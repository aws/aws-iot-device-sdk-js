/*
 * Copyright 2010-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */


/*
jobs agent error values:

ERR_DOWNLOAD_FAILED
ERR_FILE_COPY_FAILED
ERR_UNNAMED_PACKAGE
ERR_INVALID_PACKAGE_NAME
ERR_SYSTEM_CALL_FAILED
ERR_UNEXPECTED_PACKAGE_EXIT
ERR_UNABLE_TO_START_PACKAGE
ERR_UNABLE_TO_STOP_PACKAGE
ERR_UNSUPPORTED_CHECKSUM_ALGORITHM
ERR_CHECKSUM_FAILED
ERR_UNEXPECTED
*/


//node.js deps
var crypto = require('crypto');
var { exec } = require('child_process');
var fs = require('fs');
var path = require('path');

//npm deps

//package deps
var jobsModule = require('..').jobs;
var cmdLineProcess = require('./lib/cmdline');
var isUndefined = require('../common/lib/is-undefined');

var downloadFile = require('./lib/download-file');
var copyFile = require('./lib/copy-file');

const maxBackoff = 24 * 60 * 60;   // set max backoff for job subscriptions to 24 hours in seconds
const killTimout = 20;             // set timeout to kill process at 20 seconds
const startupTimout = 20;          // set timeout to start process at 20 seconds
const installedPackagesDataFileName = 'installedPackages.json';
const maxStatusDetailLength = 64;

//
// Track information about management of packages in installedPackages JSON array.
//
// General format:
// [
//   {
//      "operation":"install",
//      "packageName":"uniquePackageName",
//      "autoStart":"true",
//      "workingDirectory":"./root/directory/for/files/and/launch/command/execution",
//      "launchCommand":"command to pass to child_process exec in order to launch executable package",
//      "files":[
//         {
//            "fileName":"destinationFileName",
//            "fileSource":{
//               "url":"https://s3-example-bucket-name.s3.amazonaws.com/exampleFileName"
//            }
//         }
//      ]
//   },
//   ...
// ]
//
var installedPackages = [];

//
// Track information about running state of packages
//
var packageRuntimes = {};

//
// Private function to show jobs errors
//
function showJobsError(err) {
   if (!isUndefined(err)) {
      console.error('jobs error', err);
   }
}

//
// Private function to safely convert errors to strings
//
function errorToString(err) {
   if (isUndefined(err)) {
      return undefined;
   } else if (err.toString().length > maxStatusDetailLength) {
      return err.toString().substring(0, maxStatusDetailLength - 3) + '...';
   } else {
      return err.toString();
   }
}

//
// Private function to validate checksum
//
function validateChecksum(fileName, checksum, cb) {
   if (isUndefined(checksum) || isUndefined(checksum.hashAlgorithm)) {
      cb();
      return;
   }

   if (isUndefined(checksum.inline) || isUndefined(checksum.inline.value)) {
      cb(new Error('Installed jobs agent only supports inline checksum value provided in job document'));
      return;
   }

   var hash;
   try {
      hash = crypto.createHash(checksum.hashAlgorithm);
   } catch (err) {
      cb(new Error('Unsupported checksum hash algorithm: ' + checksum.hashAlgorithm));
      return;
   }

   var stream = fs.createReadStream(fileName);

   stream.on('data', function (data) {
      hash.update(data, 'utf8');
   }).on('end', function () {
      if (hash.digest('hex') !== checksum.inline.value) {
         var err = new Error('Checksum mismatch');
         err.fileName = fileName;
         cb(err);
      } else {
         cb();
      }
   }).on('error', function (err) {
      err.fileName = fileName;
      cb(err);
   });
}


//
// Private function to backup existing files before downloading
//
function backupFiles(job, iFile, cb) {
   if (isUndefined(cb)) {
      cb = iFile;
      iFile = 0;
   }

   if (iFile === job.document.files.length) {
      cb();
      return;
   }

   var file = job.document.files[iFile];
   if (isUndefined(file)) {
      cb(new Error('empty file specification'));
      return;
   }

   if (isUndefined(file.fileName)) {
      cb(new Error('fileName missing'));
      return;
   }

   var filePath = path.resolve(job.document.workingDirectory || '', file.fileName);
   if (!fs.existsSync(filePath)) {
      backupFiles(job, iFile + 1, cb);
      return;
   }

   job.inProgress({ operation: job.operation, step: 'backing up existing file', fileName: file.fileName }, function(err) {
      showJobsError(err);
      copyFile(filePath, filePath + '.old', function(copyFileError) {
         if (isUndefined(copyFileError)) {
            backupFiles(job, iFile + 1, cb);
         } else {
            cb(copyFileError);
         }
      });
   });
}


//
// Private function to rollback files after a failed install operation
//
function rollbackFiles(job, iFile, cb) {
   if (isUndefined(cb)) {
      cb = iFile;
      iFile = 0;
   }

   if (iFile === job.document.files.length) {
      cb();
      return;
   }

   var file = job.document.files[iFile];
   var filePath = path.resolve(job.document.workingDirectory || '', file.fileName);
   if (!fs.existsSync(filePath + '.old')) {
      rollbackFiles(job, iFile + 1, cb);
      return;
   }

   job.inProgress({ operation: job.operation, step: 'rolling back file', fileName: file.fileName }, function(err) {
      showJobsError(err);
      copyFile(filePath + '.old', filePath, function(fileErr) {
         rollbackFiles(job, iFile + 1, function(rollbackError) {
            cb(rollbackError || fileErr);
         });
      });
   });
}


//
// Private function to download specified files in sequence to temporary locations
//
function downloadFiles(job, iFile, cb) {
   if (isUndefined(cb)) {
      cb = iFile;
      iFile = 0;
   }

   if (iFile === job.document.files.length) {
      cb();
      return;
   }

   var file = job.document.files[iFile];
   var filePath = path.resolve(job.document.workingDirectory || '', file.fileName);

   if (isUndefined(file.fileSource) || isUndefined(file.fileSource.url)) {
      job.inProgress({ operation: job.operation, step: 'download error, rollback pending', fileName: file.fileName }, function(err) {
         showJobsError(err);
         cb(new Error('fileSource url missing'));
      });
      return;
   }

   job.inProgress({ step: 'downloading', fileName: file.fileName }, function(err) {
      showJobsError(err);
      downloadFile(file.fileSource.url, filePath, function(downloadError) {
         if (isUndefined(downloadError)) {
            validateChecksum(filePath, file.checksum, function(checksumError) {
               if (isUndefined(checksumError)) {
                  downloadFiles(job, iFile + 1, cb);
               } else {
                  cb(checksumError);
               }
            });
         } else {
            cb(downloadError);
         }
      });
   });
}


//
// Private function to update installed package
//
function updateInstalledPackage(updatedPackage) {
   var packageIndex = installedPackages.findIndex(function(element) {
      return (element.packageName === updatedPackage.packageName);
   });

   if (packageIndex < 0) {
      packageIndex = installedPackages.length;
      installedPackages.push(updatedPackage);
   } else {
      installedPackages[packageIndex] = updatedPackage;
   }

   fs.writeFileSync(installedPackagesDataFileName, JSON.stringify(installedPackages));
}


//
// Private function to stop managed package process
//
function stopPackage(packageName, cb) {
   var packageRuntime = packageRuntimes[packageName];

   if (isUndefined(packageRuntime) || isUndefined(packageRuntime.process)) {
      cb();
      return;
   }

   if (!isUndefined(packageRuntime.killTimer)) {
      cb(new Error('already attempting to stop package ' + packageName));
      return;
   }

   if (!isUndefined(packageRuntime.startupTimer)) {
      clearTimeout(packageRuntime.startupTimer);
      packageRuntime.startupTimer = null;
   }

   packageRuntime.killedCallback = cb;
   packageRuntime.killTimer = setTimeout(function() {
      packageRuntime.killedCallback = null;
      packageRuntime.killTimer = null;
      cb(new Error('unable to stop package ' + packageName));
   }, killTimout * 1000);

   packageRuntime.process.kill();
}


//
// Private function to stop managed package process
//
function stopPackageFromJob(job) {
   if (!isUndefined(job.document.packageName)) {
      stopPackage(job.document.packageName, function(err) {
         if (isUndefined(err)) {
            job.succeeded({ operation: job.operation, state: 'package stopped' }, showJobsError);
         } else {
            job.failed({ operation: job.operation, errorCode: 'ERR_UNABLE_TO_STOP_PACKAGE', errorMessage: errorToString(err) }, showJobsError);
         }
      });
   } else {
      job.failed({ operation: job.operation, errorCode: 'ERR_UNNAMED_PACKAGE', errorMessage: 'no packageName property specified' }, showJobsError);
   }
}


//
// Private function to start installed package
//
function startPackage(package, cb) {
   if (isUndefined(packageRuntimes[package.packageName])) {
      packageRuntimes[package.packageName] = {};
   }

   var packageRuntime = packageRuntimes[package.packageName];

   if (!isUndefined(packageRuntime.process)) {
      cb(new Error('package already running'));
      return;
   }

   packageRuntime.startupTimer = setTimeout(function() {
      packageRuntime.startupTimer = null;
      cb();
   }, startupTimout * 1000);

   packageRuntime.process = exec(package.launchCommand, { cwd: (!isUndefined(package.workingDirectory) ? path.resolve(package.workingDirectory) : undefined) }, function(err) {
      packageRuntime.process = null;
      if (!isUndefined(packageRuntime.startupTimer)) {
         clearTimeout(packageRuntime.startupTimer);
         packageRuntime.startupTimer = null;
         cb(err);
      } else if (!isUndefined(packageRuntime.killTimer)) {
         clearTimeout(packageRuntime.killTimer);
         packageRuntime.killTimer = null;
         packageRuntime.killedCallback();
         packageRuntime.killedCallback = null;
      }
   });
}


//
// Private function to start managed package process
//
function startPackageFromJob(job) {
   if (!isUndefined(job.document.packageName)) {
      var package = installedPackages.find(function(element) {
         return (element.packageName === job.document.packageName);
      });

      if (isUndefined(package)) {
         job.failed({ operation: job.operation, errorCode: 'ERR_INVALID_PACKAGE_NAME', errorMessage: 'no package installed called: ' + job.document.packageName }, showJobsError);
         return;
      }

      job.inProgress({ operation: job.operation, step: 'starting package, checking stability' }, function(err) {
         showJobsError(err);
         startPackage(package, function(err) {
            if (isUndefined(err)) {
               job.succeeded({ operation: job.operation, state: 'package started' }, showJobsError);
            } else {
               job.failed({ operation: job.operation, errorCode: 'ERR_UNABLE_TO_START_PACKAGE', errorMessage: errorToString(err) }, showJobsError);
            }
         });
      });
   } else {
      job.failed({ operation: job.operation, errorCode: 'ERR_UNNAMED_PACKAGE', errorMessage: 'no packageName property specified' }, showJobsError);
   }
}


//
// Private function to start managed package process
//
function restartPackage(job) {
   if (!isUndefined(job.document.packageName)) {
      job.inProgress({ operation: job.operation, step: 'stopping running package' }, function(err) {
         showJobsError(err);
         stopPackage(job.document.packageName, function (err) {
            if (isUndefined(err)) {
               startPackageFromJob(job);
            } else {
               job.failed({ operation: job.operation, errorCode: 'ERR_UNABLE_TO_STOP_PACKAGE', errorMessage: 'unable to stop package for restart' }, showJobsError);
            }
         });
      });
   } else {
      job.failed({ operation: job.operation, errorCode: 'ERR_UNNAMED_PACKAGE', errorMessage: 'no packageName property specified' }, showJobsError);
   }
}


//
// Private function to handle install of new files including installing or updating packages
//
function installHandler(job) {
   // Check if the install job has not yet been started
   if (job.status.status === 'QUEUED') {
      if (isUndefined(job.document.packageName)) {
         job.failed({ operation: job.operation, errorCode: 'ERR_UNNAMED_PACKAGE', errorMessage: 'installed packages must have packageName property' }, showJobsError);
         return;
      }

      if (isUndefined(job.document.files) || !(job.document.files instanceof Array) || (job.document.files.length === 0)) {
         job.failed({ operation: job.operation, errorCode: 'ERR_FILE_COPY_FAILED', errorMessage: 'files property missing or invalid' }, showJobsError);
         return;
      }

      backupFiles(job, function(backupError) {
         if (isUndefined(backupError)) {
            downloadFiles(job, function(downloadError) {
               if (isUndefined(downloadError)) {
                  if (!isUndefined(job.document.launchCommand) && job.document.autoStart) {
                     job.inProgress({ operation: job.operation, step: 'restarting package' }, function(err) {
                        showJobsError(err);
                        stopPackage(job.document.packageName, function (err) {
                           if (isUndefined(err)) {
                              startPackage(job.document, function (err) {
                                 if (isUndefined(err)) {
                                    updateInstalledPackage(job.document);
                                    job.succeeded({ operation: job.operation, state: 'package installed and started' }, showJobsError);
                                 } else {
                                    rollbackFiles(job, function(rollbackError) {
                                       if (isUndefined(rollbackError)) {
                                          var package = installedPackages.find(function(element) {
                                             return (element.packageName === job.document.packageName);
                                          });

                                          if (isUndefined(package) || isUndefined(package.autoStart) || !package.autoStart) {
                                             job.failed({ operation: job.operation, errorCode: 'ERR_UNEXPECTED_PACKAGE_EXIT', errorMessage: errorToString(err) }, showJobsError);
                                          } else {
                                             startPackage(package, function (err) {
                                                job.failed({ operation: job.operation, errorCode: 'ERR_UNEXPECTED_PACKAGE_EXIT', errorMessage: errorToString(err) }, showJobsError);
                                             });
                                          }
                                       } else {
                                          job.failed({ operation: job.operation, errorCode: 'ERR_UNEXPECTED_PACKAGE_EXIT',
                                                       errorMessage: errorToString(err), rollbackError: errorToString(rollbackError) }, showJobsError);
                                       }
                                    });
                                 }
                              });
                           } else {
                              rollbackFiles(job, function(rollbackError) {
                                 job.failed({ operation: job.operation, errorCode: 'ERR_UNABLE_TO_STOP_PACKAGE',
                                              errorMessage: 'unable to stop package for restart,' + (isUndefined(rollbackError) ? 'rollback successful' : 'rollback failed'),
                                              rollbackError: errorToString(rollbackError) }, showJobsError);
                              });
                           }
                        });
                     });
                  } else {
                     job.succeeded({ operation: job.operation, state: 'package files installed' }, showJobsError);
                  }
               } else {
                  rollbackFiles(job, function(rollbackError) {
                     job.failed({ operation: job.operation, errorCode: 'ERR_DOWNLOAD_FAILED', downloadError: errorToString(downloadError),
                                  statusCode: downloadError.statusCode, rollbackError: errorToString(rollbackError) }, showJobsError);
                  });
               }
            });
         } else {
            job.failed({ operation: job.operation, errorCode: 'ERR_FILE_COPY_FAILED', backupError: errorToString(backupError) }, showJobsError);
         }
      });
   } else {
      job.failed({ operation: job.operation, errorCode: 'ERR_UNEXPECTED', errorMessage: 'job in unexpected state' }, showJobsError);
   }
}


//
// Private function to handle gracefull shutdown operation
//
function shutdownHandler(job) {
   // Change status to IN_PROGRESS
   job.inProgress({ operation: job.operation, step: 'attempting' }, function(err) {
      showJobsError(err);

      var delay = (isUndefined(job.document.delay) ? '0' : job.document.delay.toString());

      // Check for adequate permissions to perform shutdown, use -k option to do dry run
      //
      // User account running node.js agent must have passwordless sudo access on /sbin/shutdown
      // Recommended online search for permissions setup instructions https://www.google.com/search?q=passwordless+sudo+access+instructions
      exec('sudo /sbin/shutdown -k +' + delay, function (err) {
         if (!isUndefined(err)) {
            job.failed({ operation: job.operation, errorCode: 'ERR_SYSTEM_CALL_FAILED', errorMessage: 'unable to execute shutdown, check passwordless sudo permissions on agent',
                         error: errorToString(err) }, showJobsError);
         } else {
            job.succeeded({ operation: job.operation, step: 'initiated' }, function (err) {
               showJobsError(err);
               exec('sudo /sbin/shutdown +' + delay);
            });
         }
      });
   });
}


//
// Private function to handle reboot operation
//
function rebootHandler(job) {
   // Check if the reboot job has not yet been initiated
   if (job.status.status === 'QUEUED' ||
       isUndefined(job.status.statusDetails) ||
       isUndefined(job.status.statusDetails.step)) {

      // Change status to IN_PROGRESS
      job.inProgress({ operation: job.operation, step: 'initiated' }, function(err) {
         showJobsError(err);

         var delay = (isUndefined(job.document.delay) ? '0' : job.document.delay.toString());

         // User account running node.js agent must have passwordless sudo access on /sbin/shutdown
         // Recommended online search for permissions setup instructions https://www.google.com/search?q=passwordless+sudo+access+instructions
         exec('sudo /sbin/shutdown -r +' + delay, function (err) {
            if (!isUndefined(err)) {
               job.failed({ operation: job.operation, errorCode: 'ERR_SYSTEM_CALL_FAILED', errorMessage: 'unable to execute reboot, check passwordless sudo permissions on agent',
                            error: errorToString(err) }, showJobsError);
            }
         });
      });

   // Check if the reboot operation has already been successfully initiated
   } else if (job.status.statusDetails.step === 'initiated') {
      job.succeeded({ operation: job.operation, step: 'rebooted' }, showJobsError);
   } else {
      job.failed({ operation: job.operation, errorCode: 'ERR_UNEXPECTED', errorMessage: 'reboot job execution in unexpected state' }, showJobsError);
   }
}


//
// Private function to handle systemStatus operation
//
function systemStatusHandler(job) {
   var packageNames = '[';

   for (var i = 0; i < installedPackages.length; i++) {
      packageNames += installedPackages[i].packageName + ((i !== installedPackages.length - 1) ? ', ' : '');
   }
   packageNames += ']';

   job.succeeded({
      operation: job.operation,
      installedPackages: packageNames,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
      platform: process.platform,
      title: process.title,
      uptime: process.uptime()
   }, showJobsError);
}


//begin module

function jobsAgent(args) {
   //
   // The jobs module exports an MQTT instance, which will attempt
   // to connect to the AWS IoT endpoint configured in the arguments.
   // Once connected, it will emit events which our package can
   // handle.
   //
   const jobs = jobsModule({
      keyPath: args.privateKey,
      certPath: args.clientCert,
      caPath: args.caCert,
      clientId: args.clientId,
      region: args.region,
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      thingName: args.thingName,
      debug: args.Debug
   });

   jobs
      .on('connect', function() {
         console.log('agent connected');
      });
   jobs
      .on('close', function() {
         console.log('agent connection closed');
      });
   jobs
      .on('reconnect', function() {
         console.log('agent reconnected');
      });
   jobs
      .on('offline', function() {
         console.log('agent connection offline');
      });
   jobs
      .on('error', function(error) {
         console.log('agent connection error', error);
      });
   jobs
      .on('message', function(topic, payload) {
         console.log('agent message received', topic, payload.toString());
      });

   function subscribeToJobsWithRetryOnError(thingName, operationName, handler, backoff) {
      jobs.subscribeToJobs(thingName, operationName, function(err, job) {
         if (isUndefined(err)) {
            if ((!isUndefined(args.Debug)) && (args.Debug === true)) {
               console.log('job execution handler invoked:', { thingName: thingName, operationName: operationName });
            }
            handler(job);
            backoff = 1;   // reset backoff upon successful job receipt
         } else {
            // on error attempt to resubscribe with increasing backoff
            if (isUndefined(backoff)) {
               backoff = 1;
            }
            setTimeout(function() {
               subscribeToJobsWithRetryOnError(thingName, operationName, handler, Math.min(backoff * 2, maxBackoff));
            }, backoff * 1000);
         }
      });
   }

   subscribeToJobsWithRetryOnError(args.thingName, 'shutdown', shutdownHandler);
   subscribeToJobsWithRetryOnError(args.thingName, 'reboot', rebootHandler);
   subscribeToJobsWithRetryOnError(args.thingName, 'install', installHandler);
   subscribeToJobsWithRetryOnError(args.thingName, 'systemStatus', systemStatusHandler);
   subscribeToJobsWithRetryOnError(args.thingName, 'stop', stopPackageFromJob);
   subscribeToJobsWithRetryOnError(args.thingName, 'start', startPackageFromJob);
   subscribeToJobsWithRetryOnError(args.thingName, 'restart', restartPackage);

   jobs.startJobNotifications(args.thingName, function(err) {
      if (isUndefined(err)) {
         console.log('startJobNotifications completed for thing: ' + args.thingName);
      }
      else {
         console.error(err);
      }
   });

   try {
      installedPackages = JSON.parse(fs.readFileSync(installedPackagesDataFileName, 'utf8'));
      if (!(installedPackages instanceof Array)) {
         throw new Error('invalid file:' + installedPackagesDataFileName);
      }
   } catch (err) {
      // unable to read installedPackages file, initializing to empty array
      installedPackages = [];
   }

   for (var i = 0; i < installedPackages.length; i++) {
      if (!isUndefined(installedPackages[i].launchCommand) &&
          (isUndefined(installedPackages[i].autoStart) || installedPackages[i].autoStart)) {
         startPackage(installedPackages[i], console.error);
      }
   }
}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and manage installation of packages and running programs',
      process.argv.slice(2), jobsAgent);
}


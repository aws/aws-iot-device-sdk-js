/*
 * Copyright 2010-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

//node.js deps

//npm deps

//app deps
const jobsModule   = require('..').jobs;
const cmdLineProcess = require('../examples/lib/cmdline');
const isUndefined    = require('../common/lib/is-undefined.js');
const awsSDK = require('aws-sdk');
awsSDK.config.update({ "accessKeyId": process.env.JOBS_AWS_ACCESS_KEY_ID, "secretAccessKey": process.env.JOBS_AWS_SECRET_ACCESS_KEY, "region": "us-east-1" });

var iot = new awsSDK.Iot();

//begin module

function processTest( args, argsRemaining ) {
//
// Use the command line flag '--thing-name | -T' to pass in a topic
// prefix; this allows us to run multiple copies of this test simultaneously
// within the same AWS account
//

var topicPrefix = args.thingName;
var thingName = args.thingName;
var integrationTestTopic = 'jobsIntegrationTestTopic';
var preRegisteredThingName = 'testThing1';

if (!isUndefined(topicPrefix)) {
   integrationTestTopic=topicPrefix+'/'+integrationTestTopic;
}

//
// The jobs module exports an MQTT instance, which will attempt
// to connect to the AWS IoT endpoint configured in the arguments.
// Once connected, it will emit events which our application can
// handle.
//
const jobs = jobsModule({
  keyPath: args.privateKey,
  certPath: args.clientCert,
  caPath: args.caCert,
  clientId: args.clientId,
  region: args.region,
  reconnectPeriod: args.reconnectPeriod,
  protocol: args.Protocol,
  port: args.Port,
  host: args.Host,
  debug: args.Debug
});

var timeout;
var value=1;
var count=1;
var accumulator=0;
var jobCount=5;
var jobCompletedCount=0;

function checkAccumulator()
{
  console.log('checkAccumulator');
//
// Check the accumulator to see how many messages were received from the
// partner process via the MQTT passthrough.
//
   var i, messages = 0, accSave=accumulator;
   for (i = 0; i < 48; i++)
   {
      if (accumulator & 1)
      {
         messages++;
      }
      accumulator = accumulator>>1;
   }
   console.log(messages+' messages received, accumulator='+accSave.toString(16));
   console.log(jobCompletedCount+' jobs completed');
}

function handleJob(err, job)
{
  if (isUndefined(err)) {
    console.log('received job: ' + JSON.stringify(job.document));
    job.inProgress(function(err) {
      if (isUndefined(err)) {
        var jobFunction = job.succeeded;
        if (job.document.jobNum & 1) {
          jobFunction = job.failed;
        }

        jobFunction(function(err) {
          if (!isUndefined(err)) {
            console.log(err);
          }
        });
      } else {
        console.log(err);
      }
    });
  } else {
    console.log(err);
  }
}

//
// Do a simple publish/subscribe demo based on the test-mode passed
// in the command line arguments.
//
jobs
  .on('connect', function() {
    const minimumDelay=250;
    console.log('connect');
    if (args.testMode === 2)
    {
        jobs.subscribe(integrationTestTopic);
        for (var i = 0; i < jobCount - 1; i++) {
          jobs.subscribeToJobs(preRegisteredThingName, 'test' + i.toString(), handleJob);
        } 

        jobs.subscribeToJobs(preRegisteredThingName, handleJob);

        jobs.startJobNotifications(preRegisteredThingName);
    }
    else
    {
        var jobIdPrefix = 'test-job-id-' + (Math.floor(Math.random() * 99999999)).toString();

        for (var i = 0; i < jobCount; i++) {
          iot.createJob({ jobId: jobIdPrefix + '-' + i.toString(), targets: [ 'arn:aws:iot:us-east-1:809478692717:thing/' + preRegisteredThingName ], document: '{ "operation":"test' + i.toString() + '", "jobNum": ' + i.toString() + ' }' }, function(err, data) {
            console.log('createJob:');
            if (isUndefined(err)) {
              console.log(data);
            } else {
              console.log(err);
            }
          });
        }

// 
// Test device messaging through jobs module
//
        if ((Math.max(args.delay,minimumDelay) ) !== args.delay)
        {
            console.log( 'substituting '+ minimumDelay + 'ms delay for ' + args.delay + 'ms...' );
        }

        setTimeout( function() {
          function checkJobExecutions(jobNum) {
            if (jobNum < jobCount) {
              console.log('checking execution status on ' + preRegisteredThingName + ' for job: ' + jobIdPrefix + '-' + jobNum.toString());
              iot.describeJobExecution({ thingName: preRegisteredThingName, jobId: jobIdPrefix + '-' + jobNum.toString() }, function(err, data) {
                if (!isUndefined(data) && !isUndefined(data.execution) &&
                	((jobNum & 1) ? data.execution.status === 'FAILED' : (data.execution.status === 'SUCCESS' || data.execution.status === 'SUCCEEDED'))) {
                  jobCompletedCount++;
                }

                console.log('cancelling job ' + jobIdPrefix + '-' + jobNum.toString() + ' to prevent leaving orphan jobs');
                iot.cancelJob({ jobId: jobIdPrefix + '-' + jobNum.toString() });

                checkJobExecutions(jobNum + 1);
              });
            }
          }

          console.log( 'tally completed job executions' );
          checkJobExecutions(0);
        }, 15000);

        timeout = setInterval( function() {
                console.log('publishing value='+value+' on \''+integrationTestTopic+'\'');
                jobs.publish(integrationTestTopic, JSON.stringify({
                value: value }), { qos: 1 });

//
// After 48 publishes, exit the process.  This number is chosen as it's the last power of 2 less
// than 53 (the mantissa size for Node's native floating point numbers).
//
                value=value*2;
                count++;
                if (count >= 48)
                {
                    jobs.publish(integrationTestTopic, JSON.stringify({ quit: 1, jobCompletedCount: jobCompletedCount }), function() {
                      setTimeout( function() { process.exit(0); }, 500);
                    });
                }
        }, Math.max(args.delay,minimumDelay) );  // clip to minimum
    }
    });
jobs 
  .on('close', function() {
    console.log('close');
    process.exit(1);
  });
jobs 
  .on('reconnect', function() {
    console.log('reconnect');
    process.exit(1);
  });
jobs 
  .on('offline', function() {
    console.log('offline');
    process.exit(1);
  });
jobs
  .on('error', function(error) {
    console.log('error', error);
    process.exit(1);
  });
jobs
  .on('message', function(topic, payload) {
    
    var stateObject = JSON.parse( payload.toString() );
    console.log('received on \''+topic+'\': '+payload.toString());
    if (!isUndefined( stateObject.value ))
    {
       accumulator+=stateObject.value;
    }
    if (!isUndefined(stateObject.quit))
    {
       jobCompletedCount = (!isUndefined(stateObject.jobCompletedCount) ? stateObject.jobCompletedCount : 0);
       checkAccumulator();
       setTimeout( function() { process.exit(0); }, 500 );
    }
  });

}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and publish/subscribe to topics using MQTT, test modes 1-2',
                 process.argv.slice(2), processTest );
}


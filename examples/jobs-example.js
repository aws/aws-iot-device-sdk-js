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
const jobsModule = require('..').jobs;
const cmdLineProcess = require('./lib/cmdline');
const isUndefined = require('../common/lib/is-undefined');

//begin module

function processTest(args) {
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
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug
   });

   jobs
      .on('connect', function() {
         console.log('connect');
      });
   jobs
      .on('close', function() {
         console.log('close');
      });
   jobs
      .on('reconnect', function() {
         console.log('reconnect');
      });
   jobs
      .on('offline', function() {
         console.log('offline');
      });
   jobs
      .on('error', function(error) {
         console.log('error', error);
      });
   jobs
      .on('message', function(topic, payload) {
         console.log('message', topic, payload.toString());
      });

   jobs.subscribe('testTopic');

   if (args.thingName) {
      jobs.subscribeToJobs(args.thingName, 'customJob', function(err, job) {
         if (isUndefined(err)) {
            console.log('customJob operation handler invoked, jobId: ' + job.id.toString());

            //
            // Indicate to AWS IoT Jobs manager that the job execution is in progress of being processed
            //
            job.inProgress({ operation: 'customJob', step: 'step 1 of customJob' }, function(err) {
               //
               // Do some work...
               //

               //
               // Indicate to AWS IoT Jobs manager that the job execution is successfully completed
               //
               job.succeeded({ operation: 'customJob', step: 'finished all steps' }, function(err) {  });
            });
         }
         else {
            console.error(err);
         }
      });

      jobs.subscribeToJobs(args.thingName, function(err, job) {
         if (isUndefined(err)) {
            console.log('default job handler invoked, jobId: ' + job.id.toString());

            //
            // Indicate to AWS IoT Jobs manager that the job execution failed
            //
            job.failed({ operation: job.operation, errorCondition: 'not yet implemented' }, function(err) {  });
         }
         else {
            console.error(err);
         }
      });

      jobs.startJobNotifications(args.thingName, function(err) {
         if (isUndefined(err)) {
            console.log('startJobNotifications completed for thing: ' + args.thingName);
         }
         else {
            console.error(err);
         }
      });
   }

}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and publish/subscribe to topics using MQTT, test modes 1-2',
      process.argv.slice(2), processTest);
}


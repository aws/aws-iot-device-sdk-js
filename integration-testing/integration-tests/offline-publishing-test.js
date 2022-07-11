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
const deviceModule = require('..').device;
const cmdLineProcess = require('../examples/lib/cmdline');
const isUndefined    = require('../common/lib/is-undefined.js');

const RECEIVER_TIMEOUT_DELAY = 60000;
const TOTAL_MESSAGES_TO_SEND = 1000;
const RECONNECTS_BEFORE_FAILURE = 3;

//begin module

function processTest(args) {
   //
   // Use the command line flag '--thing-name | -T' to pass in a topic
   // prefix; this allows us to run multiple copies of this test simultaneously
   // within the same AWS account
   //
   var topicPrefix = args.thingName;
   var offlinePublishTestTopic = 'offlinePublishTestTopic';

   if (!isUndefined(topicPrefix)) {
      offlinePublishTestTopic=topicPrefix+'/'+offlinePublishTestTopic;
   }

   var customAuthHeaders;
   var region = args.region;

   if(args.Protocol === 'wss-custom-auth') {
      customAuthHeaders = JSON.parse(process.env.CUSTOM_AUTH_HEADERS);
      region = 'us-west-2';
   }

   //
   // The device module exports an MQTT instance, which will attempt
   // to connect to the AWS IoT endpoint configured in the arguments.
   // Once connected, it will emit events which our application can
   // handle.
   //
   const device = deviceModule({
      keyPath: args.privateKey,
      certPath: args.clientCert,
      caPath: args.caCert,
      clientId: args.clientId,
      region: region,
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      drainTimeMs: 35,
      offlineQueueing: true,
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug,
      customAuthHeaders: customAuthHeaders
   });
   var receiveCount = 0;
   var outOfOrderCount = 0;
   var connectCount = 0;
   var quitTimeout;
   var expectedSum = 0;
   var actualSum = 0;

   var reconnectsSinceLastSuccessfulConnect = 0;

   function receiverExitWithError() {
      console.log('No messages received in the past ' + RECEIVER_TIMEOUT_DELAY + ' ms, exiting test');
      process.exit(1);
   }

   if (args.testMode === 1) {
      //
      // This process is the receiver
      //
      var noMessageReceivedTimeout;
      noMessageReceivedTimeout = setTimeout(receiverExitWithError, RECEIVER_TIMEOUT_DELAY);
      device.subscribe(offlinePublishTestTopic);
   } else {
      var publishTimeout;
      var disconnectTimeout;
      var transmitCount = 0;
      const minimumDelay = 100;

      if ((Math.max(args.delay, minimumDelay)) !== args.delay) {
         console.log('substituting ' + minimumDelay + 'ms delay for ' + args.delay + 'ms...');
      }
      publishTimeout = setInterval(function() {
         transmitCount++;
         device.publish(offlinePublishTestTopic, JSON.stringify({
            value: transmitCount
         }));
         if(transmitCount > TOTAL_MESSAGES_TO_SEND) {
            clearInterval(publishTimeout);
            setTimeout( function() {
               process.exit(0); }, 500);
         }
      }, Math.max(args.delay, minimumDelay)); // clip to minimum
   }

   device
      .on('connect', function() {
         connectCount++;
         reconnectsSinceLastSuccessfulConnect = 0;
         if (args.testMode === 2) {
            if (connectCount < 10) {
               disconnectTimeout = setTimeout(function() {
                  console.log("Connect count: " + connectCount);
                  device.simulateNetworkFailure();
               }, 20000); // disconnect us every 20 seconds
            } else {
               quitTimeout = setTimeout(function() {
                  device.publish(offlinePublishTestTopic, JSON.stringify({
                     value: 'quit'
                  }), {
                     qos: 0
                  });
                  setTimeout(function() {
                     process.exit(0);
                  }, 1500);
               }, 10000); /* run the test for just under 10 additional seconds */
            }
         }
         console.log('connect');
      });
   device
      .on('close', function() {
         console.log('close');
      });
   device
      .on('reconnect', function() {
         console.log('reconnect');
         reconnectsSinceLastSuccessfulConnect++;
         if(reconnectsSinceLastSuccessfulConnect > RECONNECTS_BEFORE_FAILURE) {
            console.log('attempted to reconnect too many times');
            process.exit(2);
         }
      });
   device
      .on('offline', function() {
         console.log('offline');
      });
   device
      .on('error', function(error) {
         console.log('error', error);
      });
   device
      .on('message', function(topic, payload) {
         if (args.testMode === 1) {
            var obj = JSON.parse(payload.toString());
            if (obj.value === 'quit') {
               var errorRate = (expectedSum / actualSum);

               console.log('quality (closer to 1.0 = fewer drops): ' + errorRate.toFixed(6));
               setTimeout(function() {
                  process.exit(0);
               }, 500);
            } else {
               receiveCount++;
               expectedSum += receiveCount;
               actualSum += obj.value;
               if (obj.value !== receiveCount) {
                  outOfOrderCount++;
               }
               clearTimeout(noMessageReceivedTimeout);
               noMessageReceivedTimeout = setTimeout(receiverExitWithError, RECEIVER_TIMEOUT_DELAY);
            }
         }
         console.log('message', topic, payload.toString());
      });
}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and publish/subscribe to topics using MQTT, test modes 1-2',
      process.argv.slice(2), processTest);
}

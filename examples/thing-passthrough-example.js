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
const thingShadow = require('..').thingShadow;
const cmdLineProcess = require('./lib/cmdline');
const isUndefined = require('../common/lib/is-undefined');

//begin module

//
// This test demonstrates the use of thing shadows along with
// non-thing topics.  One process updates a thing shadow and
// subscribes to a non-thing topic; the other receives delta
// updates on the thing shadow on publishes to the non-thing
// topic.
//
function processTest(args) {
   //
   // Instantiate the thing shadow class.
   //
   const thingShadows = thingShadow({
      keyPath: args.privateKey,
      certPath: args.clientCert,
      caPath: args.caCert,
      clientId: args.clientId,
      region: args.region,
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug
   });

   //
   // Operation timeout in milliseconds
   //
   const operationTimeout = 10000;

   const thingName = 'thingShadow1';
   const nonThingName = 'nonThingTopic1';

   //
   // The current operation count
   //
   var count = 1;

   var currentTimeout = null;

   //
   // For convenience, use a stack to keep track of the current client
   // token; in this example app, this should never reach a depth of more
   // than a single element, but if your application uses multiple thing
   // shadows simultaneously, you'll need some data structure to correlate
   // client tokens with their respective thing shadows.
   //
   var stack = [];

   function genericOperation(operation, state) {
      var clientToken = thingShadows[operation](thingName, state);
      if (clientToken === null) {
         //
         // The thing shadow operation can't be performed because another one
         // is pending; if no other operation is pending, reschedule it after an
         // interval which is greater than the thing shadow operation timeout.
         //
         if (currentTimeout !== null) {
            console.log('operation in progress, scheduling retry...');
            currentTimeout = setTimeout(
               function() {
                  genericOperation(operation, state);
               },
               operationTimeout * 2);
         }
      } else {
         //
         // Save the client token so that we know when the operation completes.
         //
         stack.push(clientToken);
      }
   }

   function generateState() {
      return {
         state: {
            desired: {
               value: count++
            }
         }
      };
   }

   function thingUpdateeConnect() {
      //
      // This process receives deltas from the thing shadow and publishes the
      // data to the non-thing topic.
      //
      thingShadows.register(thingName, {
         ignoreDeltas: false
      });
   }

   function thingUpdaterConnect() {
      //
      // This process updates the thing shadow and subscribes to the non-thing
      // topic.
      //
      thingShadows.register(thingName, {
         ignoreDeltas: true
      }, function(err, failedTopics) {
            if (isUndefined(err) && isUndefined(failedTopics)) {
               genericOperation('update', generateState());
               thingShadows.subscribe(nonThingName);
            }
         });
   }

   if (args.testMode === 1) {
      thingUpdateeConnect();
   } else {
      thingUpdaterConnect();
   }

   function handleStatus(thingName, stat, clientToken, stateObject) {
      var expectedClientToken = stack.pop();

      if (expectedClientToken === clientToken) {
         console.log('got \'' + stat + '\' status on: ' + thingName);
      } else {
         console.log('(status) client token mismtach on: ' + thingName);
      }

      if (args.testMode === 2) {
         console.log('updated state to thing shadow');
         //
         // If no other operation is pending, restart it after 10 seconds.
         //
         if (currentTimeout === null) {
            currentTimeout = setTimeout(function() {
               currentTimeout = null;
               genericOperation('update', generateState());
            }, 10000);
         }
      }
   }

   function handleDelta(thingName, stateObject) {
      if (args.testMode === 2) {
         console.log('unexpected delta in device mode: ' + thingName);
      } else {
         console.log('received delta on ' + thingName +
            ', publishing on non-thing topic...');
         thingShadows.publish(nonThingName,
            JSON.stringify({
               message: 'received ' +
                  JSON.stringify(stateObject.state)
            }));
      }
   }

   function handleTimeout(thingName, clientToken) {
      var expectedClientToken = stack.pop();

      if (expectedClientToken === clientToken) {
         console.log('timeout on: ' + thingName);
      } else {
         console.log('(timeout) client token mismtach on: ' + thingName);
      }

      if (args.testMode === 2) {
         genericOperation('update', generateState());
      }
   }

   function handleMessage(topic, payload) {
      console.log('received on \'' + topic + '\': ' + payload.toString());
   }

   thingShadows.on('connect', function() {
      console.log('connected to AWS IoT');
   });

   thingShadows.on('close', function() {
      console.log('close');
      thingShadows.unregister(thingName);
   });

   thingShadows.on('reconnect', function() {
      console.log('reconnect');
   });

   thingShadows.on('offline', function() {
      //
      // If any timeout is currently pending, cancel it.
      //
      if (currentTimeout !== null) {
         clearTimeout(currentTimeout);
         currentTimeout = null;
      }
      //
      // If any operation is currently underway, cancel it.
      //
      while (stack.length) {
         stack.pop();
      }
      console.log('offline');
   });

   thingShadows.on('error', function(error) {
      console.log('error', error);
   });

   thingShadows.on('message', function(topic, payload) {
      console.log('message', topic, payload.toString());
   });

   thingShadows.on('status', function(thingName, stat, clientToken, stateObject) {
      handleStatus(thingName, stat, clientToken, stateObject);
   });

   thingShadows.on('delta', function(thingName, stateObject) {
      handleDelta(thingName, stateObject);
   });

   thingShadows.on('timeout', function(thingName, clientToken) {
      handleTimeout(thingName, clientToken);
   });

   thingShadows.on('message', function(topic, payload) {
      handleMessage(topic, payload);
   });
}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and demonstrate thing shadow APIs, test modes 1-2',
      process.argv.slice(2), processTest);
}

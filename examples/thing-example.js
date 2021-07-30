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
// Simulate the interaction of a mobile device and a remote thing via the
// AWS IoT service.  The remote thing will be a dimmable color lamp, where
// the individual RGB channels can be set to an intensity between 0 and 255.
// One process will simulate each side, with testMode being used to distinguish
// between the mobile app (1) and the remote thing (2).  The remote thing
// will update its state periodically using an 'update thing shadow' operation,
// and the mobile device will listen to delta events to receive the updated
// state information.
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
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug
   });

   //
   // Operation timeout in milliseconds
   //
   const operationTimeout = 10000;

   const thingName = 'RGBLedLamp';

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

   function generateRandomState() {
      var rgbValues = {
         red: 0,
         green: 0,
         blue: 0
      };

      rgbValues.red = Math.floor(Math.random() * 255);
      rgbValues.green = Math.floor(Math.random() * 255);
      rgbValues.blue = Math.floor(Math.random() * 255);

      return {
         state: {
            desired: rgbValues
         }
      };
   }

   function mobileAppConnect() {
      thingShadows.register(thingName, {
            ignoreDeltas: false
         },
         function(err, failedTopics) {
            if (isUndefined(err) && isUndefined(failedTopics)) {
               console.log('Mobile thing registered.');
            }
         });
   }

   function deviceConnect() {
      thingShadows.register(thingName, {
            ignoreDeltas: true
         },
         function(err, failedTopics) {
            if (isUndefined(err) && isUndefined(failedTopics)) {
               console.log('Device thing registered.');
               genericOperation('update', generateRandomState());
            }
         });
   }

   if (args.testMode === 1) {
      mobileAppConnect();
   } else {
      deviceConnect();
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
               genericOperation('update', generateRandomState());
            }, 10000);
         }
      }
   }

   function handleDelta(thingName, stateObject) {
      if (args.testMode === 2) {
         console.log('unexpected delta in device mode: ' + thingName);
      } else {
         console.log('delta on: ' + thingName + JSON.stringify(stateObject));
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
         genericOperation('update', generateRandomState());
      }
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
}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and demonstrate thing shadow APIs, test modes 1-2',
      process.argv.slice(2), processTest);
}

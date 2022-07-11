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
const cmdLineProcess = require('../examples/lib/cmdline');
const isUndefined    = require('../common/lib/is-undefined.js');

//begin module

//
// This integration test runs as two processes and uses the example program
// command line flags for configuration.  One process (-t 1) updates a thing shadow
// and subscribes to an MQTT topic; the other (-t 2) listens to deltas on the thing
// shadow and publishes to the MQTT topic.  The mode 1 process sends a value with
// each update and doubles it afterwards; the mode 2 process publishes this value
// back to the mode 1 process.  Each process adds the value received in an 
// accumulator.  After the mode 1 process has sent 48 messages, it prepares to exit
// and sends a 'quit' command on the thing shadow which forces the mode 2 process 
// to enter its exit logic.  As both processes exit, they count the number of bits
// set in their accumulators.  This test verifies that thing shadow update and
// deltas are working as well as non-thing publish and subscribe.  Since actual
// values are used in the test, it verifies that simple state objects are 
// transferred correctly, and because it maintains a bitmask of received values it
// allows for some messages to be lost due to QOS:0.  A passing integration test
// here should probably expect >90% of the messages to be received on both sides.
//
// NOTE: The mode 1 process needs to be started first, and the mode 2 process
// started less than 10 seconds later.
//
// NOTE: 48 is used as the number of messages here because it's the last power of
// 2 less than 53, which is the mantissa size of Node's native number type (64-bit
// float).
//

function processTest( args, argsRemaining ) {
//
// Use the command line flag '--thing-name | -T' to pass in a thing name/topic
// prefix; this allows us to run multiple copies of this test simultaneously
// within the same AWS account
//
var topicPrefix = args.thingName;
var integrationTestTopic = 'integrationTestTopic';
var integrationTestShadow = 'integrationTestShadow';

if (!isUndefined(topicPrefix)) {
   integrationTestTopic=topicPrefix+'/'+integrationTestTopic;
}

if (!isUndefined(topicPrefix)) {
   integrationTestShadow=topicPrefix+'-'+integrationTestShadow;
}

var customAuthHeaders;
var region = args.region;

if(args.Protocol === 'wss-custom-auth') {
  customAuthHeaders = JSON.parse(process.env.CUSTOM_AUTH_HEADERS);
  region = 'us-west-2';
}

//
// Instantiate the thing shadow class.
//
const thingShadows = thingShadow({
  keyPath: args.privateKey,
  certPath: args.clientCert,
  caPath: args.caCert,
  clientId: args.clientId,
  region: region,
  reconnectPeriod: args.reconnectPeriod,
  protocol: args.Protocol,
  port: args.Port,
  host: args.Host,
  debug: args.Debug,
  customAuthHeaders: customAuthHeaders
});

var value=1;
var count=1;
var clientToken;
var timer;

var accumulator=0;

function checkAccumulator()
{
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
}

//
// This test demonstrates the use of thing shadows along with 
// non-thing topics.  One process updates a thing shadow and
// subscribes to a non-thing topic; the other receives delta
// updates on the thing shadow on publishes to the non-thing
// topic.
//
function updateThingShadow( )
{
   if (count < 48)
   {
      console.log('updating thing shadow...');
      clientToken = thingShadows.update( integrationTestShadow, 
                       { state: { desired: { value: value, quit: 0 }}} );
      value = value*2;
      count++;
   }
   else
   {
       checkAccumulator();
//
// Tell the partner to exit.
//
      clientToken = thingShadows.update( integrationTestShadow, 
                       { state: { desired: { value: value, quit: 1 }}} );
      setTimeout( function() { process.exit(0); }, 500 );
   }
}

thingShadows
  .on('connect', function() {
       console.log('connected to things instance, registering thing name');

       if (args.testMode === 1)
       {
//
// This process will update a thing shadow and subscribe to a non-
// thing topic.
//
          thingShadows.register( integrationTestShadow, { ignoreDeltas: true } );
          console.log('subscribing to non-thing topic');
          thingShadows.subscribe( integrationTestTopic );
//
// Start updating after 10 seconds.
//
          timer = setInterval( function() {
             updateThingShadow();
          }, 10000 );
       }
       else
       {
//
// This process will listen to deltas on a thing shadow and publish to a 
// non-thing topic.
//
          thingShadows.register( integrationTestShadow );
       }
    });
thingShadows 
  .on('close', function() {
    console.log('close');
    process.exit(1);
  });
thingShadows 
  .on('reconnect', function() {
    console.log('reconnect');
    process.exit(1);
  });
thingShadows 
  .on('offline', function() {
    console.log('offline');
    process.exit(1);
  });
thingShadows
  .on('error', function(error) {
    console.log('error', error);
    process.exit(1);
  });
thingShadows
  .on('message', function(topic, payload) {
    console.log('received on \''+topic+'\': '+ payload.toString());
    accumulator += JSON.parse( payload.toString() ).value;
    clearInterval( timer );
//
// After a few seconds, update the thing shadow and if no message has 
// been received after 10 seconds, try again.
//
    setTimeout( function() {
       updateThingShadow();
       timer = setInterval( function() {
          updateThingShadow();
       }, 10000 );
    }, args.delay );

  });
//
// Only the second process is interested in delta events.
//
if (args.testMode===2)
{
   thingShadows
     .on('delta', function(thingName, stateObject) {
 
        console.log('received delta, state='+JSON.stringify( stateObject.state));

        if (!stateObject.state.quit)
        {
           thingShadows.publish( integrationTestTopic, JSON.stringify(stateObject.state));
           accumulator += stateObject.state.value;
        }
        else
        {
           checkAccumulator();
//
// Our partner has told us the test has ended; it's our responsibility to delete
// the shadow afterwards and then exit ourselves.
//
           setTimeout( function() { 
              thingShadows.delete( integrationTestShadow ); 
              setTimeout( function() { process.exit(0); }, 500 ); }, 500 );
        }
     });
}

thingShadows
  .on('status', function(thingName, statusType, clientToken, stateObject) {
     if (statusType !== 'accepted')
     {
//
// This update wasn't accepted; do a get operation to re-sync.  Wait
// a few seconds, then get the thing shadow to re-sync; restart the
// interval timer.
//
        clearInterval( timer );

        console.log('status: '+statusType+', state: '+
                    JSON.stringify(stateObject));
        setTimeout( function() {
           clientToken = thingShadows.get( integrationTestShadow );
           timer = setInterval( function() {
              updateThingShadow();
           }, 10000 );
        }, args.delay );
     }
  });
}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and demonstrate thing shadow APIs, test modes 1-2',
                 process.argv.slice(2), processTest );
}



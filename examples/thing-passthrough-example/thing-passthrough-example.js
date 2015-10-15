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
const thingShadow = require('../..').thingShadow;
const cmdLineProcess   = require('../commonLib/cmdline');

//begin module

function processTest( args, argsRemaining ) {
//
// Instantiate the thing shadow class.
//
const thingShadows = thingShadow({
  keyPath: args.privateKey,
  certPath: args.clientCert,
  caPath: args.caCert,
  clientId: args.clientId,
  region: args.region,
  reconnectPeriod: args.reconnectPeriod,
});

var count=1;
var clientToken;
var timer;

//
// This test demonstrates the use of thing shadows along with 
// non-thing topics.  One process updates a thing shadow and
// subscribes to a non-thing topic; the other receives delta
// updates on the thing shadow on publishes to the non-thing
// topic.
//
function updateThingShadow( )
{
   console.log('updating thing shadow...');
   clientToken = thingShadows.update( 'thingShadow1', 
                       { state: { desired: { value: count++ }}} );
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
          thingShadows.register( 'thingShadow1', { ignoreDeltas: true } );
          console.log('subscribing to non-thing topic');
          thingShadows.subscribe( 'nonThingTopic1' );
//
// Begin by updating the state on the thing shadow; this will start the 
// exchange between the two processes.
//
          setTimeout( updateThingShadow(), 3000 );
//
// If no message has been received after 10 seconds, try again.
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
          thingShadows.register( 'thingShadow1' );
       }
    });
thingShadows 
  .on('close', function() {
    console.log('close');
    thingShadows.unregister( 'thingShadow1' );
    if (args.testMode === 1)
    {
       clearInterval( timer );
       timer=null;
    }
  });
thingShadows 
  .on('reconnect', function() {
    console.log('reconnect');
    if (args.testMode === 1)
    {
       thingShadows.register( 'thingShadow1', { ignoreDeltas: true } );
       thingShadows.subscribe( 'nonThingTopic1' );
//
// Begin by updating the state on the thing shadow; this will start the 
// exchange between the two processes.
//
       setTimeout( updateThingShadow(), 3000 );
//
// If no message has been received after 10 seconds, try again.
//
       timer = setInterval( function() {
          updateThingShadow();
       }, 10000 );
    }
    else
    {
       thingShadows.register( 'thingShadow1' );
    }
  });
thingShadows 
  .on('offline', function() {
    console.log('offline');
  });
thingShadows
  .on('error', function(error) {
    console.log('error', error);
  });
thingShadows
  .on('message', function(topic, payload) {
    console.log('received on \''+topic+'\': '+ payload.toString());
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
    }, 3000 );

  });
//
// Only the second process is interested in delta events.
//
if (args.testMode===2)
{
   thingShadows
     .on('delta', function(thingName, stateObject) {
         console.log('received delta on '+thingName+', publishing on non-thing topic...');
         thingShadows.publish( 'nonThingTopic1', 
                               JSON.stringify({ message: 'received '+
                                 JSON.stringify(stateObject.state) } ));
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
           clientToken = thingShadows.get( 'thingShadow1' );
           timer = setInterval( function() {
              updateThingShadow();
           }, 10000 );
        }, 3000 );
     }
  });
}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and demonstrate thing shadow APIs, test modes 1-2',
                 process.argv.slice(2), processTest );
}


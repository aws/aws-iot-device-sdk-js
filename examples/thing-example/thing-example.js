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
const isUndefined = require('../../common/lib/is-undefined');
const cmdLineProcess   = require('../commonLib/cmdline');

//begin module

function processTest( args, argsRemaining ) {
//
// The thing module exports the thing class through which we
// can register and unregister interest in thing shadows, perform
// update/get/delete operations on them, and receive delta updates
// when the cloud state differs from the device state.
//
const thingShadows = thingShadow({
  keyPath: args.privateKey,
  certPath: args.clientCert,
  caPath: args.caCert,
  clientId: args.clientId,
  region: args.region,
  reconnectPeriod: args.reconnectPeriod,
});

//
// Track operations in here using clientTokens as indices.
//
var operationCallbacks = { };

var role='DEVICE';

if (args.testMode===1)
{
   role='MOBILE APP'
}
var rgbValues={ red: 0, green: 0, blue: 0 };

var mobileAppOperation='update';
//
// Simulate the interaction of a mobile device and a remote thing via the
// AWS IoT service.  The remote thing will be a dimmable color lamp, where
// the individual RGB channels can be set to an intensity between 0 and 255.  
// One process will simulate each side, with testMode being used to distinguish 
// between the mobile app (1) and the remote thing (2).  The mobile app
// will wait a random number of seconds and then change the LED lamp's values;
// the LED lamp will synchronize with them upon receipt of an .../update/delta.
//
thingShadows
  .on('connect', function() {
    console.log('connected to things instance, registering thing name');

    if (args.testMode === 1)
    {
       thingShadows.register( 'RGBLedLamp', { ignoreDeltas: true,
                                              persistentSubscribe: true } );
    }
    else
    {
       thingShadows.register( 'RGBLedLamp' );
    }
    var count=0;
    var rgbLedLampState = { };

    var opFunction = function() {
       if (args.testMode === 1)
       {
//
// The mobile app sets new values for the LED lamp.
//
          rgbValues.red   = Math.floor(Math.random() * 255);
          rgbValues.green = Math.floor(Math.random() * 255);
          rgbValues.blue  = Math.floor(Math.random() * 255);

          rgbLedLampState={state: { desired: rgbValues }};
       }

       var clientToken;
 
       if (args.testMode === 1)
       {
          if (mobileAppOperation === 'update')
          {
             clientToken = thingShadows[mobileAppOperation]('RGBLedLamp',
                                                            rgbLedLampState );
          }
          else // mobileAppOperation === 'get'
          {
             clientToken = thingShadows[mobileAppOperation]('RGBLedLamp' );
          }
          operationCallbacks[clientToken] = { operation: mobileAppOperation,
                                              cb: null };
//
// Force the next operation back to update in case we had to do a get after
// a 'rejected' status.
//
          mobileAppOperation = 'update';
       }
       else
       {
//
// The device gets the latest state from the thing shadow after connecting.
//
          clientToken = thingShadows.get('RGBLedLamp');
          operationCallbacks[clientToken] = { operation: 'get', cb: null };
       }
       if (args.testMode === 1)
       {
          operationCallbacks[clientToken].cb =
             function( thingName, operation, statusType, stateObject ) {

                console.log(role+':'+operation+' '+statusType+' on '+thingName+': '+
                            JSON.stringify(stateObject));
//
// If this operation was rejected, force a 'get' as the next operation; it is
// probably a version conflict, and it can be resolved by simply getting the
// latest thing shadow.
//
                if (statusType != 'accepted')
                {
                   mobileAppOperation = 'get';
                }
                opFunction();
             };
       }
       else
       {
          operationCallbacks[clientToken].cb =
             function( thingName, operation, statusType, stateObject ) { 

                console.log(role+':'+operation+' '+statusType+' on '+thingName+': '+
                            JSON.stringify(stateObject));
             };
       }
    };
    opFunction();
    });
thingShadows 
  .on('close', function() {
    console.log('close');
    thingShadows.unregister( 'RGBLedLamp' );
  });
thingShadows 
  .on('reconnect', function() {
    console.log('reconnect');
    if (args.testMode === 1)
    {
       thingShadows.register( 'RGBLedLamp', { ignoreDeltas: true,
                                              persistentSubscribe: true } );
    }
    else
    {
       thingShadows.register( 'RGBLedLamp' );
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
    console.log('message', topic, payload.toString());
  });
thingShadows
  .on('status', function(thingName, stat, clientToken, stateObject) {
      if (!isUndefined( operationCallbacks[clientToken] ))
      {
         setTimeout( function() {
         operationCallbacks[clientToken].cb( thingName, 
              operationCallbacks[clientToken].operation,
              stat,
              stateObject );

         delete operationCallbacks[clientToken];
         }, 2000 );
      }
      else
      {
         console.warn( 'status:unknown clientToken \''+clientToken+'\' on \''+
                       thingName+'\'' );
      }
  });
//
// Only the simulated device is interested in delta events.
//
if (args.testMode===2)
{
   thingShadows
     .on('delta', function(thingName, stateObject) {
         console.log(role+':delta on '+thingName+': '+
                     JSON.stringify(stateObject));
         rgbValues=stateObject.state;
     });
}

thingShadows
  .on('timeout', function(thingName, clientToken) {
      if (!isUndefined( operationCallbacks[clientToken] ))
      {
         operationCallbacks[clientToken].cb( thingName,
              operationCallbacks[clientToken].operation,
              'timeout',
              { } );
         delete operationCallbacks[clientToken];
      }
      else
      {
         console.warn( 'timeout:unknown clientToken \''+clientToken+'\' on \''+
                       thingName+'\'' );
      }
  });
}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and demonstrate thing shadow APIs, test modes 1-2',
                 process.argv.slice(2), processTest );
}

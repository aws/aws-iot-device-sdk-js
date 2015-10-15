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
const deviceModule   = require('../..').device;
const cmdLineProcess = require('../commonLib/cmdline');

//begin module

function processTest( args, argsRemaining ) {
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
  region: args.region,
  reconnectPeriod: args.reconnectPeriod,
});

var timeout;
var count=0;
//
// Do a simple publish/subscribe demo based on the test-mode passed
// in the command line arguments.  If test-mode is 1, subscribe to
// 'topic_1' and publish to 'topic_2'; otherwise vice versa.  Publish
// a message every four seconds.
//
device
  .on('connect', function() {
    const minimumDelay=250;
    console.log('connect');
    if (args.testMode === 1)
    {
        device.subscribe('topic_1');
    }
    else
    {
        device.subscribe('topic_2');
    }
    if ((Math.max(args.delay,minimumDelay) ) != args.delay)
    {
        console.log( 'substituting '+ minimumDelay + 'ms delay for ' + args.delay + 'ms...' );
    }
    timeout = setInterval( function() {
        count++;
   
        if (args.testMode === 1)
        {
            device.publish('topic_2', JSON.stringify({
            mode_1_process: count }));
        }
        else
        {
            device.publish('topic_1', JSON.stringify({
            mode_2_process: count }));
        }
    }, Math.max(args.delay,minimumDelay) );  // clip to minimum
    });
device 
  .on('close', function() {
    console.log('close');
    clearInterval( timeout );
    count=0;
  });
device 
  .on('reconnect', function() {
    console.log('reconnect');
  });
device 
  .on('offline', function() {
    console.log('offline');
    clearInterval( timeout );
    count=0;
  });
device
  .on('error', function(error) {
    console.log('error', error);
    clearInterval( timeout );
    count=0;
  });
device
  .on('message', function(topic, payload) {
    console.log('message', topic, payload.toString());
  });

}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and publish/subscribe to topics using MQTT, test modes 1-2',
                 process.argv.slice(2), processTest );
}

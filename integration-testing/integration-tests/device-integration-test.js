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
const deviceModule   = require('..').device;
const cmdLineProcess = require('../examples/lib/cmdline');
const isUndefined    = require('../common/lib/is-undefined.js');

//begin module

function processTest( args, argsRemaining ) {
//
// Use the command line flag '--thing-name | -T' to pass in a topic
// prefix; this allows us to run multiple copies of this test simultaneously
// within the same AWS account
//
var topicPrefix = args.thingName;
var integrationTestTopic = 'deviceIntegrationTestTopic';

if (!isUndefined(topicPrefix)) {
  integrationTestTopic=topicPrefix+'/'+integrationTestTopic;
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
  reconnectPeriod: args.reconnectPeriod,
  protocol: args.Protocol,
  port: args.Port,
  host: args.Host,
  debug: args.Debug,
  customAuthHeaders: customAuthHeaders
});

var timeout;
var value=1;
var count=1;
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
// Do a simple publish/subscribe demo based on the test-mode passed
// in the command line arguments.
//
device
  .on('connect', function() {
    const minimumDelay=250;
    console.log('connect');
    if (args.testMode === 2)
    {
        device.subscribe(integrationTestTopic);
    }
    else
    {
        if ((Math.max(args.delay,minimumDelay) ) !== args.delay)
        {
            console.log( 'substituting '+ minimumDelay + 'ms delay for ' + args.delay + 'ms...' );
        }
        timeout = setInterval( function() {
                console.log('publishing value='+value+' on \''+integrationTestTopic+'\'');
                device.publish(integrationTestTopic, JSON.stringify({
                value: value }), { qos: 1 });

//
// After 48 publishes, exit the process.  This number is chosen as it's the last power of 2 less
// than 53 (the mantissa size for Node's native floating point numbers).
//
                value=value*2;
                count++;
                if (count >= 48)
                {
                    device.publish(integrationTestTopic, JSON.stringify({
                    quit: 1 }));
                    setTimeout( function() {
                    process.exit(0); }, 500);
                }
        }, Math.max(args.delay,minimumDelay) );  // clip to minimum
    }
    });
device 
  .on('close', function() {
    console.log('close');
    process.exit(1);
  });
device 
  .on('reconnect', function() {
    console.log('reconnect');
    process.exit(1);
  });
device 
  .on('offline', function() {
    console.log('offline');
    process.exit(1);
  });
device
  .on('error', function(error) {
    console.log('error', error);
    process.exit(1);
  });
device
  .on('message', function(topic, payload) {
    
    var stateObject = JSON.parse( payload.toString() );
    console.log('received on \''+topic+'\': '+payload.toString());
    if (!isUndefined( stateObject.value ))
    {
       accumulator+=stateObject.value;
    }
    if (!isUndefined( stateObject.quit))
    {
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


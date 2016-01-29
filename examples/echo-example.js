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
const isUndefined = require('../common/lib/is-undefined');
const cmdLineProcess = require('./lib/cmdline');

//begin module

function processTest(args) {

  if (isUndefined(args.thingName)) {
    console.log('thing name must be specified with --thing-name');
    process.exit(1);
  }
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
    protocol: args.Protocol,
    port: args.Port,
    host: args.Host,
    debug: args.Debug
  });

  //
  // Register a thing name and listen for deltas.  Whatever we receive on delta
  // is echoed via thing shadow updates.
  //
  thingShadows
    .on('connect', function() {
      console.log('connected to things instance, registering thing name');

      thingShadows.register(args.thingName, {
        persistentSubscribe: true
      });
    });

  thingShadows
    .on('close', function() {
      thingShadows.unregister(args.thingName);
      console.log('close');
    });

  thingShadows
    .on('reconnect', function() {
      thingShadows.register(args.thingName, {
        persistentSubscribe: true
      });
      console.log('reconnect');
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
    .on('delta', function(thingName, stateObject) {
      console.log('received delta on ' + thingName + ': ' +
        JSON.stringify(stateObject));
      thingShadows.update(thingName, {
        state: {
          reported: stateObject.state
        }
      });
    });

  thingShadows
    .on('timeout', function(thingName, clientToken) {
      console.warn('timeout: ' + thingName + ', clientToken=' + clientToken);
    });
}

module.exports = cmdLineProcess;

if (require.main === module) {
  cmdLineProcess('connect to the AWS IoT service and perform thing shadow echo',
    process.argv.slice(2), processTest, ' ', true);
}

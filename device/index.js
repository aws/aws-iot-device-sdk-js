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
const mqtt = require('mqtt');

//app deps
const exceptions = require('./lib/exceptions'),
  isUndefined = require('../common/lib/is-undefined'),
  tlsReader = require('../common/lib/tls-reader');

//begin module
const reconnectPeriod = 3 * 1000;

//
// This method is the exposed module; it validates the mqtt options,
// creates a secure mqtt connection via TLS, and returns the mqtt
// connection instance.
//
module.exports = function(options) {
  //
  // Validate options, set default reconnect period if not specified.
  //
  if (isUndefined(options) ||
    Object.keys(options).length === 0) {
    throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
  }
  if (isUndefined(options.reconnectPeriod)) {
    options.reconnectPeriod = reconnectPeriod;
  }

  // set port, do not override existing definitions if available
  if (isUndefined(options.port)) {
    options.port = 8883;
  }
  options.protocol = 'mqtts';

  if (isUndefined(options.host)) {
    if (!(isUndefined(options.region))) {
      options.host = 'data.iot.' + options.region + '.amazonaws.com';
    } else {
      throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
    }
  }

  //read and map certificates
  tlsReader(options);

  if ((!isUndefined(options)) && (options.debug === true)) {
    console.log(options);
    console.log('attempting new mqtt connection...');
  }
  //connect and return the client instance to map all mqttjs apis
  const device = mqtt.connect(options);

  //handle some exceptions
  device
    .on('error', function(error) {
      //certificate issue
      if (error.code === 'EPROTO') {
        throw new Error(error);
      }
    });
  return device;
};

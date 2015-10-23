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
const fs = require('fs');

//npm deps

//app deps
const isUndefined = require('./is-undefined');

//begin module
/**
 * This method is the exposed module; it validates and prepares the tls
 * options as required for connection to the AWS IoT service.
 *
 * @param {Object} options
 * @access public
 */
module.exports = function(options) {

  // verify certificate paths
  if (isUndefined(options.keyPath)) {
    throw new Error(exceptions.INVALID_KEY_PATH_OPTION);
  }
  if (isUndefined(options.certPath)) {
    throw new Error(exceptions.INVALID_CERT_PATH_OPTION);
  }
  if (isUndefined(options.caPath)) {
    throw new Error(exceptions.INVALID_CA_PATH_OPTION);
  }
  //parse pem files
  options.key  = Buffer.isBuffer(options.keyPath) ? options.keyPath:fs.readFileSync(options.keyPath);
  options.cert = Buffer.isBuffer(options.certPath) ? options.certPath:fs.readFileSync(options.certPath);
  options.ca   = Buffer.isBuffer(options.caPath) ? options.caPath:fs.readFileSync(options.caPath);

  // request certificate from partner
  options.requestCert = true;

  // require certificate authentication
  options.rejectUnauthorized = true;

};

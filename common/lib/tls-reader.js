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
var filesys = require('fs');

//npm deps

//app deps
var isUndefined = require('./is-undefined');
var exceptions = require('./exceptions');

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
   if (isUndefined(options.keyPath) && isUndefined(options.privateKey)) {
      throw new Error(exceptions.NO_KEY_OPTION);
   }
   if (isUndefined(options.certPath) && isUndefined(options.clientCert)) {
      throw new Error(exceptions.NO_CERT_OPTION);
   }
   if (isUndefined(options.caPath) && isUndefined(options.caCert)) {
      throw new Error(exceptions.NO_CA_OPTION);
   }
   //
   // Certificates and private keys may be passed in files using options
   // ending in 'Path', e.g. 'keyPath', 'certPath', and 'caPath'.  In addition,
   // they can also be passed in as buffers or files using the options
   // 'privateKey', 'clientCert', and 'caCert'.  This second set is the one
   // that the AWS Console generates a JSON configuration document for.
   //
   if (!isUndefined(options.caCert)) {
      if (Buffer.isBuffer(options.caCert)) {
         options.ca = options.caCert;
      } else {
         if (filesys.existsSync(options.caCert)) {
            options.ca = filesys.readFileSync(options.caCert);
         } else {
            throw new Error(exceptions.INVALID_CA_CERT_OPTION);
         }
      }
   }
   if (!isUndefined(options.privateKey)) {
      if (Buffer.isBuffer(options.privateKey)) {
         options.key = options.privateKey;
      } else {
         if (filesys.existsSync(options.privateKey)) {
            options.key = filesys.readFileSync(options.privateKey);
         } else {
            throw new Error(exceptions.INVALID_PRIVATE_KEY_OPTION);
         }
      }
   }
   if (!isUndefined(options.clientCert)) {
      if (Buffer.isBuffer(options.clientCert)) {
         options.cert = options.clientCert;
      } else {
         if (filesys.existsSync(options.clientCert)) {
            options.cert = filesys.readFileSync(options.clientCert);
         } else {
            throw new Error(exceptions.INVALID_CLIENT_CERT_OPTION);
         }
      }
   }

   // Parse PEM files.  Options ending in 'Path' must be files
   // and will override options which do not end in 'Path'.

   if (filesys.existsSync(options.keyPath)) {
      options.key = filesys.readFileSync(options.keyPath);
   } else if (!isUndefined(options.keyPath)) {
      throw new Error(exceptions.INVALID_KEY_PATH_OPTION);
   }
   if (filesys.existsSync(options.certPath)) {
      options.cert = filesys.readFileSync(options.certPath);
   } else if (!isUndefined(options.certPath)) {
      throw new Error(exceptions.INVALID_CERT_PATH_OPTION);
   }
   if (filesys.existsSync(options.caPath)) {
      options.ca = filesys.readFileSync(options.caPath);
   } else if (!isUndefined(options.caPath)) {
      throw new Error(exceptions.INVALID_CA_PATH_OPTION);
   }

   // request certificate from partner
   options.requestCert = true;

   // require certificate authentication
   options.rejectUnauthorized = true;

};

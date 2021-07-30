/*
 * Copyright 2010-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
var fs = require('fs');
var https = require('https');
var url = require('url');

//npm deps

//app deps
var isUndefined = require('../../common/lib/is-undefined');
var copyFile = require('./copy-file');

//begin module

var supportedProtocols = {
    'https:': https
};

/**
 * This is the exposed module.
 * This method facilitates downloading a file.
 *
 * @param {String} fileUrlStr
 * @param {String} fileDest
 * @param {Function} cb
 * @access public
 */
module.exports = function(fileUrlStr, fileDest, cb) {
   var fileUrl = url.parse(fileUrlStr);
   var protocolLib = supportedProtocols[ fileUrl.protocol ];

   if (!isUndefined(protocolLib)) {
      var file = fs.createWriteStream(fileDest);
      protocolLib.get(fileUrlStr, function(res) {
         if (res.statusCode !== 200) {
            var err = new Error('file download failed');
            err.fileName = fileDest;
            err.statusCode = res.statusCode;
            return cb(err);
         }

         res.on('data', function(data) {
            file.write(data);
         }).on('end', function() {
            file.end();
            cb();
         });
      }).on('error', function (err) {
         console.log('downloadFile error');
         fs.unlink(fileDest);
         err.fileName = fileDest;
         cb(err);
      });
   }
   else {
      copyFile(fileUrl.pathname, fileDest, cb);
   }
};

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

//npm deps

//app deps

//begin module

/**
 * This is the exposed module.
 * This method facilitates copying a file.
 *
 * @param {String} fileSrc
 * @param {String} fileDest
 * @param {Function} cb
 * @access public
 */
module.exports = function(fileSrc, fileDest, cb) {
   var cbCalled = false;

   var rd = fs.createReadStream(fileSrc);
   rd.on('error', function(err) {
      err.fileName = fileSrc;
      done(err);
   });

   var wr = fs.createWriteStream(fileDest);
   wr.on('error', function(err) {
      err.fileName = fileDest;
      done(err);
   });

   wr.on('close', function(ex) {
      done();
   });
   rd.pipe(wr);

   function done(err) {
      if (!cbCalled) {
         cb(err);
         cbCalled = true;
      }
   }
};

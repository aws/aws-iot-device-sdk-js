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
const mqtt   = require('mqtt');
const crypto = require('crypto-js');

//app deps
const exceptions = require('./lib/exceptions'),
  isUndefined = require('../common/lib/is-undefined'),
  tlsReader = require('../common/lib/tls-reader');

//begin module
const reconnectPeriod = 3 * 1000;

function makeTwoDigits( n ) {
   if (n > 9)
   {
      return n;
   }
   else
   {
      return '0' + n;
   }
}

function getDateTimeString() {
   var d = new Date();

//
// The additional ''s are used to force JavaScript to interpret the
// '+' operator as string concatenation rather than arithmetic.
//
   return d.getUTCFullYear() + '' +
             makeTwoDigits(d.getUTCMonth()+1) + '' +
             makeTwoDigits(d.getUTCDate()) + 'T' + '' +
             makeTwoDigits(d.getUTCHours()) + '' +
             makeTwoDigits(d.getUTCMinutes()) +  '' +
             makeTwoDigits(d.getUTCSeconds()) + 'Z';
}

function getDateString( dateTimeString ) {
   return dateTimeString.substring(0, dateTimeString.indexOf('T'));
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
   var kDate = crypto.HmacSHA256(dateStamp, 'AWS4' + key, { asBytes: true});
   var kRegion = crypto.HmacSHA256(regionName, kDate, { asBytes: true });
   var kService =crypto.HmacSHA256(serviceName, kRegion, { asBytes: true });
   var kSigning = crypto.HmacSHA256('aws4_request', kService, { asBytes: true });
   return kSigning;
}

function signUrl(method, scheme, hostname, path, queryParams, accessId, secretKey, 
                 region, serviceName, payload, today, now, debug, awsSTSToken ) {

   var signedHeaders = 'host';

   var canonicalHeaders = 'host:' + hostname + '\n';

   var canonicalRequest = method + '\n' + // method
       path + '\n' + // path
       queryParams + '\n' + // query params
       canonicalHeaders +// headers
       '\n' + // no idea why this needs to be here, but it fails without
       signedHeaders + '\n' + // signed header list
       crypto.SHA256(payload, { asBytes: true }); // hash of payload (empty string)

   if (debug === true) {
      console.log('canonical request: ' + canonicalRequest + '\n');
   }

   var hashedCanonicalRequest = crypto.SHA256(canonicalRequest, { asBytes: true });

   if (debug === true) {
      console.log('hashed canonical request: ' + hashedCanonicalRequest + '\n');
   }

   var stringToSign = 'AWS4-HMAC-SHA256\n' +
       now + '\n' +
       today + '/' + region + '/' + serviceName + '/aws4_request\n' +
       hashedCanonicalRequest;

   if (debug === true) {
      console.log('string to sign: ' + stringToSign + '\n');
   }

   var signingKey = getSignatureKey(secretKey, today, region, serviceName);

   if (debug === true) {
      console.log('signing key: ' + signingKey + '\n');
   }

   var signature = crypto.HmacSHA256(stringToSign, signingKey, { asBytes: true });

   if (debug === true) {
      console.log('signature: ' + signature + '\n');
   }

   var finalParams = queryParams + '&X-Amz-Signature=' + signature;

   if (awsSTSToken){
      finalParams += "&X-Amz-Security-Token=" + encodeURIComponent(awsSTSToken);
   }

   var url = scheme + hostname + path + '?' + finalParams;

   if (debug === true) {
      console.log('url: ' + url + '\n');
   }

   return url;
}

function prepareWebsocketUrl( options, awsAccessId, awsSecretKey, awsSTSToken )
{
   var now = getDateTimeString();
   var today = getDateString( now );
   var path = '/mqtt';
   var awsServiceName = 'iotdata';
   var queryParams = 'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
   '&X-Amz-Credential=' + awsAccessId + '%2F' + today + '%2F' + options.region + '%2F' + awsServiceName + '%2Faws4_request' +
   '&X-Amz-Date=' + now +
   '&X-Amz-SignedHeaders=host';

   return signUrl('GET', 'wss://', options.host, path, queryParams, 
                     awsAccessId, awsSecretKey, options.region, awsServiceName, '', today, now, options.debug, awsSTSToken );
}

//
// This method is the exposed module; it validates the mqtt options,
// creates a secure mqtt connection via TLS, and returns the mqtt
// connection instance.
//
module.exports = function(options) {

  var awsAccessId;
  var awsSecretKey;
  var awsSTSToken;

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
  // set protocol, do not override existing definitions if available
  if (isUndefined(options.protocol))
  {
     options.protocol = 'mqtts';
  }

  if (isUndefined(options.host))
  {
     if (!(isUndefined(options.region)))
     {
        options.host = 'data.iot.'+options.region+'.amazonaws.com';
     }
     else
     {
        throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
     }
  }

  if (options.protocol === 'mqtts')
  {
     // set port, do not override existing definitions if available
     if (isUndefined(options.port))
     {
        options.port = 8883;
     }

     //read and map certificates
     tlsReader(options);
  }
  else if (options.protocol === 'wss')
  {
     //AWS access id and secret key must be available in environment
     awsAccessId = process.env.AWS_ACCESS_KEY_ID;
     awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
     awsSTSToken = process.env.AWS_SESSION_TOKEN;
  
     if (isUndefined( awsAccessId ) || (isUndefined( awsSecretKey )))
     {
        console.log('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be defined in environment');
        throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
     }
     // set port, do not override existing definitions if available
     if (isUndefined(options.port))
     {
        options.port = 443;
     }
  }
  else
  {
     console.log('unsupported protocol: '+options.protocol);
     throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
  }

  if ((!isUndefined(options)) && (options.debug===true))
  {
     console.log(options);
     console.log('attempting new mqtt connection...');
  }
  //connect and return the client instance to map all mqttjs apis

  var protocols = {};
  protocols.mqtts = require('./lib/tls');
  protocols.wss = require('./lib/ws');

  function wrapper (client) {
     if (options.protocol === 'wss')
     {
        //
        // Access id and secret key are available, prepare URL. 
        //
        var url = prepareWebsocketUrl( options, awsAccessId, awsSecretKey, awsSTSToken );

        if (options.debug === true) {
           console.log('using websockets, will connect to \''+url+'\'...');
        }

        options.url = url;
    }
    return protocols[options.protocol](client, options);
  }

  const device = new mqtt.MqttClient(wrapper, options);

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

module.exports.prepareWebsocketUrl = prepareWebsocketUrl;

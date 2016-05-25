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
const events = require('events');
const inherits = require('util').inherits;

//npm deps
const mqtt = require('mqtt');
const MqttClient = require('mqtt/lib/client');
const crypto = require('crypto-js');

//app deps
const exceptions = require('./lib/exceptions'),
   isUndefined = require('../common/lib/is-undefined'),
   tlsReader = require('../common/lib/tls-reader');

//begin module
function makeTwoDigits(n) {
   if (n > 9) {
      return n;
   } else {
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
      makeTwoDigits(d.getUTCMonth() + 1) + '' +
      makeTwoDigits(d.getUTCDate()) + 'T' + '' +
      makeTwoDigits(d.getUTCHours()) + '' +
      makeTwoDigits(d.getUTCMinutes()) + '' +
      makeTwoDigits(d.getUTCSeconds()) + 'Z';
}

function getDateString(dateTimeString) {
   return dateTimeString.substring(0, dateTimeString.indexOf('T'));
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
   var kDate = crypto.HmacSHA256(dateStamp, 'AWS4' + key, {
      asBytes: true
   });
   var kRegion = crypto.HmacSHA256(regionName, kDate, {
      asBytes: true
   });
   var kService = crypto.HmacSHA256(serviceName, kRegion, {
      asBytes: true
   });
   var kSigning = crypto.HmacSHA256('aws4_request', kService, {
      asBytes: true
   });
   return kSigning;
}

function signUrl(method, scheme, hostname, path, queryParams, accessId, secretKey,
   region, serviceName, payload, today, now, debug, awsSTSToken) {

   var signedHeaders = 'host';

   var canonicalHeaders = 'host:' + hostname.toLowerCase() + '\n';

   var canonicalRequest = method + '\n' + // method
      path + '\n' + // path
      queryParams + '\n' + // query params
      canonicalHeaders + // headers
      '\n' + // required
      signedHeaders + '\n' + // signed header list
      crypto.SHA256(payload, {
         asBytes: true
      }); // hash of payload (empty string)

   if (debug === true) {
      console.log('canonical request: ' + canonicalRequest + '\n');
   }

   var hashedCanonicalRequest = crypto.SHA256(canonicalRequest, {
      asBytes: true
   });

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

   var signature = crypto.HmacSHA256(stringToSign, signingKey, {
      asBytes: true
   });

   if (debug === true) {
      console.log('signature: ' + signature + '\n');
   }

   var finalParams = queryParams + '&X-Amz-Signature=' + signature;

   if (!isUndefined(awsSTSToken)) {
      finalParams += '&X-Amz-Security-Token=' + encodeURIComponent(awsSTSToken);
   }

   var url = scheme + hostname + path + '?' + finalParams;

   if (debug === true) {
      console.log('url: ' + url + '\n');
   }

   return url;
}

function prepareWebSocketUrl(options, awsAccessId, awsSecretKey, awsSTSToken) {
   var now = getDateTimeString();
   var today = getDateString(now);
   var path = '/mqtt';
   var awsServiceName = 'iotdata';
   var queryParams = 'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=' + awsAccessId + '%2F' + today + '%2F' + options.region + '%2F' + awsServiceName + '%2Faws4_request' +
      '&X-Amz-Date=' + now +
      '&X-Amz-SignedHeaders=host';

   return signUrl('GET', 'wss://', options.host, path, queryParams,
      awsAccessId, awsSecretKey, options.region, awsServiceName, '', today, now, options.debug, awsSTSToken);
}
//
// This method is the exposed module; it validates the mqtt options,
// creates a secure mqtt connection via TLS, and returns the mqtt
// connection instance.
//
function DeviceClient(options) {
   //
   // Force instantiation using the 'new' operator; this will cause inherited
   // constructors (e.g. the 'events' class) to be called.
   //
   if (!(this instanceof DeviceClient)) {
      return new DeviceClient(options);
   }
   //
   // A copy of 'this' for use inside of closures
   //
   var that = this;

   //
   // Offline Operation
   //
   // The connection to AWS IoT can be in one of three states:
   //
   //   1) Inactive
   //   2) Established
   //   3) Stable
   //
   // During state 1), publish operations are placed in a queue
   // ("filling")
   //
   // During states 2) and 3), any operations present in the queue
   // are sent to the mqtt client for completion ("draining").
   //
   // In all states, subscriptions are tracked in a cache
   //
   // A "draining interval" is used to specify the rate at which
   // which operations are drained from the queue.
   //
   //    +- - - - - - - - - - - - - - - - - - - - - - - - +
   //    |                                                |
   //
   //    |                    FILLING                     |
   //
   //    |                                                |
   //              +-----------------------------+
   //    |         |                             |        |
   //              |                             |
   //    |         v                             |        |
   //    +- - Established                     Inactive - -+
   //    |         |                             ^        |
   //              |                             |
   //    |         |                             |        |
   //              +----------> Stable ----------+
   //    |                                                |
   //
   //    |                     DRAINING                   |
   //
   //    |                                                |
   //    +- - - - - - - - - - - - - - - - - - - - - - - - +
   //
   //
   // Draining Operation
   //
   // During draining, existing subscriptions are re-sent,
   // followed by any publishes which occurred while offline.
   //

   //
   // Operation cache used during filling
   //
   var offlineOperations = [];
   var offlineQueueing = true;
   var offlineQueueMaxSize = 0;
   var offlineQueueDropBehavior = 'oldest'; // oldest or newest
   offlineOperations.length = 0;

   //
   // Subscription cache; active if autoResubscribe === true
   //
   var activeSubscriptions = [];
   var autoResubscribe = true;
   activeSubscriptions.length = 0;

   //
   // Cloned subscription cache; active during initial draining.
   //
   var clonedSubscriptions = [];
   clonedSubscriptions.length = 0;

   //
   // Contains the operational state of the connection
   //
   var connectionState = 'inactive';

   //
   // Used to time draining operations; active during draining.
   //
   var drainingTimer = null;
   var drainTimeMs = 250;

   //
   // These properties control the reconnect behavior of the MQTT Client.  If
   // the MQTT client becomes disconnected, it will attempt to reconnect after
   // a quiet period; this quiet period doubles with each reconnection attempt,
   // e.g. 1 seconds, 2 seconds, 2, 8, 16, 32, etc... up until a maximum
   // reconnection time is reached.
   //
   // If a connection is active for the minimum connection time, the quiet
   // period is reset to the initial value.
   //
   // baseReconnectTime: the time in seconds to wait before the first
   //     reconnect attempt
   //
   // minimumConnectionTime: the time in seconds that a connection must be
   //     active before resetting the current reconnection time to the base
   //     reconnection time
   //
   // maximumReconnectTime: the maximum time in seconds to wait between
   //     reconnect attempts
   //
   // The defaults for these values are:
   //
   // baseReconnectTime: 1 seconds
   // minimumConnectionTime: 20 seconds
   // maximumReconnectTime: 128 seconds
   //
   var baseReconnectTimeMs = 1000;
   var minimumConnectionTimeMs = 20000;
   var maximumReconnectTimeMs = 128000;
   var currentReconnectTimeMs;

   //
   // Used to measure the length of time the connection has been active to
   // know if it's stable or not.  Active beginning from receipt of a 'connect'
   // event (e.g. received CONNACK) until 'minimumConnectionTimeMs' has elapsed.
   //
   var connectionTimer = null;

   //
   // Credentials when authenticating via WebSocket/SigV4
   //
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
   if (!isUndefined(options.baseReconnectTimeMs)) {
      baseReconnectTimeMs = options.baseReconnectTimeMs;
   }
   if (!isUndefined(options.minimumConnectionTimeMs)) {
      minimumConnectionTimeMs = options.minimumConnectionTimeMs;
   }
   if (!isUndefined(options.maximumReconnectTimeMs)) {
      maximumReconnectTimeMs = options.maximumReconnectTimeMs;
   }
   if (!isUndefined(options.drainTimeMs)) {
      drainTimeMs = options.drainTimeMs;
   }
   if (!isUndefined(options.autoResubscribe)) {
      autoResubscribe = options.autoResubscribe;
   }
   if (!isUndefined(options.offlineQueueing)) {
      offlineQueueing = options.offlineQueueing;
   }
   if (!isUndefined(options.offlineQueueMaxSize)) {
      offlineQueueMaxSize = options.offlineQueueMaxSize;
   }
   if (!isUndefined(options.offlineQueueDropBehavior)) {
      offlineQueueDropBehavior = options.offlineQueueDropBehavior;
   }
   currentReconnectTimeMs = baseReconnectTimeMs;
   options.reconnectPeriod = currentReconnectTimeMs;
   options.fastDisconnectDetection = true;

   //
   // Verify that the reconnection timing parameters make sense.
   //
   if (options.baseReconnectTimeMs <= 0) {
      throw new Error(exceptions.INVALID_RECONNECT_TIMING);
   }
   if (maximumReconnectTimeMs < baseReconnectTimeMs) {
      throw new Error(exceptions.INVALID_RECONNECT_TIMING);
   }
   if (minimumConnectionTimeMs < baseReconnectTimeMs) {
      throw new Error(exceptions.INVALID_RECONNECT_TIMING);
   }
   //
   // Verify that the other optional parameters make sense.
   //
   if (offlineQueueDropBehavior !== 'newest' &&
      offlineQueueDropBehavior !== 'oldest') {
      throw new Error(exceptions.INVALID_OFFLINE_QUEUEING_PARAMETERS);
   }
   if (offlineQueueMaxSize < 0) {
      throw new Error(exceptions.INVALID_OFFLINE_QUEUEING_PARAMETERS);
   }

   // set protocol, do not override existing definitions if available
   if (isUndefined(options.protocol)) {
      options.protocol = 'mqtts';
   }

   if (isUndefined(options.host)) {
      if (!(isUndefined(options.region))) {
         options.host = 'data.iot.' + options.region + '.amazonaws.com';
      } else {
         throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
      }
   }

   if (options.protocol === 'mqtts') {
      // set port, do not override existing definitions if available
      if (isUndefined(options.port)) {
         options.port = 8883;
      }

      //read and map certificates
      tlsReader(options);
   } else if (options.protocol === 'wss') {
      //
      // AWS access id and secret key must be available as either
      // options or in the environment.
      //
      if (!isUndefined(options.accessKeyId)) {
         awsAccessId = options.accessKeyId;
      } else {
         awsAccessId = process.env.AWS_ACCESS_KEY_ID;
      }
      if (!isUndefined(options.secretKey)) {
         awsSecretKey = options.secretKey;
      } else {
         awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
      }
      if (!isUndefined(options.sessionToken)) {
         awsSTSToken = options.sessionToken;
      } else {
         awsSTSToken = process.env.AWS_SESSION_TOKEN;
      }
      // AWS region must be defined when connecting via WebSocket/SigV4
      if (isUndefined(options.region)) {
         console.log('AWS region must be defined when connecting via WebSocket/SigV4; see README.md');
         throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
      }
      // AWS Access Key ID and AWS Secret Key must be defined
      if (isUndefined(awsAccessId) || (isUndefined(awsSecretKey))) {
         console.log('To connect via WebSocket/SigV4, AWS Access Key ID and AWS Secret Key must be passed either in options or as environment variables; see README.md');
         throw new Error(exceptions.INVALID_CONNECT_OPTIONS);
      }
      // set port, do not override existing definitions if available
      if (isUndefined(options.port)) {
         options.port = 443;
      }
      // check websocketOptions and ensure that the protocol is defined
      if (isUndefined(options.websocketOptions)) {
         options.websocketOptions = { protocol: 'mqttv3.1' };
      }
      else {
         options.websocketOptions.protocol = 'mqttv3.1';
      }
   }

   if ((!isUndefined(options)) && (options.debug === true)) {
      console.log(options);
      console.log('attempting new mqtt connection...');
   }
   //connect and return the client instance to map all mqttjs apis

   var protocols = {};
   protocols.mqtts = require('./lib/tls');
   protocols.wss = require('./lib/ws');

   function _addToSubscriptionCache(topic, options, callback) {
      var matches = activeSubscriptions.filter(function(element) {
         return element.topic === topic;
      });
      //
      // Add the element only if it doesn't already exist.
      //
      if (matches.length === 0) {
         activeSubscriptions.push({
            topic: topic,
            options: options,
            callback: callback
         });
      }
   }

   function _deleteFromSubscriptionCache(topic, options, callback) {
      var remaining = activeSubscriptions.filter(function(element) {
         return element.topic !== topic;
      });
      activeSubscriptions = remaining;
   }

   function _updateSubscriptionCache(operation, topics, options, callback) {
      var opFunc = null;

      //
      // Don't cache subscriptions if auto-resubscribe is disabled
      //
      if (autoResubscribe === false) {
         return;
      }
      if (operation === 'subscribe') {
         opFunc = _addToSubscriptionCache;
      } else if (operation === 'unsubscribe') {
         opFunc = _deleteFromSubscriptionCache;
      }
      //
      // Test to see if 'topics' is an array and if so, iterate.
      //
      if (Object.prototype.toString.call(topics) === '[object Array]') {
         topics.forEach(function(item, index, array) {
            opFunc(item, options, callback);
         });
      } else {
         opFunc(topics, options, callback);
      }
   }

   //
   // Return true if the connection is currently in a 'filling'
   // state
   //
   function _filling() {
      return connectionState === 'inactive';
   }

   function _wrapper(client) {
      if (options.protocol === 'wss') {
         var url;
         //
         // If the access id and secret key are available, prepare the URL.
         // Otherwise, set the url to an invalid value.
         //
         if (awsAccessId === '' || awsSecretKey === '') {
            url = 'wss://no-credentials-available';
         } else {
            url = prepareWebSocketUrl(options, awsAccessId, awsSecretKey, awsSTSToken);
         }

         if (options.debug === true) {
            console.log('using websockets, will connect to \'' + url + '\'...');
         }

         options.url = url;
      }
      return protocols[options.protocol](client, options);
   }

   const device = new MqttClient(_wrapper, options);

   //handle events from the mqtt client

   //
   // Timeout expiry function for the connection timer; once a connection
   // is stable, reset the current reconnection time to the base value.
   //
   function _markConnectionStable() {
      currentReconnectTimeMs = baseReconnectTimeMs;
      device.options.reconnectPeriod = currentReconnectTimeMs;
      //
      // Mark this timeout as expired
      //
      connectionTimer = null;
      connectionState = 'stable';
   }
   //
   // Trim the offline queue if required; returns true if another
   // element can be placed in the queue
   //
   function _trimOfflineQueueIfNecessary() {
      var rc = true;

      if ((offlineQueueMaxSize > 0) &&
         (offlineOperations.length >= offlineQueueMaxSize)) {
         //
         // The queue has reached its maximum size, trim it
         // according to the defined drop behavior.
         //
         if (offlineQueueDropBehavior === 'oldest') {
            offlineOperations.shift();
         } else {
            rc = false;
         }
      }
      return rc;
   }

   //
   // Timeout expiry function for the drain timer; once a connection
   // has been established, begin draining cached transactions.
   //
   function _drainOperationQueue() {

      //
      // Handle our active subscriptions first, using a cloned
      // copy of the array.  We shift them out one-by-one until
      // all have been processed, leaving the official record
      // of active subscriptions untouched.
      //
      var subscription = clonedSubscriptions.shift();

      if (!isUndefined(subscription)) {
         device.subscribe(subscription.topic,
            subscription.options,
            subscription.callback);
      } else {
         //
         // Then handle cached operations...
         //
         var operation = offlineOperations.shift();

         if (!isUndefined(operation)) {
            switch (operation.type) {
               case 'publish':
                  device.publish(operation.topic,
                     operation.message,
                     operation.options,
                     operation.callback);
                  break;
               default:
                  console.log('unrecognized operation \'' + operation + '\' during draining!');
                  break;
            }
         }
         if (offlineOperations.length === 0) {
            //
            // The subscription and operation queues are fully drained,
            // cancel the draining timer.
            //
            clearInterval(drainingTimer);
            drainingTimer = null;
         }
      }
   }
   //
   // Event handling - *all* events generated by the mqtt.js client must be
   // handled here, *and* propagated upwards.
   //

   device.on('connect', function() {
      //
      // If not already running, start the connection timer.
      //
      if (connectionTimer === null) {
         connectionTimer = setTimeout(_markConnectionStable,
            minimumConnectionTimeMs);
      }
      connectionState = 'established';
      //
      // If not already running, start the draining timer and
      // clone the active subscriptions.
      //
      if (drainingTimer === null) {
         clonedSubscriptions = activeSubscriptions.slice(0);
         drainingTimer = setInterval(_drainOperationQueue,
            drainTimeMs);
      }
      that.emit('connect');
   });
   device.on('close', function() {
      if ((!isUndefined(options)) && (options.debug === true)) {
         console.log('connection lost - will attempt reconnection in ' +
            device.options.reconnectPeriod / 1000 + ' seconds...');
      }
      //
      // Clear the connection and drain timers
      //
      clearTimeout(connectionTimer);
      connectionTimer = null;
      clearInterval(drainingTimer);
      drainingTimer = null;

      //
      // Mark the connection state as inactive
      //
      connectionState = 'inactive';

      that.emit('close');
   });
   device.on('reconnect', function() {
      //
      // Update the current reconnect timeout; this will be the
      // next timeout value used if this connect attempt fails.
      //
      currentReconnectTimeMs = currentReconnectTimeMs * 2;
      currentReconnectTimeMs = Math.min(maximumReconnectTimeMs, currentReconnectTimeMs);
      device.options.reconnectPeriod = currentReconnectTimeMs;

      that.emit('reconnect');
   });
   device.on('offline', function() {
      that.emit('offline');
   });
   device.on('error', function(error) {
      that.emit('error', error);
   });
   device.on('message', function(topic, message, packet) {
      that.emit('message', topic, message, packet);
   });

   //
   // The signatures of these methods *must* match those of the mqtt.js
   // client.
   //
   this.publish = function(topic, message, options, callback) {
      //
      // If filling or still draining, push this publish operation
      // into the offline operations queue; otherwise, perform it
      // immediately.
      //
      if (offlineQueueing === true && (_filling() || drainingTimer !== null)) {
         if (_trimOfflineQueueIfNecessary()) {
            offlineOperations.push({
               type: 'publish',
               topic: topic,
               message: message,
               options: options,
               callback: callback
            });
         }
      } else {
         if (offlineQueueing === true || !_filling()) {
            device.publish(topic, message, options, callback);
         }
      }
   };
   this.subscribe = function(topics, options, callback) {
      _updateSubscriptionCache('subscribe', topics, options, callback);
      if (!_filling() || autoResubscribe === false) {
         device.subscribe(topics, options, callback);
      }
   };
   this.unsubscribe = function(topics, options, callback) {
      _updateSubscriptionCache('unsubscribe', topics, options, callback);
      if (!_filling() || autoResubscribe === false) {
         device.unsubscribe(topics, options, callback);
      }
   };
   this.end = function(force, callback) {
      device.end(force, callback);
   };
   this.handleMessage = function(packet, callback) {
      device.handleMessage(packet, callback);
   };
   //
   // Call this function to update the credentials used when
   // connecting via WebSocket/SigV4.
   //
   this.updateWebSocketCredentials = function(accessKeyId, secretKey, sessionToken, expiration) {
      awsAccessId = accessKeyId;
      awsSecretKey = secretKey;
      awsSTSToken = sessionToken;
   };
   //
   // Used for integration testing only
   //
   this.simulateNetworkFailure = function() {
      device.stream.emit('error', new Error('simulated connection error'));
      device.stream.end();
   };
}

//
// Allow instances to listen in on events that we produce for them
//
inherits(DeviceClient, events.EventEmitter);

module.exports = DeviceClient;
module.exports.DeviceClient = DeviceClient;

//
// Exported for unit testing only
//
module.exports.prepareWebSocketUrl = prepareWebSocketUrl;

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
var events = require('events');
var inherits = require('util').inherits;

//npm deps

//app deps
var deviceModule = require('../device');
var isUndefined = require('../common/lib/is-undefined');

//
// private functions
//
function buildThingShadowTopic(thingName, operation, type) {
   if (!isUndefined(type)) {
      return '$aws/things/' + thingName + '/shadow/' + operation + '/' + type;
   }
   return '$aws/things/' + thingName + '/shadow/' + operation;
}

function isReservedTopic(topic) {
   if (topic.substring(0, 12) === '$aws/things/') {
      return true;
   }
   return false;
}

function isThingShadowTopic(topicTokens, direction) {
   var rc = false;
   if (topicTokens[0] === '$aws') {
      //
      // Thing shadow topics have the form:
      //
      //      $aws/things/{thingName}/shadow/{Operation}/{Status}
      //
      // Where {Operation} === update|get|delete
      //   And    {Status} === accepted|rejected|delta
      //
      if ((topicTokens[1] === 'things') &&
         (topicTokens[3] === 'shadow') &&
         ((topicTokens[4] === 'update') ||
            (topicTokens[4] === 'get') ||
            (topicTokens[4] === 'delete'))) {
         //
         // Looks good so far; now check the direction and see if
         // still makes sense.
         //
         if (direction === 'subscribe') {
            if (((topicTokens[5] === 'accepted') ||
                  (topicTokens[5] === 'rejected') ||
                  (topicTokens[5] === 'delta')) &&
               (topicTokens.length === 6)) {
               rc = true;
            }
         } else // direction === 'publish'
         {
            if (topicTokens.length === 5) {
               rc = true;
            }
         }
      }
   }
   return rc;
}

//begin module

function ThingShadowsClient(deviceOptions, thingShadowOptions) {
   //
   // Force instantiation using the 'new' operator; this will cause inherited
   // constructors (e.g. the 'events' class) to be called.
   //
   if (!(this instanceof ThingShadowsClient)) {
      return new ThingShadowsClient(deviceOptions, thingShadowOptions);
   }

   //
   // A copy of 'this' for use inside of closures
   //
   var that = this;

   //
   // Track Thing Shadow registrations in here.
   //
   var thingShadows = [{}];

   //
   // Implements for every operation, used to construct clientToken.
   //
   var operationCount = 0;

   //
   // Operation timeout (milliseconds).  If no accepted or rejected response
   // to a thing operation is received within this time, subscriptions
   // to the accepted and rejected sub-topics for a thing are cancelled.
   //
   var operationTimeout = 10000; /* milliseconds */

   //
   // Variable used by the testing API setConnectionStatus() to simulate
   // network connectivity failures.
   //
   var connected = true;

   //
   // Instantiate the device.
   //
   var device = deviceModule.DeviceClient(deviceOptions);

   if (!isUndefined(thingShadowOptions)) {
      if (!isUndefined(thingShadowOptions.operationTimeout)) {
         operationTimeout = thingShadowOptions.operationTimeout;
      }
   }

   //
   // Private function to subscribe and unsubscribe from topics.
   //
   this._handleSubscriptions = function(thingName, topicSpecs, devFunction, callback) {
      var topics = [];

      //
      // Build an array of topic names.
      //
      for (var i = 0, topicsLen = topicSpecs.length; i < topicsLen; i++) {
         for (var j = 0, opsLen = topicSpecs[i].operations.length; j < opsLen; j++) {
            for (var k = 0, statLen = topicSpecs[i].statii.length; k < statLen; k++) {
               topics.push(buildThingShadowTopic(thingName,
                  topicSpecs[i].operations[j],
                  topicSpecs[i].statii[k]));
            }
         }
      }

      if (thingShadows[thingName].debug === true) {
         console.log(devFunction + ' on ' + topics);
      }
      //
      // Subscribe/unsubscribe from the topics and perform callback when complete.
      //
      var args = [];
      args.push(topics);
      if (devFunction === 'subscribe') {
         // QoS only applicable for subscribe
         args.push({
            qos: thingShadows[thingName].qos
         });
         // add our callback to check the SUBACK response for granted subscriptions
         args.push(function(err, granted) {
            if (!isUndefined(callback)) {
               if (err) {
                  callback(err);
                  return;
               }
               //
               // Check to see if we got all topic subscriptions granted.
               //
              var failedTopics = [];
              for (var k = 0, grantedLen = granted.length; k < grantedLen; k++) {
                 //
                 // 128 is 0x80 - Failure from the MQTT lib.
                 //
                 if (granted[k].qos === 128) {
                    failedTopics.push(granted[k]);
                 }
              }

              if (failedTopics.length > 0) {
                 callback('Not all subscriptions were granted', failedTopics);
                 return;
              }

              // all subscriptions were granted
              callback();
            }
         });
      } else {
         if (!isUndefined(callback)) {
            args.push(callback);
         }
      }

      device[devFunction].apply(device, args);
   };

   //
   // Private function to handle messages and dispatch them accordingly.
   //
   this._handleMessages = function(thingName, operation, operationStatus, payload) {
      var stateObject = {};
      try {
         stateObject = JSON.parse(payload.toString());
      } catch (err) {
         if (deviceOptions.debug === true) {
            console.error('failed parsing JSON \'' + payload.toString() + '\', ' + err);
         }
         return;
      }
      var clientToken = stateObject.clientToken;
      var version = stateObject.version;
      //
      // Remove the properties 'clientToken' and 'version' from the stateObject;
      // these properties are internal to this class.
      //
      delete stateObject.clientToken;
      //Expose shadow version from raw object
      //delete stateObject.version;
      //
      // Update the thing version on every accepted or delta message which 
      // contains it.
      //
      if ((!isUndefined(version)) && (operationStatus !== 'rejected')) {
         //
         // The thing shadow version is incremented by AWS IoT and should always
         // increase.  Do not update our local version if the received version is
         // less than our version.  
         //
         if ((isUndefined(thingShadows[thingName].version)) ||
            (version >= thingShadows[thingName].version)) {
            thingShadows[thingName].version = version;
         } else {
            //
            // We've received a message from AWS IoT with a version number lower than
            // we would expect.  There are two things that can cause this:
            //
            //  1) The shadow has been deleted (version # reverts to 1 in this case.)
            //  2) The message has arrived out-of-order.
            //
            // For case 1) we can look at the operation to determine that this
            // is the case and notify the client if appropriate.  For case 2, 
            // we will not process it unless the client has specifically expressed
            // an interested in these messages by setting 'discardStale' to false.
            //
            if (operation !== 'delete' && thingShadows[thingName].discardStale === true) {
               if (deviceOptions.debug === true) {
                  console.warn('out-of-date version \'' + version + '\' on \'' +
                     thingName + '\' (local version \'' +
                     thingShadows[thingName].version + '\')');
               }
               return;
            }
         }
      }
      //
      // If this is a 'delta' message, emit an event for it and return.
      //
      if (operationStatus === 'delta') {
         this.emit('delta', thingName, stateObject);
         return;
      }
      //
      // only accepted/rejected messages past this point
      // ===============================================
      // If this is an unkown clientToken (e.g., it doesn't have a corresponding
      // client token property, the shadow has been modified by another client.
      // If it's an update/accepted or delete/accepted, update the shadow and
      // notify the client.
      //
      if (isUndefined(thingShadows[thingName].clientToken) ||
         thingShadows[thingName].clientToken !== clientToken) {
         if ((operationStatus === 'accepted') && (operation !== 'get')) {
            //
            // This is a foreign update or delete accepted, update our
            // shadow with the latest state and send a notification.
            //
            this.emit('foreignStateChange', thingName, operation, stateObject);
         }
         return;
      }
      //
      // A response has been received, so cancel any outstanding timeout on this
      // thingName/clientToken, delete the timeout handle, and unsubscribe from
      // all sub-topics.
      //
      clearTimeout(
         thingShadows[thingName].timeout);

      delete thingShadows[thingName].timeout;
      //
      // Delete the operation's client token.
      //
      delete thingShadows[thingName].clientToken;
      //
      // Mark this operation as complete.
      //
      thingShadows[thingName].pending = false;

      //
      // Unsubscribe from the 'accepted' and 'rejected' sub-topics unless we are
      // persistently subscribed to this thing shadow.
      //
      if (thingShadows[thingName].persistentSubscribe === false) {
         this._handleSubscriptions(thingName, [{
            operations: [operation],
            statii: ['accepted', 'rejected']
         }], 'unsubscribe');
      }

      //
      // Emit an event detailing the operation status; the clientToken is included
      // as an argument so that the application can correlate status events to
      // the operations they are associated with.
      //
      this.emit('status', thingName, operationStatus, clientToken, stateObject);
   };

   device.on('connect', function() {
      that.emit('connect');
   });
   device.on('close', function() {
      that.emit('close');
   });
   device.on('reconnect', function() {
      that.emit('reconnect');
   });
   device.on('offline', function() {
      that.emit('offline');
   });
   device.on('error', function(error) {
      that.emit('error', error);
   });
   device.on('packetsend', function(packet) {
      that.emit('packetsend', packet);
   });
   device.on('packetreceive', function(packet) {
      that.emit('packetreceive', packet);
   });
   device.on('message', function(topic, payload) {

      if (connected === true) {
         //
         // Parse the topic to determine what to do with it.
         //
         var topicTokens = topic.split('/');
         //
         // First, do a rough check to see if we should continue or not.
         //
         if (isThingShadowTopic(topicTokens, 'subscribe')) {
            //
            // This looks like a valid Thing topic, so see if the Thing is in the
            // registered Thing table.
            //
            if (thingShadows.hasOwnProperty(topicTokens[2])) {
               //
               // This is a registered Thing, so perform message handling on it.
               //
               that._handleMessages(topicTokens[2], // thingName
                  topicTokens[4], // operation
                  topicTokens[5], // status
                  payload);
            }
            //
            // Any messages received for unregistered Things fall here and are ignored.
            //
         } else {
            //
            // This isn't a Thing topic, so pass it along to the instance if they have
            // indicated they want to handle it.
            //
            that.emit('message', topic, payload);
         }
      }
   });

   this._thingOperation = function(thingName, operation, stateObject) {
      var rc = null;

      if (thingShadows.hasOwnProperty(thingName)) {
         //
         // Don't allow a new operation if an existing one is still in process.
         //
         if (thingShadows[thingName].pending === false) {
            //
            // Starting a new operation
            //
            thingShadows[thingName].pending = true;
            //
            // If not provided, construct a clientToken from the clientId and a rolling 
            // operation count.  The clientToken is transmitted in any published stateObject 
            // and is returned to the caller for each operation.  Applications can use
            // clientToken values to correlate received responses or timeouts with
            // the original operations.
            //
            var clientToken;

            if (isUndefined(stateObject.clientToken)) {
               //
               // AWS IoT restricts client tokens to 64 bytes, so use only the last 48
               // characters of the client ID when constructing a client token.
               //
               var clientIdLength = deviceOptions.clientId.length;

               if (clientIdLength > 48) {
                  clientToken = deviceOptions.clientId.substr(clientIdLength - 48) + '-' + operationCount++;
               } else {
                  clientToken = deviceOptions.clientId + '-' + operationCount++;
               }
            } else {
               clientToken = stateObject.clientToken;
            }
            //
            // Remember the client token for this operation; it will be
            // deleted when the operation completes or times out.
            //
            thingShadows[thingName].clientToken = clientToken;

            var publishTopic = buildThingShadowTopic(thingName,
               operation);
            //
            // Subscribe to the 'accepted' and 'rejected' sub-topics for this get
            // operation and set a timeout beyond which they will be unsubscribed if 
            // no messages have been received for either of them.
            //
            thingShadows[thingName].timeout = setTimeout(
               function(thingName, clientToken) {
                  //
                  // Timed-out.  Unsubscribe from the 'accepted' and 'rejected' sub-topics unless
                  // we are persistently subscribing to this thing shadow.
                  //
                  if (thingShadows[thingName].persistentSubscribe === false) {
                     that._handleSubscriptions(thingName, [{
                        operations: [operation],
                        statii: ['accepted', 'rejected']
                     }], 'unsubscribe');
                  }
                  //
                  // Mark this operation as complete.
                  //
                  thingShadows[thingName].pending = false;

                  //
                  // Delete the timeout handle and client token for this thingName.
                  //
                  delete thingShadows[thingName].timeout;
                  delete thingShadows[thingName].clientToken;

                  //
                  // Emit an event for the timeout; the clientToken is included as an argument
                  // so that the application can correlate timeout events to the operations
                  // they are associated with.
                  //
                  that.emit('timeout', thingName, clientToken);


               }, operationTimeout,
               thingName, clientToken);
            //
            // Subscribe to the 'accepted' and 'rejected' sub-topics unless we are
            // persistently subscribing, in which case we can publish to the topic immediately
            // since we are already subscribed to all applicable sub-topics.
            //
            if (thingShadows[thingName].persistentSubscribe === false) {
               this._handleSubscriptions(thingName, [{
                     operations: [operation],
                     statii: ['accepted', 'rejected'],
                  }], 'subscribe',
                  function(err, failedTopics) {
                     if (!isUndefined(err) || !isUndefined(failedTopics)) {
                        console.warn('failed subscription to accepted/rejected topics');
                        return;
                     }

                     //
                     // If 'stateObject' is defined, publish it to the publish topic for this
                     // thingName+operation.
                     //
                     if (!isUndefined(stateObject)) {
                        //
                        // Add the version # (if known and versioning is enabled) and 
                        // 'clientToken' properties to the stateObject.
                        //
                        if (!isUndefined(thingShadows[thingName].version) &&
                           thingShadows[thingName].enableVersioning) {
                           stateObject.version = thingShadows[thingName].version;
                        }
                        stateObject.clientToken = clientToken;

                        device.publish(publishTopic,
                           JSON.stringify(stateObject), {
                              qos: thingShadows[thingName].qos
                           });
                        if (!(isUndefined(thingShadows[thingName])) &&
                           thingShadows[thingName].debug === true) {
                           console.log('publishing \'' + JSON.stringify(stateObject) +
                              ' on \'' + publishTopic + '\'');
                        }
                     }
                  });
            } else {
               //
               // Add the version # (if known and versioning is enabled) and 
               // 'clientToken' properties to the stateObject.
               //
               if (!isUndefined(thingShadows[thingName].version) &&
                  thingShadows[thingName].enableVersioning) {
                  stateObject.version = thingShadows[thingName].version;
               }
               stateObject.clientToken = clientToken;

               device.publish(publishTopic,
                  JSON.stringify(stateObject), {
                     qos: thingShadows[thingName].qos
                  });
               if (thingShadows[thingName].debug === true) {
                  console.log('publishing \'' + JSON.stringify(stateObject) +
                     ' on \'' + publishTopic + '\'');
               }
            }
            rc = clientToken; // return the clientToken to the caller
         } else {
            if (deviceOptions.debug === true) {
               console.error(operation + ' still in progress on thing: ', thingName);
            }
         }
      } else {
         if (deviceOptions.debug === true) {
            console.error('attempting to ' + operation + ' unknown thing: ', thingName);
         }
      }
      return rc;
   };

   this.register = function(thingName, options, callback) {

      if (!thingShadows.hasOwnProperty(thingName)) {
         //
         // Initialize the registration entry for this thing; because the version # is 
         // not yet known, do not add the property for it yet. The version number 
         // property will be added after the first accepted update from AWS IoT.
         //
         var ignoreDeltas = false;
         var topicSpecs = [];
         thingShadows[thingName] = {
            persistentSubscribe: true,
            debug: false,
            discardStale: true,
            enableVersioning: true,
            qos: 0,
            pending: true
         };
         if (typeof options === 'function') {
            callback = options;
            options = null;
         }
         if (!isUndefined(options)) {
            if (!isUndefined(options.ignoreDeltas)) {
               ignoreDeltas = options.ignoreDeltas;
            }
            if (!isUndefined(options.persistentSubscribe)) {
               thingShadows[thingName].persistentSubscribe = options.persistentSubscribe;
            }
            if (!isUndefined(options.debug)) {
               thingShadows[thingName].debug = options.debug;
            }
            if (!isUndefined(options.discardStale)) {
               thingShadows[thingName].discardStale = options.discardStale;
            }
            if (!isUndefined(options.enableVersioning)) {
               thingShadows[thingName].enableVersioning = options.enableVersioning;
            }
            if (!isUndefined(options.qos)) {
               thingShadows[thingName].qos = options.qos;
            }
         }
         //
         // Always listen for deltas unless requested otherwise.
         //
         if (ignoreDeltas === false) {
            topicSpecs.push({
               operations: ['update'],
               statii: ['delta']
            });
         }
         //
         // If we are persistently subscribing, we subscribe to everything we could ever
         // possibly be interested in.  This will provide us the ability to publish
         // without waiting at the cost of potentially increased irrelevant traffic
         // which the application will need to filter out.
         //
         if (thingShadows[thingName].persistentSubscribe === true) {
            topicSpecs.push({
               operations: ['update', 'get', 'delete'],
               statii: ['accepted', 'rejected']
            });
         }

         if (topicSpecs.length > 0) {
            this._handleSubscriptions(thingName, topicSpecs, 'subscribe', function(err, failedTopics) {
               if (isUndefined(err) && isUndefined(failedTopics)) {
                  thingShadows[thingName].pending = false;
               }
               if (!isUndefined(callback)) {
                  callback(err, failedTopics);
               }
            });
         } else {
            thingShadows[thingName].pending = false;
            if (!isUndefined(callback)) {
               callback();
            }
         }

      } else {
         if (deviceOptions.debug === true) {
            console.error('thing already registered: ', thingName);
         }
      }
   };

   this.unregister = function(thingName) {
      if (thingShadows.hasOwnProperty(thingName)) {
         var topicSpecs = [];

         //
         // If an operation is outstanding, it will have a timeout set; when it
         // expires any accept/reject sub-topic subscriptions for the thing will be 
         // deleted.  If any messages arrive after the thing has been deleted, they
         // will simply be ignored as it no longer exists in the thing registrations.
         // The only sub-topic we need to unsubscribe from is the delta sub-topic,
         // which is always active.
         //
         topicSpecs.push({
            operations: ['update'],
            statii: ['delta']
         });
         //
         // If we are persistently subscribing, we subscribe to everything we could ever
         // possibly be interested in; this means that when it's time to unregister
         // interest in a thing, we need to unsubscribe from all of these topics.
         //
         if (thingShadows[thingName].persistentSubscribe === true) {
            topicSpecs.push({
               operations: ['update', 'get', 'delete'],
               statii: ['accepted', 'rejected']
            });
         }

         this._handleSubscriptions(thingName, topicSpecs, 'unsubscribe');

         //
         // Delete any pending timeout
         //
         if (!isUndefined(thingShadows[thingName].timeout)) {
            clearTimeout(thingShadows[thingName].timeout);
         }
         //
         // Delete the thing from the Thing registrations.
         //
         delete thingShadows[thingName];
      } else {
         if (deviceOptions.debug === true) {
            console.error('attempting to unregister unknown thing: ', thingName);
         }
      }
   };

   //
   // Perform an update operation on the given thing shadow.
   //
   this.update = function(thingName, stateObject) {
      var rc = null;
      //
      // Verify that the message does not contain a property named 'version',
      // as these property is reserved for use within this class.
      //
      if (isUndefined(stateObject.version)) {
         rc = that._thingOperation(thingName, 'update', stateObject);
      } else {
         console.error('message can\'t contain \'version\' property');
      }
      return rc;
   };

   //
   // Perform a get operation on the given thing shadow; allow the user
   // to specify their own client token if they don't want to use the
   // default.
   //
   this.get = function(thingName, clientToken) {
      var stateObject = {};
      if (!isUndefined(clientToken)) {
         stateObject.clientToken = clientToken;
      }
      return that._thingOperation(thingName, 'get', stateObject);
   };

   //
   // Perform a delete operation on the given thing shadow.
   //
   this.delete = function(thingName, clientToken) {
      var stateObject = {};
      if (!isUndefined(clientToken)) {
         stateObject.clientToken = clientToken;
      }
      return that._thingOperation(thingName, 'delete', stateObject);
   };
   //
   // Publish on non-thing topics.
   //
   this.publish = function(topic, message, options, callback) {
      if (!isReservedTopic(topic)) {
         device.publish(topic, message, options, callback);
      } else {
         throw ('cannot publish to reserved topic \'' + topic + '\'');
      }
   };

   //
   // Subscribe to non-thing topics.
   //
   this.subscribe = function(topics, options, callback) {
      var topicsArray = [];
      if (typeof topics === 'string') {
         topicsArray.push(topics);
      } else if (typeof topics === 'object' && topics.length) {
         topicsArray = topics;
      }
      for (var i = 0; i < topicsArray.length; i++) {
         if (isReservedTopic(topicsArray[i])) {
            throw ('cannot subscribe to topic array since one of them is a reserved topic \'' + topicsArray[i] + '\'');
         }
      }
      device.subscribe(topicsArray, options, callback);
   };
   //
   // Unsubscribe from non-thing topics.
   //
   this.unsubscribe = function(topics, callback) {
      var topicsArray = [];
      if (typeof topics === 'string') {
         topicsArray.push(topics);
      } else if (typeof topics === 'object' && topics.length) {
         topicsArray = topics;
      }
      for (var i = 0; i < topicsArray.length; i++) {
         if (isReservedTopic(topicsArray[i])) {
            throw ('cannot unsubscribe from topic array since one of them is a reserved topic \'' + topicsArray[i] + '\'');
         }
      }
      device.unsubscribe(topicsArray, callback);
   };
   //
   // Close the device connection; this will be passed through to
   // the device class.
   //
   this.end = function(force, callback) {
      device.end(force, callback);
   };
   //
   // Call this function to update the credentials used when
   // connecting via WebSocket/SigV4; this will be passed through
   // to the device class.
   //
   this.updateWebSocketCredentials = function(accessKeyId, secretKey, sessionToken, expiration) {
      device.updateWebSocketCredentials(accessKeyId, secretKey, sessionToken, expiration);
   };
   //
   // Call this function to update the custom auth headers
   // This will be passed through to the device class
   //
   this.updateCustomAuthHeaders = function(newHeaders) {
      device.updateCustomAuthHeaders(newHeaders);
   };

   //
   // This is an unpublished API used for testing.
   //
   this.setConnectionStatus = function(connectionStatus) {
      connected = connectionStatus;
   };
   events.EventEmitter.call(this);
}

//
// Allow instances to listen in on events that we produce for them
//
inherits(ThingShadowsClient, events.EventEmitter);

module.exports = ThingShadowsClient;

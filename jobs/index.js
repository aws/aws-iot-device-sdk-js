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
var events = require('events');
var inherits = require('util').inherits;

//npm deps

//app deps
var deviceModule = require('../device');
var isUndefined = require('../common/lib/is-undefined');

//
// private functions
//

function isJobTopic(topicTokens) {
   //
   // Job topics have the forms:
   //
   //      $aws/things/{thingName}/jobs/#
   //
   return (topicTokens[0] === '$aws' && topicTokens[1] === 'things' && topicTokens[3] === 'jobs');
}

function buildJobTopic(thingName, jobId, operation) {
   var result = '$aws/things/' + thingName + '/jobs/';

   // check for omitted jobId and fixup parameters
   if (isUndefined(operation)) {
      operation = jobId;
   } else {
      result += jobId.toString() + '/';
   }

   result += operation;

   return result;
}


//begin module

function jobsClient(options) {
   //
   // Force instantiation using the 'new' operator; this will cause inherited
   // constructors (e.g. the 'events' class) to be called.
   //
   if (!(this instanceof jobsClient)) {
      return new jobsClient(options);
   }

   //
   // A copy of 'this' for use inside of closures
   //
   var that = this;

   //
   // Track job subscriptions
   //
   // [
   //    {
   //       "thingName": "string",
   //       "operations": [
   //          {
   //             "operationName": "string",  // if null then treat as default
   //             "currentJob": job,
   //             "callback": callback
   //          }
   //       ]
   //    }
   // ]
   //
   var jobSubscriptions = [];

   //
   // Instantiate the device
   //
   var device = deviceModule.DeviceClient(options);

   //
   // Private function to update job execution status for given thing
   //
   this._updateJobStatus = function(thingName, job, status, statusDetails, callback) {
      // Check for omitted statusDetails and update parameters
      if (typeof statusDetails === 'function') {
         callback = statusDetails;
         statusDetails = undefined;
      }

      if ((!isUndefined(options)) && (options.debug === true)) {
         console.log('updateJobStatus:', { thingName: thingName, jobId: job.id, status: status, statusDetails: statusDetails });
      }

      device.publish(buildJobTopic(thingName, job.id, 'update'), JSON.stringify({ status: status, statusDetails: statusDetails}), null, function(err) {
         if (isUndefined(err)) {
            job.status = { status: status, statusDetails: statusDetails };
         }

         if (!isUndefined(callback)) {
            callback(err);
         }
      });
   };

   //
   // Private function to build job object for passing to callback supplied in subscribeToJobs
   //
   this._buildJobObject = function(thingName, jobExecution) {
      if (isUndefined(jobExecution) || isUndefined(jobExecution.jobId)) {
         return null;
      }

      var job = {};

      job.id = jobExecution.jobId;
      job.document = jobExecution.jobDocument;
      job.operation = job.document.operation;
      job.status = { status: jobExecution.status, statusDetails: jobExecution.statusDetails };

      job.inProgress = function(statusDetails, callback) {
         that._updateJobStatus(thingName, job, 'IN_PROGRESS', statusDetails, callback);
      };

      job.failed = function(statusDetails, callback) {
         that._updateJobStatus(thingName, job, 'FAILED', statusDetails, callback);
      };

      job.succeeded = function(statusDetails, callback) {
         that._updateJobStatus(thingName, job, 'SUCCEEDED', statusDetails, callback);
      };

      return job;
   };

   //
   // Private function to handle job messages and process them accordingly
   //
   this._handleMessages = function(topic, payload) {
      var topicTokens = topic.split('/');

      // If not a job topic emit to application and return
      if (!isJobTopic(topicTokens)) {
         that.emit('message', topic, payload);
         return;
      }

      var thingName = topicTokens[2];

      var thing = jobSubscriptions.find(function(elem) {
         return elem.thingName === thingName;
      });

      // Do nothing if thing not found in job subscriptions
      if (isUndefined(thing)) {
         return;
      }

      var jobExecutionData = {};

      try {
         jobExecutionData = JSON.parse(payload.toString());
      } catch (err) {
         if (options.debug === true) {
            console.error('failed parsing JSON \'' + payload.toString() + '\', ' + err);
         }
         return;
      }

      if (isUndefined(jobExecutionData.execution) ||
          isUndefined(jobExecutionData.execution.jobId) ||
          isUndefined(jobExecutionData.execution.jobDocument)) {
         return;
      }

      var operationName = jobExecutionData.execution.jobDocument.operation;
      var operation = thing.operations.find(function(elem) {
         return (isUndefined(operationName) ? isUndefined(elem.operationName) : operationName === elem.operationName);
      });

      // If operation subscription not found by operation name then look for default operation subscription
      if (isUndefined(operation)) {
         operation = thing.operations.find(function(elem) { return (isUndefined(elem.operationName)); });

         if (isUndefined(operation)) {
            return;
         }
      }

      operation.callback(null, that._buildJobObject(thingName, jobExecutionData.execution));
   };

   this.subscribeToJobs = function(thingName, operationName, callback) {
      // Check for omitted optional operationName and fixup parameters
      if (isUndefined(callback)) {
         callback = operationName;
         operationName = null;
      }

      if ((!isUndefined(options)) && (options.debug === true)) {
         console.log('subscribeToJobs:', { thingName: thingName, operationName: operationName });
      }

      var thing = jobSubscriptions.find(function(elem) {
         return elem.thingName === thingName;
      });

      // Check for previously unseen thing and add to job subscriptions
      if (isUndefined(thing)) {
         thing = { thingName: thingName, operations: [] };
         jobSubscriptions.push(thing);

         device.subscribe([ buildJobTopic(thingName, '$next/get/accepted'), buildJobTopic(thingName, 'notify-next') ], function(err, granted) {
            if (!isUndefined(err)) {
               callback(err);
            }
         });
      }

      // Find existing subscription for the given operationName
      var operation = thing.operations.find(function(elem) {
         return (isUndefined(operationName) ? isUndefined(elem.operationName) : operationName === elem.operationName);
      });

      // If existing subscription found then update callback, otherwise create new entry in the thing's operations array
      if (!isUndefined(operation)) {
         operation.callback = callback;
      } else {
         operation = { operationName: operationName, callback: callback };
         thing.operations.push(operation);
      }
   };

   this.unsubscribeFromJobs = function(thingName, operationName, callback) {
      // Check for omitted optional operationName and fixup parameters
      if (isUndefined(callback)) {
         callback = operationName;
         operationName = null;
      }

      if ((!isUndefined(options)) && (options.debug === true)) {
         console.log('unsubscribeFromJobs:', { thingName: thingName, operationName: operationName });
      }

      var iThing = jobSubscriptions.findIndex(function(elem) {
         return elem.thingName === thingName;
      });

      var notFoundError = new Error('subscription not found for given thing');

      // Check for previously unseen thing and add to job subscriptions and publish to get to retrieve first job to be executed
      if (iThing < 0) {
         callback(notFoundError);
         return;
      }

      var iOperation = jobSubscriptions[iThing].operations.findIndex(function (elem) {
         return (isUndefined(operationName) ? isUndefined(elem.operationName) : operationName === elem.operationName);
      });

      if (iOperation < 0) {
         callback(notFoundError);
         return;
      }

      jobSubscriptions[iThing].operations.splice(iOperation, 1);

      if (jobSubscriptions[iThing].operations.length === 0) {
         jobSubscriptions.splice(iThing, 1);
         device.unsubscribe([ buildJobTopic(thingName, '$next/get/accepted'), buildJobTopic(thingName, 'notify-next') ], callback);
         return;
      }

      callback();
   };

   this.startJobNotifications = function(thingName, callback) {
      if ((!isUndefined(options)) && (options.debug === true)) {
         console.log('startJobNotifications:', { thingName: thingName });
      }

      device.publish(buildJobTopic(thingName, '$next', 'get'), '{}', callback);
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

   device.on('message', that._handleMessages);

   this.publish = device.publish;
   this.subscribe = device.subscribe;
   this.unsubscribe = device.unsubscribe;
   this.end = device.end;
   this.handleMessage = device.handleMessage;
   this.updateWebSocketCredentials = device.updateWebSocketCredentials;

   //
   // Used for integration testing only
   //
   this.simulateNetworkFailure = device.simulateNetworkFailure;
}

//
// Allow instances to listen in on events that we produce for them
//
inherits(jobsClient, events.EventEmitter);

module.exports = jobsClient;

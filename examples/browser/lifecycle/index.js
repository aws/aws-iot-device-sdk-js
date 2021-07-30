/*
 * Copyright 2015-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

//
// Instantiate the AWS SDK and configuration objects.  The AWS SDK for
// JavaScript (aws-sdk) is used for Cognito Identity/Authentication, and
// the AWS IoT SDK for JavaScript (aws-iot-device-sdk) is used for the
// WebSocket connection to AWS IoT and device shadow APIs.
//
var AWS = require('aws-sdk');
var AWSIoTData = require('aws-iot-device-sdk');
var AWSConfiguration = require('./aws-configuration.js');

console.log('Loaded AWS SDK for JavaScript and AWS IoT SDK for Node.js');

//
// Remember whether or not we have subscribed to AWS IoT lifecycle events.
//
var subscribedToLifeCycleEvents = false;

//
// Remember the clients we learn about in here.
//
var clients = {};

//
// Create a client id to use when connecting to AWS IoT.
//
var clientId = 'lifecycle-monitor-' + (Math.floor((Math.random() * 100000) + 1));

//
// Initialize our configuration.
//
AWS.config.region = AWSConfiguration.region;

AWS.config.credentials = new AWS.CognitoIdentityCredentials({
   IdentityPoolId: AWSConfiguration.poolId
});

//
// Create the AWS IoT device object.  Note that the credentials must be
// initialized with empty strings; when we successfully authenticate to
// the Cognito Identity Pool, the credentials will be dynamically updated.
//
const mqttClient = AWSIoTData.device({
   //
   // Set the AWS region we will operate in.
   //
   region: AWS.config.region,
   //
   // Set the AWS IoT Host Endpoint
   // //
   host:AWSConfiguration.host,
   //
   // Use the clientId created earlier.
   //
   clientId: clientId,
   //
   // Connect via secure WebSocket
   //
   protocol: 'wss',
   //
   // Set the maximum reconnect time to 8 seconds; this is a browser application
   // so we don't want to leave the user waiting too long for reconnection after
   // re-connecting to the network/re-opening their laptop/etc...
   //
   maximumReconnectTimeMs: 8000,
   //
   // Enable console debugging information (optional)
   //
   debug: true,
   //
   // IMPORTANT: the AWS access key ID, secret key, and sesion token must be
   // initialized with empty strings.
   //
   accessKeyId: '',
   secretKey: '',
   sessionToken: ''
});

//
// Attempt to authenticate to the Cognito Identity Pool.  Note that this
// example only supports use of a pool which allows unauthenticated
// identities.
//
var cognitoIdentity = new AWS.CognitoIdentity();
AWS.config.credentials.get(function(err, data) {
   if (!err) {
      console.log('retrieved identity: ' + AWS.config.credentials.identityId);
      var params = {
         IdentityId: AWS.config.credentials.identityId
      };
      cognitoIdentity.getCredentialsForIdentity(params, function(err, data) {
         if (!err) {
            //
            // Now, pull all rows from the DynamoDB table containing the currently
            // connected clients.
            //
            var docClient = new AWS.DynamoDB.DocumentClient();

            var params = {
               TableName: 'LifecycleEvents',
               ProjectionExpression: 'clientId'
            };

            console.log('scanning dynamodb...');
            docClient.scan(params, function(err, data) {
               if (!err) {
                  console.log('successfully scanned lifecycle events table');
                  data.Items.forEach(function(object) {
                     console.log('found client: ' + object.clientId);
                     var divName = 'div-' + object.clientId.replace(/-|\s/g, '');
                     if (window.isUndefined(clients[divName])) {
                        //
                        // This is a currently connected client; create a new div for
                        // it and append it to the list of client divs.
                        //
                        var clientsDiv = document.getElementById('clients-div');
                        var newDiv = document.createElement(divName);
                        newDiv.innerHTML = object.clientId;
                        newDiv.style.visibility = 'visible';
                        newDiv.setAttribute('class', 'stack');
                        clientsDiv.appendChild(newDiv);
                        //
                        // Remember this client
                        //
                        clients[divName] = newDiv;
                     }
                  });
               } else {
                  console.log('error scanning lifecycle events table: ' + JSON.stringify(err, null, 2));
               }
            });
            //
            // Update our latest AWS credentials; the MQTT client will use these
            // during its next reconnect attempt.
            //
            mqttClient.updateWebSocketCredentials(data.Credentials.AccessKeyId,
               data.Credentials.SecretKey,
               data.Credentials.SessionToken);
         } else {
            console.log('error retrieving credentials: ' + err);
            alert('error retrieving credentials: ' + err);
         }
      });
   } else {
      console.log('error retrieving identity:' + err);
      alert('error retrieving identity: ' + err);
   }
});

//
// Connect handler; update div visibility and fetch latest shadow documents.
// Subscribe to lifecycle events on the first connect event.
//
window.mqttClientConnectHandler = function() {
   console.log('connect');
   document.getElementById('connecting-div').style.visibility = 'hidden';
   document.getElementById('clients-div').style.visibility = 'visible';

   //
   // We only subscribe to lifecycle events once.
   //
   if (!subscribedToLifeCycleEvents) {
      mqttClient.subscribe('$aws/events/#');
      subscribedToLifeCycleEvents = true;
   }
};

//
// Reconnect handler; update div visibility.
//
window.mqttClientReconnectHandler = function() {
   console.log('reconnect');
   document.getElementById('connecting-div').style.visibility = 'visible';
   document.getElementById('clients-div').style.visibility = 'hidden';
};

//
// Utility function to determine if a value has been defined.
//
window.isUndefined = function(value) {
   return typeof value === 'undefined' || typeof value === null;
};

//
// Message handler for lifecycle events; create/destroy divs as clients
// connect/disconnect.
//
window.mqttClientMessageHandler = function(topic, payload) {
   var topicTokens = topic.split('/');

   console.log('message: ' + topic + ':' + payload.toString());

   if ((topicTokens[0] === '$aws') &&
      (topicTokens[1] === 'events') &&
      (topicTokens[2] === 'presence') &&
      (topicTokens.length === 5)) {
      //
      // This is a presence event, topicTokens[3] contains the event
      // and topicTokens[4] contains the client name.
      //
      var clientIdString = topicTokens[4];
      var divName = 'div-' + clientIdString.replace(/-|\s/g, '');
      if (!window.isUndefined(clients[divName])) {
         //
         // We know about this client, so a div should exist for it.
         //
         var clientDiv = clients[divName];
         if (topicTokens[3] === 'disconnected') {
            //
            // Delete this div, the client has disconnected.
            //
            clientDiv.parentNode.removeChild(clientDiv);
            //
            // Forget this client
            //
            delete clients[divName];
         }
      } else {
         //
         // We have never seen this client before; if it's a connect
         // event, we'll create a new div for it.  If it isn't, it
         // was connected before we began running so we ignore it.
         // Also ignore any events for our own client ID.
         //
         if ((topicTokens[3] === 'connected') &&
            (clientIdString !== clientId)) {
            //
            // This is a newly connected client; create a new div for
            // it and append it to the list of client divs.
            //
            var clientsDiv = document.getElementById('clients-div');
            var newDiv = document.createElement(divName);
            newDiv.innerHTML = clientIdString;
            newDiv.style.visibility = 'visible';
            newDiv.setAttribute('class', 'stack');
            clientsDiv.appendChild(newDiv);
            //
            // Remember this client
            //
            clients[divName] = newDiv;
         }
      }
   } else {
      console.log('unrecognized topic :' + topic);
   }
};

//
// Install connect/reconnect event handlers.
//
mqttClient.on('connect', window.mqttClientConnectHandler);
mqttClient.on('reconnect', window.mqttClientReconnectHandler);
mqttClient.on('message', window.mqttClientMessageHandler);

//
// Initialize divs.
//
document.getElementById('connecting-div').style.visibility = 'visible';
document.getElementById('clients-div').style.visibility = 'hidden';
document.getElementById('connecting-div').innerHTML = '<p>attempting to connect to aws iot...</p>';
document.getElementById('clients-div').innerHTML = '<p>connected clients</p>';

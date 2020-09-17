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
const filesys = require('fs');
//npm deps

//app deps
var rewire = require('rewire');
var sinon = require('sinon');
var assert = require('assert');
var mqtt = require('mqtt');
var myTls = rewire('../device/lib/tls');
var mockTls = require('./mock/mockTls');
var mockMQTTClient = require('./mock/mockMQTTClient');

describe( "device class unit tests", function() {
    var deviceModule = require('../').device; 

    var mockMQTTClientObject;
    var fakeConnect;
    var mqttSave;
    var mockTlsRevert;
    var mockMqttRevert;

    var mockTlsObject = new mockTls();
    var mockMqttObject = new mockTls.mqtt();

    beforeEach( function () {

        // Mock the connect API for mqtt.js
        fakeConnect = function(wrapper,options) {
            mockMQTTClientObject = new mockMQTTClient(); // return the mocking object
            mockMQTTClientObject.reInitCommandCalled();
            mockMQTTClientObject.resetPublishedMessage();
            return mockMQTTClientObject;
        };

        mqttSave = sinon.stub(mqtt, 'MqttClient', fakeConnect);

        mockTlsRevert = myTls.__set__("tls", mockTlsObject);
        mockMqttRevert = myTls.__set__("mqtt", mockMqttObject);
    });
    afterEach( function () {
        mqttSave.restore();
        mockTlsRevert();
        mockMqttRevert();
    });

    describe("TLS handler calls the correct functions", function() {
      it("calls the correct functions", function() {
            mockTlsObject.reInitCommandCalled();
            myTls(mockMqttObject, { 'testOption': true } );
            assert.equal(mockTlsObject.commandCalled['connect'], 1);
            assert.equal(mockTlsObject.commandCalled['on'], 2);
            assert.equal(mockTlsObject.commandCalled['emit'], 1);
            assert.equal(mockMqttObject.commandCalled['emit'], 1);
      })
    });

   describe( "device is instantiated with empty parameters", function() {
//
// Verify that the device module throws an exception when all
// parameters are empty.
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with no public key", function() {
//
// Verify that the device module throws an exception when there is
// no valid public key file.
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               certPath:'test/data/certificate.pem.crt',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with no CA certificate", function() {
//
// Verify that the device module throws an exception when there is
// no valid CA certificate file.
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key', 
               certPath:'test/data/certificate.pem.crt', 
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });


   describe( "device is instantiated with no client certificate", function() {
//
// Verify that the device module throws an exception when there is
// no valid client certificate file.
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key', 
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with invalid key path", function() {
//
// Verify that the device module throws an exception when key is not valid. 
// 
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key-1', 
               certPath:'test/data/certificate.pem.crt', 
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               }  );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with invalid cert path", function() {
//
// Verify that the device module throws an exception when certificate is not valid.
// 
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key', 
               certPath:'test/data/certificate.pem.crt-1', 
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               }  );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with invalid CA path", function() {
//
// Verify that the device module throws an exception when CA is not valid.
// 
//
      it("throws an exception", function() { 
         assert.throws( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key', 
               certPath:'test/data/certificate.pem.crt', 
               caPath:'test/data/root-CA.crt-1',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               }  );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device is instantiated with required parameters", function() {
//
// Verify that the device module doesn't throw an exception when all 
// parameters are specified correctly.
//
      it("does not throw an exception", function() { 
         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( { 
               keyPath:'test/data/private.pem.key', 
               certPath:'test/data/certificate.pem.crt', 
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               servername:'XXXX.iot.us-east-1.amazonaws.com'
               }  );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device accepts certificate data in buffer", function() {
//
// Verify that the device module accepts certificate and key data in buffers
// when using the properties generated by the AWS Console.
//
      it("does not throw an exception", function() { 
         var buffers = {};

         buffers.privateKey = filesys.readFileSync('test/data/private.pem.key');
         buffers.certificate = filesys.readFileSync('test/data/certificate.pem.crt');
         buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( { 
               clientCert: buffers.certificate,
               privateKey: buffers.privateKey,
               caCert:buffers.rootCA,
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device accepts certificate data in buffers+files", function() {
//
// Verify that the device module accepts certificate and key data in files
// as well as buffers when using the properties generated by the AWS Iot 
// Console.  
//
      it("does not throw an exception", function() { 
         var buffers = {};

         buffers.privateKey = filesys.readFileSync('test/data/private.pem.key');
         buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( { 
               clientCert:'test/data/certificate.pem.crt',
               privateKey: buffers.privateKey,
               caCert:buffers.rootCA,
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device accepts certificate data in buffers+files", function() {
//
// Verify that the device module accepts certificate and key data in files
// as well as buffers when using the properties generated by the AWS Iot 
// Console. 
//
      it("does not throw an exception", function() { 
         var buffers = {};

         buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( { 
               clientCert:'test/data/certificate.pem.crt',
               privateKey: 'test/data/private.pem.key',
               caCert:buffers.rootCA,
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device accepts certificate data in buffers+files", function() {
//
// Verify that the device module accepts certificate and key data in files
// using the properties generated by the AWS Iot Console.
//
      it("does not throw an exception", function() { 

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( { 
               clientCert:'test/data/certificate.pem.crt',
               privateKey: 'test/data/private.pem.key',
               caCert: 'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device ensures AWS Console clientCert property is a buffer or file", function() {
//
// Verify that the device module will not accept a client certificate property
// which is neither a file nor a buffer.
//
      it("throws an exception", function() { 

         assert.throws( function( err ) { 
            var device = deviceModule( { 
               clientCert: { },
               privateKey: 'test/data/private.pem.key',
               caCert: 'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device ensures AWS Console privateKey property is a buffer or file", function() {
//
// Verify that the device module will not accept a private key property
// which is neither a file nor a buffer.
//
      it("throws an exception", function() { 

         assert.throws( function( err ) { 
            var device = deviceModule( { 
               clientCert:'test/data/certificate.pem.crt',
               privateKey: { },
               caCert: 'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device ensures AWS Console caCert property is a buffer or file", function() {
//
// Verify that the device module will not accept a CA certificate property
// which is neither a file nor a buffer.
//
      it("throws an exception", function() { 

         assert.throws( function( err ) { 
            var device = deviceModule( { 
               clientCert:'test/data/certificate.pem.crt',
               privateKey: 'test/data/private.pem.key',
               caCert: { },
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device throws an exception if using websocket protocol without IAM credentials", function() {
//
// Verify that the device module throws an exception when incorrectly
// configured for websocket operation.
//
      it("throws exception", function() { 

         delete process.env.AWS_ACCESS_KEY_ID;
         delete process.env.AWS_SECRET_ACCESS_KEY;

         assert.throws( function( err ) { 
            var device = deviceModule( {
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               filename: ''
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device throws an exception if using websocket protocol with invalid credential files", function() {
//
// Verify that the device module throws an exception when incorrectly
// configured for websocket operation.
//
      it("throws exception", function() { 

         delete process.env.AWS_ACCESS_KEY_ID;
         delete process.env.AWS_SECRET_ACCESS_KEY;

         assert.throws( function( err ) { 
            var device = deviceModule( {
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               filename: './test/data/invalid_credentials'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device not throw an exception if using websocket protocol with filename specified in options", function() {
//
// Verify that the device module does not throw an exception when loading
// credentials from credential file// 
//
      it("does not throws exception", function() { 

         delete process.env.AWS_ACCESS_KEY_ID;
         delete process.env.AWS_SECRET_ACCESS_KEY;

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( {
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               filename: './test/data/credentials'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });

   describe( "device not throw an exception if using websocket protocol with filename specified in options as well as set in environment", function() {
//
// Verify that the device module does not throw an exception when provided
// both options and environment variables 
// 
//
      it("does not throws exception", function() { 

         process.env.AWS_ACCESS_KEY_ID='not a valid access key id';
         process.env.AWS_SECRET_ACCESS_KEY='not a valid secret access key';

         assert.doesNotThrow( function( err ) { 
            var device = deviceModule( {
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               filename: './test/data/credentials'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device throws an exception if using websocket protocol with no host specified", function() {
//
// Verify that the device module throws an exception when configured for
// websocket operation with no host specified.
//
      it("throws exception", function() { 

         assert.throws( function( err ) { 
            process.env.AWS_ACCESS_KEY_ID='not a valid access key id';
            process.env.AWS_SECRET_ACCESS_KEY='not a valid secret access key';
            var device = deviceModule( { 
               protocol: 'wss',
               debug: true
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device throws an exception if using websocket protocol with incorrect host specified", function() {
//
// Verify that the device module throws an exception when configured for
// websocket operation with incorrect host specified.
//
      it("throws exception", function() { 

         assert.throws( function( err ) { 
            process.env.AWS_ACCESS_KEY_ID='not a valid access key id';
            process.env.AWS_SECRET_ACCESS_KEY='not a valid secret access key';
            var device = deviceModule( {
               host:'not-a-valid-host.com', 
               protocol: 'wss',
               debug: true
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });

   describe( "device does not throw exception if using websocket protocol with IAM credentials in environment", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation.
//
      it("does not throw an exception", function() { 

         assert.doesNotThrow( function( err ) {
            process.env.AWS_ACCESS_KEY_ID='not a valid access key id';
            process.env.AWS_SECRET_ACCESS_KEY='not a valid secret access key';
            var device = deviceModule( { 
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               debug: true
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "device does not throw exception if using websocket protocol with IAM credentials in class options", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation.
//
      it("does not throw an exception", function() { 

         assert.doesNotThrow( function( err ) {
            var device = deviceModule( { 
               host:'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss',
               debug: true,
               accessKeyId: 'not a valid access key id',
               secretKey: 'not a valid secret access key',
               sessionToken: 'not a valid session token',
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
            ); 
      });
   });
   describe( "coverage: device doesn't throw exception if using websocket protocol with IAM credentials", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation.
//
      it("does not throw an exception", function() {

         assert.doesNotThrow( function( err ) {

            deviceModule.prepareWebSocketUrl( { host:'XXXX.iot.us-east-1.amazonaws.com', debug: true }, 'not a valid access key',
                                        'not a valid secret access key' );
            }, function(err) { console.log('\t['+err+']'); return true;}
            );
      });
   });
   describe("device does not throw exception if using CustomAuth with valid headers", function () {
      it("does not throw an exception", function () {
         assert.doesNotThrow(function (err) {
            var device = deviceModule({
               host: 'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss-custom-auth',
               customAuthHeaders: {
                  'X-Amz-CustomAuthorizer-Name': 'AuthorizerFunctionName',
                  'X-Amz-CustomAuthorizer-Signature': 'Signature',
                  'NPAuthorizerToken': 'Token'
               }
            });
         }, function (err) { console.log('\t[' + err + ']'); return true; }
         );
      });
   });
   describe("device throws exception if using CustomAuth over websocket without headers", function () {
      it("throws exception", function () {
         assert.throws(function (err) {
            var device = deviceModule({
               host: 'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss-custom-auth'
            });
         }, function (err) { console.log('\t[' + err + ']'); return true; }
         );
      });
   });
   describe("device does not throw exception if using CustomAuth over websocket with non-standard headers", function () {
      it("does not throw an exception", function () {
         assert.doesNotThrow(function (err) {
            var device = deviceModule({
               host: 'XXXX.iot.us-east-1.amazonaws.com',
               protocol: 'wss-custom-auth',
               customAuthHeaders: {
                  'Custom-Header-1': 'Value1',
                  'Custom-Header-2': 'Value2',
               }
            });
         }, function (err) { console.log('\t[' + err + ']'); return true; }
         );
      });
   });
   describe( "device doesn't accept invalid timing parameters: baseReconnectTimeMs<1", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:-1
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device doesn't accept invalid timing parameters: minimumConnectionTimeMs<baseReconnectTimeMs", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:500
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device doesn't accept invalid timing parameters: maximumReconnectTimeMs<baseReconnectTimeMs", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:500
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device accepts valid timing parameters", function() {
      it("does not throw an exception", function() {
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:5000
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device passes default keepalive time correctly", function(){
      it("does not throw an exception", function() {
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com'
            });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].keepalive, 300);
      });
   });
   describe( "device override default keepalive time when specified in options", function(){
      it("does not throw an exception", function(){
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com',
                  keepalive:600
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].keepalive, 600);
      });
   });
   describe( "device passes default username in options correctly", function(){
      it("does not throw an exception", function(){
         var metricPrefix = "?SDK=JavaScript&Version=";
         var pjson = require('../package.json');
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com'
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].username, metricPrefix + pjson.version);
      });
   });
   describe( "device does not passes default username when metics is disabled", function(){
      it("does not throw an exception", function(){
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com',
                  enableMetrics:false
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].username, undefined);
      });
   });
   describe( "Correct username is passed when user specified in options ", function(){
      it("does not throw an exception", function(){
         var metricPrefix = "?SDK=JavaScript&Version=";
         var pjson = require('../package.json');
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com',
                  username:'dummy-user-name'
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].username, 'dummy-user-name' + metricPrefix + pjson.version);
      });
   });
   describe( "Username will be concatenated if customer enable metrics but also provide username ", function(){
      it("does not throw an exception", function(){
         var metricPrefix = "?SDK=JavaScript&Version=";
         var pjson = require('../package.json');
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com',
                  enableMetrics: true,
                  username:'dummy-user-name'
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].username, 'dummy-user-name' + metricPrefix + pjson.version);
      });
   });
   describe( "Username will be overriden if customer disable metrics but provide username ", function(){
      it("does not throw an exception", function(){
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
                  certPath:'test/data/certificate.pem.crt',
                  keyPath:'test/data/private.pem.key',
                  caPath:'test/data/root-CA.crt',
                  clientId:'dummy-client-1',
                  host:'XXXX.iot.us-east-1.amazonaws.com',
                  enableMetrics: false,
                  username:'dummy-user-name'
               });
         }, function(err) { console.log('\t['+err+']'); return true;}
         );
         assert.equal(mqttSave.firstCall.args[1].username, 'dummy-user-name');
      });
   });
   describe( "device handles reconnect timing correctly", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

      it ("sets the reconnect period appropriately", function() {
         assert.doesNotThrow( function( err ) {
//
// Constants reconnection quiet time constants used in this test.
//
            const baseReconnectTimeMs     = 1000;
            const minimumConnectionTimeMs = 2500;
            const maximumReconnectTimeMs  = 128000;

            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:baseReconnectTimeMs,
               minimumConnectionTimeMs:minimumConnectionTimeMs,
               maximumReconnectTimeMs:maximumReconnectTimeMs
               } );
//
// Check reconnection timing and progression to maximum.
//
            mockMQTTClientObject.emit('connect');
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');

            for (i = 0, currentReconnectTimeMs = baseReconnectTimeMs*2; 
                 i < 7; 
                 i++, currentReconnectTimeMs*=2)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            currentReconnectTimeMs/=2;
            for (i = 0; i < 4; i++)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
//
// Check that an unstable connection doesn't reset the reconnection progression
// timing.
//
            mockMQTTClientObject.emit('connect');
            clock.tick( minimumConnectionTimeMs-1 );
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');
            clock.tick( minimumConnectionTimeMs );  // make sure timer was cleared
            mockMQTTClientObject.emit('reconnect');
            assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
//
// Check that a stable connection resets the reconnection progression timing.
//
            mockMQTTClientObject.emit('connect');
            clock.tick( minimumConnectionTimeMs+1 );
            assert.equal(mockMQTTClientObject.options.reconnectPeriod, baseReconnectTimeMs);
//
// And check that it progresses correctly again...
//
            mockMQTTClientObject.emit('close');

            mockMQTTClientObject.emit('connect');
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');
            for (i = 0, currentReconnectTimeMs = baseReconnectTimeMs*2; 
                 i < 7; 
                 i++, currentReconnectTimeMs*=2)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            currentReconnectTimeMs/=2;
            for (i = 0; i < 4; i++)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            }, function(err) { console.log('\t['+err+']'); return true;}
          );
      });
   });
//
// Verify that events from the mqtt client are propagated upwards
//
    describe("Ensure that events are propagated upwards", function() {
       it("should emit the corresponding events", function() {
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:128000
            } );
          // Register fake callbacks
          var fakeCallback1 = sinon.spy();
          var fakeCallback2 = sinon.spy();
          var fakeCallback3 = sinon.spy();
          var fakeCallback4 = sinon.spy();
          var fakeCallback5 = sinon.spy();
          var fakeCallback6 = sinon.spy();
          var fakeCallback7 = sinon.spy();
          var fakeCallback8 = sinon.spy();
          device.on('connect', fakeCallback1);
          device.on('close', fakeCallback2);
          device.on('reconnect', fakeCallback3);
          device.on('offline', fakeCallback4);
          device.on('error', fakeCallback5);
          device.on('message', fakeCallback6);
          device.on('packetsend', fakeCallback7);
          device.on('packetreceive', fakeCallback8);
          // Now emit messages
          mockMQTTClientObject.emit('connect');
          assert(fakeCallback1.calledOnce);
          sinon.assert.notCalled(fakeCallback2);
          sinon.assert.notCalled(fakeCallback3);
          sinon.assert.notCalled(fakeCallback4);
          sinon.assert.notCalled(fakeCallback5);
          sinon.assert.notCalled(fakeCallback6);
          sinon.assert.notCalled(fakeCallback7);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('close');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          sinon.assert.notCalled(fakeCallback3);
          sinon.assert.notCalled(fakeCallback4);
          sinon.assert.notCalled(fakeCallback5);
          sinon.assert.notCalled(fakeCallback6);
          sinon.assert.notCalled(fakeCallback7);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('reconnect');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          sinon.assert.notCalled(fakeCallback4);
          sinon.assert.notCalled(fakeCallback5);
          sinon.assert.notCalled(fakeCallback6);
          sinon.assert.notCalled(fakeCallback7);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('offline');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          sinon.assert.notCalled(fakeCallback5);
          sinon.assert.notCalled(fakeCallback6);
          sinon.assert.notCalled(fakeCallback7);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('error');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          assert(fakeCallback5.calledOnce);
          sinon.assert.notCalled(fakeCallback6);
          sinon.assert.notCalled(fakeCallback7);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('packetsend');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          assert(fakeCallback5.calledOnce);
          sinon.assert.notCalled(fakeCallback6);
          assert(fakeCallback7.calledOnce);
          sinon.assert.notCalled(fakeCallback8);
          mockMQTTClientObject.emit('packetreceive');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          assert(fakeCallback5.calledOnce);
          sinon.assert.notCalled(fakeCallback6);
          assert(fakeCallback7.calledOnce);
          assert(fakeCallback8.calledOnce);
          mockMQTTClientObject.emit('message');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          assert(fakeCallback5.calledOnce);
          assert(fakeCallback6.calledOnce);
          assert(fakeCallback7.calledOnce);
          assert(fakeCallback8.calledOnce);
        });
    });
//
// Verify that the end and handleMessage APIs are passed-through
//
    describe("Ensure that the end and handleMessage APIs are overriding", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should call the corresponding methods in mqtt", function() {
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:128000
            } );
          mockMQTTClientObject.emit('connect');
          device.end( false, null );
          assert.equal(mockMQTTClientObject.commandCalled['end'], 1); // Called once
          // simulate overriding handleMessage
          var expectedPacket = { data: 'packet data' };
          var calledOverride = 0;
          var calledBack = 0;
          device.handleMessage = function customHandleMessage(packet, callback) {
            calledOverride++;
            assert.deepEqual(packet, expectedPacket);
            callback();
          }
          mockMQTTClientObject.handleMessage(expectedPacket, function() {
            calledBack++;
            assert.equal(calledOverride, 1);
            assert.equal(calledBack, 1);
          })
          assert.equal(mockMQTTClientObject.commandCalled['end'], 1); // Called once
        });
    });
//
// Verify that subscriptions are sent to the mqtt client only after
// the connection has been established.  
//
    describe("Verify that subscriptions are automatically renewed after connection established", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should renew subscriptions after re-connecting", function() {
         // Test parameters
         var drainTimeMs = 250;
         // Reinit mockMQTTClientObject
         mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );
         device.subscribe( 'topic1', { }, null );
         device.subscribe( 'topic2', { }, null );
         device.subscribe( 'topic3', { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0); // Connection not yet established
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0); // Connection not yet established
         clock.tick( drainTimeMs * 3 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection established, subscriptions sent
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic1');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic2');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic3');
         device.unsubscribe('topic2' );
         mockMQTTClientObject.emit('close');
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         clock.tick( drainTimeMs * 2 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 5); // Connection established
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic1');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic3');
         device.subscribe( [ 'arrayTopic1', 'arrayTopic2', 'arrayTopic3', 'arrayTopic4' ], { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 6); // Connection established
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'arrayTopic1');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'arrayTopic2');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'arrayTopic3');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'arrayTopic4');
         mockMQTTClientObject.emit('close');
         device.unsubscribe('arrayTopic2' );
         device.unsubscribe('arrayTopic4' );
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 6); // Connection not yet established
         clock.tick( drainTimeMs * 4 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 10); // Connection established
        });
    });
//
// Verify that array subscriptions sent when offline are queued as an array request and
// then later sent as an array subscribe.
//
    describe("Verify that array subscriptions are queued as arrays", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should queue array subs as arrays", function() {
         // Test parameters
         var drainTimeMs = 250;
         // Reinit mockMQTTClientObject
         mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );
         device.subscribe( ['aTopic1','aTopic2','aTopic3'], { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0); // Connection not yet established
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0); // Connection not yet established
         clock.tick( drainTimeMs * 1 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 1); // Connection established, subscriptions sent
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'aTopic1'); // one subscribe request
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'aTopic2'); // but
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'aTopic3'); // three topics seen in client
        });
    });
//
// Verify subscribes and unsubscribes are queued when offline
//
    describe("Verify subscribes and unsubscribes are queued when offline", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should queue subs and unusbs", function() {
         // Test parameters
         var drainTimeMs = 250;
         // Reinit mockMQTTClientObject
         mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );
         device.subscribe('topic1', { }, null );
         device.subscribe('topic2', { }, null );
         device.subscribe('topic3', { }, null );
         device.unsubscribe('topic2', null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0);
         assert.equal(mockMQTTClientObject.commandCalled['unsubscribe'], 0);
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0);
         assert.equal(mockMQTTClientObject.commandCalled['unsubscribe'], 0);
         clock.tick( drainTimeMs * 3 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3);
         assert.equal(mockMQTTClientObject.commandCalled['unsubscribe'], 0);
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic1');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic2');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic3');
         clock.tick( drainTimeMs * 1 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3);
         assert.equal(mockMQTTClientObject.commandCalled['unsubscribe'], 1);
        });
    });
//
// Verify offline subscription queue is not unlimited
//
    describe("Verify offline subscription queue is not unlimited", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should only queue maximum sub/unsub operations", function() {
         // Test parameters
         var drainTimeMs = 250;
         // Reinit mockMQTTClientObject
         mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );

         var fakeErrorCallback = sinon.spy();
         device.on('error', fakeErrorCallback);

         for (var i=0; i<25; ++i) {
            device.subscribe('subtopic' + i, { }, null );
            device.unsubscribe('unsubtopic' + i, null );
         }

         sinon.assert.notCalled(fakeErrorCallback);   // we're at 50 operations, no error yet
         device.subscribe('topic1', { }, null );      // one more
         assert(fakeErrorCallback.calledOnce);             // now we got an error
        });
    });
//
// Verify subscribe callback called on subscribe but not on resubscribe
//
    describe("Verify subscribe callback called on subscribe but not on resubscribe", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should callback on sub, not resub", function() {
         // Test parameters
         var drainTimeMs = 250;
         // Reinit mockMQTTClientObject
         mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );
         // Register a fake callback
         var fakeCallback = sinon.spy();
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 0);
         sinon.assert.notCalled(fakeCallback);
         device.subscribe('topic1', { }, fakeCallback);
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 1);
         assert(fakeCallback.calledOnce);
         mockMQTTClientObject.emit('close');
         mockMQTTClientObject.emit('reconnect');
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 1); // not until drain timer
         assert(fakeCallback.calledOnce);
         clock.tick( drainTimeMs * 1 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 2); // auto resubscribe
         assert(fakeCallback.calledOnce); // not called a 2nd time
        });
    });
//
// Verify that publishes are queued while offline and sent after the connection has been
// established.  Also verify that queued publishes drain at the proper rate.
//
    describe("Verify that publishes are queued while offline and drain at the correct rate", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should queue publishes while offline and drain at the correct rate", function() {
         // Test parameters
         var drainTimeMs = 250;
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
            } );
         mockMQTTClientObject.emit('connect');     // Connection established
         device.publish( 'topic1', 'message1' );
         device.publish( 'topic1', 'message2' );
         device.publish( 'topic1', 'message3' );
         device.publish( 'topic1', 'message4' );
         device.publish( 'topic1', 'message5' );
         device.publish( 'topic1', 'message6' );
         //
         // These publishes were sent while connected and sent to mqtt
         //
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message1');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message2');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message3');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message4');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message5');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message6');
         clock.tick(drainTimeMs+1);
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('close');     
         device.publish( 'topic1', 'message7' );
         device.publish( 'topic1', 'message8' );
         device.publish( 'topic1', 'message9' );
         device.publish( 'topic1', 'message10' );
         device.publish( 'topic1', 'message11' );
         device.publish( 'topic1', 'message12' );
         //
         // These publishes have been queued, not sent to mqtt 
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('connect');     // Connection established
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( drainTimeMs+1 );                        // Connection established + 1 drain period
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message7' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message8' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message9' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message10' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message11' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message12' );
         clock.tick( 1000000 );                 // any very large number will work here
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
        });
    });
//
// Verify that subscriptions are sent directly to the mqtt client if 
// auto-resubscribe is disabled, and that subscriptions aren't re-sent
// after the connection is restored
//
    describe("Verify operation when auto-resubscribe is set to false ", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should not renew subscriptions after re-connecting", function() {
         // Test parameters
         var drainTimeMs = 250;
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
               autoResubscribe: false
            } );
         device.subscribe( 'topic1', { }, null );
         device.subscribe( 'topic2', { }, null );
         device.subscribe( 'topic3', { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         clock.tick( drainTimeMs * 3 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection established, subscriptions sent
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic1');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic2');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic3');
         device.unsubscribe('topic2' );
         mockMQTTClientObject.emit('close');
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 3); // Connection not yet established
         device.subscribe( 'topic4', { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 4); // Connection not yet established
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 4); // Connection not yet established
         clock.tick( drainTimeMs * 2 );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 4); // Connection established
         assert.equal(mockMQTTClientObject.subscriptions.shift(), 'topic4');
         assert.equal(mockMQTTClientObject.subscriptions.shift(), undefined);
         device.subscribe( [ 'arrayTopic1', 'arrayTopic2', 'arrayTopic3', 'arrayTopic4' ], { }, null );
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 5); // Connection established
         mockMQTTClientObject.subscriptions.shift();
         mockMQTTClientObject.emit('close');
         device.unsubscribe('arrayTopic2' );
         device.unsubscribe('arrayTopic4' );
         mockMQTTClientObject.emit('connect');
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 5); // Connection not yet established
         clock.tick( 1000000 );     // any very large value is fine here
         assert.equal(mockMQTTClientObject.commandCalled['subscribe'], 5); // Connection established
        });
    });
//
// Verify that publishes are not queued while offline if offline queueing is disabled.
//
    describe("Verify operation if offlineQueueing is set to false", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should not queue publishes while offline if offlineQueueing is set to false", function() {
         // Test parameters
         var drainTimeMs = 250;
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
               offlineQueueing: false
            } );
         mockMQTTClientObject.emit('connect');     // Connection established
         clock.tick( drainTimeMs );
         device.publish( 'topic1', 'message1' );
         device.publish( 'topic1', 'message2' );
         device.publish( 'topic1', 'message3' );
         device.publish( 'topic1', 'message4' );
         device.publish( 'topic1', 'message5' );
         device.publish( 'topic1', 'message6' );
         //
         // These publishes were sent while connected and sent to mqtt
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message1');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message2');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message3');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message4');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message5');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message6');
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('close');     
         device.publish( 'topic1', 'message7' );
         device.publish( 'topic1', 'message8' );
         device.publish( 'topic1', 'message9' );
         device.publish( 'topic1', 'message10' );
         device.publish( 'topic1', 'message11' );
         device.publish( 'topic1', 'message12' );
         //
         // These publishes were not sent to the mqtt client
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1000000 );                 // any very large number will work here
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
        });
    });
//
// Verify that publishes are queued while offline with a maximum queue size and 'oldest'
// drop policy.  Also verify that queued publishes drain at the proper rate.
//
    describe("Verify that offline queue enforces max size/oldest and drains at the correct rate", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should queue publishes while offline and drain at the correct rate", function() {
         // Test parameters
         var drainTimeMs = 250;
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
               offlineQueueMaxSize: 5,
               offlineQueueDropBehavior: 'oldest'
            } );
         mockMQTTClientObject.emit('connect');     // Connection established
         clock.tick( drainTimeMs );
         device.publish( 'topic1', 'message1' );
         device.publish( 'topic1', 'message2' );
         device.publish( 'topic1', 'message3' );
         device.publish( 'topic1', 'message4' );
         device.publish( 'topic1', 'message5' );
         device.publish( 'topic1', 'message6' );
         //
         // These publishes were sent while connected and sent to mqtt
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message1');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message2');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message3');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message4');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message5');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message6');
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('close');     
         device.publish( 'topic1', 'message7' );     // this one will be dropped
         device.publish( 'topic1', 'message8' );
         device.publish( 'topic1', 'message9' );
         device.publish( 'topic1', 'message10' );
         device.publish( 'topic1', 'message11' );
         device.publish( 'topic1', 'message12' );
         //
         // These publishes have been queued, not sent to mqtt 
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('connect');     // Connection established
         clock.tick( drainTimeMs );                        // 1 drain period
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message8' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message9' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message10' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message11' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message12' );
         clock.tick( 1000000 );                 // any very large number will work here
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
        });
    });
//
// Verify that publishes are queued while offline with a maximum queue size and 'newest'
// drop policy.  Also verify that queued publishes drain at the proper rate.
//
    describe("Verify that offline queue enforces max size/newest and drains at the correct rate", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

       it("should queue publishes while offline and drain at the correct rate", function() {
         // Test parameters
         var drainTimeMs = 250;
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               baseReconnectTimeMs:1000,
               minimumConnectionTimeMs:20000,
               maximumReconnectTimeMs:128000,
               drainTimeMs: drainTimeMs,
               offlineQueueMaxSize: 4,
               offlineQueueDropBehavior: 'newest'
            } );
         mockMQTTClientObject.emit('connect');     // Connection established
         clock.tick( drainTimeMs );
         device.publish( 'topic1', 'message1' );
         device.publish( 'topic1', 'message2' );
         device.publish( 'topic1', 'message3' );
         device.publish( 'topic1', 'message4' );
         device.publish( 'topic1', 'message5' );
         device.publish( 'topic1', 'message6' );
         //
         // These publishes were sent while connected and sent to mqtt
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message1');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message2');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message3');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message4');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message5');
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message6');
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('close');     
         device.publish( 'topic1', 'message7' );
         device.publish( 'topic1', 'message8' );
         device.publish( 'topic1', 'message9' );
         device.publish( 'topic1', 'message10' );
         device.publish( 'topic1', 'message11' );  // this one will be dropped
         device.publish( 'topic1', 'message12' );  // this one will be dropped
         //
         // These publishes have been queued, not sent to mqtt 
         //
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         mockMQTTClientObject.emit('connect');     // Connection established
         clock.tick( drainTimeMs );                // 1 drain period
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message7' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message8' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message9' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), 'message10' );
         clock.tick( drainTimeMs-1 );                        
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
         clock.tick( 1000000 );                 // any very large number will work here
         assert.equal(mockMQTTClientObject.publishes.shift(), undefined);
        });
    });
   describe( "device doesn't accept invalid queueing parameters: offlineQueueMaxSize<1", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               offlineQueueMaxSize:-1
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device doesn't accept invalid queueing parameters: offlineQueueDropBehavior bad value", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               offlineQueueDropBehavior:'bogus'
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device doesn't accept invalid timing parameters: minConnect<reconnectPeriod", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:1000,
               minimumConnectionTimeMs:500
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device doesn't accept invalid timing parameters: maxReconnect<reconnectPeriod", function() {
      it("throws an exception", function() {
         assert.throws( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:500
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device accepts valid timing parameters", function() {
      it("does not throw an exception", function() {
         assert.doesNotThrow( function( err ) {
            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:5000
               } );
            }, function(err) { console.log('\t['+err+']'); return true;}
	    );
      });
   });
   describe( "device handles reconnect timing correctly", function() {
      var clock;

      before( function() { clock = sinon.useFakeTimers(); } );
      after( function() { clock.restore(); } );

      it ("sets the reconnect period appropriately", function() {
         assert.doesNotThrow( function( err ) {
//
// Constants reconnection quiet time constants used in this test.
//
            const baseReconnectTimeMs     = 1000;
            const minimumConnectionTimeMs = 2500;
            const maximumReconnectTimeMs  = 128000;

            var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:baseReconnectTimeMs,
               minimumConnectionTimeMs:minimumConnectionTimeMs,
               maximumReconnectTimeMs:maximumReconnectTimeMs
               } );
//
// Check reconnection timing and progression to maximum.
//
            mockMQTTClientObject.emit('connect');
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');

            for (i = 0, currentReconnectTimeMs = baseReconnectTimeMs*2; 
                 i < 7; 
                 i++, currentReconnectTimeMs*=2)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            currentReconnectTimeMs/=2;
            for (i = 0; i < 4; i++)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
//
// Check that an unstable connection doesn't reset the reconnection progression
// timing.
//
            mockMQTTClientObject.emit('connect');
            clock.tick( minimumConnectionTimeMs-1 );
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');
            clock.tick( minimumConnectionTimeMs );  // make sure timer was cleared
            mockMQTTClientObject.emit('reconnect');
            assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
//
// Check that a stable connection resets the reconnection progression timing.
//
            mockMQTTClientObject.emit('connect');
            clock.tick( minimumConnectionTimeMs+1 );
            assert.equal(mockMQTTClientObject.options.reconnectPeriod, baseReconnectTimeMs);
//
// And check that it progresses correctly again...
//
            mockMQTTClientObject.emit('close');

            mockMQTTClientObject.emit('connect');
            mockMQTTClientObject.emit('offline');
            mockMQTTClientObject.emit('close');
            for (i = 0, currentReconnectTimeMs = baseReconnectTimeMs*2; 
                 i < 7; 
                 i++, currentReconnectTimeMs*=2)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            currentReconnectTimeMs/=2;
            for (i = 0; i < 4; i++)
            {
               mockMQTTClientObject.emit('reconnect');
               mockMQTTClientObject.emit('close');
               mockMQTTClientObject.emit('offline');
               assert.equal(mockMQTTClientObject.options.reconnectPeriod, currentReconnectTimeMs);
            }
            }, function(err) { console.log('\t['+err+']'); return true;}
          );
      });
   });
//
// Verify that events from the mqtt client are propagated upwards
//
    describe("Ensure that events are propagated upwards", function() {
       it("should emit the corresponding events", function() {
          // Reinit mockMQTTClientObject
          mockMQTTClientObject.reInitCommandCalled();
         var device = deviceModule( {
               certPath:'test/data/certificate.pem.crt',
               keyPath:'test/data/private.pem.key',
               caPath:'test/data/root-CA.crt',
               clientId:'dummy-client-1',
               host:'XXXX.iot.us-east-1.amazonaws.com',
               reconnectPeriod:1000,
               minimumConnectionTimeMs:2500,
               maximumReconnectTimeMs:128000
            } );
          // Register a fake callback
          var fakeCallback1 = sinon.spy();
          var fakeCallback2 = sinon.spy();
          var fakeCallback3 = sinon.spy();
          var fakeCallback4 = sinon.spy();
          var fakeCallback5 = sinon.spy();
          var fakeCallback6 = sinon.spy();
          var fakeCallback7 = sinon.spy();
          device.on('connect', fakeCallback1);
          device.on('close', fakeCallback2);
          device.on('reconnect', fakeCallback3);
          device.on('offline', fakeCallback4);
          device.on('error', fakeCallback5);
          device.on('packetsend', fakeCallback6);
          device.on('packetreceive', fakeCallback7);
          // Now emit messages
          mockMQTTClientObject.emit('connect');
          mockMQTTClientObject.emit('close');
          mockMQTTClientObject.emit('reconnect');
          mockMQTTClientObject.emit('offline');
          mockMQTTClientObject.emit('error');
          mockMQTTClientObject.emit('packetsend');
          mockMQTTClientObject.emit('packetreceive');
          assert(fakeCallback1.calledOnce);
          assert(fakeCallback2.calledOnce);
          assert(fakeCallback3.calledOnce);
          assert(fakeCallback4.calledOnce);
          assert(fakeCallback5.calledOnce);
          assert(fakeCallback6.calledOnce);
          assert(fakeCallback7.calledOnce);
        });
    });
   describe( "websocket protocol URL is prepared correctly when session token is not present", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation.
//
      var clock;

//
// Fix the date at a known value so that the URL preparation code will always produce
// the same result.
//
      before( function() { clock = sinon.useFakeTimers( (new Date('11/15/86 PST')).getTime(), 'Date' ); } );
      after( function() { clock.restore(); } );

      it("calculates the url correctly", function() {
         const expectedUrl='wss://not-a-real-host.com/mqtt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=not a valid access key%2F19861115%2Fundefined%2Fiotdevicegateway%2Faws4_request&X-Amz-Date=19861115T080000Z&X-Amz-SignedHeaders=host&X-Amz-Signature=9bf20395cff4912649c9eb4892e105035137ce350290025388584ebb33893098';

         var url = deviceModule.prepareWebSocketUrl( { host:'not-a-real-host.com', debug: true }, 'not a valid access key','not a valid secret access key' );
         assert.equal( url, expectedUrl );
      });
   });
   describe( "websocket protocol URL is prepared correctly when session token is present", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation.
//
      var clock;
//
// Fix the date at a known value so that the URL preparation code will always produce
// the same result.
//
      before( function() { clock = sinon.useFakeTimers( (new Date('11/15/86 PST')).getTime(), 'Date' ); } );
      after( function() { clock.restore(); } );

      it("calculates the url correctly", function() {

         const expectedUrl='wss://not-a-real-host.com/mqtt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=not a valid access key%2F19861115%2Fundefined%2Fiotdevicegateway%2Faws4_request&X-Amz-Date=19861115T080000Z&X-Amz-SignedHeaders=host&X-Amz-Signature=9bf20395cff4912649c9eb4892e105035137ce350290025388584ebb33893098&X-Amz-Security-Token=not%2Fa%2Fvalid%2Fsession%20token';

         var url = deviceModule.prepareWebSocketUrl( { host:'not-a-real-host.com', debug: true }, 'not a valid access key','not a valid secret access key', 'not/a/valid/session token' );
         assert.equal( url, expectedUrl );
      });
   });
   describe( "websocket protocol URL is prepared correctly when non-standard port number is used", function() {
//
// Verify that the device module will not throw an exception when correctly
// configured for websocket operation; verify that a non-standard port number
// is correctly appended to the hostname during URL creation.
//
      var clock;
//
// Fix the date at a known value so that the URL preparation code will always produce
// the same result.
//
      before( function() { clock = sinon.useFakeTimers( (new Date('11/15/86 PST')).getTime(), 'Date' ); } );
      after( function() { clock.restore(); } );

      it("calculates the url correctly", function() {

         const expectedUrl='wss://not-a-real-host.com:9999/mqtt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=not a valid access key%2F19861115%2Fundefined%2Fiotdevicegateway%2Faws4_request&X-Amz-Date=19861115T080000Z&X-Amz-SignedHeaders=host&X-Amz-Signature=ac89d55d95935fd1d59f44ad51f3fc35f4e79f5efc315f2f79f823a8f82dde4b&X-Amz-Security-Token=not%2Fa%2Fvalid%2Fsession%20token';

         var url = deviceModule.prepareWebSocketUrl( { host:'not-a-real-host.com', port: 9999, debug: true }, 'not a valid access key','not a valid secret access key', 'not/a/valid/session token' );
         assert.equal( url, expectedUrl );
      });
   });
   describe("CustomAuth websocket url is correctly generated", function() {
      it("generates the correct url", function() {
         const expectedUrl = 'wss://not-a-real-host.com/mqtt';
         var url = deviceModule.prepareWebSocketCustomAuthUrl( { host:'not-a-real-host.com' } );
         assert.equal( url, expectedUrl );
      });
   });
   describe("websocket headers are correctly set when CustomAuth headers are specified", function() {
      it("sets the websocket headers correctly", function() {
         var headers = {
            'X-Amz-CustomAuthorizer-Name': 'AuthorizerFunctionName',
            'X-Amz-CustomAuthorizer-Signature': 'Signature',
            'NPAuthorizerToken': 'Token'
         };
         var device = deviceModule({
            host: 'XXXX.iot.us-east-1.amazonaws.com',
            protocol: 'wss-custom-auth',
            customAuthHeaders: headers
         });
         assert.equal( headers, device.getWebsocketHeaders() );
      });
      
   });
});

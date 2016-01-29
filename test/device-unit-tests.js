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
var assert = require('assert');
var myTls = rewire('../device/lib/tls');
var mockTls = require('./mock/mockTls');

describe("device class unit tests", function() {
  var deviceModule = require('../').device;
  var mockTlsObject = new mockTls();
  var mockMqttObject = new mockTls.mqtt();

  mockTlsObject.reInitCommandCalled();
  mockMqttObject.reInitCommandCalled();


  before(function() {
    myTls.__set__("tls", mockTlsObject);
    myTls.__set__("mqtt", mockMqttObject);
  });
  describe("TLS handler calls the correct functions", function() {
    it("calls the correct functions", function() {
      mockTlsObject.reInitCommandCalled();
      myTls(mockMqttObject, {
        'testOption': true
      });
      assert.equal(mockTlsObject.commandCalled['connect'], 1);
      assert.equal(mockTlsObject.commandCalled['on'], 2);
      assert.equal(mockTlsObject.commandCalled['emit'], 1);
      assert.equal(mockMqttObject.commandCalled['emit'], 1);
    })
  });
  describe("device is instantiated with empty parameters", function() {
    //
    // Verify that the device module throws an exception when all
    // parameters are empty.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({});
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with no public key", function() {
    //
    // Verify that the device module throws an exception when there is
    // no valid public key file.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          certPath: 'test/data/certificate.pem.crt',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with no CA certificate", function() {
    //
    // Verify that the device module throws an exception when there is
    // no valid CA certificate file.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key',
          certPath: 'test/data/certificate.pem.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with no region", function() {
    //
    // Verify that the device module throws an exception when there is
    // no valid region
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          certPath: 'test/data/certificate.pem.crt',
          keyPath: 'test/data/private.pem.key',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with no region but has a host", function() {
    //
    // Verify that the device module does not throw exception when there is
    // no valid region if a host URL is supplied.
    //
    it("does not throw an exception", function() {
      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          certPath: 'test/data/certificate.pem.crt',
          keyPath: 'test/data/private.pem.key',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          host: 'https://data.iot.us-east-1.amazonaws.com'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with no client certificate", function() {
    //
    // Verify that the device module throws an exception when there is
    // no valid client certificate file.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with invalid key path", function() {
    //
    // Verify that the device module doesn't throw an exception when all 
    // parameters are specified correctly.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key-1',
          certPath: 'test/data/certificate.pem.crt',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with invalid cert path", function() {
    //
    // Verify that the device module doesn't throw an exception when all 
    // parameters are specified correctly.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key',
          certPath: 'test/data/certificate.pem.crt-1',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with invalid CA path", function() {
    //
    // Verify that the device module doesn't throw an exception when all 
    // parameters are specified correctly.
    //
    it("throws an exception", function() {
      assert.throws(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key',
          certPath: 'test/data/certificate.pem.crt',
          caPath: 'test/data/root-CA.crt-1',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device is instantiated with required parameters", function() {
    //
    // Verify that the device module doesn't throw an exception when all 
    // parameters are specified correctly.
    //
    it("does not throw an exception", function() {
      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          keyPath: 'test/data/private.pem.key',
          certPath: 'test/data/certificate.pem.crt',
          caPath: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device accepts certificate data in buffer", function() {
    //
    // Verify that the device module accepts certificate and key data in buffers
    // when using the properties generated by the AWS Console.
    //
    it("does not throw an exception", function() {
      var buffers = {};

      buffers.privateKey = filesys.readFileSync('test/data/private.pem.key');
      buffers.certificate = filesys.readFileSync('test/data/certificate.pem.crt');
      buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          clientCert: buffers.certificate,
          privateKey: buffers.privateKey,
          caCert: buffers.rootCA,
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device accepts certificate data in buffers+files", function() {
    //
    // Verify that the device module accepts certificate and key data in files
    // as well as buffers when using the properties generated by the AWS Iot 
    // Console.  
    //
    it("does not throw an exception", function() {
      var buffers = {};

      buffers.privateKey = filesys.readFileSync('test/data/private.pem.key');
      buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          clientCert: 'test/data/certificate.pem.crt',
          privateKey: buffers.privateKey,
          caCert: buffers.rootCA,
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device accepts certificate data in buffers+files", function() {
    //
    // Verify that the device module accepts certificate and key data in files
    // as well as buffers when using the properties generated by the AWS Iot 
    // Console. 
    //
    it("does not throw an exception", function() {
      var buffers = {};

      buffers.rootCA = filesys.readFileSync('test/data/root-CA.crt');

      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          clientCert: 'test/data/certificate.pem.crt',
          privateKey: 'test/data/private.pem.key',
          caCert: buffers.rootCA,
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device accepts certificate data in buffers+files", function() {
    //
    // Verify that the device module accepts certificate and key data in files
    // using the properties generated by the AWS Iot Console.
    //
    it("does not throw an exception", function() {

      assert.doesNotThrow(function(err) {
        var device = deviceModule({
          clientCert: 'test/data/certificate.pem.crt',
          privateKey: 'test/data/private.pem.key',
          caCert: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device ensures AWS Console clientCert property is a buffer or file", function() {
    //
    // Verify that the device module will not accept a client certificate property
    // which is neither a file nor a buffer.
    //
    it("throws an exception", function() {

      assert.throws(function(err) {
        var device = deviceModule({
          clientCert: {},
          privateKey: 'test/data/private.pem.key',
          caCert: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device ensures AWS Console privateKey property is a buffer or file", function() {
    //
    // Verify that the device module will not accept a private key property
    // which is neither a file nor a buffer.
    //
    it("throws an exception", function() {

      assert.throws(function(err) {
        var device = deviceModule({
          clientCert: 'test/data/certificate.pem.crt',
          privateKey: {},
          caCert: 'test/data/root-CA.crt',
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device ensures AWS Console caCert property is a buffer or file", function() {
    //
    // Verify that the device module will not accept a CA certificate property
    // which is neither a file nor a buffer.
    //
    it("throws an exception", function() {

      assert.throws(function(err) {
        var device = deviceModule({
          clientCert: 'test/data/certificate.pem.crt',
          privateKey: 'test/data/private.pem.key',
          caCert: {},
          clientId: 'dummy-client-1',
          region: 'us-east-1'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device throws an exception if using websocket protocol without IAM credentials", function() {
    //
    // Verify that the device module will not throw an exception when correctly
    // configured for websocket operation.
    //
    it("throws exception", function() {

      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      assert.throws(function(err) {
        var device = deviceModule({
          region: 'us-east-1',
          protocol: 'wss'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device does not throw exception if using websocket protocol with IAM credentials in environment", function() {
    //
    // Verify that the device module will not throw an exception when correctly
    // configured for websocket operation.
    //
    it("does not throw an exception", function() {

      assert.doesNotThrow(function(err) {
        process.env.AWS_ACCESS_KEY_ID = 'not a valid access key';
        process.env.AWS_SECRET_ACCESS_KEY = 'not a valid secret access key';
        var device = deviceModule({
          region: 'us-east-1',
          protocol: 'wss',
          debug: true,
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("coverage: device doesn't throw exception if using websocket protocol with IAM credentials", function() {
    //
    // Verify that the device module will not throw an exception when correctly
    // configured for websocket operation.
    //
    it("does not throw an exception", function() {

      assert.doesNotThrow(function(err) {
        var url = deviceModule.prepareWebsocketUrl({
          region: 'us-east-1',
          protocol: 'wss',
          debug: true,
          port: 8194
        }, 'not a valid access key', 'not a valid secret access key');
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
  describe("device throws an exception if using an unknown protocol", function() {
    //
    // Verify that the device module will not throw an exception when correctly
    // configured for websocket operation.
    //
    it("throws exception", function() {

      assert.throws(function(err) {
        var device = deviceModule({
          region: 'us-east-1',
          protocol: 'bss'
        });
      }, function(err) {
        console.log('\t[' + err + ']');
        return true;
      });
    });
  });
});

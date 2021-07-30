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

//app deps
var rewire = require('rewire');
var sinon = require('sinon');
var assert = require('assert');
var mqtt = require('mqtt');
var myTls = rewire('../device/lib/tls');
var mockTls = require('./mock/mockTls');
var mockMQTTClient = require('./mock/mockMQTTClient');

describe( 'jobs class unit tests', function() {
    var jobsModule = require('../').jobs;

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

        mqttSave = sinon.stub(mqtt, 'MqttClient').callsFake(fakeConnect);

        mockTlsRevert = myTls.__set__('tls', mockTlsObject);
        mockMqttRevert = myTls.__set__('mqtt', mockMqttObject);
    });
    afterEach( function () {
        mqttSave.restore();
        mockTlsRevert();
        mockMqttRevert();
    });

    describe('TLS handler calls the correct functions', function() {
        it('calls the correct functions', function() {
            mockTlsObject.reInitCommandCalled();
            myTls(mockMqttObject, { 'testOption': true } );
            assert.equal(mockTlsObject.commandCalled['connect'], 1);
            assert.equal(mockTlsObject.commandCalled['on'], 2);
            assert.equal(mockTlsObject.commandCalled['emit'], 1);
            assert.equal(mockMqttObject.commandCalled['emit'], 1);
        });
    });

    // Test cases begin
    describe( 'subscribeToJobs / unsubscribeFromJobs', function() {
        var jobsConfig = {
            keyPath:'test/data/private.pem.key',
            certPath:'test/data/certificate.pem.crt',
            caPath:'test/data/root-CA.crt',
            clientId:'dummy-client-1',
            host:'XXXX.iot.us-east-1.amazonaws.com'
        };

        it('matching thing, omitted operation returns no errors', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', function(err) { assert.equal(err, undefined); });
        });

        it('matching thing, matching operation returns no errors', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
        });

        it('no matching thing, no matching operation returns error', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.notEqual(err, undefined); });
        });

        it('matching thing, no matching operation returns error', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName1', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName2', function(err) { assert.notEqual(err, undefined); });
        });

        it('no matching thing, matching operation returns error', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName1', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName2', 'testOperationName', function(err) { assert.notEqual(err, undefined); });
        });

        it('duplicate returns error, omitted operation', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', function(err) { assert.notEqual(err, undefined); });
        });

        it('duplicate returns error', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.notEqual(err, undefined); });
        });

        it('duplicate subscribe, single unsubscribe returns no errors', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
        });

        it('duplicate subscribe, duplicate unsubscribe returns error', function() {
            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.subscribeToJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.equal(err, undefined); });
            jobs.unsubscribeFromJobs('testThingName', 'testOperationName', function(err) { assert.notEqual(err, undefined); });
        });
    });

    describe( 'job execution callbacks', function() {
        var jobsConfig = {
            keyPath:'test/data/private.pem.key',
            certPath:'test/data/certificate.pem.crt',
            caPath:'test/data/root-CA.crt',
            clientId:'dummy-client-1',
            host:'XXXX.iot.us-east-1.amazonaws.com'
        };

        var jobExecutionData =
        {
            clientToken : 'client-1',
            execution : {
                jobId : '022',
                status : 'QUEUED',
                jobDocument : {operation: 'testOperationName', data: 'value'}
            }
        };

        it('job subscription valid callback', function() {
            // Faking callback
            fakeCallback = sinon.spy();
            // Reinit mockMQTTClientObject
            mockMQTTClientObject.reInitCommandCalled();
            mockMQTTClientObject.resetPublishedMessage();

            var jobs = jobsModule(jobsConfig);

            jobs.subscribeToJobs('testThingName', 'testOperationName', fakeCallback);
            mockMQTTClientObject.emit('message', '$aws/things/testThingName/jobs/$next/get/accepted', JSON.stringify(jobExecutionData) );
            mockMQTTClientObject.emit('message', '$aws/things/testThingName/jobs/notify-next', JSON.stringify(jobExecutionData) );
            // Check spy
            assert(fakeCallback.calledTwice);

        });
    });
});


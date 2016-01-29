const util = require('util');
const EventEmitter = require('events');

function mockMQTTClient() {
  // Record list indicating whether the corresponding method is called
  this.commandCalled = {
    'publish': 0,
    'subscribe': 0,
    'unsubscribe': 0,
    'end': 0,
    'handleMessage': 0
  };
  this.lastPublishedMessage = 'Empty'; // Keep track of the last published message

  // Reinit the record list
  this.reInitCommandCalled = function() {
    this.commandCalled['publish'] = 0;
    this.commandCalled['subscribe'] = 0;
    this.commandCalled['unsubscribe'] = 0;
    this.commandCalled['end'] = 0;
    this.commandCalled['handleMessage'] = 0;
  };

  // Reset publishedMessage
  this.resetPublishedMessage = function() {
    this.lastPublishedMessage = 'Empty';
  }

  // This is the module mocking the client returned by mqtt.connect, APIs are:
  this.publish = function(topic, message, options, callback) {
    options = options || '';
    callback = callback || '';
    this.lastPublishedMessage = message;
    this.commandCalled['publish'] += 1;
  };

  this.subscribe = function(topic, options, callback) {
    options = options || '';
    callback = callback || '';
    this.commandCalled['subscribe'] += 1;
    if (callback !== '') {
      callback(null); // call callback
    }
  };

  this.unsubscribe = function(topic, options, callback) {
    options = options || '';
    callback = callback || '';
    this.commandCalled['unsubscribe'] += 1;
  };

  this.end = function(force, cb) {
    force = force || false;
    cb = cb || '';
    this.commandCalled['end'] += 1;
  };

  this.handleMessage = function(packet, callback) {
    this.commandCalled['handleMessage'] += 1;
  };

  EventEmitter.call(this);
}

util.inherits(mockMQTTClient, EventEmitter);
module.exports = mockMQTTClient;

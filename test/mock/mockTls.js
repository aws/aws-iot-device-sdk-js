const util = require('util');
const EventEmitter = require('events');

function mockTls() {
  // Record list indicating whether the corresponding method is called
  this.commandCalled = {'connect':0, 'end':0, 'emit':0, 'removeListener':0, 'on':0};

  // Reinit the record list
  this.reInitCommandCalled = function() {
    this.commandCalled['connect'] = 0;
    this.commandCalled['end'] = 0;
    this.commandCalled['emit'] = 0;
    this.commandCalled['removeListener'] = 0;
    this.commandCalled['on'] = 0;
  };
        this.reInitError = function() {
                this.error = '';
        };

    // This is the module mocking a TLS connection, APIs are:
    this.connect = function(options) {
    options = options || '';
    this.commandCalled['connect'] += 1;
                return this;
    };

    this.end = function() {
    this.commandCalled['end'] += 1;
    };

  this.emit = function(errorString, error) {
    this.commandCalled['emit'] += 1;
    this.error = error;
  };
  this.on = function(message, callback) {
    callback = callback || '';
    this.commandCalled['on'] += 1;
    if (callback !== '') {
      if (message === 'error') {
        callback('testing error'); // call callback
      } else {
        callback(null); // call callback
      }
    }
  };

  this.removeListener = function(message, callback) {
    force = force || false;
    callback = callback || '';
    if (callback !== '') {
      callback(null); // call callback
    }
    this.commandCalled['removeListener'] += 1;
  };

  EventEmitter.call(this);
}

function mockMqtt() {
  // Record list indicating whether the corresponding method is called
  this.commandCalled = {
    'emit': 0
  };

  // Reinit the record list
  this.reInitCommandCalled = function() {
    this.commandCalled['emit'] = 0;
  };
  this.emit = function(errorString, error) {
    this.commandCalled['emit'] += 1;
    this.error = error;
  };
  EventEmitter.call(this);
}

util.inherits(mockTls, EventEmitter);

module.exports = mockTls;

util.inherits(mockMqtt, EventEmitter);
module.exports.mqtt = mockMqtt;

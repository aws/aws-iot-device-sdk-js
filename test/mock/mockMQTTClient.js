const util = require('util');
const EventEmitter = require('events');
const isUndefined = require('../../common/lib/is-undefined.js');

function mockMQTTClient( wrapper, options ) {

   var that = this;
   this.options = { 'reconnectPeriod':0 };

   // Record list indicating whether the corresponding method is called
   this.commandCalled = {'publish':0, 'subscribe':0, 'unsubscribe':0, 'end':0, 'handleMessage':0};
   this.lastPublishedMessage = 'Empty'; // Keep track of the last published message
   this.subscriptions = new Array;
   this.subscriptions.length = 0;
   this.unsubscriptions = new Array;
   this.unsubscriptions.length = 0;
   this.publishes = new Array;    // for all topics
   this.publishes.length = 0;
   this.subscribeQosValues = new Array;
   this.subscribeQosValues.length = 0;
   this.publishQosValues = new Array;
   this.publishQosValues.length = 0;

   // Reinit the record list
   this.reInitCommandCalled = function() {
      this.commandCalled['publish'] = 0;
      this.commandCalled['subscribe'] = 0;
      this.commandCalled['unsubscribe'] = 0;
      this.commandCalled['end'] = 0;
      this.commandCalled['handleMessage'] = 0;

      var topic = this.subscriptions.shift();
      while (!isUndefined( topic )) {
       topic = this.subscriptions.shift();
      }
      var message = this.publishes.shift();
      while (!isUndefined( message )) {
       message = this.publishes.shift();
      }
      var qos = this.subscribeQosValues.shift();
      while (!isUndefined( qos )) {
       qos = this.subscribeQosValues.shift();
      }
      var qos = this.publishQosValues.shift();
      while (!isUndefined( qos )) {
       qos = this.publishQosValues.shift();
      }
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
      this.publishes.push( message );

      if (!isUndefined( options.qos )) {
       this.publishQosValues.push( options.qos );
      }
   };

   this.subscribe = function(topic, options, callback) {
      options = options || '';
      callback = callback || '';
      this.commandCalled['subscribe'] += 1;

      var granted = [];
      if ( Object.prototype.toString.call(topic) === '[object Array]' ) {
       topic.forEach( function( item, index, array ) {
          var grantedTopic = {topic: item, qos: 0}
          that.subscriptions.push( item );
          if (!isUndefined( options.qos )) {
             that.subscribeQosValues.push( options.qos );
             grantedTopic.qos = options.qos;
          }

          if (mockMQTTClient.triggerError()) {
             grantedTopic.qos = 128;
          }

          granted.push(grantedTopic);
       });
      }
      else {
         var grantedTopic = {topic: topic, qos: 0}
         this.subscriptions.push( topic );
         if (!isUndefined( options.qos )) {
            that.subscribeQosValues.push( options.qos );
            grantedTopic.qos = options.qos;
         }
         if (mockMQTTClient.triggerError()) {
            grantedTopic.qos = 128;
         }
         granted.push(grantedTopic);
      }
      if(callback !== '') {
         callback(null, granted); // call callback
      }
   };

   this.unsubscribe = function(topic, callback) {
      callback = callback || '';
      this.commandCalled['unsubscribe'] += 1;
      if ( Object.prototype.toString.call(topic) === '[object Array]' ) {
       topic.forEach( function( item, index, array ) {
          that.unsubscriptions.push( item );
       });
      }
      else {
         this.unsubscriptions.push( topic );
      }
      if (callback !== '') {
         callback(null); // call callback
      }
   };

   this.end = function(force, cb) {
      force = force || false;
      cb = cb || '';
      this.commandCalled['end'] += 1;
   };

   this.handleMessage = function(packet, callback) {
      this.commandCalled['handleMessage'] += 1;
      callback();
   };

   EventEmitter.call(this);
}

util.inherits(mockMQTTClient, EventEmitter);

mockMQTTClient.triggerError = function() {
  return false;
};

module.exports = mockMQTTClient;

## [2.2.5](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.5) (Apr 7, 2020)

Bugfixes/Improvements
  - Re-adding github related templates and readme change.

## [2.2.4](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.4) (Mar 31, 2020)
  
Bugfixes/Improvements
  - Bumping minimist version to 1.2.5 to address security issue

## [2.2.3](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.3) (Jan 20, 2020)

Bugfixes/Improvements
  - Upgrade MQTT.js to 3.0.0 to incorporate important bug fixes

## [2.2.2](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.2) (Sep 24, 2019)

Bugfixes/Improvements
  - Reorder timeout state cleanup in order to support invoking update from a timeout callback

## [2.2.1](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.1) (Jan 24, 2018)

Bugfixes/Improvements
  - Upgrade MQTT.js to 2.15.1 to address security issue

## [2.2.0](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.2.0) (Nov 29, 2017)

Features
  - Added AWS IoT Job API
  - Added options to enable AWS IoT Custom Auth
  - Added options to enalbe/disable AWS IoT metrics collection
  - Added new API to support packetsend and packetreceive events

Bugfixes/Improvements
  - Modify Keepalive defaults to 300 secs to maintain consistency across SDKs
  - Expose shadow version from raw json object
  - Added samples to demonstrate AWS IoT Job API
  - Disabled MQTT.js default resubscribe. 

## [2.1.0](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.0.1) (Sep 28, 2017)

Features
  - Update MQTT.js to 2.13.0. [MQTT.js](https://github.com/mqttjs/MQTT.js/releases/tag/v2.13.0)

Bugfixes/Improvements
  - Propagated 'error' from 'close' event. [#131](https://github.com/aws/aws-iot-device-sdk-js/pull/131)
  - Fixed method of handleMessage to be overridden rather than pass-through. [#129](https://github.com/aws/aws-iot-device-sdk-js/pull/129)
  - Pass 'connack' parameter in 'connect' event  [#99](https://github.com/aws/aws-iot-device-sdk-js/pull/99)
  - Update iot service name to 'iotdevicegateway'

## [2.0.1](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.0.1) (Jul 2, 2017)

Bugfixes/Improvements
  - Removed validation against .com in websocket connection.

## [2.0.0](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v2.0.0) (Mar 21, 2017)

API Changes
  - Deprecated region option(-g) in device configuration.
  - Added host endpoint option(-H) to connect to custom host endpoint 

Features
  - Added support for browserify on Windows CMD. [#74](https://github.com/aws/aws-iot-device-sdk-js/issues/74)
  - Added support for loading IAM credentials from aws credential files.
  - Added sample for using Node.js SDK with webpack.

Bugfixes/Improvements
  - Fixed README.md typo [#101](https://github.com/aws/aws-iot-device-sdk-js/issues/101)
  - Fixed thing.register() API to have independent optional parameters.[#106](https://github.com/aws/aws-iot-device-sdk-js/issues/106) 
  - Upgrade MQTT.js to v2.2.1 and gulp dependencies. 
  - Fixed npm test failure in node version above 4. 

## [1.0.14](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.14) (Dec 7, 2016)

Bugfixes/Improvements
  - Fixes for GitHub issues [#67]( https://github.com/aws/aws-iot-device-sdk-js/issues/67), [#95](https://github.com/aws/aws-iot-device-sdk-js/issues/95), [#96](https://github.com/aws/aws-iot-device-sdk-js/issues/96).

## [1.0.13](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.13) (July 11, 2016)

Bugfixes/Improvements
  - Addressed pull request[#83](https://github.com/aws/aws-iot-device-sdk-js/pull/83) Credits given to [Torsph](https://github.com/Torsph)
  - Updated lifecycle events browser demo to read from DynamoDB table of connected clients if available
  - Addresses pull request [#60](https://github.com/aws/aws-iot-device-sdk-js/pull/60)
  - Fixes for GitHub issues [#66](https://github.com/aws/aws-iot-device-sdk-js/issues/66), [#61](https://github.com/aws/aws-iot-device-sdk-js/issues/61), [#53](https://github.com/aws/aws-iot-device-sdk-js/issues/53), [#48](https://github.com/aws/aws-iot-device-sdk-js/issues/48), and [#44](https://github.com/aws/aws-iot-device-sdk-js/issues/44).

## [1.0.12](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.12) (April 19, 2016)

Features
  - Added support for use in browser applications

Bugfixes/Improvements
  - Incorporated GitHub pull request [#49](https://github.com/aws/aws-iot-device-sdk-js/pull/49)
  - Fixes for GitHub issues [#41](https://github.com/aws/aws-iot-device-sdk-js/issues/41), [#47](https://github.com/aws/aws-iot-device-sdk-js/issues/47), and [#50](https://github.com/aws/aws-iot-device-sdk-js/issues/50).

## [1.0.11](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.11) (March 4, 2016)

Features:
  - Configurable exponential backoff retries after connection loss
  - Configurable offline publish message queueing
  - Added option for automatic re-subscription after reconnect
  - Added shadow option for versioning disable
  - Added session token support

Bugfixes/Improvements
  - Incorporated github pull requests [#33](https://github.com/aws/aws-iot-device-sdk-js/pull/33), [#34](https://github.com/aws/aws-iot-device-sdk-js/pull/34), and [#39](https://github.com/aws/aws-iot-device-sdk-js/pull/39)
  - Fixes for github issue [#36](https://github.com/aws/aws-iot-device-sdk-js/issues/36)
  - Updated unit tests
  - Updated documentation

## [1.0.10](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.10) (January 28, 2016)

Features:
  - Added support for WebSocket connections to AWS IoT

Bugfixes/Improvements
  - Incorporated github pull requests [#28](https://github.com/aws/aws-iot-device-sdk-js/pull/28) and [#29](https://github.com/aws/aws-iot-device-sdk-js/pull/29)
  - Fixes for github issues [#30](https://github.com/aws/aws-iot-device-sdk-js/issues/30)
  - Added unit tests to release
  - Updated documentation

## [1.0.7](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.7) (October 30, 2015)

Bugfixes/Improvements:
  - Incorporated github pull requests [#7](https://github.com/aws/aws-iot-device-sdk-js/pull/7), [#9](https://github.com/aws/aws-iot-device-sdk-js/pull/9), and [#14.](https://github.com/aws/aws-iot-device-sdk-js/pull/14)
  - Fixes for github issues [#8](https://github.com/aws/aws-iot-device-sdk-js/issues/8) and [#16.](https://github.com/aws/aws-iot-device-sdk-js/issues/16)
  - Updated documentation
  - JSHint cleanup

## [1.0.6](https://github.com/aws/aws-iot-device-sdk-js/releases/tag/v1.0.6) (October 14, 2015)

Features:
  - Added support for AWS Console JSON configuration in example programs
  - Added thing-passthrough-example.js example program

Bugfixes/Improvements:
  - Fixes for github issues [#4](https://github.com/aws/aws-iot-device-sdk-js/issues/4), [#5](https://github.com/aws/aws-iot-device-sdk-js/issues/5), and [#6.](https://github.com/aws/aws-iot-device-sdk-js/issues/4)
  - Updated documentation

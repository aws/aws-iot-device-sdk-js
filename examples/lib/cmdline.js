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
const fs = require('fs');

//npm deps
const minimist = require('minimist');

//app deps
const isUndefined = require('../../common/lib/is-undefined');

//begin module
var clientIdDefault;
if (!isUndefined(process.env.USER)) {
   clientIdDefault = process.env.USER.concat(Math.floor((Math.random() * 100000) + 1));
} else {
   clientIdDefault = 'nouser' + (Math.floor((Math.random() * 100000) + 1));
}

module.exports = function(description, args, processFunction, argumentHelp) {
   var doHelp = function() {
      var progName = process.argv[1];
      var lastSlash = progName.lastIndexOf('/');
      if (lastSlash !== -1) {
         progName = progName.substring(lastSlash + 1, progName.length);
      }
      if (isUndefined(argumentHelp)) {
         console.log('Usage: ' + progName + ' [OPTION...]');
      } else {
         console.log('Usage: ' + progName + ' [OPTION...] ARGUMENTS...');
      }
      console.log('\n' + progName + ': ' + description + '\n\n' +
         ' Options\n\n' +
         '  -i, --client-id=ID               use ID as client ID\n' +
         '  -H, --host-name=HOST             connect to HOST (overrides --aws-region)\n' +
         '  -p, --port=PORT                  connect to PORT (overrides defaults)\n' +
         '  -P, --protocol=PROTOCOL          connect using PROTOCOL (mqtts|wss)\n' +
         '  -k, --private-key=FILE           use FILE as private key\n' +
         '  -c, --client-certificate=FILE    use FILE as client certificate\n' +
         '  -a, --ca-certificate=FILE        use FILE as CA certificate\n' +
         '  -f, --certificate-dir=DIR        look in DIR for certificates\n' +
         '  -F, --configuration-file=FILE    use FILE (JSON format) for configuration\n' +
         '  -r, --reconnect-period-ms=VALUE  use VALUE as the reconnect period (ms)\n' +
         '  -K, --keepalive=VALUE            use VALUE as the keepalive time (seconds)\n' +
         '  -t, --test-mode=[1-n]            set test mode for multi-process tests\n' +
         '  -T, --thing-name=THINGNAME       access thing shadow named THINGNAME\n' +
         '  -d, --delay-ms=VALUE             delay in milliseconds before publishing\n' +
         '  -D, --debug                      print additional debugging information\n\n' +
         ' Default values\n\n' +
         '  client-id                        $USER<random-integer>\n' +
         '  protocol                         mqtts\n' +
         '  private-key                      private.pem.key\n' +
         '  client-certificate               certificate.pem.crt\n' +
         '  ca-certificate                   root-CA.crt\n' +
         '  reconnect-period-ms              3000ms\n' +
         '  delay-ms                         4000ms\n' +
         '  test-mode                        1\n');
      if (!isUndefined(argumentHelp)) {
         console.log(argumentHelp);
      }
   };
   args = minimist(args, {
      string: ['certificate-dir', 'private-key', 'client-certificate',
         'ca-certificate', 'client-id', 'thing-name', 'configuration-file',
         'host-name', 'protocol'
      ],
      integer: ['reconnect-period-ms', 'test-mode', 'port', 'delay-ms',
         'keepalive'
      ],
      boolean: ['help', 'debug'],
      alias: {
         clientId: ['i', 'client-id'],
         privateKey: ['k', 'private-key'],
         clientCert: ['c', 'client-certificate'],
         caCert: ['a', 'ca-certificate'],
         certDir: ['f', 'certificate-dir'],
         configFile: ['F', 'configuration-file'],
         baseReconnectTimeMs: ['r', 'reconnect-period-ms'],
         keepAlive: ['K', 'keepalive'],
         testMode: ['t', 'test-mode'],
         thingName: ['T', 'thing-name'],
         delay: ['d', 'delay-ms'],
         Port: ['p', 'port'],
         Protocol: ['P', 'protocol'],
         Host: ['H', 'host-name'],
         Debug: ['D', 'debug'],
         help: 'h'
      },
      default: {
         protocol: 'mqtts',
         clientId: clientIdDefault,
         privateKey: 'private.pem.key',
         clientCert: 'certificate.pem.crt',
         caCert: 'root-CA.crt',
         testMode: 1,
         /* milliseconds */
         baseReconnectTimeMs: 4000,
         /* seconds */
         keepAlive: 300,
         /* milliseconds */
         delay: 4000,
         Debug: false
      },
      unknown: function() {
         console.error('***unrecognized options***');
         doHelp();
         process.exit(1);
      }
   });
   if (args.help) {
      doHelp();
      return;
   }
   //
   // If the user has specified a directory where certificates are located,
   // prepend it to all of the certificate filenames.
   //
   if (!isUndefined(args.certDir)) {
      args.privateKey = args.certDir + '/' + args.privateKey;
      args.clientCert = args.certDir + '/' + args.clientCert;
      args.caCert = args.certDir + '/' + args.caCert;
   }
   //
   // If the configuration file is defined, read it in and set the parameters based
   // on the values inside; these will override any other arguments specified on
   // the command line.
   //
   if (!isUndefined(args.configFile)) {
      if (!fs.existsSync(args.configFile)) {
         console.error('\n' + args.configFile + ' doesn\'t exist (--help for usage)\n');
         return;
      }
      var config = JSON.parse(fs.readFileSync(args.configFile, 'utf8'));

      if (!isUndefined(config.privateKey)) {
         if (!isUndefined(args.certDir)) {
            args.privateKey = args.certDir + '/' + config.privateKey;
         } else {
            args.privateKey = config.privateKey;
         }
      }
      if (!isUndefined(config.clientCert)) {
         if (!isUndefined(args.certDir)) {
            args.clientCert = args.certDir + '/' + config.clientCert;
         } else {
            args.clientCert = config.clientCert;
         }
      }
      if (!isUndefined(config.caCert)) {
         if (!isUndefined(args.certDir)) {
            args.caCert = args.certDir + '/' + config.caCert;
         } else {
            args.caCert = config.caCert;
         }
      }
      if (!isUndefined(config.host)) {
         args.Host = config.host;
      }
      if (!isUndefined(config.port)) {
         args.Port = config.port;
      }
      //
      // When using a JSON configuration document from the AWS Console, allow
      // the client ID to be overriden by the command line option for client ID.
      // This is required to run the example programs from a JSON configuration
      // document, since both instances must use different client IDs.
      //
      if (!isUndefined(config.clientId) && isUndefined(args.clientId)) {
         args.clientId = config.clientId;
      }
      if (!isUndefined(config.thingName)) {
         args.thingName = config.thingName;
      }
   }

   if (args.Protocol === 'mqtts') {
      //
      // Client certificate, private key, and CA certificate must all exist if
      // connecting via mqtts.
      //
      if (!fs.existsSync(args.privateKey)) {
         console.error('\n' + args.privateKey + ' doesn\'t exist (--help for usage)\n');
         return;
      }
      if (!fs.existsSync(args.clientCert)) {
         console.error('\n' + args.clientCert + ' doesn\'t exist (--help for usage)\n');
         return;
      }
      if (!fs.existsSync(args.caCert)) {
         console.error('\n' + args.caCert + ' doesn\'t exist (--help for usage)\n');
         return;
      }
   }

   processFunction(args);
};

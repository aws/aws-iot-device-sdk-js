#!/bin/bash
#
# Copyright 2010-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
#
#  http://aws.amazon.com/apache2.0
#
# or in the "license" file accompanying this file. This file is distributed
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
# express or implied. See the License for the specific language governing
# permissions and limitations under the License.
#
BROWSER_BUNDLE_DIR=browser
#
# Make sure that browserify is available.
#
BROWSERIFY=`which browserify`
if [ $? = "0" ] 
then
#
# Make sure that npm is available.
#
   NPM=`which npm`
   if [ $? = "0" ] 
   then
#
# Make sure we are in the right directory by verifying the presence of a couple of files
#
      if [ -e "README.md" ] && [ -e "thing/index.js" ] && [ -d $BROWSER_BUNDLE_DIR ]
      then
#
# Check to see how many arguments are available; if there are none, we'll create the
# browser bundle to be used by other applications.  If one argument is available, we'll
# browserify that file using external references to aws-sdk and aws-iot-device-sdk and
# place the result in that directory under 'bundle.js'.  If two arguments are available
# available, we'll use the second argument as the bundle output file.  Finally, we'll
# copy the browser bundle into the application directory so that it's available for use.
#
         if [ $# = "0" ] || [ ! -f $BROWSER_BUNDLE_DIR/aws-iot-sdk-browser-bundle.js ]
         then

#
# Prepare the bundle by doing an npm install in the browser bundle directory.  Note
# that we use this copy of the SDK files rather than pulling them from npm, so that
# we can easily work with local changes, if necessary.
#
            (cd $BROWSER_BUNDLE_DIR; tar cvzf aws-iot-device-sdk.tgz --exclude ${PWD##*/} --exclude node_modules --exclude .git --exclude .coverdata --exclude debug --exclude examples --exclude reports --exclude test -C ../ .; mkdir -p node_modules/aws-iot-device-sdk; (cd node_modules/aws-iot-device-sdk; tar xvzf ../../aws-iot-device-sdk.tgz); npm install)
#
# Finally, create the browser bundle and delete all working files/directories.  Note
# that we allow aws-iot-device-sdk and aws-sdk to be required by other browserify bundles.
#
            (cd $BROWSER_BUNDLE_DIR; rm -f bundle.js; $BROWSERIFY -r aws-iot-device-sdk -r aws-sdk -o aws-iot-sdk-browser-bundle.js; rm -rf node_modules; rm -f aws-iot-device-sdk.tgz)
            echo ${0##*/}": prepared browser bundle"
         fi
#
# Browserify another app using external references to aws-sdk and aws-iot-device-sdk.
#
         if [ $# -ge "1" ] && [ -f $1"" ]
         then
            APP_PATH=${1%/*}""
            APP_NAME=${1##*/}""
            OUTPUT_FILE=bundle.js

            if [ $2"" != "" ]
            then
               OUTPUT_FILE=${2##*/}
            fi
            echo "browserifying "$1" and placing result in "$APP_PATH/$OUTPUT_FILE"..."
            (cd $APP_PATH""; $BROWSERIFY -x aws-sdk -x aws-iot-device-sdk $APP_NAME -o $OUTPUT_FILE)
            cp $BROWSER_BUNDLE_DIR/aws-iot-sdk-browser-bundle.js $APP_PATH
         else
            if [ $# -gt "2" ]
            then
               echo "usage: "${0##*/}" [javascript application] [output file]"
               rc=4
            else
               echo ${0##*/}": can't browserify ("$1") because it's not a file"
               rc=3
            fi
         fi
      else
         echo ${0##*/}": this script must be run in the package top-level directory"
         rc=2
      fi
   else
      echo ${0##*/}": npm is not available, please install"
      rc=1
   fi
else
   echo ${0##*/}": browserify is not available, please install, e.g. npm install -g browserify"
   rc=1
fi
exit $rc

#!/bin/bash
#
# Master integration test runner for the AWS IoT Node.js device SDK.  
#
# USAGE
#
#     run-tests.sh <authentication-type>
#
# PARAMETERS 
#
#                        <authentication-type> : [websocket|certificate|custom-auth]
#
# This program will first validate the given parameters, then attempt to
# retrieve required secrets from AWS secrets manager; if both are successful, it
# will execute all of the scripts under the 'integration-tests' directory 
# until either one of them exits with a non-zero status, or they have all 
# been executed.  If this program exits with a zero status, that indicates 
# that both the test setup and the test execution was successful.
#
# RETURNS
#
#     0 if successful, non-zero otherwise
#
# SECRET HANDLING
#
# This script handles retrieving secrets from AWS secrets manager; for
# websocket authentication, it will place the appropriate values in the AWS_ACCESS_KEY_ID 
# and AWS_SECRET_ACCESS_KEY environment variables used by the SDK.  For
# certificate authentication, the certificate and private key will be stored 
# in PEM-format temporary files, along with the root CA certificate;
# the files are named according to the default naming convention
# specified in the README.md, and the following environment variable points
# to their location:
#
#    CERT_DIR
#
# Temporary certificate and private key files are deleted after running the
# individual test runner scripts.
#
#

#
# Set a randomized directory name to isolate this test run from others
# in the same environment and make it available to sub-scripts via export.
#
export NPMTEST_DIR="/tmp/npmtest-"$RANDOM

#
# Validate arguments
#
if [ $# -eq 1 ]
then
   export AUTHENTICATION_TYPE=$1

   if [ $AUTHENTICATION_TYPE"" != "websocket" ] && \
      [ $AUTHENTICATION_TYPE"" != "certificate" ] && \
      [ $AUTHENTICATION_TYPE"" != "custom-auth" ]	  
   then
       echo ${0##*/}": authentication-type must be one of [websocket|certificate|custom-auth]"
       exit 2
   fi
   export LONG_RUNNING_TEST="" 
else
   echo ${0##*/}" <authentication-type>"
   exit 1
fi

#
# Set node/npm paths
NODE=`which node`
if [ ! -x $NODE"" ]
then
   echo ${0##*/}": can't find node, exiting..."
   exit 1
fi

NPM=`which npm`
if [ ! -x $NPM"" ]
then
   echo ${0##*/}": can't find npm, exiting..."
   exit 1
fi

#
# node-gyp requires that $HOME be defined
#
#export HOME=$PWD

#
# This script will run all of the programs under the integration-tests directory until
# either one executes with a non-zero status or they have all been run.
#
RUN_INTEGRATION_TESTS='./run-integration-tests.sh'

#
# Install the Node.js SDK under a new temporary directory.
#
echo "Running integration tests in ${NPMTEST_DIR}"
mkdir -p $NPMTEST_DIR
(cp -r ../../aws-iot-device-sdk-js $NPMTEST_DIR; cd $NPMTEST_DIR)
if [ $? != "0" ]
then
   echo "###################################################################"
   echo ${0##*/}": unable to copy iot sdk to test directory!"
   echo "###################################################################"
   exit 4    
fi

#
# Attempt an npm install of the AWS Node.js SDK for control plane access for creating test jobs
#
(cd $NPMTEST_DIR/aws-iot-device-sdk-js; $NPM install aws-sdk)
if [ $? != "0" ]
then
   echo "###################################################################"
   echo ${0##*/}": unable to npm install aws-sdk!"
   echo "###################################################################"
   exit 4
fi


#
# Attempt an npm install of the Node.js SDK
#
(cd $NPMTEST_DIR/aws-iot-device-sdk-js; $NPM install)
if [ $? != "0" ]
then
   echo "###################################################################"
   echo ${0##*/}": unable to npm install aws iot device sdk!"
   echo "###################################################################"
   exit 4
fi    

#
# The SDK installed without errors; now, retrieve credentials
#
echo "###################################################################"
echo ${0##*/}": retrieving AWS credentials from AWS SecretsManager"
echo "###################################################################"
# fetch secret value and strip quotes with sed
principal=$(aws --region us-east-1 secretsmanager get-secret-value --secret-id V1IotSdkIntegrationTestWebsocketAccessKeyId --query SecretString | sed -n 's/^"\(.*\)"/\1/p')
if [ $? == "0" ]
then
    echo ${0##*/}": retrieved ws testing access key id"
else
    echo ${0##*/}": couldn't retrieve ws testing access key id!"
    exit 5
fi

# fetch secret value and strip quotes with sed
credential=$(aws --region us-east-1 secretsmanager get-secret-value --secret-id V1IotSdkIntegrationTestWebsocketSecretAccessKey --query SecretString | sed -n 's/^"\(.*\)"/\1/p')
if [ $? == "0" ]
then
    echo ${0##*/}": retrieved ws testing secret access key"
else
    echo ${0##*/}": couldn't retrieve ws testing secret access key!"
    exit 6
fi

case $AUTHENTICATION_TYPE"" in 

   websocket)
       export AWS_ACCESS_KEY_ID=$principal
       export AWS_SECRET_ACCESS_KEY=$credential

       $RUN_INTEGRATION_TESTS
       exit $?
       ;;

   custom-auth)
       echo "###################################################################"
       echo ${0##*/}": setting custom-auth credentials"
       echo "###################################################################"

       export CUSTOM_AUTH_HEADERS="{ \"X-Amz-CustomAuthorizer-Name\": \"SDKTestAuthorizer\", \"X-Amz-CustomAuthorizer-Signature\": \"vHPdrbNsr24wR+OcR45el1xh14MtJu5zLPp5ZhoJo9mGCmWQcFj9wPhgYWmgX/900T3NFhB+c7fN8Cln7r6ZszMQP48fjFiF95FmqlXPENlEDWuLN8kCVE3BRr12fcvXDNo9gPEWYE71KkWDLTrqtuOIDFAp39zduEPhzN3bj0yn+0RCMA7X9Q3BNxJji+Rq1U68jCWTjGay9cz3P+PnxfL5zqnoeJhg7baJG+xf7b1kmDw9lMzUSXNGs6FTxO66TzOscZ6I8oOWrMUvTSe24j4POs00bROOTWc0XXoCvX/v4W+TI/Oe3jnJXfXcmOqLXLPqapgWL2XobiOnFjl0PA==\", \"SDKTestAuthorizerToken\": \"abc123\" }"

       # Make sure it won't reject the internal cert used by Gamma PDX. Once we switch to prod, remove this line
       export NODE_TLS_REJECT_UNAUTHORIZED=0

       $RUN_INTEGRATION_TESTS
       exit $?
       ;;
   
   certificate)
       export JOBS_AWS_ACCESS_KEY_ID=$principal
       export JOBS_AWS_SECRET_ACCESS_KEY=$credential

       export CERT_DIR=$NPMTEST_DIR/certs
       mkdir -p $CERT_DIR
       echo "###################################################################"
       echo ${0##*/}": retrieving certificate credentials from AWS Secrets Manager"
       echo "###################################################################"

       # fetch secret value, strip quotes and replace "\n" with an actual newline
       aws --region us-east-1 secretsmanager get-secret-value --secret-id V1IotSdkIntegrationTestCertificate --query SecretString | sed -n 's/^"\(.*\)"/\1/p' | sed 's/\\n/\
/g' > $CERT_DIR/certificate.pem.crt
       if [ $? == "0" ]
       then
	   echo ${0##*/}": retrieved Certificate"
       else
	   echo ${0##*/}": couldn't retrieve Certificate!"
	   exit 5
       fi

       # fetch secret value, strip quotes and replace "\n" with an actual newline
       aws --region us-east-1 secretsmanager get-secret-value --secret-id V1IotSdkIntegrationTestPrivateKey --query SecretString | sed -n 's/^"\(.*\)"/\1/p' | sed 's/\\n/\
/g' > $CERT_DIR/private.pem.key
       if [ $? == "0" ]
       then
	   echo ${0##*/}": retrieved Private Key"
       else
	   echo ${0##*/}": couldn't retrieve Private Key!"
	   exit 6
       fi
       
       #
       # Retrieve the root CA certificate
       #
       curl -s 'https://www.amazontrust.com/repository/AmazonRootCA1.pem' > $CERT_DIR/root-CA.crt
       if [ $? == "0" ]
       then
	   echo ${0##*/}": retrieved root CA certificate"
       else
	   echo ${0##*/}": couldn't retrieve root CA certificate!"
	   exit 7
       fi

       $RUN_INTEGRATION_TESTS
       exit $?
       ;;

   *)
       echo ${0##*/}": unsupported authentication type ("$AUTHENTICATION_TYPE")"
       ;;
esac

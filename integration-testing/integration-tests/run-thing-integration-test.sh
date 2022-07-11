#!/bin/bash
#
# Run the thing-mode integration test.
#
#
# Check to make sure the top-level test directory is defined.
#
if [ $NPMTEST_DIR"" = "" ] 
then
   echo ${0##*/}": NPMTEST_DIR must be defined!"
   exit 1
fi
#
# Set the name of the node executable (it should be in our path)
#
NODE=node
#
# Set a randomized test tag to isolate this test run from others within
# the AWS account associated with our Odin material set.  This ensures
# that all topic names used are unique to this test run.
#
TEST_TAG="test-"$RANDOM
export HOSTNAME="ajje7lpljulm4-ats.iot.us-east-1.amazonaws.com"
export CUSTOM_AUTH_HOST="ajje7lpljulm4.gamma.us-west-2.iot.amazonaws.com"
#
# Capture the exit code of the first command which fails in a pipeline.
#
set -o pipefail
#
# The integration tests pass a number of updates between two partner
# processes.  Because these are QoS 0, delivery isn't guaranteed, but
# we should expect to receive most of them.  All tests use the same number
# of updates (48).
#
RECEIVES_REQUIRED=46
TRANSMITS_TOTAL=48
#
# Process output will be captured in these files.
#
PROC1_OUTFILE=$NPMTEST_DIR/${0##*/}-$RANDOM-$RANDOM-proc-1.out
PROC2_OUTFILE=$NPMTEST_DIR/${0##*/}-$RANDOM-$RANDOM-proc-2.out
#
# Move the test javascript programs to the installed SDK
# directory
#
INT_TEST_DIR=$NPMTEST_DIR/aws-iot-device-sdk-js/integration-test
mkdir -p $INT_TEST_DIR
cp ${0%/*}/thing-integration-test.js $INT_TEST_DIR
#
# Start the two partner processes for the thing-mode integration test and
# save their PIDs.
#
if [ $AUTHENTICATION_TYPE"" == "certificate" ]
then
    echo "###################################################################"
    echo ${0##*/}": running thing integration test (certificate auth)"
    echo "###################################################################"
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $HOSTNAME -f $CERT_DIR -t1 --debug=true -T $TEST_TAG | tee $PROC1_OUTFILE &
    PROC1_PID=$!
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $HOSTNAME -f $CERT_DIR -t2 --debug=true -T $TEST_TAG | tee $PROC2_OUTFILE &
    PROC2_PID=$!
elif [ $AUTHENTICATION_TYPE"" == "custom-auth" ]
then
    echo "###################################################################"
    echo ${0##*/}": running device integration test (websocket/custom auth)"
    echo "###################################################################"
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $CUSTOM_AUTH_HOST -P=wss-custom-auth -t1 --debug=true -T $TEST_TAG | tee $PROC1_OUTFILE &
    PROC1_PID=$!
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $CUSTOM_AUTH_HOST -P=wss-custom-auth -t2 --debug=true -T $TEST_TAG | tee $PROC2_OUTFILE &
    PROC2_PID=$!
else
    echo "###################################################################"
    echo ${0##*/}": running thing integration test (websocket/sigv4)"
    echo "###################################################################"
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $HOSTNAME -P=wss -t1 --debug=true -T $TEST_TAG | tee $PROC1_OUTFILE &
    PROC1_PID=$!
    $NODE $INT_TEST_DIR/thing-integration-test.js -H $HOSTNAME -P=wss -t2 --debug=true -T $TEST_TAG | tee $PROC2_OUTFILE &
    PROC2_PID=$!
fi
#
# Wait on the two partner processes and record their exit codes.
#
wait $PROC1_PID
PROC1_EXIT_CODE=$?
wait $PROC2_PID
PROC2_EXIT_CODE=$?
#
# Combine the two exit codes; if either process exited abnormally, this
# test is a failure.
#
COMBINED_EXIT_CODE=$((PROC1_EXIT_CODE | PROC_2_EXIT_CODE))
if [ $COMBINED_EXIT_CODE"" = "0" ]
then
   numReceived1=`cat $PROC1_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $1}'`
   receiveMask1=`cat $PROC1_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $4}'|sed -e 's/.*=//'`
   numReceived2=`cat $PROC2_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $1}'`
   receiveMask2=`cat $PROC2_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $4}'|sed -e 's/.*=//'`
   
   echo "proc 1: "$numReceived1" messages received, receive mask ["$receiveMask1"]"
   echo "proc 2: "$numReceived2" messages received, receive mask ["$receiveMask2"]"

   if [ $numReceived1"" -gt $RECEIVES_REQUIRED ] && [ $numReceived2"" -gt $RECEIVES_REQUIRED ]
   then
      echo "########################################################"
      echo "   TEST SUCCEEDED: PROC 1 RECEIVED "$numReceived1"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required"
      echo "                   PROC 2 RECEIVED "$numReceived2"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required"
      echo "########################################################"
   else
      echo "########################################################"
      echo "   TEST FAILED: PROC 1 RECEIVED "$numReceived1"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required"
      echo "                PROC 2 RECEIVED "$numReceived2"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required"
      echo "########################################################"
      exit 2
   fi
else
   echo ${0##*/}": FAILED ("$PROC1_EXIT_CODE":"$PROC2_EXIT_CODE")"
   exit $COMBINED_EXIT_CODE
fi
rm $PROC1_OUTFILE $PROC2_OUTFILE

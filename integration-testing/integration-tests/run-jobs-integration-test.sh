#!/bin/bash
#
# Run the jobs-mode integration test.
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
COMPLETED_JOBS_REQUIRED=4
CREATED_JOBS_TOTAL=5
export HOSTNAME="ajje7lpljulm4-ats.iot.us-east-1.amazonaws.com"
#
# Process output will be captured in these files.
#
PROC1_OUTFILE=$NPMTEST_DIR/${0##*/}-$RANDOM-$RANDOM-proc-1.out
PROC2_OUTFILE=$NPMTEST_DIR/${0##*/}-$RANDOM-$RANDOM-proc-2.out
#
# Move the test javascript program to the installed SDK
# directory
#
INT_TEST_DIR=$NPMTEST_DIR/aws-iot-device-sdk-js/integration-test
mkdir -p $INT_TEST_DIR
cp ${0%/*}/jobs-integration-test.js $INT_TEST_DIR
#
# Start the two partner processes for the jobs-mode integration test and
# save their PIDs.
#
if [ $CERT_DIR"" != "" ]
then
    echo "###################################################################"
    echo ${0##*/}": running jobs integration test (certificate auth)"
    echo "###################################################################"
    $NODE $INT_TEST_DIR/jobs-integration-test.js -H $HOSTNAME -f $CERT_DIR -t2 --debug=true -T $TEST_TAG | tee $PROC2_OUTFILE &
    PROC2_PID=$!
    $NODE $INT_TEST_DIR/jobs-integration-test.js -H $HOSTNAME  -f $CERT_DIR -t1 --debug=true -T $TEST_TAG | tee $PROC1_OUTFILE &
    PROC1_PID=$!
elif [ $AUTHENTICATION_TYPE"" == "websocket" ]
then
    echo "###################################################################"
    echo ${0##*/}": running jobs integration test (websocket/sigv4)"
    echo "###################################################################"
    $NODE $INT_TEST_DIR/jobs-integration-test.js -H $HOSTNAME -P=wss -t2 --debug=true -T $TEST_TAG | tee $PROC2_OUTFILE &
    PROC2_PID=$!
    $NODE $INT_TEST_DIR/jobs-integration-test.js -H $HOSTNAME -P=wss -t1 --debug=true -T $TEST_TAG | tee $PROC1_OUTFILE &
    PROC1_PID=$!
else
    echo "###################################################################"
    echo ${0##*/}": skipping jobs integration test (custom_auth)"
    echo "###################################################################"
    exit 0
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
   jobsCompleted=`cat $PROC2_OUTFILE | grep -E '^[0-9]+\ jobs completed' |awk '{print $1}'`
   numReceived=`cat $PROC2_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $1}'`
   receiveMask=`cat $PROC2_OUTFILE | grep -E '^[0-9]+\ messages received, accumulator=.*' |awk '{print $4}'|sed -e 's/.*=//'`
   
   echo $numReceived" messages received, receive mask ["$receiveMask"]"
   echo $jobsCompleted" jobs completed"

   if !([ $numReceived"" -lt $RECEIVES_REQUIRED"" ] || [ $jobsCompleted -lt $COMPLETED_JOBS_REQUIRED ])
   then
      echo "########################################################"
      echo "   TEST SUCCEEDED: RECEIVED "$numReceived"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required" 
      echo "                   JOBS COMPLETED "$jobsCompleted"/"$CREATED_JOBS_TOTAL", "$COMPLETED_JOBS_REQUIRED" required" 
      echo "########################################################"
   else
      echo "########################################################"
      echo "   TEST FAILED: RECEIVED "$numReceived"/"$TRANSMITS_TOTAL", "$RECEIVES_REQUIRED" required"
      echo "                JOBS COMPLETED "$jobsCompleted"/"$CREATED_JOBS_TOTAL", "$COMPLETED_JOBS_REQUIRED" required"
      echo "########################################################"
      exit 2
   fi
else
   echo ${0##*/}": FAILED ("$PROC1_EXIT_CODE":"$PROC2_EXIT_CODE")"
   exit $COMBINED_EXIT_CODE
fi
rm $PROC1_OUTFILE $PROC2_OUTFILE

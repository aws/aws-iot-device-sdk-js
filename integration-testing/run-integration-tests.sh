#!/bin/bash
#

INTEGRATION_TEST_PATH=./integration-tests

TEST_COUNT=0
#
# Run each integration test; if it exits with a non-zero status,
# stop testing and return that status to the parent process.
#
for file in `ls $INTEGRATION_TEST_PATH`
do
#
# Only run executable files.
#
   if [ -x $INTEGRATION_TEST_PATH/$file ]
   then
#
# If not running in parallel mode, execute each test runner in sequence.
#
      if [ $PARALLEL_EXECUTION"" = "" ]
      then
         echo "###################################################################"
         echo ${0##*/}": running "${file##*/}"..."
         echo "###################################################################"
         $INTEGRATION_TEST_PATH/$file
         statusValue=$?
         echo "###################################################################"
         echo ${0##*/}": complete, status="$statusValue
         echo "###################################################################"
         if [ $statusValue"" != 0 ]
         then
            exit $statusValue""
         fi
      else
#
# If running in parallel mode, execute all test runners simultaneously.
#
         echo "###################################################################"
         echo ${0##*/}": running "${file##*/}" (parallel mode)..."
         echo "###################################################################"
         $INTEGRATION_TEST_PATH/$file &
         PIDS[$TEST_COUNT]=$!
         NAMES[$TEST_COUNT]=${file##*/}
         TEST_COUNT=$((TEST_COUNT+1))
      fi
   fi
done

if [ $PARALLEL_EXECUTION"" != "" ]
then
   COMBINED_EXIT_CODE=0
#
# Wait on all test runner processes.
#
   TEST_COUNT=0
   for PID in "${PIDS[@]}"
   do
      wait "$PID"
      EXIT_CODE=$?
      echo "###################################################################"
      echo ${NAMES[$TEST_COUNT]}" complete, status="$EXIT_CODE
      echo "###################################################################"
      TEST_COUNT=$((TEST_COUNT+1))
      COMBINED_EXIT_CODE=$((EXIT_CODE | COMBINED_EXIT_CODE))
   done
   echo "###################################################################"
   echo ${0##*/}": all test runners complete, status="$COMBINED_EXIT_CODE
   echo "###################################################################"
   exit $COMBINED_EXIT_CODE
else
#
# All test runners have completed successfully, exit with status 0
#
   exit 0
fi

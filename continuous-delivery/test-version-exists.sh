#!/usr/bin/env bash
set -ex

# force a failure if there's no tag
git describe --tags
# now get the tag
CURRENT_TAG=$(git describe --tags | cut -f2 -dv)
# convert v0.2.12-2-g50254a9 to 0.2.12
CURRENT_TAG_VERSION=$(git describe --tags | cut -f1 -d'-' | cut -f2 -dv)
# if there's a hash on the tag, then this is not a release tagged commit
if [ "$CURRENT_TAG" != "$CURRENT_TAG_VERSION" ]; then
    echo "Current tag version is not a release tag, cut a new release if you want to publish."
    exit 1
fi

PUBLISHED_TAG_VERSION=`npm show aws-iot-device-sdk version`
if [ "$PUBLISHED_TAG_VERSION" == "$CURRENT_TAG_VERSION" ]; then
    echo "$CURRENT_TAG_VERSION is already in npm, cut a new tag if you want to upload another version."
    exit 1
fi

echo "$CURRENT_TAG_VERSION currently does not exist in npm, allowing pipeline to continue."
exit 0

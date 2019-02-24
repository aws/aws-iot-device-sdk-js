/*
 * Copyright 2010-2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

var assert = require('assert');

var isUndefined = require('../common/lib/is-undefined');

describe( "Common Lib", function() {
    describe( "isUndefined", function() {
        it("returns true for undefined", function() {
            assert.equal(isUndefined(undefined), true);
        });

        it("returns true for null", function() {
            assert.equal(isUndefined(null), true);
        });

        it("returns false for strings", function() {
            assert.equal(isUndefined('foobar'), false);
        });

        it("returns false for numbers", function() {
            assert.equal(isUndefined(1.5), false);
        });

        it("returns false for integers", function() {
            assert.equal(isUndefined(1), false);
        });

        it("returns false for objects", function() {
            assert.equal(isUndefined({}), false);
        });

        it("returns false for arrays", function() {
            assert.equal(isUndefined([]), false);
        });
    });
});

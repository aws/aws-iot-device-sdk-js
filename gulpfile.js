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
/*jshint node:true*/
'use strict';

var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    mocha = require('gulp-mocha'),
    eslint = require('gulp-eslint');

function lint() {
  console.log('Analyzing source with JSHint and JSCS');
  return gulp
      .src(['common/lib/*.js','examples/**/*.js', 'device/**/*.js','thing/*.js','index.js', '!node_modules/**/*.js', '!examples/**/node_modules/**/*.js', '!examples/**/aws-configuration.js', '!browser/**/*bundle.js', '!examples/browser/**/*bundle.js'])
      .pipe(jshint())
      .pipe(jshint.reporter('jshint-stylish', {verbose: true}))
      .pipe(jshint.reporter('fail'))
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(eslint.failAfterError());
}

exports.lint = lint;

function test() {
  console.log('Running unit tests');
  return gulp.src(['test/*unit-tests.js'], {read: false})
      .pipe(mocha({
        reporter: 'spec'
      }));
}

exports.test = gulp.series(exports.lint, test);

exports.default = exports.test;



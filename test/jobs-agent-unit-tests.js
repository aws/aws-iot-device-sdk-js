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

//npm deps

//app deps
var rewire = require('rewire');
var sinon = require('sinon');
var assert = require('assert');

var copyFileModule = rewire('../examples/lib/copy-file');
var downloadFileModule = rewire('../examples/lib/download-file');
var jobsAgentModule = rewire('../examples/jobs-agent');

var isUndefined = require('../common/lib/is-undefined');

//
// Object to simulate file system operations using in memory structure
//
var fs = {
    fileStore: {},
    readEventHandlers: {},
    writeEventHandlers: {},
    reset: function() {
        this.fileStore = {};
        this.readEventHandlers = {};
        this.writeEventHandlers = {};
    },
    writeFileSync: function(fileName, contents) {
        this.fileStore[fileName] = contents;
    },
    readFileSync: function(fileName) {
        return this.fileStore[fileName];
    },
    existsSync: function(fileName) {
        return !isUndefined(this.fileStore[fileName]);
    },
    writeSync: function(fd, data) {
    },
    createWriteStream: function(fileName) {
        return {
            write: function(data) {
                fs.fileStore[fileName] = data;
                if (!isUndefined(fs.writeEventHandlers[fileName + 'close'])) {
                    fs.writeEventHandlers[fileName + 'close']();
                }
            },
            end: function() {},
            on: function(eventName, handler) {
                fs.writeEventHandlers[fileName + eventName] = handler;
                return this;
            }
        };
    },
    createReadStream: function(fileName) {
        return {
            pipe: function(ws) {
                ws.write(fs.fileStore[fileName]);
            },
            end: function() {
            },
            on: function(eventName, handler) {
                fs.readEventHandlers[fileName + eventName] = handler;

                // if both 'data' and 'end' handlers added simulate stream file transfer
                if ((eventName === 'data' || eventName === 'end') &&
                    !isUndefined(fs.readEventHandlers[fileName + 'data']) &&
                    !isUndefined(fs.readEventHandlers[fileName + 'end'])) {
                    fs.readEventHandlers[fileName + 'data'](fs.fileStore[fileName]);
                    fs.readEventHandlers[fileName + 'end']();
                }
                return this;
            }
        };
    },
    unlink: function(fileName) {
        this.fileStore[fileName] = undefined;
    }
};

var pathStub = {
    resolve: function(arg1, arg2) {
        return '/' + (isUndefined(arg2) ? arg1 : arg2);
    }
};

const tempDir = '/';

copyFileModule.__set__('fs', fs);
downloadFileModule.__set__({'fs': fs, 'copyFile': copyFileModule});
jobsAgentModule.__set__({'fs': fs, 'copyFile': copyFileModule, 'downloadFile': downloadFileModule, 'path': pathStub});

describe( 'jobs agent unit tests', function() {
    function buildJobObject(operation, status, jobDocument, inProgress, failed, succeeded) {
        var job = {};

        job.id = '1234';
        job.document = jobDocument;
        job.operation = operation;
        job.status = status;
        job.inProgress = inProgress;
        job.failed = failed;
        job.succeeded = succeeded;

        return job;
    }
    describe( 'install handler tests', function() {
        var installHandler = jobsAgentModule.__get__('installHandler');
        var fakeCallbackInProgress = sinon.spy();
        var fakeCallbackFailed = sinon.spy();
        var fakeCallbackSucceeded = sinon.spy();

        it('invalid status calls failed callback', function() {
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'INVALID' }, null, fakeCallbackInProgress, function (statusDetails) {
                fakeCallbackFailed();
                console.log(statusDetails);
                assert.equal(statusDetails.errorCode, 'ERR_UNEXPECTED');
            }, fakeCallbackSucceeded);
            installHandler(job);
            sinon.assert.notCalled(fakeCallbackInProgress);
            assert(fakeCallbackFailed.calledOnce);
            sinon.assert.notCalled(fakeCallbackSucceeded);
        });

        it('missing packageName calls failed callback', function() {
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, { files: [ { fileName: 'testFileName' } ] }, fakeCallbackInProgress, function (statusDetails) {
                fakeCallbackFailed();
                console.log(statusDetails);
                assert.equal(statusDetails.errorCode, 'ERR_UNNAMED_PACKAGE');
            }, fakeCallbackSucceeded);
            installHandler(job);
            sinon.assert.notCalled(fakeCallbackInProgress);
            assert(fakeCallbackFailed.calledOnce);
            sinon.assert.notCalled(fakeCallbackSucceeded);
        });

        it('missing files list calls failed callback', function() {
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, { packageName: 'testPackageName' }, fakeCallbackInProgress, function (statusDetails) {
                fakeCallbackFailed();
                console.log(statusDetails);
                assert.equal(statusDetails.errorCode, 'ERR_FILE_COPY_FAILED');
            }, fakeCallbackSucceeded);
            installHandler(job);
            sinon.assert.notCalled(fakeCallbackInProgress);
            assert(fakeCallbackFailed.calledOnce);
            sinon.assert.notCalled(fakeCallbackSucceeded);
        });

        it('empty files list calls failed callback', function() {
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, { packageName: 'testPackageName', files: [] }, fakeCallbackInProgress, function (statusDetails) {
                fakeCallbackFailed();
                console.log(statusDetails);
                assert.equal(statusDetails.errorCode, 'ERR_FILE_COPY_FAILED');
            }, fakeCallbackSucceeded);
            installHandler(job);
            sinon.assert.notCalled(fakeCallbackInProgress);
            assert(fakeCallbackFailed.calledOnce);
            sinon.assert.notCalled(fakeCallbackSucceeded);
        });

        it('invalid file in files list calls failed callback', function() {
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName',
                    files: [ null, { fileName: 'testFileName.txt' } ] },
                fakeCallbackInProgress,
                function (statusDetails, cb) {
                    fakeCallbackFailed();
                    console.log(statusDetails);
                    assert.equal(statusDetails.errorCode, 'ERR_FILE_COPY_FAILED');
                    cb();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
            sinon.assert.notCalled(fakeCallbackInProgress);
            assert(fakeCallbackFailed.calledOnce);
            sinon.assert.notCalled(fakeCallbackSucceeded);
        });

        it('missing url in file in files calls failed callback, rolls back', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt' } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledThrice);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('invalid url in file in files calls failed callback, rolls back', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt', fileSource: { url: 'https://bogus.not.a.url' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledThrice);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('valid url, calls succeed callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fs.writeFileSync('/testNewFile.txt', 'This is an updated test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt', fileSource: { url: 'file:///testNewFile.txt' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                fakeCallbackFailed,
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledTwice);
                    sinon.assert.notCalled(fakeCallbackFailed);
                    assert(fs.readFileSync('/testFileName.txt').toString() === 'This is an updated test.');
                    done();
                }
            );
            installHandler(job);
        });

        it('valid url, invalid checksum hash algorithm, called failed callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fs.writeFileSync('/testNewFile.txt', 'This is an updated test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt', fileSource: { url: 'file:///testNewFile.txt' },
                    checksum: { inline: { value: '1234567890' }, hashAlgorithm: 'invalid' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledThrice);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    assert(fs.readFileSync('/testFileName.txt').toString() === 'This is a test.');
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('valid url, invalid checksum value, called failed callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fs.writeFileSync('/testNewFile.txt', 'This is an updated test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt', fileSource: { url: 'file:///testNewFile.txt' },
                    checksum: { inline: { value: '1234567890' }, hashAlgorithm: 'md5' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledThrice);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    assert(fs.readFileSync('/testFileName.txt').toString() === 'This is a test.');
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('valid url, valid checksum value, called succeeded callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName.txt', 'This is a test.');
            fs.writeFileSync('/testNewFile.txt', 'This is an updated test.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName.txt', fileSource: { url: 'file:///testNewFile.txt' },
                    checksum: { inline: { value: 'f51ecee397f3a4247c4e927ee9dad03b' }, hashAlgorithm: 'md5' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                fakeCallbackFailed,
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.calledTwice);
                    sinon.assert.notCalled(fakeCallbackFailed);
                    assert(fs.readFileSync('/testFileName.txt').toString() === 'This is an updated test.');
                    done();
                }
            );
            installHandler(job);
        });

        it('multiple file download, fails checksum on second file, both files rolled back, called failed callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName1.txt', 'This is a test 1.');
            fs.writeFileSync('/testNewFile1.txt', 'This is an updated test 1.');
            fs.writeFileSync('/testFileName2.txt', 'This is a test 2.');
            fs.writeFileSync('/testNewFile2.txt', 'This is an updated test 2.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName1.txt', fileSource: { url: 'file:///testNewFile1.txt' } },
                    { fileName: 'testFileName2.txt', fileSource: { url: 'file:///testNewFile2.txt' },
                    checksum: { inline: { value: 'notavalidchecksum' }, hashAlgorithm: 'md5' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.callCount === 6);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    assert(fs.readFileSync('/testFileName1.txt').toString() === 'This is a test 1.');
                    assert(fs.readFileSync('/testFileName2.txt').toString() === 'This is a test 2.');
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('multiple file download, called succeeded callback', function(done) {
            fs.reset();
            fs.writeFileSync('/testFileName1.txt', 'This is a test 1.');
            fs.writeFileSync('/testNewFile1.txt', 'This is an updated test 1.');
            fs.writeFileSync('/testFileName2.txt', 'This is a test 2.');
            fs.writeFileSync('/testNewFile2.txt', 'This is an updated test 2.');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    files: [ { fileName: 'testFileName1.txt', fileSource: { url: 'file:///testNewFile1.txt' } },
                    { fileName: 'testFileName2.txt', fileSource: { url: 'file:///testNewFile2.txt' },
                    checksum: { inline: { value: '074a905b4855d78cb883a46191189f0e' }, hashAlgorithm: 'md5' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                },
                fakeCallbackFailed,
                function(statusDetails, cb) {
                    console.log(statusDetails);
                    cb();
                    assert(fakeCallbackInProgress.callCount === 4);
                    sinon.assert.notCalled(fakeCallbackFailed);
                    assert(fs.readFileSync('/testFileName1.txt').toString() === 'This is an updated test 1.');
                    assert(fs.readFileSync('/testFileName2.txt').toString() === 'This is an updated test 2.');
                    done();
                }
            );
            installHandler(job);
        });

        it('valid url to invalid program file, calls failed callback', function(done) {
            fs.reset();
            fs.writeFileSync('/program.js', 'previous program version');
            fs.writeFileSync('/badNewProgram.js', 'this is an invalid node program to install');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    launchCommand: 'node -e "this is an invalid node program to install"', autoStart: true,
                    files: [ { fileName: 'program.js', fileSource: { url: 'file:///badNewProgram.js' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    cb();
                },
                function(statusDetails, cb) {
                    cb();
                    assert(fakeCallbackInProgress.callCount === 4);
                    sinon.assert.notCalled(fakeCallbackSucceeded);
                    assert(fs.readFileSync('/program.js').toString() === 'previous program version');
                    assert(fs.readFileSync('/badNewProgram.js').toString() === 'this is an invalid node program to install');
                    done();
                },
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

        it('valid url to valid program file, calls inProgress callback', function(done) {
            fs.reset();
            fs.writeFileSync('/program.js', 'previous program version');
            fs.writeFileSync('/newProgram.js', 'function done() {}; setTimeout(done, 3000);');
            fakeCallbackInProgress.resetHistory();
            fakeCallbackFailed.resetHistory();
            fakeCallbackSucceeded.resetHistory();
            var job = buildJobObject('install', { status: 'QUEUED' }, {
                    packageName: 'testPackageName', workingDirectory: tempDir,
                    launchCommand: 'node -e "function done() {}; setTimeout(done, 3000);"', autoStart: true,
                    files: [ { fileName: 'program.js', fileSource: { url: 'file:///newProgram.js' } } ] },
                function(statusDetails, cb) {
                    fakeCallbackInProgress();
                    console.log(statusDetails);
                    cb();
                    if (statusDetails.step === 'restarting package') {
                        assert(fakeCallbackInProgress.callCount === 3);
                        assert(fs.readFileSync('/program.js').toString() === 'function done() {}; setTimeout(done, 3000);');
                        done();
                    }
                },
                fakeCallbackFailed,
                fakeCallbackSucceeded
            );
            installHandler(job);
        });

    });
});


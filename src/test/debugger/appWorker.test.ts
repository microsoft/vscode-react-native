// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as WebSocket from "ws";
import * as path from "path";
import * as Q from "q";
import * as sinon from "sinon";

import * as AppWorker from "../../debugger/appWorker";
import {ScriptImporter} from "../../debugger/scriptImporter";
import {Packager} from "../../common/packager";

suite("appWorker", function() {
    suite("debuggerContext", function() {
        const packagerPort = 8081;

        suite("SandboxedAppWorker", function() {
            const sourcesStoragePath = path.resolve(__dirname, "assets");
            const startScriptFileName = require.resolve(path.join(sourcesStoragePath, ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME));
            const debugAdapterPort = 9090;

            let sandboxedWorker: AppWorker.SandboxedAppWorker;
            let downloadAppScriptStub = sinon.stub();
            let postReplyFunction = sinon.stub();
            let readFileStub = sinon.stub();

            setup(function() {
                const nodeFileSystemMock: any = {
                    readFile: readFileStub,
                };

                const scriptImporterMock: any = {
                    downloadAppScript: downloadAppScriptStub,
                };

                sandboxedWorker = new AppWorker.SandboxedAppWorker(packagerPort, sourcesStoragePath, debugAdapterPort, postReplyFunction, {
                    nodeFileSystem: nodeFileSystemMock,
                    scriptImporter: scriptImporterMock,
                });
            });

            teardown(function() {
                // Reset everything
                sandboxedWorker = null;

                readFileStub = sinon.stub();
                downloadAppScriptStub = sinon.stub();
                postReplyFunction = sinon.stub();
            });


            test("should execute scripts correctly and be able to invoke the callback", function() {
                const expectedMessageResult = { success: true };
                const startScriptContents = `var testResponse = ${JSON.stringify(expectedMessageResult)}; postMessage(testResponse);`;

                readFileStub.withArgs(startScriptFileName).returns(Q.resolve(startScriptContents));

                return sandboxedWorker.start().then(() => {
                    assert(postReplyFunction.calledWithExactly(expectedMessageResult));
                });
            });

            test("should be able to import scripts", function() {
                const scriptImportPath = "testScript.js";
                const startScriptContents = `importScripts("${scriptImportPath}"); postMessage("postImport");`;
                readFileStub.withArgs(startScriptFileName).returns(Q.resolve(startScriptContents));

                const testScriptContents = "postMessage('inImport')";
                const scriptImportDeferred = Q.defer<void>();
                downloadAppScriptStub.withArgs(scriptImportPath, debugAdapterPort).returns(scriptImportDeferred.promise.then(() => {
                    return {
                        contents: testScriptContents,
                        filepath: scriptImportPath,
                    };
                }));

                return sandboxedWorker.start().then(() => {
                    // We have not yet finished importing the script, we should not have posted a response yet
                    assert(postReplyFunction.notCalled, "postReplyFuncton called before scripts imported");
                    scriptImportDeferred.resolve(void 0);
                    return Q.delay(1);
                }).then(() => {
                    assert(postReplyFunction.calledWith("postImport"), "postMessage after import not handled");
                    assert(postReplyFunction.calledWith("inImport"), "postMessage not registered from within import");
                });
            });

            test("should correctly pass postMessage to the loaded script", function() {
                const startScriptContents = `onmessage = postMessage;`;
                readFileStub.withArgs(startScriptFileName).returns(Q.resolve(startScriptContents));

                const testMessage = { method: "test", success: true };

                return sandboxedWorker.start().then(() => {
                    assert(postReplyFunction.notCalled, "postRepyFunction called before message sent");
                    sandboxedWorker.postMessage(testMessage);
                    return Q.delay(1);
                }).then(() => {
                    assert(postReplyFunction.calledWith({ data: testMessage }), "No echo back from app");
                });
            });

            test("should be able to require an installed node module via __debug__.require", function () {
                const expectedMessageResult = { qString: Q.toString() };
                const startScriptContents = `var Q = __debug__.require('q');
                    var testResponse = { qString: Q.toString() };
                    postMessage(testResponse);`;

                readFileStub.withArgs(startScriptFileName).returns(Q.resolve(startScriptContents));

                return sandboxedWorker.start().then(() => {
                    assert(postReplyFunction.calledWithExactly(expectedMessageResult));
                });
            });
        });

        suite("MultipleLifetimesAppWorker", function() {
            const sourcesStoragePath = path.resolve(__dirname, "assets");
            const debugAdapterPort = 9090;

            let multipleLifetimesWorker: AppWorker.MultipleLifetimesAppWorker;
            let sandboxedAppWorkerStub: Sinon.SinonStub;
            let webSocket: Sinon.SinonStub;
            let sandboxedAppConstructor: Sinon.SinonStub;
            let webSocketConstructor: Sinon.SinonStub;
            let packagerIsRunning: Sinon.SinonStub;

            let sendMessage: (message: string) => void;

            let clock: Sinon.SinonFakeTimers;

            setup(function() {
                webSocket = sinon.createStubInstance(WebSocket);
                sandboxedAppWorkerStub = sinon.createStubInstance(AppWorker.SandboxedAppWorker);

                const messageInvocation: Sinon.SinonStub = (<any>webSocket).on.withArgs("message");
                sendMessage = (message: string) => messageInvocation.callArgWith(1, message);

                sandboxedAppConstructor = sinon.stub();
                sandboxedAppConstructor.returns(sandboxedAppWorkerStub);
                webSocketConstructor = sinon.stub();
                webSocketConstructor.returns(webSocket);
                packagerIsRunning = sinon.stub(Packager, "isPackagerRunning");
                packagerIsRunning.returns(Q.resolve(true));

                multipleLifetimesWorker = new AppWorker.MultipleLifetimesAppWorker(packagerPort, sourcesStoragePath, debugAdapterPort, {
                    sandboxedAppConstructor: sandboxedAppConstructor,
                    webSocketConstructor: webSocketConstructor,
                });
            });

            teardown(function() {
                // Reset everything
                multipleLifetimesWorker = null;
                webSocket = null;
                sandboxedAppWorkerStub = null;
                sandboxedAppConstructor = null;
                webSocketConstructor = null;
                sendMessage = null;
                packagerIsRunning.restore();
                packagerIsRunning = null;

                if (clock) {
                    clock.restore();
                    clock = null;
                }
            });

            test("with packager running should construct a websocket connection to the correct endpoint and listen for events", function() {
                return multipleLifetimesWorker.start().then(() => {
                    const websocketRegex = new RegExp("ws://[^:]*:[0-9]*/debugger-proxy\\?role=debugger");
                    assert(webSocketConstructor.calledWithMatch(websocketRegex), "The web socket was not constructed to the correct url: " + webSocketConstructor.args[0][0]);

                    const expectedListeners = ["open", "close", "message", "error"];
                    expectedListeners.forEach((event) => {
                        assert((<any>webSocket).on.calledWithMatch(event), `Missing listener for ${event}`);
                    });
                });
            });

            test("with packager running should attempt to reconnect after disconnecting", function() {
                return multipleLifetimesWorker.start().then(() => {
                    // Forget previous invocations
                    webSocketConstructor.reset();
                    packagerIsRunning.returns(Q.resolve(true));

                    clock = sinon.useFakeTimers();

                    const closeInvocation: Sinon.SinonStub = (<any>webSocket).on.withArgs("close");
                    closeInvocation.callArg(1);

                    // Ensure that the retry is 100ms after the disconnection
                    clock.tick(99);
                    assert(webSocketConstructor.notCalled, "Attempted to reconnect too quickly");

                    clock.tick(1);
                }).then(() => {
                    assert(webSocketConstructor.called);
                });
            });

            test("with packager running should respond correctly to prepareJSRuntime messages", function() {
                return multipleLifetimesWorker.start().then(() => {
                    const messageId = 1;
                    const testMessage = JSON.stringify({ method: "prepareJSRuntime", id: messageId });
                    const expectedReply = JSON.stringify({ replyID: messageId });

                    const appWorkerDeferred = Q.defer<void>();

                    const appWorkerStart: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).start;
                    const websocketSend: Sinon.SinonStub = (<any>webSocket).send;

                    appWorkerStart.returns(appWorkerDeferred.promise);

                    sendMessage(testMessage);

                    assert(appWorkerStart.called, "SandboxedAppWorker not started in respones to prepareJSRuntime");
                    assert(websocketSend.notCalled, "Response sent prior to configuring sandbox worker");

                    appWorkerDeferred.resolve(void 0);

                    return Q.delay(1).then(() => {
                        assert(websocketSend.calledWith(expectedReply), "Did not receive the expected response to prepareJSRuntime");
                    });
                });
            });

            test("with packager running should pass unknown messages to the sandboxedAppWorker", function() {
                return multipleLifetimesWorker.start().then(() => {
                    // Start up an app worker
                    const prepareJSMessage = JSON.stringify({ method: "prepareJSRuntime", id: 1 });
                    const appWorkerStart: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).start;
                    appWorkerStart.returns(Q.resolve(void 0));

                    sendMessage(prepareJSMessage);

                    // Then attempt to message it

                    const testMessage = { method: "unknownMethod" };
                    const testMessageString = JSON.stringify(testMessage);

                    const postMessageStub: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).postMessage;

                    assert(postMessageStub.notCalled, "sandboxedAppWorker.postMessage called prior to any message");
                    sendMessage(testMessageString);

                    assert(postMessageStub.calledWith(testMessage), "message was not passed to sandboxedAppWorker");
                });
            });

            test("with packager running should close connection if there is another debugger connected to packager", () => {
                return multipleLifetimesWorker.start().then(() => {
                    // Forget previous invocations
                    webSocketConstructor.reset();
                    clock = sinon.useFakeTimers(new Date().getTime());

                    const closeInvocation: Sinon.SinonStub = (<any>webSocket).on.withArgs("close");
                    (<any>webSocket)._closeMessage = "Another debugger is already connected";
                    closeInvocation.callArg(1);

                    // Ensure it doesn't try to reconnect
                    clock.tick(100);
                    assert(webSocketConstructor.notCalled, "socket attempted to reconnect");
                });
            });

            test("without packager running should not start if there is no packager running", () => {
                packagerIsRunning.returns(Q.resolve(false));

                return multipleLifetimesWorker.start()
                    .done(() => {
                        assert(webSocketConstructor.notCalled, "socket should not be created");
                    }, reason => {
                        assert(reason.message === `Cannot attach to packager. Are you sure there is a packager and it is running in the port ${packagerPort}? If your packager is configured to run in another port make sure to add that to the setting.json.`);
                    });
            });
        });

    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as WebSocket from "ws";
import * as vscode from "vscode";
import * as path from "path";
import * as sinon from "sinon";
import * as child_process from "child_process";
import { MultipleLifetimesAppWorker } from "../../src/debugger/appWorker";
import { ForkedAppWorker } from "../../src/debugger/forkedAppWorker";
import * as ForkedAppWorkerModule from "../../src/debugger/forkedAppWorker";
import * as packagerStatus from "../../src/common/packagerStatus";
import { ScriptImporter, DownloadedScript } from "../../src/debugger/scriptImporter";
import { PromiseUtil } from "../../src/common/node/promise";

suite("appWorker", function () {
    suite("debuggerContext", function () {
        const packagerPort = 8081;

        suite("SandboxedAppWorker", function () {
            const originalSpawn = child_process.spawn;
            const sourcesStoragePath = path.resolve(__dirname, "assets");

            // Inject 5 sec delay before shutting down to worker to give tests some time to execute
            const WORKER_DELAY_SHUTDOWN = `setTimeout(() => {console.log("Shutting down")}, 5000)`;

            let testWorker: ForkedAppWorker;
            let spawnStub: Sinon.SinonStub;
            let postReplyFunction = sinon.stub();

            function workerWithScript(scriptBody: string): ForkedAppWorker {
                const wrappedBody = [
                    MultipleLifetimesAppWorker.WORKER_BOOTSTRAP,
                    scriptBody,
                    MultipleLifetimesAppWorker.WORKER_DONE,
                    WORKER_DELAY_SHUTDOWN,
                ].join("\n");

                spawnStub = sinon.stub(child_process, "spawn", () =>
                    originalSpawn("node", ["-e", wrappedBody], {
                        stdio: ["pipe", "pipe", "pipe", "ipc"],
                    }),
                );

                testWorker = new ForkedAppWorker(
                    "localhost",
                    packagerPort,
                    sourcesStoragePath,
                    "",
                    postReplyFunction,
                );
                return testWorker;
            }

            teardown(function () {
                // Reset everything
                if (spawnStub) {
                    spawnStub.restore();
                }
                postReplyFunction.reset();
                if (testWorker) {
                    testWorker.stop();
                }
            });

            test("should execute scripts correctly and be able to invoke the callback", async function () {
                const expectedMessageResult = { success: true };
                const startScriptContents = `var testResponse = ${JSON.stringify(
                    expectedMessageResult,
                )}; postMessage(testResponse);`;

                await workerWithScript(startScriptContents).start();
                await PromiseUtil.delay(1000);
                assert(postReplyFunction.calledWithExactly(expectedMessageResult));
            });

            test("should be able to import scripts", async function () {
                // NOTE: we're not able to mock reading script for import since this is performed by a
                // separate node process and is out of control so we must provide a real script file
                const scriptImportPath = path
                    .resolve(sourcesStoragePath, "importScriptsTest.js")
                    .replace(/\\/g, "/");
                const startScriptContents = `importScripts("${scriptImportPath}"); postMessage("postImport");`;

                await workerWithScript(startScriptContents).start();
                // We have not yet finished importing the script, we should not have posted a response yet
                assert(
                    postReplyFunction.notCalled,
                    "postReplyFuncton called before scripts imported",
                );
                await PromiseUtil.delay(500);
                assert(
                    postReplyFunction.calledWith("postImport"),
                    "postMessage after import not handled",
                );
                assert(
                    postReplyFunction.calledWith("inImport"),
                    "postMessage not registered from within import",
                );
            });

            test("should correctly pass postMessage to the loaded script", async function () {
                const startScriptContents = `onmessage = postMessage;`;
                const testMessage = { method: "test", success: true };

                const worker = workerWithScript(startScriptContents);
                await worker.start();
                assert(postReplyFunction.notCalled, "postReplyFunction called before message sent");
                worker.postMessage(testMessage);
                await PromiseUtil.delay(1000);
                assert(
                    postReplyFunction.calledWith({ data: testMessage }),
                    "No echo back from app",
                );
            });

            test("should be able to require an installed node module via __debug__.require", async function () {
                const expectedMessageResult = { promiseString: Promise.toString() };
                const startScriptContents = `var testResponse = { promiseString: Promise.toString() };
                    postMessage(testResponse);`;

                await workerWithScript(startScriptContents).start();
                await PromiseUtil.delay(5000);
                assert(postReplyFunction.calledWithExactly(expectedMessageResult));
            }).timeout(5500);

            test("should download script from remote packager", async () => {
                class MockAppWorker extends ForkedAppWorker {
                    public workerLoaded: Promise<void>;
                    public scriptImporter: ScriptImporter;
                    public debuggeeProcess: any = {
                        send: () => void 0,
                    };
                }
                const remotePackagerAddress = "1.2.3.4";
                const remotePackagerPort = 1337;
                const worker = new MockAppWorker(
                    remotePackagerAddress,
                    remotePackagerPort,
                    sourcesStoragePath,
                    "",
                    postReplyFunction,
                );
                const downloadAppScriptStub = sinon.stub(
                    worker.scriptImporter,
                    "downloadAppScript",
                );
                const fakeDownloadedScript = <DownloadedScript>{ filepath: "/home/test/file" };
                downloadAppScriptStub.returns(Promise.resolve(fakeDownloadedScript));
                const debuggeeProcessSendStub = sinon.stub(worker.debuggeeProcess, "send");
                worker.workerLoaded = Promise.resolve();
                const fakeMessage = {
                    method: "executeApplicationScript",
                    url: "http://localhost:8081/test-url",
                };

                await worker.postMessage(fakeMessage);

                assert.strictEqual(downloadAppScriptStub.calledOnce, true);
                assert.strictEqual(
                    downloadAppScriptStub.firstCall.args[0],
                    `http://${remotePackagerAddress}:${remotePackagerPort}/test-url`,
                );
                assert.strictEqual(debuggeeProcessSendStub.calledOnce, true);
                assert.deepStrictEqual(debuggeeProcessSendStub.firstCall.args[0], {
                    data: {
                        ...fakeMessage,
                        url: worker.pathToFileUrl(fakeDownloadedScript.filepath),
                    },
                });
            });

            test("debuggee process should pass its output to appWorker", () => {
                class MockAppWorker extends ForkedAppWorker {
                    public getDebuggeeProcess() {
                        return this.debuggeeProcess;
                    }
                }

                const sourcesStoragePath = path.resolve(__dirname, "assets", "consoleLog");
                const testWorker: MockAppWorker = new MockAppWorker(
                    "localhost",
                    packagerPort,
                    sourcesStoragePath,
                    "",
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    () => {},
                );

                let ws: WebSocket;
                let waitForContinue: Promise<void>;
                let waitForCheckingOutput: Promise<void>;
                let debuggeeProcess: child_process.ChildProcess;

                teardown(done => {
                    if (ws) ws.close();
                    done();
                });

                const sendContinueToDebuggee = (
                    wsDebuggerUrl: string,
                    resolve: (value?: void | PromiseLike<void> | undefined) => void,
                    reject: (reason: any) => void,
                ) => {
                    ws = new WebSocket(wsDebuggerUrl);
                    ws.on("open", function open() {
                        ws.send(
                            JSON.stringify({
                                // id is just a random number, because debugging protocol requires it
                                id: 100,
                                method: "Runtime.runIfWaitingForDebugger",
                            }),
                            async (err: Error) => {
                                if (err) {
                                    reject(err);
                                }
                                // Delay is needed for debuggee process to execute script
                                await PromiseUtil.delay(1000);
                                resolve();
                            },
                        );
                    });
                    ws.on("error", () => {
                        // Suppress any errors from websocket client otherwise you'd get ECONNRESET or 400 errors
                        // for some reasons
                    });
                };

                waitForContinue = new Promise(async (resolve, reject) => {
                    await testWorker.start();
                    let output: string = "";
                    let debugOutput: string = "";
                    let isAlreadySending = false;
                    debuggeeProcess = testWorker.getDebuggeeProcess() as child_process.ChildProcess;
                    debuggeeProcess.stderr.on("data", (data: string) => {
                        // Two notices:
                        // 1. More correct way would be getting websocket debugger url by requesting GET http://localhost:debugPort/json/list
                        //    but for some reason sometimes it returns ECONNRESET, so we have to find it in debug logs produced by debuggee
                        // 2. Debuggee process writes debug logs in stderr for some reasons
                        data = data.toString();
                        debugOutput += data;
                        console.log(data);
                        // Looking for websocket url
                        // 1. Node v8+: ws://127.0.0.1:31732/7dd4c075-3222-4f31-8fb5-50cc5705dd21
                        const guidPattern =
                            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
                        const finalPattern = new RegExp(
                            `(ws:\/\/127.0.0.1:[0-9]+\/${guidPattern}$)`,
                            "gm",
                        );
                        let found = debugOutput.match(finalPattern);
                        if (found && !isAlreadySending) {
                            isAlreadySending = true;
                            // Debuggee process which has been ran with --debug-brk will be stopped at 0 line,
                            // so we have to send it a command to continue execution of the script via websocket.
                            sendContinueToDebuggee(found[0], resolve, reject);
                            return;
                        }

                        // 2. Node v6: ws=127.0.0.1:31732/7dd4c075-3222-4f31-8fb5-50cc5705dd21
                        found = debugOutput.match(/(ws=.+$)/gm);
                        if (found) {
                            sendContinueToDebuggee(
                                found[0].replace("ws=", "ws:\\\\"),
                                resolve,
                                reject,
                            );
                            return;
                        }
                    });
                    debuggeeProcess.stdout.on("data", (data: string) => {
                        output += data;
                    });
                    debuggeeProcess.on("exit", () => {
                        assert.notEqual(output, "");
                        assert.strictEqual(output.trim(), "test output from debuggee process");
                        waitForCheckingOutput = Promise.resolve();
                    });
                    await waitForContinue;
                    debuggeeProcess.kill();
                    await waitForCheckingOutput;
                });
            }).timeout(5000);
        });

        suite("ScriptImporter", function () {
            let scriptImporter: ScriptImporter;
            setup(function () {
                scriptImporter = new ScriptImporter("localhost", 8081, "sources");
            });
            test("prepareDebuggerWorkerURL should return correct URL for RN < 0.50.0", () => {
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.49.0"),
                    "http://localhost:8081/debuggerWorker.js",
                );
            });
            test("prepareDebuggerWorkerURL should return correct URL for RN >= 0.50.0", () => {
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.50.0"),
                    "http://localhost:8081/debugger-ui/debuggerWorker.js",
                );
            });
            test("prepareDebuggerWorkerURL should return correct URL when debuggerWorkerUrlPath is used", () => {
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.55.4", ""),
                    "http://localhost:8081/debuggerWorker.js",
                );
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.55.4", "new-debugger/"),
                    "http://localhost:8081/new-debugger/debuggerWorker.js",
                );
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.55.4", undefined),
                    "http://localhost:8081/debugger-ui/debuggerWorker.js",
                );
                assert.strictEqual(
                    scriptImporter.prepareDebuggerWorkerURL("0.49.0", "debugger-ui/"),
                    "http://localhost:8081/debugger-ui/debuggerWorker.js",
                );
            });
        });

        suite("MultipleLifetimesAppWorker", function () {
            const sourcesStoragePath = path.resolve(__dirname, "assets");

            let multipleLifetimesWorker: MultipleLifetimesAppWorker;
            let sandboxedAppWorkerStub: Sinon.SinonStub;
            let appWorkerModuleStub: Sinon.SinonStub;
            let webSocket: Sinon.SinonStub;
            let webSocketConstructor: Sinon.SinonStub;
            let packagerIsRunning: Sinon.SinonStub;

            let sendMessage: (message: string) => void;

            let clock: Sinon.SinonFakeTimers;

            setup(function () {
                webSocket = sinon.createStubInstance(WebSocket);

                sandboxedAppWorkerStub = sinon.createStubInstance(ForkedAppWorker);
                appWorkerModuleStub = sinon
                    .stub(ForkedAppWorkerModule, "ForkedAppWorker")
                    .returns(sandboxedAppWorkerStub);

                const messageInvocation: Sinon.SinonStub = (<any>webSocket).on.withArgs("message");
                sendMessage = (message: string) => messageInvocation.callArgWith(1, message);

                webSocketConstructor = sinon.stub();
                webSocketConstructor.returns(webSocket);
                packagerIsRunning = sinon.stub(packagerStatus, "ensurePackagerRunning");
                packagerIsRunning.returns(Promise.resolve());
                const attachRequestArguments = {
                    address: "localhost",
                    port: packagerPort,
                };

                multipleLifetimesWorker = new MultipleLifetimesAppWorker(
                    attachRequestArguments,
                    sourcesStoragePath,
                    "",
                    new vscode.CancellationTokenSource().token,
                    {
                        webSocketConstructor: webSocketConstructor,
                    },
                );

                sinon
                    .stub(multipleLifetimesWorker, "downloadAndPatchDebuggerWorker")
                    .returns(Promise.resolve());
            });

            teardown(function () {
                // Reset everything
                multipleLifetimesWorker.stop();
                appWorkerModuleStub.restore();
                packagerIsRunning.restore();

                if (clock) {
                    clock.restore();
                }
            });

            test("with packager running should construct a websocket connection to the correct endpoint and listen for events", async function () {
                await multipleLifetimesWorker.start();
                const websocketRegex = new RegExp(
                    "ws://[^:]*:[0-9]*/debugger-proxy\\?role=debugger",
                );
                assert(
                    webSocketConstructor.calledWithMatch(websocketRegex),
                    "The web socket was not constructed to the correct url: " +
                        webSocketConstructor.args[0][0],
                );
                const expectedListeners = ["open", "close", "message", "error"];
                expectedListeners.forEach(event => {
                    assert(
                        (<any>webSocket).on.calledWithMatch(event),
                        `Missing listener for ${event}`,
                    );
                });
            });

            test("with packager running should attempt to reconnect after disconnecting", async function () {
                let startWorker = sinon.spy(multipleLifetimesWorker, "start");
                await multipleLifetimesWorker.start();
                // Forget previous invocations
                startWorker.reset();
                packagerIsRunning.returns(Promise.resolve());
                clock = sinon.useFakeTimers();
                const closeInvocation: Sinon.SinonStub = (<any>webSocket).on.withArgs("close");
                closeInvocation.callArg(1);
                // Ensure that the retry is 100ms after the disconnection
                clock.tick(99);
                assert(startWorker.notCalled, "Attempted to reconnect too quickly");
                clock.tick(1);
                assert(startWorker.called);
            });

            test("with packager running should respond correctly to prepareJSRuntime messages", async function () {
                await multipleLifetimesWorker.start();
                const messageId = 1;
                const testMessage = JSON.stringify({
                    method: "prepareJSRuntime",
                    id: messageId,
                });
                const expectedReply = JSON.stringify({ replyID: messageId });
                const appWorkerStart: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).start;
                const websocketSend: Sinon.SinonStub = (<any>webSocket).send;
                const appWorkerDeferred = new Promise<void>((resolve) => {
                    appWorkerStart.returns(appWorkerDeferred);

                    sendMessage(testMessage);

                    assert(
                        appWorkerStart.called,
                        "SandboxedAppWorker not started in respones to prepareJSRuntime",
                    );
                    assert(
                        websocketSend.notCalled,
                        "Response sent prior to configuring sandbox worker",
                    );

                    resolve();
                });
                await PromiseUtil.delay(1);
                assert(
                    websocketSend.calledWith(expectedReply),
                    "Did not receive the expected response to prepareJSRuntime",
                );
            });

            test("with packager running should pass unknown messages to the sandboxedAppWorker", async function () {
                await multipleLifetimesWorker.start();
                // Start up an app worker
                const prepareJSMessage = JSON.stringify({ method: "prepareJSRuntime", id: 1 });
                const appWorkerStart: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).start;
                appWorkerStart.returns(Promise.resolve());
                sendMessage(prepareJSMessage);
                // Then attempt to message it
                const testMessage = { method: "unknownMethod" };
                const testMessageString = JSON.stringify(testMessage);
                const postMessageStub: Sinon.SinonStub = (<any>sandboxedAppWorkerStub).postMessage;
                assert(
                    postMessageStub.notCalled,
                    "sandboxedAppWorker.postMessage called prior to any message",
                );
                sendMessage(testMessageString);
                assert(
                    postMessageStub.calledWith(testMessage),
                    "message was not passed to sandboxedAppWorker",
                );
            });

            test("with packager running should close connection if there is another debugger connected to packager", async () => {
                await multipleLifetimesWorker.start();
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

            test("without packager running should not start if there is no packager running", async () => {
                packagerIsRunning.returns(Promise.reject(new Error()));

                try {
                    await multipleLifetimesWorker.start();
                } catch (error) {
                    assert(webSocketConstructor.notCalled, "socket should not be created");
                }
            });
        });

        suite("console.trace()", function () {
            function runScriptAndCheckOutput(
                expectedTraceMessage: string,
                consoleTraceCall: string,
                done: Mocha.Done,
            ): void {
                const script = [
                    MultipleLifetimesAppWorker.CONSOLE_TRACE_PATCH,
                    consoleTraceCall,
                ].join("\n");
                const testProcess = child_process.spawn("node", ["-e", script]);
                let procData: string = "";
                let procErrData: string = "";
                testProcess.stdout.on("data", (data: Buffer) => {
                    procData += data.toString();
                });
                testProcess.stderr.on("data", (data: Buffer) => {
                    procErrData += data.toString();
                });
                testProcess.on("error", (err: Error) => {
                    console.error(err);
                });
                testProcess.on("close", (code: number) => {
                    assert.strictEqual(code, 0);
                    if (procErrData !== "") {
                        assert.fail(procErrData);
                    }
                    const traceContent = procData.trim().split("\n");
                    assert.strictEqual(traceContent[0], expectedTraceMessage);
                    traceContent.shift();
                    traceContent.forEach(element => {
                        assert.strictEqual(
                            element.trim().startsWith("at"),
                            true,
                            `Stack frame ${element} isn't started with 'at'`,
                        );
                    });
                    done();
                });
            }

            test("console.trace() patch should produce a correct output if called without args", (done: Mocha.Done) => {
                const consoleTraceCall = `console.trace();`;
                const expectedTraceMessage = "Trace";
                runScriptAndCheckOutput(expectedTraceMessage, consoleTraceCall, done);
            });

            test("console.trace() patch should produce a correct output if called with simple args", (done: Mocha.Done) => {
                const consoleTraceCall = `console.trace(\"Simple string\", 1337);`;
                const expectedTraceMessage = "Trace: Simple string 1337";
                runScriptAndCheckOutput(expectedTraceMessage, consoleTraceCall, done);
            });

            test("console.trace() patch should produce a correct output if called with formatted string", (done: Mocha.Done) => {
                const consoleTraceCall = `console.trace("%s: %d", "Format string prints", 42);`;
                const expectedTraceMessage = "Trace: Format string prints: 42";
                runScriptAndCheckOutput(expectedTraceMessage, consoleTraceCall, done);
            });
        });

        suite("process.toString()", function () {
            test("process.toString() should return empty string to avoid errors in native app", (done: Mocha.Done) => {
                const nodeProcessCheckToStringReturnCommand = "console.log(process.toString());";
                const nodeProcessCheckCommand =
                    "console.log(Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]');";
                const script = [
                    MultipleLifetimesAppWorker.PROCESS_TO_STRING_PATCH,
                    nodeProcessCheckToStringReturnCommand,
                    nodeProcessCheckCommand,
                ].join("\n");

                const testProcess = child_process.spawn("node", ["-e", script]);
                let procData: string = "";
                let procErrData: string = "";
                testProcess.stdout.on("data", (data: Buffer) => {
                    procData += data.toString();
                });
                testProcess.stderr.on("data", (data: Buffer) => {
                    procErrData += data.toString();
                });
                testProcess.on("error", (err: Error) => {
                    console.error(err);
                });
                testProcess.on("close", (code: number) => {
                    assert.strictEqual(code, 0);
                    if (procErrData !== "") {
                        assert.fail(procErrData);
                    }
                    const output = procData.split("\n");
                    assert.strictEqual(output[0].trim(), "");
                    assert.strictEqual(output[1].trim(), "false");
                    done();
                });
            });
        });

        suite("node --no-deprecation tests", function () {
            test("node process should work with --no-deprecation flag and produce no deprecation warnings for Buffer function and GLOBAL variable usage", (done: Mocha.Done) => {
                const globalVariableCheck = "GLOBAL.toString();";
                const bufferCommandCheck = "Buffer('TestString');";
                const script = [globalVariableCheck, bufferCommandCheck].join("\n");

                const testProcess = child_process.spawn("node", ["--no-deprecation", "-e", script]);
                let procData: string = "";
                let procErrData: string = "";
                testProcess.stdout.on("data", (data: Buffer) => {
                    procData += data.toString();
                });
                testProcess.stderr.on("data", (data: Buffer) => {
                    procErrData += data.toString();
                });
                testProcess.on("error", (err: Error) => {
                    console.error(err);
                });
                testProcess.on("close", (code: number) => {
                    assert.strictEqual(code, 0);
                    if (procErrData !== "") {
                        if (
                            procErrData.indexOf("DeprecationWarning") !== -1 ||
                            procErrData.indexOf("DEP") !== -1
                        ) {
                            assert.fail(`Deprecation messages found in stderr:\n ${procErrData}`);
                        } else {
                            assert.fail(procErrData);
                        }
                    }
                    if (procData !== "") {
                        if (
                            procData.indexOf("DeprecationWarning") !== -1 ||
                            procData.indexOf("DEP") !== -1
                        ) {
                            assert.fail(`Deprecation messages found in stdout:\n ${procData}`);
                        }
                    }
                    done();
                });
            });
        });
    });
});

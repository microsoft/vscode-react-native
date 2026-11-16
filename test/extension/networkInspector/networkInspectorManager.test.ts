// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import proxyquire = require("proxyquire");
import type { AppLauncher } from "../../../src/extension/appLauncher";

suite("networkInspectorManager", function () {
    function createDeferred() {
        let resolve!: () => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<void>((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });
        return { promise, resolve, reject };
    }

    function nextTurn(): Promise<void> {
        return new Promise(resolve => {
            setImmediate(resolve);
        });
    }

    const fakeAppLauncher = {
        getPackager: () => ({
            getProjectPath: () => "/workspace/project",
        }),
        getOrUpdateNodeModulesRoot: () => "/workspace/node_modules",
    };

    class FakeAdbHelper {
        constructor(public projectPath: string, public nodeModulesRoot: string) {}
    }

    const createManagerModule = (
        networkInspectorStart: Sinon.SinonStub = sinon.stub().returns(Promise.resolve()),
    ) => {
        const executeCommandStub = sinon.stub().returns(Promise.resolve());
        const clearCacheStub = sinon.stub();
        const androidDeviceTrackerStartStub = sinon.stub().returns(Promise.resolve());
        const androidDeviceTrackerStopStub = sinon.stub();
        const iOSDeviceTrackerStartStub = sinon.stub().returns(Promise.resolve());
        const iOSDeviceTrackerStopStub = sinon.stub();
        const networkInspectorStopStub = sinon.stub().returns(Promise.resolve());
        const logErrorStub = sinon.stub();

        class FakeAndroidDeviceTracker {
            public start = androidDeviceTrackerStartStub;
            public stop = androidDeviceTrackerStopStub;
            constructor(public adbHelper: FakeAdbHelper) {}
        }

        class FakeNetworkInspectorServer {
            public start = networkInspectorStart;
            public stop = networkInspectorStopStub;
        }

        class FakeIOSDeviceTracker {
            public start = iOSDeviceTrackerStartStub;
            public stop = iOSDeviceTrackerStopStub;
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/networkInspectorManager",
            {
                vscode: {
                    commands: {
                        executeCommand: executeCommandStub,
                    },
                },
                "../android/adb": {
                    AdbHelper: FakeAdbHelper,
                },
                "../android/androidDeviceTracker": {
                    AndroidDeviceTracker: FakeAndroidDeviceTracker,
                },
                "../ios/iOSDeviceTracker": {
                    IOSDeviceTracker: FakeIOSDeviceTracker,
                },
                "../networkInspector/networkInspectorServer": {
                    NetworkInspectorServer: FakeNetworkInspectorServer,
                },
                "../networkInspector/views/inspectorViewFactory": {
                    InspectorViewFactory: {
                        clearCache: clearCacheStub,
                    },
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => ({ error: logErrorStub }),
                    },
                },
            },
        ) as typeof import("../../../src/extension/commands/networkInspectorManager");

        return {
            NetworkInspectorManager: module.NetworkInspectorManager,
            executeCommandStub,
            clearCacheStub,
            androidDeviceTrackerStartStub,
            androidDeviceTrackerStopStub,
            iOSDeviceTrackerStartStub,
            iOSDeviceTrackerStopStub,
            networkInspectorStart,
            networkInspectorStopStub,
            logErrorStub,
        };
    };

    let originalPlatformDescriptor: PropertyDescriptor | undefined;

    setup(() => {
        originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
        Object.defineProperty(process, "platform", {
            value: "win32",
        });
    });

    teardown(() => {
        if (originalPlatformDescriptor) {
            Object.defineProperty(process, "platform", originalPlatformDescriptor);
        }
    });

    test("should start and report running state", async () => {
        const {
            NetworkInspectorManager,
            executeCommandStub,
            clearCacheStub,
            androidDeviceTrackerStartStub,
            iOSDeviceTrackerStartStub,
            networkInspectorStart,
        } = createManagerModule();
        const manager = new NetworkInspectorManager();

        assert.strictEqual(manager.isRunning(), false);

        await manager.start(fakeAppLauncher as any);

        assert.strictEqual(manager.isRunning(), true);
        assert.strictEqual(androidDeviceTrackerStartStub.calledOnce, true);
        assert.strictEqual(iOSDeviceTrackerStartStub.called, false);
        assert.strictEqual(networkInspectorStart.calledOnce, true);
        assert.strictEqual(executeCommandStub.calledOnce, true);
        assert.deepStrictEqual(executeCommandStub.firstCall.args, [
            "setContext",
            "isRNTNetworkInspectorRunning",
            true,
        ]);
        assert.strictEqual(clearCacheStub.called, false);
    });

    test("should stop after start and report not running state", async () => {
        const {
            NetworkInspectorManager,
            executeCommandStub,
            clearCacheStub,
            androidDeviceTrackerStopStub,
            iOSDeviceTrackerStopStub,
            networkInspectorStopStub,
        } = createManagerModule();
        const manager = new NetworkInspectorManager();

        await manager.start(fakeAppLauncher as any);
        await manager.stop();

        assert.strictEqual(manager.isRunning(), false);
        assert.strictEqual(androidDeviceTrackerStopStub.calledOnce, true);
        assert.strictEqual(iOSDeviceTrackerStopStub.called, false);
        assert.strictEqual(networkInspectorStopStub.calledOnce, true);
        assert.strictEqual(clearCacheStub.calledOnce, true);
        assert.deepStrictEqual(executeCommandStub.secondCall.args, [
            "setContext",
            "isRNTNetworkInspectorRunning",
            false,
        ]);
    });

    test("should throw when start is called twice", async () => {
        const { NetworkInspectorManager } = createManagerModule();
        const manager = new NetworkInspectorManager();

        await manager.start(fakeAppLauncher as any);

        await assert.rejects(async () => {
            await manager.start(fakeAppLauncher as any);
        }, /Network Inspector is already running/);
    });

    test("should no-op stop when not running", async () => {
        const { NetworkInspectorManager, executeCommandStub, clearCacheStub } =
            createManagerModule();
        const manager = new NetworkInspectorManager();

        await manager.stop();

        assert.strictEqual(manager.isRunning(), false);
        assert.strictEqual(executeCommandStub.called, false);
        assert.strictEqual(clearCacheStub.called, false);
    });

    test("should clean up when start fails", async () => {
        const startError = new Error("start failed");
        const networkInspectorStart = sinon.stub().returns(Promise.reject(startError));
        const {
            NetworkInspectorManager,
            executeCommandStub,
            clearCacheStub,
            androidDeviceTrackerStopStub,
            networkInspectorStopStub,
        } = createManagerModule(networkInspectorStart);
        const manager = new NetworkInspectorManager();

        await assert.rejects(async () => {
            await manager.start(fakeAppLauncher as any);
        }, /start failed/);

        assert.strictEqual(manager.isRunning(), false);
        assert.strictEqual(androidDeviceTrackerStopStub.calledOnce, true);
        assert.strictEqual(networkInspectorStopStub.calledOnce, true);
        assert.strictEqual(clearCacheStub.calledOnce, true);
        assert.deepStrictEqual(executeCommandStub.firstCall.args, [
            "setContext",
            "isRNTNetworkInspectorRunning",
            false,
        ]);
    });

    for (const stage of ["iOS tracker", "Android tracker", "server", "running context"] as const) {
        test(`should wait for startup before stopping while awaiting ${stage}`, async () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            const stubs = createManagerModule();
            const startup = createDeferred();
            const startupStubs = {
                "iOS tracker": stubs.iOSDeviceTrackerStartStub,
                "Android tracker": stubs.androidDeviceTrackerStartStub,
                server: stubs.networkInspectorStart,
                "running context": stubs.executeCommandStub,
            };
            startupStubs[stage].onCall(0).returns(startup.promise);
            const manager = new stubs.NetworkInspectorManager();

            const startResult = manager.start(fakeAppLauncher as AppLauncher);
            const firstStop = manager.stop();
            const secondStop = manager.stop();
            let stopped = false;
            const stopResult = firstStop.then(() => {
                stopped = true;
            });
            await nextTurn();

            assert.strictEqual(firstStop, secondStop);
            assert.strictEqual(stopped, false);
            assert.strictEqual(manager.isRunning(), true);
            sinon.assert.notCalled(stubs.iOSDeviceTrackerStopStub);
            sinon.assert.notCalled(stubs.androidDeviceTrackerStopStub);
            sinon.assert.notCalled(stubs.networkInspectorStopStub);
            sinon.assert.notCalled(stubs.clearCacheStub);
            await assert.rejects(
                manager.start(fakeAppLauncher as AppLauncher),
                /Network Inspector is already running/,
            );

            startup.resolve();
            await Promise.all([startResult, stopResult]);

            assert.strictEqual(stopped, true);
            assert.strictEqual(manager.isRunning(), false);
            sinon.assert.calledOnce(stubs.iOSDeviceTrackerStopStub);
            sinon.assert.calledOnce(stubs.androidDeviceTrackerStopStub);
            sinon.assert.calledOnce(stubs.networkInspectorStopStub);
            sinon.assert.calledOnce(stubs.clearCacheStub);
            sinon.assert.callOrder(
                stubs.networkInspectorStart,
                stubs.iOSDeviceTrackerStopStub,
                stubs.networkInspectorStopStub,
                stubs.clearCacheStub,
            );
            assert.deepStrictEqual(stubs.executeCommandStub.args, [
                ["setContext", "isRNTNetworkInspectorRunning", true],
                ["setContext", "isRNTNetworkInspectorRunning", false],
            ]);
        });
    }

    for (const stage of ["server", "stopped context"] as const) {
        test(`should share cleanup and block restarting while awaiting ${stage}`, async () => {
            const stubs = createManagerModule();
            const manager = new stubs.NetworkInspectorManager();
            await manager.start(fakeAppLauncher as AppLauncher);
            const cleanup = createDeferred();
            if (stage === "server") {
                stubs.networkInspectorStopStub.onCall(0).returns(cleanup.promise);
            } else {
                stubs.executeCommandStub.onCall(1).returns(cleanup.promise);
            }

            const firstStop = manager.stop();
            const secondStop = manager.stop();
            await nextTurn();

            assert.strictEqual(firstStop, secondStop);
            assert.strictEqual(manager.isRunning(), true);
            sinon.assert.calledOnce(stubs.androidDeviceTrackerStopStub);
            sinon.assert.calledOnce(stubs.networkInspectorStopStub);
            await assert.rejects(
                manager.start(fakeAppLauncher as AppLauncher),
                /Network Inspector is already running/,
            );

            cleanup.resolve();
            await Promise.all([firstStop, secondStop]);

            assert.strictEqual(manager.isRunning(), false);
            sinon.assert.calledOnce(stubs.clearCacheStub);
            await manager.start(fakeAppLauncher as AppLauncher);
            await manager.stop();
            assert.strictEqual(stubs.networkInspectorStart.callCount, 2);
            assert.strictEqual(stubs.networkInspectorStopStub.callCount, 2);
            assert.strictEqual(manager.isRunning(), false);
        });
    }

    test("should share cleanup with a concurrent stop when startup fails", async () => {
        const startup = createDeferred();
        const startError = new Error("start failed");
        const stubs = createManagerModule(sinon.stub().returns(startup.promise));
        const manager = new stubs.NetworkInspectorManager();
        const startResult = assert.rejects(
            manager.start(fakeAppLauncher as AppLauncher),
            (error: unknown) => error === startError,
        );
        const stopResult = manager.stop();
        assert.strictEqual(manager.stop(), stopResult);

        startup.reject(startError);
        await Promise.all([startResult, stopResult]);

        assert.strictEqual(manager.isRunning(), false);
        sinon.assert.calledOnce(stubs.androidDeviceTrackerStopStub);
        sinon.assert.calledOnce(stubs.networkInspectorStopStub);
        sinon.assert.calledOnce(stubs.clearCacheStub);
        sinon.assert.notCalled(stubs.logErrorStub);
        assert.deepStrictEqual(stubs.executeCommandStub.args, [
            ["setContext", "isRNTNetworkInspectorRunning", false],
        ]);
    });

    test("should preserve both failures and allow cleanup retry after concurrent startup and stop fail", async () => {
        const startup = createDeferred();
        const cleanup = createDeferred();
        const startError = new Error("start failed");
        const cleanupError = new Error("cleanup failed");
        const stubs = createManagerModule(sinon.stub().returns(startup.promise));
        stubs.networkInspectorStopStub.onCall(0).returns(cleanup.promise);
        const manager = new stubs.NetworkInspectorManager();
        const startResult = assert.rejects(
            manager.start(fakeAppLauncher as AppLauncher),
            (error: unknown) => error === startError,
        );
        const stop = manager.stop();
        assert.strictEqual(manager.stop(), stop);
        const stopResult = assert.rejects(stop, (error: unknown) => error === cleanupError);

        startup.reject(startError);
        await nextTurn();
        sinon.assert.calledOnce(stubs.networkInspectorStopStub);
        cleanup.reject(cleanupError);
        await Promise.all([startResult, stopResult]);

        assert.strictEqual(manager.isRunning(), true);
        sinon.assert.calledOnce(stubs.networkInspectorStopStub);
        sinon.assert.calledOnce(stubs.logErrorStub);
        assert.strictEqual(stubs.logErrorStub.firstCall.args[1], cleanupError);
        sinon.assert.notCalled(stubs.clearCacheStub);

        await manager.stop();

        assert.strictEqual(manager.isRunning(), false);
        assert.strictEqual(stubs.networkInspectorStopStub.callCount, 2);
        sinon.assert.calledOnce(stubs.clearCacheStub);
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import proxyquire = require("proxyquire");

suite("networkInspectorManager", function () {
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
        const logger = { error: sinon.stub() };

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
                        getMainChannel: () => logger,
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
            logger,
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

    for (const failedStep of [
        "androidDeviceTrackerStopStub",
        "iOSDeviceTrackerStopStub",
        "networkInspectorStopStub",
        "clearCacheStub",
        "executeCommandStub",
    ] as const) {
        test(`should finish remaining cleanup and allow retry when ${failedStep} fails`, async () => {
            Object.defineProperty(process, "platform", { value: "darwin" });
            const stubs = createManagerModule();
            const manager = new stubs.NetworkInspectorManager();
            await manager.start(fakeAppLauncher as any);

            const stopError = new Error(`${failedStep} failed`);
            if (failedStep === "executeCommandStub") {
                stubs.executeCommandStub.onSecondCall().returns(Promise.reject(stopError));
            } else if (failedStep === "networkInspectorStopStub") {
                stubs.networkInspectorStopStub.onFirstCall().returns(Promise.reject(stopError));
            } else {
                stubs[failedStep].onFirstCall().throws(stopError);
            }

            await assert.rejects(manager.stop(), (error: unknown) => error === stopError);

            assert.strictEqual(stubs.androidDeviceTrackerStopStub.calledOnce, true);
            assert.strictEqual(stubs.iOSDeviceTrackerStopStub.calledOnce, true);
            assert.strictEqual(stubs.networkInspectorStopStub.calledOnce, true);
            assert.strictEqual(stubs.clearCacheStub.calledOnce, true);
            assert.deepStrictEqual(stubs.executeCommandStub.secondCall.args, [
                "setContext",
                "isRNTNetworkInspectorRunning",
                failedStep !== "executeCommandStub",
            ]);
            assert.strictEqual(
                stubs.logger.error.calledWithExactly(String(stopError), stopError),
                true,
            );
            assert.strictEqual(manager.isRunning(), true);
            await assert.rejects(
                manager.start(fakeAppLauncher as any),
                /Network Inspector is already running/,
            );

            await manager.stop();

            assert.strictEqual(manager.isRunning(), false);
            assert.strictEqual(stubs.androidDeviceTrackerStopStub.calledTwice, true);
            assert.strictEqual(stubs.iOSDeviceTrackerStopStub.calledTwice, true);
            assert.strictEqual(stubs.networkInspectorStopStub.calledTwice, true);
            assert.strictEqual(stubs.clearCacheStub.calledTwice, true);
            assert.deepStrictEqual(stubs.executeCommandStub.thirdCall.args, [
                "setContext",
                "isRNTNetworkInspectorRunning",
                false,
            ]);
        });
    }

    test("should report every cleanup failure and rethrow the first error", async () => {
        const stubs = createManagerModule();
        const manager = new stubs.NetworkInspectorManager();
        await manager.start(fakeAppLauncher as any);
        const trackerError = new Error("tracker stop failed");
        const serverError = new Error("server stop failed");
        stubs.androidDeviceTrackerStopStub.throws(trackerError);
        stubs.networkInspectorStopStub.returns(Promise.reject(serverError));

        await assert.rejects(manager.stop(), (error: unknown) => error === trackerError);

        assert.strictEqual(stubs.clearCacheStub.calledOnce, true);
        assert.strictEqual(stubs.logger.error.callCount, 2);
        assert.deepStrictEqual(stubs.logger.error.firstCall.args, [
            String(trackerError),
            trackerError,
        ]);
        assert.deepStrictEqual(stubs.logger.error.secondCall.args, [
            String(serverError),
            serverError,
        ]);
        assert.strictEqual(manager.isRunning(), true);
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
});

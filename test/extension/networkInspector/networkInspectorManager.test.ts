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
        const networkInspectorStopStub = sinon.stub().returns(Promise.resolve());

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
            public start = sinon.stub().returns(Promise.resolve());
            public stop = sinon.stub();
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
            },
        ) as typeof import("../../../src/extension/commands/networkInspectorManager");

        return {
            NetworkInspectorManager: module.NetworkInspectorManager,
            executeCommandStub,
            clearCacheStub,
            androidDeviceTrackerStartStub,
            androidDeviceTrackerStopStub,
            networkInspectorStart,
            networkInspectorStopStub,
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
            networkInspectorStart,
        } = createManagerModule();
        const manager = new NetworkInspectorManager();

        assert.strictEqual(manager.isRunning(), false);

        await manager.start(fakeAppLauncher as any);

        assert.strictEqual(manager.isRunning(), true);
        assert.strictEqual(androidDeviceTrackerStartStub.calledOnce, true);
        assert.strictEqual(networkInspectorStart.calledOnce, true);
        assert.strictEqual(executeCommandStub.calledOnce, true);
        assert.deepStrictEqual(executeCommandStub.firstCall.args, [
            "setContext",
            "isRNTNetworkInspectorRunning",
            true,
        ]);
        assert.strictEqual(clearCacheStub.called, false);
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
});

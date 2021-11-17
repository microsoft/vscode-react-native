// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as assert from "assert";
import Sinon = require("sinon");
import { QuickPickItem, window } from "vscode";
import { AdbHelper } from "../../src/extension/android/adb";
import {
    IMobileTarget,
    IDebuggableMobileTarget,
    MobileTarget,
} from "../../src/extension/mobileTarget";
import {
    IOSTargetManager,
    IDebuggableIOSTarget,
    IOSTarget,
} from "../../src/extension/ios/iOSTargetManager";
import {
    AndroidTarget,
    AndroidTargetManager,
} from "../../src/extension/android/androidTargetManager";
import { MobileTargetManager } from "../../src/extension/mobileTargetManager";
import { ChildProcess } from "../../src/common/node/childProcess";
import { PromiseUtil } from "../../src/common/node/promise";
import { TargetType } from "../../src/extension/generalPlatform";
import { InternalErrorCode } from "../../src/common/error/internalErrorCode";
import { InternalError, NestedError } from "../../src/common/error/internalError";

suite("MobileTargetManager", function () {
    const testProjectPath = path.join(__dirname, "..", "resources", "testCordovaProject");

    let onlineSimulator1: IMobileTarget;
    let onlineSimulator2: IMobileTarget;

    let offlineSimulator1: IMobileTarget;
    let offlineSimulator2: IMobileTarget;

    let device1: IMobileTarget;
    let device2: IMobileTarget;

    let revertTargetsStates: () => void;

    let targetManager: MobileTargetManager;

    let targetsForSelection: string[];
    let showQuickPickStub: Sinon.SinonStub;
    let launchSimulatorStub: Sinon.SinonStub;
    let collectTargetsStub: Sinon.SinonStub;

    const defaultPath = process.env.Path;
    const getPathWithoutEmulator = PromiseUtil.promiseCacheDecorator(async () => {
        const cp = new ChildProcess();
        const isWin = process.platform === "win32";
        try {
            const whereEmulatorOutput = isWin
                ? await cp.execToString("where emulator", { env: process.env })
                : await cp.execToString("which -a emulator", { env: process.env });
            const pathsToEmulatorUtility = whereEmulatorOutput
                .split("\n")
                .filter(str => str.length)
                .map(str => path.dirname(str));
            return process.env.Path?.split(isWin ? ";" : ":")
                .filter(path => !pathsToEmulatorUtility.find(emuPath => emuPath === path))
                .join(isWin ? ";" : ":");
        } catch (error) {
            console.log(error);
            return defaultPath;
        }
    });

    async function executeWithoutEmulator(func: () => any) {
        process.env.Path = await getPathWithoutEmulator();
        await func();
        process.env.Path = defaultPath;
    }

    async function checkTargetType(
        assertFun: () => Promise<void>,
        catchFun?: (err?: any) => void,
    ): Promise<void> {
        try {
            await assertFun();
        } catch (err) {
            if (catchFun) {
                catchFun(err);
            }
        }
    }

    async function checkTargetSeletionResult(
        filter: (target: IMobileTarget) => boolean = () => true,
        selectionListCheck: (options: string[]) => boolean = () => true,
        resultCheck: (target?: MobileTarget) => boolean = () => true,
    ): Promise<void> {
        const target = await targetManager.selectAndPrepareTarget(filter);
        if (selectionListCheck) {
            assert.ok(selectionListCheck(targetsForSelection), "Did not pass options list check");
        }
        if (resultCheck) {
            assert.ok(resultCheck(target), "Did not pass result target check");
        }
    }

    function runTargetTypeCheckTests() {
        test("Should properly recognize virtual target type", async function () {
            await checkTargetType(
                async () =>
                    assert.strictEqual(
                        await targetManager.isVirtualTarget(TargetType.Simulator),
                        true,
                        "Could not recognize any simulator",
                    ),
                () => assert.fail("Could not recognize any simulator"),
            );
            await checkTargetType(
                async () =>
                    assert.strictEqual(
                        await targetManager.isVirtualTarget(onlineSimulator1.id as string),
                        true,
                        `Could not recognize simulator id: ${onlineSimulator1.id as string}`,
                    ),
                () =>
                    assert.fail(
                        `Could not recognize simulator id: ${onlineSimulator1.id as string}`,
                    ),
            );
            await checkTargetType(async () =>
                assert.strictEqual(
                    await targetManager.isVirtualTarget("simulatorId11"),
                    false,
                    "Misrecognized simulator id: simulatorId11",
                ),
            );
            await checkTargetType(
                async () =>
                    assert.strictEqual(
                        await targetManager.isVirtualTarget(onlineSimulator2.name as string),
                        true,
                        `Could not recognize simulator name: ${onlineSimulator2.name as string}`,
                    ),
                () =>
                    assert.fail(
                        `Could not recognize simulator name: ${onlineSimulator2.name as string}`,
                    ),
            );
            await checkTargetType(async () =>
                assert.strictEqual(
                    await targetManager.isVirtualTarget("simulatorName22"),
                    false,
                    "Misrecognized simulator name: simulatorName22",
                ),
            );
        });

        test("Should properly recognize device target", async function () {
            await checkTargetType(
                async () =>
                    assert.strictEqual(
                        await targetManager.isVirtualTarget(TargetType.Device),
                        false,
                        "Could not recognize any device",
                    ),
                () => assert.fail("Could not recognize any device"),
            );
            await checkTargetType(
                async () =>
                    assert.strictEqual(
                        await targetManager.isVirtualTarget(device1.id as string),
                        false,
                        `Could not recognize device id: ${device1.id as string}`,
                    ),
                () => assert.fail(`Could not recognize device id: ${device1.id as string}`),
            );
            await checkTargetType(async () =>
                assert.strictEqual(
                    await targetManager.isVirtualTarget("deviceid111"),
                    false,
                    "Misrecognized device id: deviceid111",
                ),
            );
        });
    }

    function runTargetSelectionTests() {
        test("Should show all targets in case filter has not been defined", async function () {
            await checkTargetSeletionResult(undefined, options => options.length === 6);
        });

        test("Should show targets by filter", async function () {
            const onlineTargetsFilter = (target: IMobileTarget) => target.isOnline;
            await checkTargetSeletionResult(onlineTargetsFilter, options => options.length === 4);
        });

        test("Should auto select option in case there is only one target", async function () {
            const showQuickPickCallCount = showQuickPickStub.callCount;
            const specificNameTargetFilter = (target: IMobileTarget) =>
                target.name === onlineSimulator1.name;

            await checkTargetSeletionResult(
                specificNameTargetFilter,
                undefined,
                (target: MobileTarget) => target.id === onlineSimulator1.id,
            );
            assert.strictEqual(
                showQuickPickStub.callCount - showQuickPickCallCount,
                0,
                "There is only one target, but quick pick was shown",
            );
        });

        test("Should launch the selected simulator in case it's offline", async function () {
            const specificNameTargetFilter = (target: IMobileTarget) =>
                target.name === offlineSimulator1.name;
            await checkTargetSeletionResult(
                specificNameTargetFilter,
                undefined,
                (target: MobileTarget) =>
                    target.isOnline && !!target.id && target.name === offlineSimulator1.name,
            );
        });
    }

    suiteSetup(() => {
        showQuickPickStub = Sinon.stub(
            window,
            "showQuickPick",
            async (
                items: string[] | Thenable<string[]> | QuickPickItem[] | Thenable<QuickPickItem[]>,
            ) => {
                targetsForSelection = <string[]>await items;
                return items[0];
            },
        );
        targetsForSelection = [];
    });

    suiteTeardown(() => {
        showQuickPickStub.reset();
    });

    suite("IOSTargetManager", function () {
        suiteSetup(() => {
            targetManager = new IOSTargetManager();
            revertTargetsStates = () => {
                onlineSimulator1 = {
                    name: "simulatorName1",
                    id: "simulatorId1",
                    isVirtualTarget: true,
                    isOnline: true,
                    system: "1",
                } as IDebuggableIOSTarget;
                onlineSimulator2 = {
                    name: "simulatorName2",
                    id: "simulatorId2",
                    isVirtualTarget: true,
                    isOnline: true,
                    system: "1",
                } as IDebuggableIOSTarget;

                offlineSimulator1 = {
                    name: "simulatorName3",
                    id: "simulatorId3",
                    isVirtualTarget: true,
                    isOnline: false,
                    system: "1",
                } as IDebuggableIOSTarget;
                offlineSimulator2 = {
                    name: "simulatorName4",
                    id: "simulatorId4",
                    isVirtualTarget: true,
                    isOnline: false,
                    system: "1",
                } as IDebuggableIOSTarget;

                device1 = {
                    name: "deviceName1",
                    id: "deviceid1",
                    isVirtualTarget: false,
                    isOnline: true,
                    system: "1",
                } as IDebuggableIOSTarget;
                device2 = {
                    name: "deviceName2",
                    id: "deviceid2",
                    isVirtualTarget: false,
                    isOnline: true,
                    system: "1",
                } as IDebuggableIOSTarget;
            };
            collectTargetsStub = Sinon.stub(targetManager as any, "collectTargets", async () => {
                revertTargetsStates();
                (targetManager as any).targets = [
                    onlineSimulator1,
                    onlineSimulator2,
                    offlineSimulator1,
                    offlineSimulator2,
                    device1,
                    device2,
                ];
            });
            launchSimulatorStub = Sinon.stub(
                targetManager as any,
                "launchSimulator",
                async (simulator: IMobileTarget) => {
                    simulator.isOnline = true;
                    return IOSTarget.fromInterface(<IDebuggableIOSTarget>simulator);
                },
            );
            targetsForSelection = [];
        });

        suiteTeardown(() => {
            launchSimulatorStub.reset();
            collectTargetsStub.reset();
        });

        suite("Target selection", function () {
            setup(async () => {
                await targetManager.collectTargets();
            });

            runTargetSelectionTests();

            test("Should select target after system selection", async () => {
                (onlineSimulator2 as IDebuggableIOSTarget).system = "2";
                (offlineSimulator2 as IDebuggableIOSTarget).system = "2";
                (device1 as IDebuggableIOSTarget).system = "2";

                const showQuickPickCallCount = showQuickPickStub.callCount;
                await checkTargetSeletionResult(undefined, options => options.length === 3);
                assert.strictEqual(
                    showQuickPickStub.callCount - showQuickPickCallCount,
                    2,
                    "Incorrect number of selection steps",
                );
            });
        });

        suite("Target identification", function () {
            runTargetTypeCheckTests();
        });
    });

    suite("AndroidTargetManager", function () {
        let adbHelper: AdbHelper;

        let getAvdsNamesStub: Sinon.SinonStub;
        let getAvdNameById: Sinon.SinonStub;
        let getOnlineTargetsStub: Sinon.SinonStub;

        function defaultSetup() {
            setupWithEmulatorCommands();
            launchSimulatorStub = Sinon.stub(
                targetManager as any,
                "launchSimulator",
                async (simulatorTarget: IMobileTarget) => {
                    simulatorTarget.isOnline = true;
                    switch (simulatorTarget.name) {
                        case "emulatorName1":
                            simulatorTarget.id = "emulator-5551";
                            break;
                        case "emulatorName2":
                            simulatorTarget.id = "emulator-5552";
                            break;
                        case "emulatorName3":
                            simulatorTarget.id = "emulator-5553";
                            break;
                        case "emulatorName4":
                            simulatorTarget.id = "emulator-5554";
                            break;
                    }
                    return AndroidTarget.fromInterface(<IDebuggableMobileTarget>simulatorTarget);
                },
            );
            getAvdsNamesStub = Sinon.stub(adbHelper, "getAvdsNames", async () => {
                return [
                    onlineSimulator1.name,
                    onlineSimulator2.name,
                    offlineSimulator1.name,
                    offlineSimulator2.name,
                ];
            });
        }

        function setupWithEmulatorCommands() {
            adbHelper = new AdbHelper(testProjectPath, path.join(testProjectPath, "node_modules"));
            targetManager = new AndroidTargetManager(adbHelper);

            getOnlineTargetsStub = Sinon.stub(adbHelper, "getOnlineTargets", async () => {
                return <IDebuggableMobileTarget[]>(
                    [
                        onlineSimulator1,
                        onlineSimulator2,
                        offlineSimulator1,
                        offlineSimulator2,
                        device1,
                        device2,
                    ].filter(target => target.isOnline)
                );
            });
            getAvdNameById = Sinon.stub(
                adbHelper,
                "getAvdNameById",
                async (targetId: string): Promise<string | undefined> => {
                    return [
                        onlineSimulator1,
                        onlineSimulator2,
                        offlineSimulator1,
                        offlineSimulator2,
                        device1,
                        device2,
                    ].find(target => target.id === targetId)?.name;
                },
            );
            targetsForSelection = [];
        }

        suiteSetup(() => {
            revertTargetsStates = () => {
                onlineSimulator1 = {
                    name: "emulatorName1",
                    id: "emulator-5551",
                    isVirtualTarget: true,
                    isOnline: true,
                };
                onlineSimulator2 = {
                    name: "emulatorName2",
                    id: "emulator-5552",
                    isVirtualTarget: true,
                    isOnline: true,
                };

                offlineSimulator1 = {
                    name: "emulatorName3",
                    id: undefined,
                    isVirtualTarget: true,
                    isOnline: false,
                }; //id: emulator-5553
                offlineSimulator2 = {
                    name: "emulatorName4",
                    id: undefined,
                    isVirtualTarget: true,
                    isOnline: false,
                }; //id: emulator-5554

                device1 = { id: "deviceid1", isVirtualTarget: false, isOnline: true };
                device2 = { id: "deviceid2", isVirtualTarget: false, isOnline: true };
            };
            defaultSetup();
        });

        suiteTeardown(() => {
            getAvdsNamesStub.reset();
            getOnlineTargetsStub.reset();
            getAvdNameById.reset();
            launchSimulatorStub.reset();
        });

        suite("Target selection", function () {
            setup(async () => {
                revertTargetsStates();
                await targetManager.collectTargets();
                targetsForSelection = [];
            });

            runTargetSelectionTests();
        });

        suite("Collect targets in case there in no 'emulator' utility in the PATH", function () {
            suiteSetup(() => {
                setupWithEmulatorCommands();
            });

            suiteTeardown(() => {
                defaultSetup();
            });

            test(`Should not throw error in case passed target type is undefined`, async function () {
                await executeWithoutEmulator(async () => {
                    try {
                        await targetManager.collectTargets();
                        assert.strictEqual(
                            (await targetManager.getTargetList()).find(target => !target.isOnline),
                            undefined,
                            "Should collect only online targets",
                        );
                    } catch (error) {
                        assert.fail(`Error has been thrown: ${error}`);
                    }
                });
            });
            test(`Should not throw error in case passed target type equals '${TargetType.Device}'`, async function () {
                await executeWithoutEmulator(async () => {
                    try {
                        await targetManager.collectTargets(TargetType.Device);
                        assert.strictEqual(
                            (await targetManager.getTargetList()).find(
                                target => target.isVirtualTarget,
                            ),
                            undefined,
                            "Should collect only devices",
                        );
                    } catch (error) {
                        assert.fail(`Error has been thrown: ${error}`);
                    }
                });
            });
            test(`Should throw error in case passed target type equals '${TargetType.Simulator}'`, async function () {
                await executeWithoutEmulator(async () => {
                    try {
                        await targetManager.collectTargets(TargetType.Simulator);
                        assert.fail(`Did not throw error.`);
                    } catch (error) {
                        if (error instanceof InternalError) {
                            assert.strictEqual(error.errorCode, InternalErrorCode.CommandFailed);
                        } else {
                            throw error;
                        }
                    }
                });
            });
        });

        suite("Target identification", function () {
            runTargetTypeCheckTests();
        });

        suite(
            "Target identification in case there in no 'emulator' utility in the PATH",
            function () {
                suiteSetup(() => {
                    setupWithEmulatorCommands();
                });

                suiteTeardown(() => {
                    defaultSetup();
                });

                test(`Should not throw error for target equals ${TargetType.Simulator}`, async function () {
                    await executeWithoutEmulator(async () => {
                        await checkTargetType(
                            async () =>
                                assert.strictEqual(
                                    await targetManager.isVirtualTarget(TargetType.Simulator),
                                    true,
                                    "Could not recognize any simulator",
                                ),
                            err => assert.fail(`Error has been thrown: ${err}`),
                        );
                    });
                });
                test(`Should not throw error for target equals online emulator id`, async function () {
                    await executeWithoutEmulator(async () => {
                        await checkTargetType(
                            async () =>
                                assert.strictEqual(
                                    await targetManager.isVirtualTarget(
                                        onlineSimulator1.id as string,
                                    ),
                                    true,
                                    "Could not recognize simulator id",
                                ),
                            err => assert.fail(`Error has been thrown: ${err}`),
                        );
                    });
                });
                test(`Should not throw error for target equals ${TargetType.Device}`, async function () {
                    await executeWithoutEmulator(async () => {
                        await checkTargetType(
                            async () =>
                                assert.strictEqual(
                                    await targetManager.isVirtualTarget(TargetType.Device),
                                    false,
                                    "Could not recognize any device",
                                ),
                            err => assert.fail(`Error has been thrown: ${err}`),
                        );
                    });
                });
                test(`Should not throw error for target equals device id`, async function () {
                    await executeWithoutEmulator(async () => {
                        await checkTargetType(
                            async () =>
                                assert.strictEqual(
                                    await targetManager.isVirtualTarget(device1.id as string),
                                    false,
                                    "Could not recognize device id",
                                ),
                            err => assert.fail(`Error has been thrown: ${err}`),
                        );
                    });
                });
                test(`Should throw error for target equals emulator AVD name`, async function () {
                    await executeWithoutEmulator(async () => {
                        await checkTargetType(
                            async () => {
                                const isVirtualTarget = await targetManager.isVirtualTarget(
                                    offlineSimulator1.name as string,
                                );
                                assert.fail(`Did not throw error and return ${isVirtualTarget}`);
                            },
                            (err: Error) => {
                                if (err instanceof NestedError) {
                                    assert.strictEqual(
                                        err.innerError.errorCode,
                                        InternalErrorCode.CommandFailed,
                                    );
                                } else {
                                    throw err;
                                }
                            },
                        );
                    });
                });
            },
        );
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as assert from "assert";
import Sinon = require("sinon");
import { QuickPickItem, window } from "vscode";
import { AdbHelper } from "../../src/extension/android/adb";
import {
    AndroidTargetManager,
    AndroidTarget,
} from "../../src/extension/android/androidTargetManager";
import { IMobileTarget, IDebuggableMobileTarget } from "../../src/extension/mobileTarget";

suite("AndroidTargetManager", function () {
    const testProjectPath = path.join(__dirname, "..", "resources", "testCordovaProject");

    let onlineEmulator1: IMobileTarget;
    let onlineEmulator2: IMobileTarget;

    let offlineEmulator1: IMobileTarget;
    let offlineEmulator2: IMobileTarget;

    let device1: IMobileTarget;
    let device2: IMobileTarget;

    const adbHelper = new AdbHelper(testProjectPath, path.join(testProjectPath, "node_modules"));
    let getAbdsNamesStub: Sinon.SinonStub;
    let getOnlineTargetsStub: Sinon.SinonStub;

    const androidTargetManager = new AndroidTargetManager(adbHelper);
    let launchSimulatorStub: Sinon.SinonStub;

    let targetsForSelection: string[];
    let showQuickPickStub: Sinon.SinonStub;

    function revertTargetsStates() {
        onlineEmulator1 = {
            name: "emulatorName1",
            id: "emulator-5551",
            isVirtualTarget: true,
            isOnline: true,
        };
        onlineEmulator2 = {
            name: "emulatorName2",
            id: "emulator-5552",
            isVirtualTarget: true,
            isOnline: true,
        };

        offlineEmulator1 = {
            name: "emulatorName3",
            id: undefined,
            isVirtualTarget: true,
            isOnline: false,
        }; //id: emulator-5553
        offlineEmulator2 = {
            name: "emulatorName4",
            id: undefined,
            isVirtualTarget: true,
            isOnline: false,
        }; //id: emulator-5554

        device1 = { id: "deviceid1", isVirtualTarget: false, isOnline: true };
        device2 = { id: "deviceid2", isVirtualTarget: false, isOnline: true };
    }

    suiteSetup(() => {
        revertTargetsStates();

        getAbdsNamesStub = Sinon.stub(adbHelper, "getAvdsNames", async () => {
            return [
                onlineEmulator1.name,
                onlineEmulator2.name,
                offlineEmulator1.name,
                offlineEmulator2.name,
            ];
        });
        getOnlineTargetsStub = Sinon.stub(adbHelper, "getOnlineTargets", async () => {
            return <IDebuggableMobileTarget[]>(
                [
                    onlineEmulator1,
                    onlineEmulator2,
                    offlineEmulator1,
                    offlineEmulator2,
                    device1,
                    device2,
                ].filter(target => target.isOnline)
            );
        });

        launchSimulatorStub = Sinon.stub(
            <any>androidTargetManager,
            "launchSimulator",
            async (emulatorTarget: IMobileTarget) => {
                emulatorTarget.isOnline = true;
                switch (emulatorTarget.name) {
                    case "emulatorName1":
                        emulatorTarget.id = "emulator-5551";
                        break;
                    case "emulatorName2":
                        emulatorTarget.id = "emulator-5552";
                        break;
                    case "emulatorName3":
                        emulatorTarget.id = "emulator-5553";
                        break;
                    case "emulatorName4":
                        emulatorTarget.id = "emulator-5554";
                        break;
                }
                return AndroidTarget.fromInterface(<IDebuggableMobileTarget>emulatorTarget);
            },
        );

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
        getAbdsNamesStub.reset();
        getOnlineTargetsStub.reset();
        launchSimulatorStub.reset();
        showQuickPickStub.reset();
    });

    suite("Target identification", function () {
        async function checkTargetTargetTypeCheck(
            assertFun: () => Promise<void>,
            catchFun?: () => void,
        ): Promise<void> {
            try {
                await assertFun();
            } catch {
                if (catchFun) {
                    catchFun();
                }
            }
        }

        test("Should properly recognize virtual target type", async function () {
            await checkTargetTargetTypeCheck(
                async () =>
                    assert.strictEqual(
                        await androidTargetManager.isVirtualTarget("emulator-1234"),
                        true,
                        "Could not recognize emulator id: emulator-1234",
                    ),
                () => assert.fail("Could not recognize emulator id: (emulator-1234)"),
            );
            await checkTargetTargetTypeCheck(
                async () =>
                    assert.strictEqual(
                        await androidTargetManager.isVirtualTarget("emulator"),
                        true,
                        "Could not recognize any emulator",
                    ),
                () => assert.fail("Could not recognize any emulator"),
            );
            await checkTargetTargetTypeCheck(
                async () =>
                    assert.strictEqual(
                        await androidTargetManager.isVirtualTarget("emulatorName2"),
                        true,
                        "Could not recognize emulator AVD name",
                    ),
                () => assert.fail("Could not recognize emulator AVD name"),
            );
            await checkTargetTargetTypeCheck(async () =>
                assert.strictEqual(
                    await androidTargetManager.isVirtualTarget("emulaor-1234"),
                    false,
                    "Misrecognized emulator id: emulaor-1234",
                ),
            );
            await checkTargetTargetTypeCheck(async () =>
                assert.strictEqual(
                    await androidTargetManager.isVirtualTarget("emulator--1234"),
                    false,
                    "Misrecognized emulator id: emulator--1234",
                ),
            );
            await checkTargetTargetTypeCheck(async () =>
                assert.strictEqual(
                    await androidTargetManager.isVirtualTarget("emulaor1234"),
                    false,
                    "Misrecognized emulator id: emulator1234",
                ),
            );
            await checkTargetTargetTypeCheck(async () =>
                assert.strictEqual(
                    await androidTargetManager.isVirtualTarget("1232emulator1234"),
                    false,
                    "Misrecognized emulator id: 1232emulator1234",
                ),
            );
        });

        test("Should properly recognize device target", async function () {
            await checkTargetTargetTypeCheck(
                async () =>
                    assert.strictEqual(
                        await androidTargetManager.isVirtualTarget("device"),
                        false,
                        "Could not recognize any device",
                    ),
                () => assert.fail("Could not recognize any device"),
            );
            await checkTargetTargetTypeCheck(
                async () =>
                    assert.strictEqual(
                        await androidTargetManager.isVirtualTarget("deviceid1"),
                        false,
                        "Could not recognize device id",
                    ),
                () => assert.fail("Could not recognize device id"),
            );
            await checkTargetTargetTypeCheck(async () =>
                assert.strictEqual(
                    await androidTargetManager.isVirtualTarget("deviceid111"),
                    false,
                    "Misrecognized device id: deviceid111",
                ),
            );
        });
    });

    suite("Target selection", function () {
        async function checkTargetSeletionResult(
            filter: (target: IMobileTarget) => boolean = () => true,
            selectionListCheck: (options: string[]) => boolean = () => true,
            resultCheck: (target?: AndroidTarget) => boolean = () => true,
        ): Promise<void> {
            const target = await androidTargetManager.selectAndPrepareTarget(filter);
            if (selectionListCheck) {
                assert.ok(
                    selectionListCheck(targetsForSelection),
                    "Did not pass options list check",
                );
            }
            if (resultCheck) {
                assert.ok(resultCheck(target), "Did not pass result target check");
            }
        }

        setup(async () => {
            revertTargetsStates();
            targetsForSelection = [];
            await androidTargetManager.collectTargets();
        });

        test("Should show all targets in case filter has not been defined", async function () {
            await checkTargetSeletionResult(undefined, options => options.length === 6);
        });

        test("Should show targets by filter", async function () {
            const onlineTargetsFilter = (target: IMobileTarget) => target.isOnline;
            await checkTargetSeletionResult(
                onlineTargetsFilter,
                options =>
                    options.length ===
                    options.filter(
                        option =>
                            option === onlineEmulator1.name ||
                            option === onlineEmulator2.name ||
                            option === device1.id ||
                            option === device2.id,
                    ).length,
            );
        });

        test("Should auto select option in case there is only one target", async function () {
            const showQuickPickCallCount = showQuickPickStub.callCount;
            const specificNameTargetFilter = (target: IMobileTarget) =>
                target.name === onlineEmulator1.name;

            await checkTargetSeletionResult(
                specificNameTargetFilter,
                undefined,
                (target: AndroidTarget) => target.id === onlineEmulator1.id,
            );
            assert.strictEqual(
                showQuickPickStub.callCount - showQuickPickCallCount,
                0,
                "There is only one target, but quick pick was shown",
            );
        });

        test("Should launch the selected emulator in case it's offline", async function () {
            const specificNameTargetFilter = (target: IMobileTarget) =>
                target.name === offlineEmulator1.name;
            await checkTargetSeletionResult(
                specificNameTargetFilter,
                undefined,
                (target: AndroidTarget) => target.isOnline && !!target.id,
            );
        });
    });
});

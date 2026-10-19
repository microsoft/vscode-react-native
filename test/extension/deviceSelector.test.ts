// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import {
    Device,
    DeviceItem,
    applySelectedDevice,
    buildPickerItems,
    nextCurrent,
    statusBarText,
    statusBarTooltip,
    toAndroidDevices,
} from "../../src/extension/deviceSelector";
import { PlatformType } from "../../src/extension/launchArgs";
import * as sinon from "sinon";
import { AdbHelper } from "../../src/extension/android/adb";
import { AndroidTargetManager } from "../../src/extension/android/androidTargetManager";
import { ChildProcess } from "../../src/common/node/childProcess";

const pixel: Device = {
    platform: PlatformType.Android,
    key: "Pixel_7_API_34",
    id: "emulator-5554",
    name: "Pixel_7_API_34",
    isVirtual: true,
    isOnline: true,
};
const phone: Device = {
    platform: PlatformType.Android,
    key: "R5CT",
    id: "R5CT",
    name: "Pixel 8",
    isVirtual: false,
    isOnline: true,
};
const offlineAvd: Device = {
    platform: PlatformType.Android,
    key: "Pixel_4_API_30",
    id: "Pixel_4_API_30",
    name: "Pixel_4_API_30",
    isVirtual: true,
    isOnline: false,
};
const iphone: Device = {
    platform: PlatformType.iOS,
    key: "UDID-1",
    id: "UDID-1",
    name: "iPhone 17",
    isVirtual: true,
    isOnline: true,
    system: "iOS 27.0",
};
const offlineSim: Device = {
    platform: PlatformType.iOS,
    key: "UDID-2",
    id: "UDID-2",
    name: "iPhone 17e",
    isVirtual: true,
    isOnline: false,
    system: "iOS 27.0",
};

function describeItems(items: DeviceItem[]): string[] {
    return items.map(item =>
        item.kind === vscode.QuickPickItemKind.Separator
            ? `-- ${item.label}`
            : [item.label, item.description, item.detail, item.coldBoot && "cold"]
                  .filter(Boolean)
                  .join(" | "),
    );
}

suite("DeviceSelector", function () {
    suite("statusBarText", function () {
        test("shows No Device when nothing is selected", function () {
            assert.strictEqual(statusBarText(undefined), "No Device");
        });

        test("labels emulators, simulators and physical devices", function () {
            assert.strictEqual(statusBarText(pixel), "Pixel_7_API_34 (android emulator)");
            assert.strictEqual(statusBarText(phone), "Pixel 8 (android)");
            assert.strictEqual(statusBarText(iphone), "iPhone 17 (ios simulator)");
        });
    });

    suite("statusBarTooltip", function () {
        test("counts only online devices", function () {
            assert.strictEqual(statusBarTooltip([]), undefined);
            assert.strictEqual(statusBarTooltip([offlineAvd]), undefined);
            assert.strictEqual(statusBarTooltip([pixel, offlineAvd]), "1 Device Connected");
            assert.strictEqual(statusBarTooltip([pixel, iphone]), "2 Devices Connected");
        });
    });

    suite("buildPickerItems", function () {
        test("lists the current device first, then offline emulators with cold boot rows", function () {
            const items = buildPickerItems([iphone, pixel, offlineAvd, offlineSim], pixel);
            assert.deepStrictEqual(describeItems(items), [
                "-- Available Devices",
                "$(device-mobile) Pixel_7_API_34 | emulator-5554 - android | Current Device",
                "$(device-mobile) iPhone 17 | UDID-1 - ios",
                "-- Offline Emulators",
                "$(play) Start Pixel_4_API_30 | mobile emulator",
                "$(play) Start Pixel_4_API_30 | mobile emulator (cold boot) | cold",
                "$(play) Start iPhone 17e | mobile simulator (iOS 27.0)",
            ]);
            assert.strictEqual(items[1].device, pixel);
            assert.strictEqual(items[5].device, offlineAvd);
        });

        test("sorts available devices by name when none is current", function () {
            const items = buildPickerItems([pixel, iphone], undefined);
            assert.deepStrictEqual(describeItems(items), [
                "-- Available Devices",
                "$(device-mobile) iPhone 17 | UDID-1 - ios",
                "$(device-mobile) Pixel_7_API_34 | emulator-5554 - android",
            ]);
        });

        test("omits empty sections", function () {
            assert.deepStrictEqual(buildPickerItems([], undefined), []);
            assert.deepStrictEqual(describeItems(buildPickerItems([offlineAvd], undefined)), [
                "-- Offline Emulators",
                "$(play) Start Pixel_4_API_30 | mobile emulator",
                "$(play) Start Pixel_4_API_30 | mobile emulator (cold boot) | cold",
            ]);
        });
    });

    suite("nextCurrent", function () {
        test("first refresh picks the saved device when it is online", function () {
            assert.strictEqual(
                nextCurrent(undefined, undefined, [pixel, iphone], "UDID-1"),
                iphone,
            );
        });

        test("first refresh falls back to the first online device", function () {
            assert.strictEqual(
                nextCurrent(undefined, undefined, [offlineAvd, pixel, iphone], "gone"),
                pixel,
            );
            assert.strictEqual(
                nextCurrent(undefined, undefined, [offlineAvd], undefined),
                undefined,
            );
        });

        test("a newly connected device replaces a current device that was not picked", function () {
            assert.strictEqual(nextCurrent(pixel, [pixel], [pixel, iphone], undefined), iphone);
        });

        test("a newly connected device does not replace the picked device", function () {
            assert.strictEqual(
                nextCurrent(pixel, [pixel], [pixel, iphone], "Pixel_7_API_34"),
                pixel,
            );
        });

        test("the picked device is re-selected when it reconnects", function () {
            assert.strictEqual(
                nextCurrent(iphone, [iphone], [iphone, pixel], "Pixel_7_API_34"),
                pixel,
            );
        });

        test("an offline AVD coming online counts as newly connected", function () {
            const booted: Device = { ...offlineAvd, id: "emulator-5556", isOnline: true };
            assert.strictEqual(
                nextCurrent(pixel, [pixel, offlineAvd], [pixel, booted], undefined),
                booted,
            );
        });

        test("when the current device disconnects, prefers the saved device, then the first online", function () {
            assert.strictEqual(
                nextCurrent(iphone, [iphone, pixel, phone], [phone, pixel], "Pixel_7_API_34"),
                pixel,
            );
            assert.strictEqual(nextCurrent(iphone, [iphone, phone], [phone], undefined), phone);
            assert.strictEqual(nextCurrent(iphone, [iphone], [], undefined), undefined);
        });

        test("returns the fresh object from the new device list", function () {
            const stale: Device = { ...pixel, name: "old" };
            assert.strictEqual(nextCurrent(stale, [pixel], [pixel], undefined), pixel);
        });
    });

    suite("applySelectedDevice", function () {
        const launch = (platform: string, target?: string): vscode.DebugConfiguration => ({
            name: platform === "ios" ? "Debug iOS" : "Debug Android",
            type: "reactnative",
            request: "launch",
            platform,
            ...(target === undefined ? {} : { target }),
        });

        test("fills an empty target with the device key", function () {
            const config = launch("android");
            assert.strictEqual(applySelectedDevice(config, pixel), undefined);
            assert.strictEqual(config.target, "Pixel_7_API_34");
        });

        test("fills simulator/device targets only when the device type matches", function () {
            const simulator = launch("android", "simulator");
            applySelectedDevice(simulator, pixel);
            assert.strictEqual(simulator.target, "Pixel_7_API_34");

            const device = launch("android", "device");
            applySelectedDevice(device, phone);
            assert.strictEqual(device.target, "R5CT");

            const wrongType = launch("android", "simulator");
            assert.strictEqual(applySelectedDevice(wrongType, phone), undefined);
            assert.strictEqual(wrongType.target, "simulator");

            const wrongType2 = launch("ios", "device");
            applySelectedDevice(wrongType2, iphone);
            assert.strictEqual(wrongType2.target, "device");
        });

        test("never overrides an explicit target", function () {
            const config = launch("android", "emulator-5556");
            assert.strictEqual(applySelectedDevice(config, pixel), undefined);
            assert.strictEqual(config.target, "emulator-5556");
            assert.strictEqual(
                applySelectedDevice(launch("android", "emulator-5556"), undefined),
                undefined,
            );
        });

        test("returns a note on platform mismatch and leaves the config alone", function () {
            const config = launch("ios");
            assert.strictEqual(
                applySelectedDevice(config, pixel),
                "Selected device 'Pixel_7_API_34' (android) doesn't match 'Debug iOS' (ios); using the default target selection.",
            );
            assert.strictEqual(config.target, undefined);
        });

        test("returns a note when no device is selected", function () {
            assert.strictEqual(
                applySelectedDevice(launch("android"), undefined),
                "No device selected; using the default target selection.",
            );
        });

        test("ignores attach requests and other platforms", function () {
            const attach: vscode.DebugConfiguration = { ...launch("android"), request: "attach" };
            assert.strictEqual(applySelectedDevice(attach, pixel), undefined);
            assert.strictEqual(attach.target, undefined);

            const expo = launch("exponent");
            assert.strictEqual(applySelectedDevice(expo, pixel), undefined);
            assert.strictEqual(expo.target, undefined);
        });
    });

    suite("toAndroidDevices", function () {
        test("keys running emulators by AVD name, phones by serial, and lists AVDs that are not running", function () {
            const devices = toAndroidDevices(
                [
                    { id: "emulator-5554", isVirtual: true, name: "Pixel_7_API_34" },
                    { id: "R5CT", isVirtual: false, name: "Pixel 8" },
                ],
                ["Pixel_4_API_30", "Pixel_7_API_34"],
            );
            assert.deepStrictEqual(devices, [pixel, phone, offlineAvd]);
        });
    });
});

suite("AndroidTargetManager.launchSimulator", function () {
    test("passes -no-snapshot-load for a cold boot and resolves with the emulator serial", async function () {
        this.timeout(5000);
        const spawnStub = sinon.stub(ChildProcess.prototype, "spawn").returns({
            spawnedProcess: { unref: () => undefined },
            outcome: new Promise<void>(() => undefined),
        } as any);
        const adbHelper = {
            getOnlineTargets: async () => [
                { id: "emulator-5554", isOnline: true, isVirtualTarget: true },
            ],
            getAvdNameById: async () => "Pixel_4_API_30",
        } as unknown as AdbHelper;
        try {
            const target = await new AndroidTargetManager(adbHelper).launchSimulator(
                { name: "Pixel_4_API_30", isOnline: false, isVirtualTarget: true },
                true,
            );
            assert.deepStrictEqual(spawnStub.firstCall.args.slice(0, 2), [
                "emulator",
                ["-avd", "Pixel_4_API_30", "-no-snapshot-load"],
            ]);
            assert.strictEqual(target.id, "emulator-5554");
        } finally {
            spawnStub.restore();
        }
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { EventEmitter } from "events";
import * as sinon from "sinon";
import { AdbHelper } from "../../../src/extension/android/adb";
import { LogCatMonitor } from "../../../src/extension/android/logCatMonitor";
import { OutputChannelLogger } from "../../../src/extension/log/OutputChannelLogger";

suite("logCatMonitor arguments", function () {
    const deviceId = "emulator-5554";
    let adbHelper: AdbHelper;
    let startLogCatStub: Sinon.SinonStub;
    let getChannelStub: Sinon.SinonStub;
    let disposeChannelStub: Sinon.SinonStub;

    setup(() => {
        adbHelper = new AdbHelper(".", ".");
        startLogCatStub = sinon.stub(adbHelper, "startLogCat").returns({
            spawnedProcess: { kill: sinon.stub() },
            stdin: {},
            stdout: new EventEmitter(),
            stderr: new EventEmitter(),
            outcome: Promise.resolve(),
        });
        const logger = {
            channelName: `LogCat - ${deviceId}`,
            debug: sinon.stub(),
            info: sinon.stub(),
        };
        getChannelStub = sinon.stub(OutputChannelLogger, "getChannel").returns(logger);
        disposeChannelStub = sinon.stub(OutputChannelLogger, "disposeChannel");
    });

    teardown(() => {
        startLogCatStub.restore();
        getChannelStub.restore();
        disposeChannelStub.restore();
    });

    for (const [description, input, expected] of [
        ["PID option", ["--pid", "1234"], ["--pid", "1234"]],
        ["format option", ["-v", "threadtime"], ["-v", "threadtime"]],
        ["an argument containing spaces", ["--regex", "one two"], ["--regex", "one two"]],
        ["filter expressions", ["*:S", "ReactNative:V"], ["*:S", "ReactNative:V"]],
        ["empty array", [], []],
        ["string", "--pid 1234", ["--pid", "1234"]],
        ["empty string", "", [""]],
        ["defaults", undefined, ["*:S", "ReactNative:V", "ReactNativeJS:V"]],
    ] as Array<[string, string | string[] | undefined, string[]]>) {
        test(`passes ${description} to adb`, async () => {
            const monitor = new LogCatMonitor(deviceId, adbHelper, input);
            await monitor.start();

            sinon.assert.calledOnce(startLogCatStub);
            sinon.assert.calledWithExactly(startLogCatStub, [
                "-s",
                deviceId,
                "logcat",
                ...expected,
            ]);
            monitor.dispose();
        });
    }
});

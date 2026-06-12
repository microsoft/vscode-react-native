// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { EventEmitter } from "events";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("installExpoGoApplicationCommand", function () {
    function createMockProject(projectPath: string): any {
        return {
            getExponentHelper: () => ({
                isExpoManagedApp: Sinon.stub().returns(Promise.resolve(true)),
                exponentSdk: Sinon.stub().returns(Promise.resolve("50.0.0")),
            }),
            getPackager: () => ({
                getProjectPath: () => projectPath,
            }),
        };
    }

    function createCommandModule(
        androidClientVersion: string,
        downloadExpoGoStub: Sinon.SinonStub,
    ) {
        const response = new EventEmitter() as any;
        response.setEncoding = Sinon.stub();

        const request = new EventEmitter() as any;
        request.end = Sinon.stub();

        const getStub = ((_url: string, callback: (response: any) => void) => {
            callback(response);
            process.nextTick(() => {
                response.emit(
                    "data",
                    JSON.stringify({
                        sdkVersions: {
                            "50.0.0": {
                                androidClientUrl: "https://example.com/expo.apk",
                                androidClientVersion,
                                iosClientUrl: "https://example.com/expo.tar.gz",
                                iosClientVersion: "2.0.0",
                            },
                        },
                    }),
                );
                response.emit("end");
            });
            return request;
        }) as any;

        const showQuickPickStub = Sinon.stub();
        showQuickPickStub.onFirstCall().returns(Promise.resolve("Android"));
        showQuickPickStub.onSecondCall().returns(Promise.resolve("Manual"));

        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
            logStream: Sinon.stub(),
        };

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/installExpoGoApplication",
            {
                vscode: {
                    window: {
                        showQuickPick: showQuickPickStub,
                        showInformationMessage: Sinon.stub(),
                    },
                },
                https: {
                    get: getStub,
                },
                "../../common/downloadHelper": {
                    downloadExpoGo: downloadExpoGoStub,
                },
                "../../common/installHelper": {
                    installAndroidApplication: Sinon.stub().returns(Promise.resolve()),
                    installiOSApplication: Sinon.stub().returns(Promise.resolve()),
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getMainChannel: () => logger,
                    },
                },
            },
        ) as typeof import("../../../src/extension/commands/installExpoGoApplication");

        return {
            InstallExpoGoApplication: module.InstallExpoGoApplication,
            getStub,
        };
    }

    async function runCommand(
        commandClass: typeof import("../../../src/extension/commands/installExpoGoApplication").InstallExpoGoApplication,
    ): Promise<void> {
        const command = commandClass.formInstance();
        (command as any).project = createMockProject("/workspace/app");
        await command.baseFn();
    }

    test("should reject non-numeric Expo Go version strings", async function () {
        const downloadExpoGoStub = Sinon.stub().returns(Promise.resolve());
        const { InstallExpoGoApplication } = createCommandModule(
            "2.0.0;rm -rf /",
            downloadExpoGoStub,
        );

        await assert.rejects(
            runCommand(InstallExpoGoApplication),
            /Invalid Expo Go version string: 2\.0\.0;rm -rf \//,
        );
        assert.strictEqual(downloadExpoGoStub.called, false);
    });

    test("should use valid Expo Go version strings in the download path", async function () {
        const downloadExpoGoStub = Sinon.stub().returns(Promise.resolve());
        const { InstallExpoGoApplication } = createCommandModule("2.0.0", downloadExpoGoStub);

        await runCommand(InstallExpoGoApplication);

        assert.strictEqual(downloadExpoGoStub.calledOnce, true);
        assert.deepStrictEqual(downloadExpoGoStub.firstCall.args, [
            "https://example.com/expo.apk",
            "/workspace/app/expogo_2.0.0.apk",
        ]);
    });
});

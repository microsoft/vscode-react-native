// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { EventEmitter } from "events";
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { NestedError } from "../../../src/common/error/internalError";
import { InternalErrorCode } from "../../../src/common/error/internalErrorCode";

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
        quickPickResults: Array<string | undefined> = ["Android", "Manual"],
    ) {
        const response = new EventEmitter() as any;
        response.setEncoding = Sinon.stub();

        const request = new EventEmitter() as any;
        request.end = Sinon.stub();

        const getStub = Sinon.spy((_url: string, callback: (response: any) => void) => {
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
        });

        const showQuickPickStub = Sinon.stub();
        quickPickResults.forEach((result, index) => {
            showQuickPickStub.onCall(index).returns(Promise.resolve(result));
        });

        const logger = {
            info: Sinon.stub(),
            error: Sinon.stub(),
            warning: Sinon.stub(),
            debug: Sinon.stub(),
            logStream: Sinon.stub(),
        };
        const installAndroidApplicationStub = Sinon.stub().returns(Promise.resolve());
        const installiOSApplicationStub = Sinon.stub().returns(Promise.resolve());

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
                fs: {
                    existsSync: Sinon.stub().returns(false),
                },
                os: {
                    platform: () => "darwin",
                },
                "../../common/downloadHelper": {
                    downloadExpoGo: downloadExpoGoStub,
                },
                "../../common/installHelper": {
                    installAndroidApplication: installAndroidApplicationStub,
                    installiOSApplication: installiOSApplicationStub,
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
            showQuickPickStub,
            installAndroidApplicationStub,
            installiOSApplicationStub,
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

    test("should stop when platform selection is canceled", async function () {
        const downloadExpoGoStub = Sinon.stub().returns(Promise.resolve());
        const { InstallExpoGoApplication, getStub, showQuickPickStub } = createCommandModule(
            "2.0.0",
            downloadExpoGoStub,
            [undefined],
        );

        await runCommand(InstallExpoGoApplication);

        assert.strictEqual(showQuickPickStub.calledOnce, true);
        assert.strictEqual(getStub.called, false);
        assert.strictEqual(downloadExpoGoStub.called, false);
    });

    test("should stop when installation selection is canceled", async function () {
        const downloadExpoGoStub = Sinon.stub().returns(Promise.resolve());
        const { InstallExpoGoApplication, getStub, showQuickPickStub } = createCommandModule(
            "2.0.0",
            downloadExpoGoStub,
            ["Android", undefined],
        );

        await runCommand(InstallExpoGoApplication);

        assert.strictEqual(showQuickPickStub.callCount, 2);
        assert.strictEqual(getStub.called, false);
        assert.strictEqual(downloadExpoGoStub.called, false);
    });

    for (const platform of ["Android", "iOS"]) {
        test(`should preserve the original ${platform} download error`, async function () {
            const originalError = new Error("ECONNRESET while downloading Expo Go");
            const downloadExpoGoStub = Sinon.stub().returns(Promise.reject(originalError));
            const {
                InstallExpoGoApplication,
                installAndroidApplicationStub,
                installiOSApplicationStub,
            } = createCommandModule("2.0.0", downloadExpoGoStub, [platform, "Auto"]);

            await assert.rejects(runCommand(InstallExpoGoApplication), (error: unknown) => {
                assert.ok(error instanceof NestedError);
                assert.strictEqual(error.innerError, originalError);
                assert.strictEqual(error.errorCode, InternalErrorCode.FailedToInstallExpoGo);
                assert.strictEqual(
                    error.message,
                    `Failed to download Expo Go.: ${originalError.message}`,
                );
                return true;
            });
            assert.strictEqual(installAndroidApplicationStub.called, false);
            assert.strictEqual(installiOSApplicationStub.called, false);
        });

        test(`should preserve the original ${platform} installation error`, async function () {
            const originalError = new Error(`${platform} device installation failed`);
            const downloadExpoGoStub = Sinon.stub().returns(Promise.resolve());
            const {
                InstallExpoGoApplication,
                installAndroidApplicationStub,
                installiOSApplicationStub,
            } = createCommandModule("2.0.0", downloadExpoGoStub, [platform, "Auto"]);
            const installStub =
                platform === "Android" ? installAndroidApplicationStub : installiOSApplicationStub;
            installStub.returns(Promise.reject(originalError));

            await assert.rejects(runCommand(InstallExpoGoApplication), (error: unknown) => {
                assert.ok(error instanceof NestedError);
                assert.strictEqual(error.innerError, originalError);
                assert.strictEqual(error.errorCode, InternalErrorCode.FailedToInstallExpoGo);
                assert.strictEqual(
                    error.message,
                    `Failed to install Expo Go.: ${originalError.message}`,
                );
                return true;
            });
            assert.strictEqual(downloadExpoGoStub.calledOnce, true);
            assert.strictEqual(installStub.calledOnce, true);
        });
    }
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { PlatformType } from "../../../src/extension/launchArgs";

suite("runExponentCommand", function () {
    function createMockProject(nodeModulesRoot = "project/node_modules") {
        const packager = {};

        return {
            project: {
                getOrUpdateNodeModulesRoot: Sinon.stub().returns(nodeModulesRoot),
                setReactNativeVersions: Sinon.stub(),
                getPackager: Sinon.stub().returns(packager),
            },
            packager,
            nodeModulesRoot,
        };
    }

    function createCommandModule() {
        const superOnBeforeExecuteStub = Sinon.stub().returns(Promise.resolve());
        const getVersionsStub = Sinon.stub().returns(
            Promise.resolve({
                reactNativeVersion: "1.0.0",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            }),
        );
        const getRunOptionsStub = Sinon.stub().returns({ platform: PlatformType.Exponent });
        const loginToExponentStub = Sinon.stub().returns(Promise.resolve({ username: "user" }));
        const exponentPlatformConstructorStub = Sinon.stub();
        const beforeStartPackagerStub = Sinon.stub().returns(Promise.resolve());
        const startPackagerStub = Sinon.stub().returns(Promise.resolve());

        class FakeReactNativeCommand {
            public project: any;

            static formInstance(): any {
                return new this();
            }

            async onBeforeExecute(): Promise<void> {
                await superOnBeforeExecuteStub();
            }
        }

        class FakeExponentPlatform {
            public beforeStartPackager = beforeStartPackagerStub;
            public startPackager = startPackagerStub;

            constructor(runOptions: unknown, context: unknown) {
                exponentPlatformConstructorStub(runOptions, context);
            }
        }

        const module = proxyquire.noCallThru()("../../../src/extension/commands/runExponent", {
            "../../common/projectVersionHelper": {
                ProjectVersionHelper: {
                    getReactNativePackageVersionsFromNodeModules: getVersionsStub,
                },
            },
            "../exponent/exponentPlatform": {
                ExponentPlatform: FakeExponentPlatform,
            },
            "../launchArgs": {
                PlatformType,
            },
            "./util": {
                getRunOptions: getRunOptionsStub,
                loginToExponent: loginToExponentStub,
            },
            "./util/reactNativeCommand": {
                ReactNativeCommand: FakeReactNativeCommand,
            },
        }) as typeof import("../../../src/extension/commands/runExponent");

        return {
            RunExponent: module.RunExponent,
            superOnBeforeExecuteStub,
            getVersionsStub,
            getRunOptionsStub,
            loginToExponentStub,
            exponentPlatformConstructorStub,
            beforeStartPackagerStub,
            startPackagerStub,
        };
    }

    async function runCommand(stubs: ReturnType<typeof createCommandModule>, project: any) {
        const command = stubs.RunExponent.formInstance() as any;
        command.project = project;
        await command.baseFn();
    }

    test("should resolve versions and start the Expo packager", async function () {
        const stubs = createCommandModule();
        const { project, packager, nodeModulesRoot } = createMockProject();

        await runCommand(stubs, project);

        assert.strictEqual(stubs.getVersionsStub.calledWithExactly(nodeModulesRoot), true);
        assert.deepStrictEqual(project.setReactNativeVersions.firstCall.args, [
            {
                reactNativeVersion: "1.0.0",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            },
        ]);
        assert.strictEqual(
            stubs.getRunOptionsStub.calledWithExactly(project, PlatformType.Exponent),
            true,
        );
        assert.deepStrictEqual(stubs.exponentPlatformConstructorStub.firstCall.args, [
            { platform: PlatformType.Exponent },
            { packager },
        ]);
        assert.strictEqual(stubs.beforeStartPackagerStub.calledOnce, true);
        assert.strictEqual(stubs.startPackagerStub.calledOnce, true);
        assert.strictEqual(
            stubs.beforeStartPackagerStub.calledBefore(stubs.startPackagerStub),
            true,
        );
    });

    test("should log in to Expo before executing the command", async function () {
        const stubs = createCommandModule();
        const { project } = createMockProject();
        const command = stubs.RunExponent.formInstance() as any;
        command.project = project;

        await command.onBeforeExecute();

        assert.strictEqual(stubs.superOnBeforeExecuteStub.calledOnce, true);
        assert.strictEqual(stubs.loginToExponentStub.calledWithExactly(project), true);
        assert.strictEqual(
            stubs.superOnBeforeExecuteStub.calledBefore(stubs.loginToExponentStub),
            true,
        );
    });

    test("should propagate Expo login failures", async function () {
        const error = new Error("Expo login failed");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        const command = stubs.RunExponent.formInstance() as any;
        command.project = project;
        stubs.loginToExponentStub.returns(Promise.reject(error));

        await assert.rejects(() => command.onBeforeExecute(), error);
    });

    test("should stop before starting the packager when version resolution fails", async function () {
        const error = new Error("failed to read React Native versions");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        stubs.getVersionsStub.returns(Promise.reject(error));

        await assert.rejects(() => runCommand(stubs, project), error);

        assert.strictEqual(project.setReactNativeVersions.called, false);
        assert.strictEqual(stubs.exponentPlatformConstructorStub.called, false);
        assert.strictEqual(stubs.beforeStartPackagerStub.called, false);
        assert.strictEqual(stubs.startPackagerStub.called, false);
    });

    test("should propagate packager startup failures", async function () {
        const error = new Error("failed to start Expo packager");
        const stubs = createCommandModule();
        const { project } = createMockProject();
        stubs.startPackagerStub.returns(Promise.reject(error));

        await assert.rejects(() => runCommand(stubs, project), error);
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");
import { InternalError } from "../../../src/common/error/internalError";

suite("testDevEnvironmentCommand", function () {
    const failedToTestDevEnvironmentErrorCode = 118;
    const workspaceNotFoundErrorCode = 105;
    const projectRoot = "test-project";
    const nodeModulesRoot = "test-project/node_modules";
    const reactNativeWindowsPackage = { packageName: "react-native-windows" };
    const reactNativeMacOsPackage = { packageName: "react-native-macos" };
    const packageVersions = {
        reactNativeVersion: "0.80.0",
        reactNativeWindowsVersion: "0.80.0",
        reactNativeMacOSVersion: "0.80.0",
    };
    const convertedPackageVersions = [{ reactNativeVersion: "0.80.0" }];
    const validationCategories = {
        Expo: "Expo",
        Windows: "Windows",
        macOS: "macOS",
    };

    function createProject(isExpoManagedAppResult: Promise<boolean> = Promise.resolve(false)) {
        const isExpoManagedAppStub = Sinon.stub().returns(isExpoManagedAppResult);
        const getExponentHelperStub = Sinon.stub().returns({
            isExpoManagedApp: isExpoManagedAppStub,
        });
        const getPackagerStub = Sinon.stub().returns({
            getExponentHelper: getExponentHelperStub,
        });
        const getOrUpdateNodeModulesRootStub = Sinon.stub().returns(nodeModulesRoot);
        const getWorkspaceFolderUriStub = Sinon.stub().returns({ fsPath: projectRoot });

        return {
            project: {
                getPackager: getPackagerStub,
                getOrUpdateNodeModulesRoot: getOrUpdateNodeModulesRootStub,
                getWorkspaceFolderUri: getWorkspaceFolderUriStub,
            },
            isExpoManagedAppStub,
            getExponentHelperStub,
            getPackagerStub,
            getOrUpdateNodeModulesRootStub,
            getWorkspaceFolderUriStub,
        };
    }

    function createCommandModule(options?: {
        isRNWindowsProject?: boolean;
        isRNMacosProject?: boolean;
        observerConstructorError?: Error;
        versionsResult?: Promise<typeof packageVersions>;
    }) {
        const commandError = new Error("Failed to test development environment");
        const selectProjectStub = Sinon.stub();
        const runChecksStub = Sinon.stub().returns(Promise.resolve());
        const getInternalErrorStub = Sinon.stub().returns(commandError);
        const getReactNativeProjectRootStub = Sinon.stub().returns(projectRoot);
        const getVersionsStub = Sinon.stub().returns(
            options?.versionsResult || Promise.resolve(packageVersions),
        );
        const convertVersionsStub = Sinon.stub().returns(convertedPackageVersions);
        const observerConstructorStub = Sinon.stub();

        class FakeCommand {
            static formInstance(): any {
                return new this();
            }

            public selectProject(): Promise<any> {
                return selectProjectStub();
            }
        }

        class FakeRNProjectObserver {
            public isRNWindowsProject = options?.isRNWindowsProject || false;
            public isRNMacosProject = options?.isRNMacosProject || false;
            public rnPackageVersions: typeof packageVersions;

            constructor(root: string, versions: typeof packageVersions) {
                observerConstructorStub(root, versions);
                if (options?.observerConstructorError) {
                    throw options.observerConstructorError;
                }
                this.rnPackageVersions = versions;
            }
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/commands/testDevEnvironment",
            {
                "../../common/error/errorHelper": {
                    ErrorHelper: {
                        getInternalError: getInternalErrorStub,
                    },
                },
                "../../common/error/internalErrorCode": {
                    InternalErrorCode: {
                        FailedToTestDevEnvironment: failedToTestDevEnvironmentErrorCode,
                        WorkspaceNotFound: workspaceNotFoundErrorCode,
                    },
                },
                "../../common/projectVersionHelper": {
                    ProjectVersionHelper: {
                        getReactNativePackageVersionsFromNodeModules: getVersionsStub,
                    },
                    REACT_NATIVE_PACKAGES: {
                        REACT_NATIVE_WINDOWS: reactNativeWindowsPackage,
                        REACT_NATIVE_MACOS: reactNativeMacOsPackage,
                    },
                    RNPackageVersionsToPackageVersion: convertVersionsStub,
                },
                "../rnProjectObserver": {
                    RNProjectObserver: FakeRNProjectObserver,
                },
                "../services/validationService/checker": {
                    runChecks: runChecksStub,
                },
                "../services/validationService/checks/types": {
                    ValidationCategoryE: validationCategories,
                },
                "../settingsHelper": {
                    SettingsHelper: {
                        getReactNativeProjectRoot: getReactNativeProjectRootStub,
                    },
                },
                "./util/command": {
                    Command: FakeCommand,
                },
            },
        ) as typeof import("../../../src/extension/commands/testDevEnvironment");

        return {
            TestDevEnvironment: module.TestDevEnvironment,
            commandError,
            selectProjectStub,
            runChecksStub,
            getInternalErrorStub,
            getReactNativeProjectRootStub,
            getVersionsStub,
            convertVersionsStub,
            observerConstructorStub,
        };
    }

    test("should expose metadata for a project-optional untrusted-workspace command", function () {
        const stubs = createCommandModule();
        const command = stubs.TestDevEnvironment.formInstance() as any;

        assert.strictEqual(command.codeName, "testDevEnvironment");
        assert.strictEqual(command.label, "Check development environment configuration");
        assert.strictEqual(command.requiresTrust, false);
        assert.strictEqual(command.requiresProject, false);
        assert.strictEqual(command.error, stubs.commandError);
        assert.strictEqual(
            stubs.getInternalErrorStub.calledWithExactly(failedToTestDevEnvironmentErrorCode),
            true,
        );
    });

    test("should run common checks when no workspace is found", async function () {
        const stubs = createCommandModule();
        const workspaceNotFoundError = new InternalError(
            workspaceNotFoundErrorCode,
            "Workspace not found",
        );
        stubs.selectProjectStub.returns(Promise.reject(workspaceNotFoundError));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.deepStrictEqual(stubs.runChecksStub.firstCall.args, [
            {
                [validationCategories.Expo]: false,
                [validationCategories.Windows]: false,
                [validationCategories.macOS]: false,
            },
        ]);
        assert.strictEqual(stubs.getVersionsStub.called, false);
    });

    test("should propagate project selection errors other than WorkspaceNotFound", async function () {
        const error = new Error("Project selection failed");
        const stubs = createCommandModule();
        stubs.selectProjectStub.returns(Promise.reject(error));

        await assert.rejects(() => stubs.TestDevEnvironment.formInstance().baseFn(), error);

        assert.strictEqual(stubs.runChecksStub.called, false);
    });

    test("should detect Expo, Windows, and macOS projects and pass package versions", async function () {
        const stubs = createCommandModule({
            isRNWindowsProject: true,
            isRNMacosProject: true,
        });
        const projectStubs = createProject(Promise.resolve(true));
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.strictEqual(projectStubs.isExpoManagedAppStub.calledWithExactly(false), true);
        assert.deepStrictEqual(stubs.runChecksStub.firstCall.args, [
            {
                [validationCategories.Expo]: true,
                [validationCategories.Windows]: true,
                [validationCategories.macOS]: true,
            },
            convertedPackageVersions,
        ]);
        assert.strictEqual(stubs.convertVersionsStub.calledWithExactly(packageVersions), true);
    });

    test("should create the project observer from the resolved roots and package versions", async function () {
        const stubs = createCommandModule();
        const projectStubs = createProject();
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.strictEqual(projectStubs.getOrUpdateNodeModulesRootStub.calledOnce, true);
        assert.strictEqual(projectStubs.getWorkspaceFolderUriStub.calledOnce, true);
        assert.strictEqual(
            stubs.getReactNativeProjectRootStub.calledWithExactly(projectRoot),
            true,
        );
        assert.strictEqual(
            stubs.getVersionsStub.calledWithExactly(nodeModulesRoot, [
                reactNativeWindowsPackage,
                reactNativeMacOsPackage,
            ]),
            true,
        );
        assert.deepStrictEqual(stubs.observerConstructorStub.firstCall.args, [
            projectRoot,
            packageVersions,
        ]);
    });

    test("should treat a failed Expo detection as a non-Expo project", async function () {
        const stubs = createCommandModule({ isRNWindowsProject: true });
        const projectStubs = createProject(Promise.reject(new Error("Expo detection failed")));
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.deepStrictEqual(stubs.runChecksStub.firstCall.args[0], {
            [validationCategories.Expo]: false,
            [validationCategories.Windows]: true,
            [validationCategories.macOS]: false,
        });
    });

    test("should run checks without package versions when version detection fails", async function () {
        const stubs = createCommandModule({
            versionsResult: Promise.reject(new Error("Version detection failed")),
        });
        const projectStubs = createProject(Promise.resolve(true));
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.deepStrictEqual(stubs.runChecksStub.firstCall.args, [
            {
                [validationCategories.Expo]: true,
                [validationCategories.Windows]: false,
                [validationCategories.macOS]: false,
            },
        ]);
        assert.strictEqual(stubs.convertVersionsStub.called, false);
    });

    test("should run checks without package versions when observer creation fails", async function () {
        const stubs = createCommandModule({
            observerConstructorError: new Error("Observer creation failed"),
        });
        const projectStubs = createProject();
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));

        await stubs.TestDevEnvironment.formInstance().baseFn();

        assert.deepStrictEqual(stubs.runChecksStub.firstCall.args, [
            {
                [validationCategories.Expo]: false,
                [validationCategories.Windows]: false,
                [validationCategories.macOS]: false,
            },
        ]);
        assert.strictEqual(stubs.convertVersionsStub.called, false);
    });

    test("should propagate validation execution errors", async function () {
        const error = new Error("Validation failed");
        const stubs = createCommandModule();
        const projectStubs = createProject();
        stubs.selectProjectStub.returns(Promise.resolve(projectStubs.project));
        stubs.runChecksStub.returns(Promise.reject(error));

        await assert.rejects(() => stubs.TestDevEnvironment.formInstance().baseFn(), error);
    });
});

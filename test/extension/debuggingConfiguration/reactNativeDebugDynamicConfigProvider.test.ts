// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ProjectVersionHelper } from "../../../src/common/projectVersionHelper";
import { ReactNativeProjectHelper } from "../../../src/common/reactNativeProjectHelper";
import { DEBUG_CONFIGURATION_NAMES } from "../../../src/extension/debuggingConfiguration/debugConfigTypesAndConstants";
import { ReactNativeDebugDynamicConfigProvider } from "../../../src/extension/debuggingConfiguration/reactNativeDebugDynamicConfigProvider";
import { SettingsHelper } from "../../../src/extension/settingsHelper";

suite("ReactNativeDebugDynamicConfigProvider", function () {
    const workspaceRoot = vscode.Uri.file(path.resolve("dynamic-config-workspace")).fsPath;
    const folder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file(workspaceRoot),
        name: "workspace",
        index: 0,
    };
    const platformCases = [
        {
            method: "isAndroidHermesEnabled",
            names: [
                DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES,
                DEBUG_CONFIGURATION_NAMES.RUN_ANDROID_HERMES,
            ],
        },
        {
            method: "isIOSHermesEnabled",
            names: [
                DEBUG_CONFIGURATION_NAMES.DEBUG_IOS_HERMES,
                DEBUG_CONFIGURATION_NAMES.RUN_IOS_HERMES,
            ],
        },
        {
            method: "isWindowsHermesEnabled",
            names: [DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES],
        },
        {
            method: "isMacOSHermesEnabled",
            names: [DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES],
        },
    ] as const;
    const hermesNames = platformCases.flatMap(platform => platform.names);
    const versions = {
        reactNativeVersion: "0.80.0",
        reactNativeWindowsVersion: "0.80.0",
        reactNativeMacOSVersion: "0.80.0",
    };
    const getReactNativeProjectRoot = SettingsHelper.getReactNativeProjectRoot;

    let rootStub: Sinon.SinonStub;
    let versionStub: Sinon.SinonStub;
    let detectors: Sinon.SinonStub[];

    setup(function () {
        rootStub = sinon.stub(SettingsHelper, "getReactNativeProjectRoot");
        versionStub = sinon
            .stub(ProjectVersionHelper, "tryToGetRNSemverValidVersionsFromProjectPackage")
            .returns(Promise.resolve(versions));
        detectors = platformCases.map(platform =>
            sinon.stub(ReactNativeProjectHelper, platform.method).returns(false),
        );
    });

    teardown(function () {
        rootStub.restore();
        versionStub.restore();
        detectors.forEach(detector => detector.restore());
    });

    platformCases.forEach((platform, index) => {
        test(`detects ${platform.method} in the configured project`, async function () {
            const projectRoot = path.join(workspaceRoot, "apps", "mobile");
            rootStub.returns(projectRoot);
            detectors[index].withArgs(projectRoot).returns(true);

            const configs =
                await new ReactNativeDebugDynamicConfigProvider().provideDebugConfigurations(
                    folder,
                );
            const names = configs.map(config => config.name);

            for (const name of hermesNames) {
                assert.strictEqual(names.includes(name), platform.names.includes(name));
            }
            assert.ok(names.includes(DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION));
            assert.strictEqual(rootStub.calledOnce, true);
            assert.strictEqual(rootStub.calledWithExactly(workspaceRoot), true);
            assert.strictEqual(versionStub.calledOnce, true);
            assert.strictEqual(versionStub.firstCall.args[0], projectRoot);
            assert.strictEqual(versionStub.firstCall.args[2], projectRoot);
            detectors.forEach(detector =>
                assert.strictEqual(detector.calledWithExactly(projectRoot), true),
            );
        });
    });

    test("does not use Hermes settings from the workspace instead of the configured project", async function () {
        const projectRoot = path.join(workspaceRoot, "apps", "mobile");
        rootStub.returns(projectRoot);
        detectors.forEach(detector => detector.withArgs(workspaceRoot).returns(true));

        const configs =
            await new ReactNativeDebugDynamicConfigProvider().provideDebugConfigurations(folder);
        const names = configs.map(config => config.name);

        for (const name of hermesNames) {
            assert.strictEqual(names.includes(name), false);
        }
        assert.strictEqual(
            names.includes(DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION),
            false,
        );
    });

    for (const { description, setting, projectRoot } of [
        {
            description: "a relative projectRoot",
            setting: path.join("apps", "mobile"),
            projectRoot: path.join(workspaceRoot, "apps", "mobile"),
        },
        {
            description: "an absolute projectRoot",
            setting: path.resolve(workspaceRoot, "..", "external-mobile"),
            projectRoot: path.resolve(workspaceRoot, "..", "external-mobile"),
        },
        {
            description: "no projectRoot",
            setting: undefined,
            projectRoot: workspaceRoot,
        },
        {
            description: "an empty projectRoot",
            setting: "",
            projectRoot: workspaceRoot,
        },
    ]) {
        test(`uses ${description} to detect Hermes`, async function () {
            rootStub.restore();
            rootStub = sinon.stub(
                SettingsHelper,
                "getReactNativeProjectRoot",
                getReactNativeProjectRoot,
            );
            const configurationStub = sinon.stub(vscode.workspace, "getConfiguration").returns({
                has: (key: string) => key === "projectRoot" && setting !== undefined,
                get: () => setting,
            });
            detectors[0].withArgs(projectRoot).returns(true);

            try {
                const configs =
                    await new ReactNativeDebugDynamicConfigProvider().provideDebugConfigurations(
                        folder,
                    );
                const names = configs.map(config => config.name);

                assert.ok(names.includes(DEBUG_CONFIGURATION_NAMES.DEBUG_ANDROID_HERMES));
                assert.ok(names.includes(DEBUG_CONFIGURATION_NAMES.ATTACH_TO_HERMES_APPLICATION));
                detectors.forEach(detector =>
                    assert.strictEqual(detector.calledWithExactly(projectRoot), true),
                );
            } finally {
                configurationStub.restore();
            }
        });
    }

    test("does not detect desktop Hermes when the desktop packages are absent", async function () {
        rootStub.returns(path.join(workspaceRoot, "apps", "mobile"));
        versionStub.returns(
            Promise.resolve({
                ...versions,
                reactNativeWindowsVersion: "error",
                reactNativeMacOSVersion: "error",
            }),
        );

        const configs =
            await new ReactNativeDebugDynamicConfigProvider().provideDebugConfigurations(folder);
        const names = configs.map(config => config.name);

        assert.strictEqual(names.includes(DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS), false);
        assert.strictEqual(names.includes(DEBUG_CONFIGURATION_NAMES.DEBUG_WINDOWS_HERMES), false);
        assert.strictEqual(names.includes(DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS), false);
        assert.strictEqual(names.includes(DEBUG_CONFIGURATION_NAMES.DEBUG_MACOS_HERMES), false);
        assert.strictEqual(detectors[2].called, false);
        assert.strictEqual(detectors[3].called, false);
    });
});

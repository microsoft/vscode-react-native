// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import proxyquire = require("proxyquire");

suite("debugScenario commands", function () {
    const debuggingCommandFailedErrorCode = 321;
    const workspaceFolder = { name: "test-workspace" };
    const debugConfigurationNames = {
        ATTACH_TO_HERMES_APPLICATION: "Attach to Hermes application",
        ATTACH_TO_DIRECT_IOS_EXPERIMENTAL: "Attach to Direct iOS - Experimental",
        ATTACH_TO_PACKAGER: "Attach to packager",
        DEBUG_ANDROID: "Debug Android",
        DEBUG_IOS: "Debug iOS",
        DEBUG_WINDOWS: "Debug Windows",
        DEBUG_MACOS: "Debug macOS",
        DEBUG_IN_EXPONENT: "Debug in Exponent",
        DEBUG_ANDROID_HERMES: "Debug Android Hermes",
        DEBUG_DIRECT_IOS_EXPERIMENTAL: "Debug Direct iOS - Experimental",
        DEBUG_IOS_HERMES: "Debug iOS Hermes",
        DEBUG_MACOS_HERMES: "Debug macOS Hermes",
        DEBUG_WINDOWS_HERMES: "Debug Windows Hermes",
        RUN_ANDROID: "Run Android",
        RUN_IOS: "Run iOS",
        RUN_ANDROID_HERMES: "Run Android Hermes",
        RUN_IOS_HERMES: "Run iOS Hermes",
        RUN_DIRECT_IOS_EXPERIMENTAL: "Run Direct iOS - Experimental",
        DEBUG_IN_EXPONENT_HERMES: "Debug in Hermes Exponent",
        DEBUG_IN_EXPONENT_WEB: "Debug in Exponent Web",
    } as const;

    type DebugConfigurationKey = keyof typeof debugConfigurationNames;

    interface TestProject {
        getWorkspaceFolder(): typeof workspaceFolder;
    }

    interface TestCommand {
        codeName: string;
        label: string;
        error: Error;
        project?: TestProject;
        baseFn(): Promise<void>;
    }

    interface DebugConfiguration {
        name: string;
        isDynamic?: boolean;
    }

    interface Scenario {
        className: string;
        codeName: string;
        configurationKey: DebugConfigurationKey;
    }

    type CommandConstructor = new () => TestCommand;

    const scenarios: Scenario[] = [
        {
            className: "AttachHermesApplication",
            codeName: "debugScenario.attachHermesApplication",
            configurationKey: "ATTACH_TO_HERMES_APPLICATION",
        },
        {
            className: "AttachDirectIosExperimental",
            codeName: "debugScenario.attachDirectIosExperimental",
            configurationKey: "ATTACH_TO_DIRECT_IOS_EXPERIMENTAL",
        },
        {
            className: "AttachToPackager",
            codeName: "debugScenario.attachToPackager",
            configurationKey: "ATTACH_TO_PACKAGER",
        },
        {
            className: "DebugAndroid",
            codeName: "debugScenario.debugAndroid",
            configurationKey: "DEBUG_ANDROID",
        },
        {
            className: "DebugIos",
            codeName: "debugScenario.debugIos",
            configurationKey: "DEBUG_IOS",
        },
        {
            className: "DebugWindows",
            codeName: "debugScenario.debugWindows",
            configurationKey: "DEBUG_WINDOWS",
        },
        {
            className: "DebugMacos",
            codeName: "debugScenario.debugMacos",
            configurationKey: "DEBUG_MACOS",
        },
        {
            className: "DebugInExponent",
            codeName: "debugScenario.debugInExponent",
            configurationKey: "DEBUG_IN_EXPONENT",
        },
        {
            className: "DebugInHermesExponent",
            codeName: "debugScenario.debugInHermesExponent",
            configurationKey: "DEBUG_IN_EXPONENT_HERMES",
        },
        {
            className: "DebugInExponentWeb",
            codeName: "debugScenario.debugInExponentWeb",
            configurationKey: "DEBUG_IN_EXPONENT_WEB",
        },
        {
            className: "DebugAndroidHermes",
            codeName: "debugScenario.debugAndroidHermes",
            configurationKey: "DEBUG_ANDROID_HERMES",
        },
        {
            className: "DebugDirectIosExperimental",
            codeName: "debugScenario.debugDirectIosExperimental",
            configurationKey: "DEBUG_DIRECT_IOS_EXPERIMENTAL",
        },
        {
            className: "DebugIosHermes",
            codeName: "debugScenario.debugIosHermes",
            configurationKey: "DEBUG_IOS_HERMES",
        },
        {
            className: "DebugMacosHermes",
            codeName: "debugScenario.debugMacosHermes",
            configurationKey: "DEBUG_MACOS_HERMES",
        },
        {
            className: "DebugWindowsHermes",
            codeName: "debugScenario.debugWindowsHermes",
            configurationKey: "DEBUG_WINDOWS_HERMES",
        },
        {
            className: "RunAndroid",
            codeName: "debugScenario.runAndroid",
            configurationKey: "RUN_ANDROID",
        },
        {
            className: "RunIos",
            codeName: "debugScenario.runIos",
            configurationKey: "RUN_IOS",
        },
        {
            className: "RunAndroidHermes",
            codeName: "debugScenario.runAndroidHermes",
            configurationKey: "RUN_ANDROID_HERMES",
        },
        {
            className: "RunIosHermes",
            codeName: "debugScenario.runIosHermes",
            configurationKey: "RUN_IOS_HERMES",
        },
        {
            className: "RunDirectIosExperimental",
            codeName: "debugScenario.runDirectIosExperimental",
            configurationKey: "RUN_DIRECT_IOS_EXPERIMENTAL",
        },
    ];

    const debugConfigurations: Record<string, DebugConfiguration> = {};
    for (const configurationName of Object.values(debugConfigurationNames)) {
        debugConfigurations[configurationName] = { name: configurationName };
    }

    const commandError = new Error("Debugging command failed");
    const startDebuggingStub = Sinon.stub().returns(Promise.resolve(true));
    const getInternalErrorStub = Sinon.stub().returns(commandError);

    class FakeCommand {
        public project?: TestProject;
    }

    const commandModule = proxyquire.noCallThru()("../../../src/extension/commands/debugScenario", {
        vscode: {
            debug: {
                startDebugging: startDebuggingStub,
            },
        },
        "vscode-nls": {
            MessageFormat: { bundle: "bundle" },
            BundleFormat: { standalone: "standalone" },
            config: Sinon.stub().returns(() => undefined),
            loadMessageBundle: Sinon.stub().returns((_key: string, message: string) => message),
        },
        "../../common/error/errorHelper": {
            ErrorHelper: {
                getInternalError: getInternalErrorStub,
            },
        },
        "../../common/error/internalErrorCode": {
            InternalErrorCode: {
                DebuggingCommandFailed: debuggingCommandFailedErrorCode,
            },
        },
        "../debuggingConfiguration/debugConfigTypesAndConstants": {
            debugConfigurations,
            DEBUG_CONFIGURATION_NAMES: debugConfigurationNames,
        },
        "./util/command": {
            Command: FakeCommand,
        },
    }) as Record<string, CommandConstructor>;

    setup(function () {
        startDebuggingStub.reset();
        for (const debugConfiguration of Object.values(debugConfigurations)) {
            delete debugConfiguration.isDynamic;
        }
    });

    test("should cover every exported debug scenario command", function () {
        assert.deepStrictEqual(
            Object.keys(commandModule).sort(),
            scenarios.map(scenario => scenario.className).sort(),
        );
    });

    for (const scenario of scenarios) {
        suite(scenario.className, function () {
            const configurationName = debugConfigurationNames[scenario.configurationKey];
            const CommandClass = commandModule[scenario.className];

            test("should expose the expected command metadata", function () {
                const command = new CommandClass();

                assert.strictEqual(command.codeName, scenario.codeName);
                assert.strictEqual(command.label, "");
                assert.strictEqual(command.error, commandError);
                assert.strictEqual(
                    getInternalErrorStub.args.filter(
                        ([errorCode, errorConfigurationName]) =>
                            errorCode === debuggingCommandFailedErrorCode &&
                            errorConfigurationName === configurationName,
                    ).length,
                    1,
                );
            });

            test("should start debugging with the expected dynamic configuration", async function () {
                const getWorkspaceFolderStub = Sinon.stub().returns(workspaceFolder);
                const command = new CommandClass();
                command.project = { getWorkspaceFolder: getWorkspaceFolderStub };

                await command.baseFn();

                assert.strictEqual(getWorkspaceFolderStub.calledOnce, true);
                assert.strictEqual(getWorkspaceFolderStub.calledWithExactly(), true);
                assert.strictEqual(
                    startDebuggingStub.calledOnce &&
                        startDebuggingStub.calledWithExactly(
                            workspaceFolder,
                            debugConfigurations[configurationName],
                        ),
                    true,
                );
                assert.strictEqual(debugConfigurations[configurationName].isDynamic, true);
            });

            test("should require a project before starting debugging", async function () {
                const command = new CommandClass();

                await assert.rejects(() => command.baseFn(), assert.AssertionError);

                assert.strictEqual(startDebuggingStub.called, false);
            });
        });
    }
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../automation";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { vscodeManager } from "./main";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { testApplicationSetupManager } from "./main";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";
import TestProject from "./helpers/testProject";
import AutomationHelper from "./helpers/AutomationHelper";

export function startDebugScenariosCreationTests(project: TestProject): void {
    describe("Debugging scenarios creation test", () => {
        let app: Application;
        let launchConfigurationManager: LaunchConfigurationManager;
        let previousConfigurationsCount: number;
        let automationHelper: AutomationHelper;

        async function initApp(
            workspaceOrFolder: string,
            sessionName?: string,
            locale?: string,
        ): Promise<Application> {
            app = await vscodeManager.runVSCode(workspaceOrFolder, sessionName, locale);
            automationHelper = new AutomationHelper(app);
            return app;
        }

        function clearDebugConfigs() {
            fs.writeFileSync(
                path.join(project.vsCodeConfigPath, "launch.json"),
                `{
                    "version": "0.2.0",
                    "configurations": [
                        {
                            "name": "Dont use this config",
                            "type": "pwa-node",
                            "request": "launch",
                            "skipFiles": [
                                "<node_internals>/**"
                            ],
                            "program": "index.js"
                        }
                    ]
                }`,
            );
        }

        before(async () => {
            app = await initApp(project.workspaceDirectory, "DebuggingScenariosCreationTest");
            clearDebugConfigs();
            launchConfigurationManager = new LaunchConfigurationManager(project.workspaceDirectory);
            await automationHelper.prepareForDebugScenarioCreactionTestWithRetry();
            SmokeTestLogger.info("Debugging scenarios creation test: launch.json file is opened");
        });

        after(async () => {
            if (app) {
                await app.stop();
            }
            testApplicationSetupManager.copyDebuggingConfigurationsToProject(project);
        });

        beforeEach(async () => {
            launchConfigurationManager.readLaunchScenarios();
            previousConfigurationsCount = launchConfigurationManager.getConfigurationsCount();
            SmokeTestLogger.info(
                "Debugging scenarios creation test: click on the Add Configuration button and React Native option",
            );
            await automationHelper.addConfigurationWithRetry();
        });

        describe("Add Run scenarios", () => {
            it("Add Run iOS debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Run application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Classic app option",
                );
                await app.workbench.quickinput.selectQuickInputElement(1);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Run iOS");
                assert.strictEqual(configurations && configurations[0].type, "reactnative");
                assert.strictEqual(configurations && configurations[0].platform, "ios");

                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Run iOS debugging scenario has been added successfully",
                );
            });
        });

        describe("Add Debug scenarios", () => {
            it("Add Debug iOS Hermes - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Debug application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Yes option");
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Debug iOS Hermes - Experimental",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");
                assert.strictEqual(configurations && configurations[0].platform, "ios");
                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Debug iOS Hermes - Experimental debugging scenario has been added successfully",
                );
            });

            it("Add Debug Direct iOS - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Debug application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select No option");
                await app.workbench.quickinput.selectQuickInputElement(1);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Debug Direct iOS - Experimental",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");
                assert.strictEqual(configurations && configurations[0].platform, "ios");
                assert.strictEqual(configurations && configurations[0].useHermesEngine, false);
                assert.strictEqual(configurations && configurations[0].target, "device");
                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Debug Direct iOS - Experimental debugging scenario has been added successfully",
                );
            });

            it("Add Debug macOS Hermes - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Debug application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select macOS option");
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Debug macOS Hermes - Experimental",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");
                assert.strictEqual(configurations && configurations[0].platform, "macos");

                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Debug macOS Hermes - Experimental debugging scenario has been added successfully",
                );
            });

            it("Add Debug Android Hermes - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Debug application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Android option");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Debug Android Hermes - Experimental",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");
                assert.strictEqual(configurations && configurations[0].platform, "android");
                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Debug Android Hermes - Experimental debugging scenario has been added successfully",
                );
            });

            it("Add Debug in Exponent debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Debug application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Exponent option");
                await app.workbench.quickinput.selectQuickInputElement(4, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select LAN Expo host type",
                );
                await app.workbench.quickinput.selectQuickInputElement(1);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Debug in Exponent");
                assert.strictEqual(
                    configurations && (configurations[0] as any).expoHostType,
                    "lan",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnative");
                assert.strictEqual(configurations && configurations[0].platform, "exponent");
                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Debug in Exponent debugging scenario has been added successfully",
                );
            });
        });

        describe("Add Attach scenarios", () => {
            it("Add Attach to packager debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Attach to application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Classic app option",
                );
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                const hostAddress = "127.0.0.1";
                SmokeTestLogger.info(
                    `Debugging scenarios creation test: enter ${hostAddress} address`,
                );
                await app.workbench.quickinput.inputAndSelect(hostAddress);
                SmokeTestLogger.info("Debugging scenarios creation test: skip port changing");
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Attach to packager");
                assert.strictEqual(
                    configurations && (configurations[0] as any).address,
                    hostAddress,
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnative");

                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Attach to packager debugging scenario has been added successfully",
                );
            });

            it("Add Attach to Hermes application - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Attach to application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Hermes engine option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info(`Debugging scenarios creation test: skip address changing`);
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: skip port changing");
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Attach to Hermes application - Experimental",
                );
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");

                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Attach to Hermes application - Experimental debugging scenario has been added successfully",
                );
            });

            it("Add Attach to Direct iOS - Experimental debugging scenario", async function () {
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Attach to application scenario",
                );
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info(
                    "Debugging scenarios creation test: select Direct mode option",
                );
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Direct iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info(`Debugging scenarios creation test: skip address changing`);
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: skip port changing");
                await app.workbench.quickinput.selectQuickInputElement(0);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(
                    previousConfigurationsCount + 1,
                    launchConfigurationManager.getConfigurationsCount(),
                );
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(
                    configurations && configurations[0].name,
                    "Attach to Direct iOS - Experimental",
                );
                assert.strictEqual(configurations && (configurations[0] as any).port, 9221);
                assert.strictEqual(configurations && configurations[0].type, "reactnativedirect");
                assert.strictEqual(configurations && configurations[0].platform, "ios");
                assert.strictEqual(configurations && configurations[0].useHermesEngine, false);

                SmokeTestLogger.success(
                    "Debugging scenarios creation test: Attach to Direct iOS - Experimental debugging scenario has been added successfully",
                );
            });
        });
    });
}

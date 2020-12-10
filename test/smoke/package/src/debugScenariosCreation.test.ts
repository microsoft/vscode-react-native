// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import { vscodeManager } from "./main";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";
import { Application } from "../../automation";
import { testApplicationSetupManager } from "./main";
import { LaunchConfigurationManager } from "./helpers/launchConfigurationManager";

export function startDebugScenariosCreationTests(workspace: string): void {
    describe("Debugging scenarios creation test", () => {
        let app: Application;
        let launchConfigurationManager: LaunchConfigurationManager;
        let previousConfigurationsCount: number;

        before(async () => {
            app = await vscodeManager.runVSCode(workspace, "DebuggingScenariosCreationTest");
            launchConfigurationManager = new LaunchConfigurationManager(workspace);
            await app.workbench.debug.openDebugViewlet();
            await app.workbench.debug.configure();
            SmokeTestLogger.info("Debugging scenarios creation test: launch.json file is opened");
            await app.workbench.terminal.showTerminalWithoutNecessaryFocus();
        });

        after(async () => {
            if (app) {
                await app.stop();
            }
            testApplicationSetupManager.copyDebuggingConfigurationsToProject(path.join(workspace, ".vscode"));
        });

        beforeEach(async () => {
            launchConfigurationManager.readLaunchScenarios();
            previousConfigurationsCount = launchConfigurationManager.getConfigurationsCount();
            SmokeTestLogger.info("Debugging scenarios creation test: click on the Add Configuration button and React Native option");
            await app.workbench.debug.addConfiguration();
        });

        describe("Add Run scenarios", () => {
            it("Add Run iOS debugging scenario", async function () {
                SmokeTestLogger.info("Debugging scenarios creation test: select Run application scenario");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Classic app option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(previousConfigurationsCount + 1, launchConfigurationManager.getConfigurationsCount());
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Run iOS");

                SmokeTestLogger.success("Debugging scenarios creation test: Run iOS debugging scenario has been added successfully");
            });
        });

        describe("Add Debug scenarios", () => {
            it("Add Debug Android Hermes - Experimental debugging scenario", async function () {
                SmokeTestLogger.info("Debugging scenarios creation test: select Debug application scenario");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Android option");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Direct mode option");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(previousConfigurationsCount + 1, launchConfigurationManager.getConfigurationsCount());
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Debug Android Hermes - Experimental");
                SmokeTestLogger.success("Debugging scenarios creation test: Debug Android Hermes - Experimental debugging scenario has been added successfully");
            });

            it("Add Debug in Exponent debugging scenario", async function () {
                SmokeTestLogger.info("Debugging scenarios creation test: select Debug application scenario");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Exponent option");
                await app.workbench.quickinput.selectQuickInputElement(4, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select LAN Expo host type");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(previousConfigurationsCount + 1, launchConfigurationManager.getConfigurationsCount());
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Debug in Exponent");
                assert.strictEqual(configurations && (configurations[0] as any).expoHostType, "lan");
                SmokeTestLogger.success("Debugging scenarios creation test: Debug in Exponent debugging scenario has been added successfully");
            });
        });

        describe("Add Attach scenarios", () => {
            it("Add Attach to packager debugging scenario", async function () {
                SmokeTestLogger.info("Debugging scenarios creation test: select Attach to application scenario");
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Classic app option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                const hostAddress = "127.0.0.1";
                SmokeTestLogger.info(`Debugging scenarios creation test: enter ${hostAddress} address`);
                await app.workbench.quickinput.inputAndSelect(hostAddress);
                SmokeTestLogger.info("Debugging scenarios creation test: skip port changing");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(previousConfigurationsCount + 1, launchConfigurationManager.getConfigurationsCount());
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Attach to packager");
                assert.strictEqual(configurations && (configurations[0] as any).address, hostAddress);

                SmokeTestLogger.success("Debugging scenarios creation test: Attach to packager debugging scenario has been added successfully");
            });

            it("Add Attach to the React Native iOS - Experimental debugging scenario", async function () {
                SmokeTestLogger.info("Debugging scenarios creation test: select Attach to application scenario");
                await app.workbench.quickinput.selectQuickInputElement(2, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Direct mode option");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: select Direct iOS option");
                await app.workbench.quickinput.selectQuickInputElement(1, false);
                SmokeTestLogger.info(`Debugging scenarios creation test: skip address changing`);
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: skip port changing");
                await app.workbench.quickinput.selectQuickInputElement(0, false);
                SmokeTestLogger.info("Debugging scenarios creation test: save launch.json file");
                await app.workbench.editors.saveOpenedFile();
                launchConfigurationManager.readLaunchScenarios();

                assert.strictEqual(previousConfigurationsCount + 1, launchConfigurationManager.getConfigurationsCount());
                let configurations = launchConfigurationManager.getLaunchScenarios().configurations;
                assert.strictEqual(configurations && configurations[0].name, "Attach to the React Native iOS - Experimental");
                assert.strictEqual(configurations && (configurations[0] as any).port, 9221);

                SmokeTestLogger.success("Debugging scenarios creation test: Attach to the React Native iOS - Experimental debugging scenario has been added successfully");
            });
        });
    });
}

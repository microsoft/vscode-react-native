// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor } from "./../../common/commandExecutor";
import { QuickPickOptions, window } from "vscode";
import { AdbHelper } from "./adb";

export class AndroidEmulatorManager {
    private static readonly EMULATOR_COMMAND = "emulator";
    private static readonly EMULATOR_LIST_AVDS_COMMAND = `${AndroidEmulatorManager.EMULATOR_COMMAND} -list-avds`;
    private static readonly EMULATOR_AVD_START_COMMAND = `${AndroidEmulatorManager.EMULATOR_COMMAND} -avd`;

    private static readonly EMULATOR_START_TIMEOUT = 30;

    private commandExecutor: CommandExecutor;
    private adbHelper: AdbHelper;

    constructor(adbHelper: AdbHelper) {
        this.commandExecutor = new CommandExecutor();
        this.adbHelper = adbHelper;
    }

    public async launchEmulatorByName(emulatorName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.commandExecutor.execute(`${AndroidEmulatorManager.EMULATOR_AVD_START_COMMAND} ${emulatorName}`);

            const rejectTimeout = setTimeout(() => {
                cleanup();
                reject(`Could not start emulator within ${AndroidEmulatorManager.EMULATOR_START_TIMEOUT} seconds.`);
            }, AndroidEmulatorManager.EMULATOR_START_TIMEOUT * 1000);

            const bootCheckInterval = setInterval(async () => {
                const connectedDevices = await this.adbHelper.getConnectedDevices();
                if (connectedDevices.length > 0) {
                    cleanup();
                    resolve(connectedDevices[0].id);
                }
            }, 1000);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(bootCheckInterval);
            };
        });
    }

    public  async selectEmulator(): Promise<string | undefined> {
        const emulatorsList = await this.getEmulatorsList();
        const quickPickOptions: QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
            placeHolder: "Select emulator for launch application",
        };
        const result = await window.showQuickPick(emulatorsList, quickPickOptions);
        return result?.toString();
    }

    private async getEmulatorsList(): Promise<string[]> {
        const res = await this.commandExecutor.executeToString(AndroidEmulatorManager.EMULATOR_LIST_AVDS_COMMAND);
        let emulatorsList: string[] = [];
        if (res) {
            emulatorsList = res.split("\r\n");
            if (emulatorsList.length == 1) {
                emulatorsList[0].trim();
            }
        }
        return emulatorsList;
    }
}
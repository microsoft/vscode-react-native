// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor } from "./../../common/commandExecutor";
import { window, QuickPickOptions, QuickPickItem } from "vscode";

export class AndroidEmulatorManager {
    private static readonly EMULATOR_COMMAND = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/emulator/emulator` : 'emulator';
    private static readonly EMULATOR_LIST_AVDS_COMMAND = `${AndroidEmulatorManager.EMULATOR_COMMAND} --list-avds`;
    private static readonly EMULATOR_AVD_START_COMMAND = `${AndroidEmulatorManager.EMULATOR_COMMAND} -avd`;

    private commandExecutor: CommandExecutor;

    constructor() {
        this.commandExecutor = new CommandExecutor();
    }

    public async selectAndLaunchEmulator() {
        return this.getEmulatorsList()
        .then((emulatorsList: string[]) => this.selectEmulator(emulatorsList))
        .then((emulatorName: string) => this.launchEmulatorByName(emulatorName));
    }

    public async launchEmulatorByName(emulatorName: string) {
        return await this.commandExecutor.execute(`${AndroidEmulatorManager.EMULATOR_AVD_START_COMMAND} ${emulatorName}`);
    }

    private async selectEmulator(emulatorsList: string[]): Promise<string> {
        return new Promise((resolve) => {
            const quickPickOptions: QuickPickOptions = {
                ignoreFocusOut: true,
                canPickMany: false,
                placeHolder: "Select emulator for launch application",
                onDidSelectItem: (item: string | QuickPickItem): any => {
                    resolve(item.toString());
                },
            };
            window.showQuickPick(emulatorsList, quickPickOptions);
        });
    }

    private async getEmulatorsList(): Promise<string[]> {
        const res = await this.commandExecutor.executeToString(AndroidEmulatorManager.EMULATOR_LIST_AVDS_COMMAND);
        let emulatorsList: string[] = [];
        if (res) {
            emulatorsList = res.split("\n\r");
        }
        return emulatorsList;
    }
}
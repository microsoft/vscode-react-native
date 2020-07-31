// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import { QuickPickOptions, window } from "vscode";
import * as nls from "vscode-nls";
import { QuickPickOptions, window } from "vscode";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize = nls.loadMessageBundle();

export interface IEmulator {
    name: string;
    id: string;
}

export abstract class EmulatorManager {

    protected async selectEmulator(): Promise<string | undefined> {
        const emulatorsList = await this.getEmulatorsNamesList();
        const quickPickOptions: QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
            placeHolder: localize("SelectEmulator", "Select emulator for launch application"),
        };
        let result: string | undefined = emulatorsList[0];
        if (emulatorsList.length > 1) {
            result = await window.showQuickPick(emulatorsList, quickPickOptions);
        }
        return result?.toString();
    }

    protected abstract async getEmulatorsNamesList(): Promise<string[]>
}
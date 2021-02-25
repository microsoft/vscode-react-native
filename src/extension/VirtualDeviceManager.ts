// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { QuickPickOptions, window } from "vscode";
import { IDevice } from "../common/device";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface IVirtualDevice extends IDevice {
    name?: string;
}

export abstract class VirtualDeviceManager {
    protected async selectVirtualDevice(
        filter?: (el: IVirtualDevice) => unknown,
    ): Promise<string | undefined> {
        const emulatorsList = await this.getVirtualDevicesNamesList(filter);
        const quickPickOptions: QuickPickOptions = {
            ignoreFocusOut: true,
            canPickMany: false,
            placeHolder: localize(
                "SelectVirtualDevice",
                "Select virtual device for launch application",
            ),
        };
        let result: string | undefined = emulatorsList[0];
        if (emulatorsList.length > 1) {
            result = await window.showQuickPick(emulatorsList, quickPickOptions);
        }
        return result?.toString();
    }

    public abstract startSelection(): Promise<string | undefined>;

    protected abstract getVirtualDevicesNamesList(
        filter?: (el: IVirtualDevice) => unknown,
    ): Promise<string[]>;
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { QuickPickOptions, window } from "vscode";
import { IMobileTarget, MobileTarget } from "./mobileTarget";
import { TargetType } from "./generalPlatform";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export abstract class MobileTargetManager {
    protected targets?: IMobileTarget[];

    public abstract collectTargets(): Promise<void>;

    public abstract selectAndPrepareTarget(
        filter?: (el: IMobileTarget) => boolean,
    ): Promise<MobileTarget | undefined>;

    public async getTargetList(filter?: (el: IMobileTarget) => boolean): Promise<IMobileTarget[]> {
        if (!this.targets) {
            await this.collectTargets();
        }
        return filter
            ? (this.targets as IMobileTarget[]).filter(filter)
            : (this.targets as IMobileTarget[]);
    }

    public async isVirtualTarget(target: string): Promise<boolean> {
        if (target === TargetType.Device) {
            return false;
        }
        if (target === TargetType.Simulator) {
            return true;
        }
        throw new Error(
            localize(
                "CouldNotRecognizeTargetType",
                "Could not recognize type of the target {0}",
                target,
            ),
        );
    }

    protected abstract launchSimulator(
        emulatorTarget: IMobileTarget,
    ): Promise<MobileTarget | undefined>;

    protected abstract startSelection(
        filter?: (el: IMobileTarget) => boolean,
    ): Promise<IMobileTarget | undefined>;

    protected async selectTarget(
        filter?: (el: IMobileTarget) => boolean,
    ): Promise<IMobileTarget | undefined> {
        const targetList = await this.getTargetList(filter);
        let result: string | undefined = targetList[0]?.name || targetList[0]?.id;
        if (targetList.length > 1) {
            const quickPickOptions: QuickPickOptions = {
                ignoreFocusOut: true,
                canPickMany: false,
                placeHolder: localize(
                    "SelectTargetDevice",
                    "Select target device for launch application",
                ),
            };
            result = await window.showQuickPick(
                targetList.map<string>(target => (target?.name || target?.id) as string),
                quickPickOptions,
            );
        }
        return targetList.find(target => target.name === result || target.id === result);
    }
}

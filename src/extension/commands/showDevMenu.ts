// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { sendMessageToMetro } from "./util";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ShowDevMenu extends Command {
    codeName = "showDevMenu";
    requiresTrust = false;
    label = "Show Dev Menu";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        localize("ReactNativeShowDevMenu", "React Native: Show Developer Menu for app"),
    );

    async baseFn(): Promise<void> {
        assert(this.project);
        await sendMessageToMetro("devMenu", this.project);
    }
}

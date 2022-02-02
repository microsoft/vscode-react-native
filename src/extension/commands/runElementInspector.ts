// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as child_process from "child_process";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { TipNotificationService } from "../services/tipsNotificationsService/tipsNotificationService";
import { HostPlatform } from "../../common/hostPlatform";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { Command } from "./_util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

// #todo!> commands should not maintain state
let elementInspector: import("child_process").ChildProcess | undefined;

export class RunElementInspector extends Command {
    static deactivate() {
        elementInspector?.kill();
    }

    codeName = "runInspector";
    label = "Run Element Inspector";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        localize("ReactNativeRunElementInspector", "React Native: Run Element Inspector"),
    );

    async baseFn() {
        assert(this.project);
        const logger = OutputChannelLogger.getMainChannel();

        void TipNotificationService.getInstance().setKnownDateForFeatureById("elementInspector");

        if (elementInspector) {
            logger.info(
                localize(
                    "AnotherElementInspectorAlreadyRun",
                    "Another element inspector already run",
                ),
            );

            return;
        }
        // Remove the following env variables to prevent running electron app in node mode.
        // https://github.com/microsoft/vscode/issues/3011#issuecomment-184577502
        const { ATOM_SHELL_INTERNAL_RUN_AS_NODE, ELECTRON_RUN_AS_NODE, ...env } = process.env;
        const command = HostPlatform.getNpmCliCommand("react-devtools");

        elementInspector = child_process.spawn(command, [], {
            env,
        });

        if (!elementInspector.pid) {
            elementInspector = undefined;
            throw ErrorHelper.getInternalError(InternalErrorCode.ReactDevtoolsIsNotInstalled);
        }

        elementInspector.stdout.on("data", (data: string) => {
            logger.info(data);
        });
        elementInspector.stderr.on("data", (data: string) => {
            logger.error(data);
        });
        elementInspector.once("exit", () => {
            elementInspector = undefined;
        });
    }
}

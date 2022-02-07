// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import * as XDL from "../exponent/xdlInterface";
import { RunExponent } from "./runExponent";
import { loginToExponent } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

const logger = OutputChannelLogger.getMainChannel();

export class PublishToExpHost extends ReactNativeCommand {
    codeName = "publishToExpHost";
    label = "Publish To Expo Host";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToPublishToExpHost);

    async baseFn() {
        if (!(await this.executePublishToExpHost())) {
            logger.warning(
                localize(
                    "ExponentPublishingWasUnsuccessfulMakeSureYoureLoggedInToExpo",
                    "Publishing was unsuccessful. Please make sure you are logged in Expo and your project is a valid Expo project",
                ),
            );
        }
    }

    private async executePublishToExpHost(): Promise<boolean> {
        assert(this.project);

        logger.info(
            localize(
                "PublishingAppToExponentServer",
                "Publishing app to Expo server. This might take a moment.",
            ),
        );

        const user = await loginToExponent(this.project);

        logger.debug(`Publishing as ${user.username}...`);

        await RunExponent.prototype.baseFn.bind(this)();
        const response = await XDL.publish(this.project.getWorkspaceFolderUri().fsPath);

        if (response.err || !response.url) {
            return false;
        }

        const publishedOutput = localize(
            "ExpoAppSuccessfullyPublishedTo",
            "Expo app successfully published to {0}",
            response.url,
        );

        logger.info(publishedOutput);

        void vscode.window.showInformationMessage(publishedOutput);
        return true;
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import { ProjectVersionHelper } from "../../common/projectVersionHelper";
// import { OutputChannelLogger } from "../log/OutputChannelLogger";
// import { ReactNativeCommand, selectProject } from "./_util";
// import * as nls from "vscode-nls";

// nls.config({
//     messageFormat: nls.MessageFormat.bundle,
//     bundleFormat: nls.BundleFormat.standalone,
// })();
// const localize = nls.loadMessageBundle();

// const logger = OutputChannelLogger.getMainChannel();

// export class PublishToExpHost extends ReactNativeCommand {
//     codeName: "publishToExpHost";
//     label: "Publish To Expo Host";
//     requireTrust: false;

//     async execute() {
//         if (!(await this.executePublishToExpHost())) {
//             logger.warning(
//                 localize(
//                     "ExponentPublishingWasUnsuccessfulMakeSureYoureLoggedInToExpo",
//                     "Publishing was unsuccessful. Please make sure you are logged in Expo and your project is a valid Expo project",
//                 ),
//             );
//         }
//     }

//     private async executePublishToExpHost(): Promise<boolean> {
//         logger.info(
//             localize(
//                 "PublishingAppToExponentServer",
//                 "Publishing app to Expo server. This might take a moment.",
//             ),
//         );
//         const appLauncher = await selectProject();
//         const user = await this.loginToExponent(appLauncher);
//         logger.debug(`Publishing as ${user.username}...`);
//         await this.runExponent();
//         const response = await XDL.publish(appLauncher.getWorkspaceFolderUri().fsPath);
//         if (response.err || !response.url) {
//             return false;
//         }
//         const publishedOutput = localize(
//             "ExpoAppSuccessfullyPublishedTo",
//             "Expo app successfully published to {0}",
//             response.url,
//         );
//         logger.info(publishedOutput);
//         vscode.window.showInformationMessage(publishedOutput);
//         return true;
//     }
// }

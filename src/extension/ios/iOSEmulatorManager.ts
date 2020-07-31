// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import { QuickPickOptions, window } from "vscode";
// import { ChildProcess } from "../../common/node/childProcess";
// import * as nls from "vscode-nls";
// nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
// const localize = nls.loadMessageBundle();

// export class iOSEmulatorManager {
//     private static readonly EMULATOR_COMMAND = "xcrun simctl";
//     private static readonly EMULATOR_LIST_COMMAND = "list -j devices";

//     private childProcess: ChildProcess;

//     constructor() {
//         this.childProcess = new ChildProcess();
//     }

//     public  async selectEmulator(): Promise<string | undefined> {
//         const emulatorsList = await this.getEmulatorsList();
//         const quickPickOptions: QuickPickOptions = {
//             ignoreFocusOut: true,
//             canPickMany: false,
//             placeHolder: localize("SelectEmulator", "Select emulator for launch application"),
//         };
//         let result: string | undefined = emulatorsList[0];
//         if (emulatorsList.length > 1) {
//             result = await window.showQuickPick(emulatorsList, quickPickOptions);
//         }
//         return result?.toString();
//     }

//     private async getEmulatorsList(): Promise<string[]> {
//         const res = await this.childProcess.execToString(`${iOSEmulatorManager.EMULATOR_COMMAND} ${iOSEmulatorManager.EMULATOR_LIST_COMMAND}`);
//         let emulatorsList: string[] = [];
//         if (res) {
//             const jsonRes = JSON.parse(res);
//             const emulators = jsonRes["devices"][0];
//             emulators.forEach((element: any) => {
//                 emulatorsList.push(element.name);
//             });
//         }
//         return emulatorsList;
//     }
// }
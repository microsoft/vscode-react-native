// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "../../common/node/childProcess";

const childProcess: ChildProcess = new ChildProcess();

export class SimctrlHelper {
    public static async getBootediOSSimulatorList(): Promise<string[]> {
        const getBootedSimulatorCommand =
            "xcrun simctl list | awk -F'[()]' '/(Booted)/ { print $2 }'";

        const targetResult = await childProcess.execToString(getBootedSimulatorCommand);
        const targetList = targetResult.split("\n");
        return targetList;
    }

    public static async installApplicationToSimulator(
        targetId: string,
        appPath: string,
    ): Promise<void> {
        const installCommand = `xcrun simctl install ${targetId} ${appPath}`;
        await childProcess.execToString(installCommand);
    }
}

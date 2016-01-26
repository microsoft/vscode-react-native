// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as child_process from 'child_process';

export class ReactNativeCommandHelper {
    private static CMD_NAME = 'react-native';

    public static executeReactNativeCommand(projectRoot: string, command: string): child_process.ChildProcess {
        // TODO: Update this to do more useful error checking
        return child_process.spawn(ReactNativeCommandHelper.CMD_NAME, [command], {cwd: projectRoot});
    }
}

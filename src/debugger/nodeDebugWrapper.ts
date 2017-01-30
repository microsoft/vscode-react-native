// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

interface ReactNativeLaunchRequestArguments extends ILaunchRequestArgs {
    args: string[];
    platform: string;
    program: string;
    internalDebuggerPort?: any;
    target?: string;
    iosRelativeProjectPath?: string;
    logCatArguments: any;
}

interface ReactNativeAttachRequestArguments extends IAttachRequestArgs {
    args: string[];
    platform: string;
    program: string;
    internalDebuggerPort?: any;
}

export function createAdapter (
        baseDebugAdapterClass: typeof ChromeDebuggerCorePackage.ChromeDebugAdapter,
        vscodeDebugPackage: typeof VSCodeDebugAdapterPackage) {

    return class ReactNativeDebugAdapter extends ChromeDebuggerCorePackage.ChromeDebugAdapter {
        protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void> {
            // HACK: Overwrite ChromeDebug's _attachMode to let Node2 adapter
            // to set up breakpoints on initial pause event
            this._attachMode = false;
            return super.doAttach(port, targetUrl, address, timeout);
        }
    };
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// tslint:disable-next-line:no-var-requires
const opener = require("opener");
// tslint:disable-next-line:no-var-requires
const open = require("open");

export class ACUtils {
    // Use open for Windows and Mac, opener for Linux
    public static OpenUrl(url: string): void {
        switch (process.platform) {
            case "win32":
            case "darwin":
                open(url);
                break;
            default:
                opener(url);
                break;
        }
    }
}

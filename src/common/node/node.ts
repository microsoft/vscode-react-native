// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as childProcess from "./childProcess";
import * as file from "./fileSystem";

export namespace Node {
    export const ChildProcess = childProcess.ChildProcess;
    export const FileSystem = file.FileSystem;
}

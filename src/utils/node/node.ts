// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as childProcess from "./childProcess";
import * as file from "./fileSystem";

export module Node {
    export var ChildProcess = childProcess.ChildProcess;
    export var FileSystem = file.FileSystem;
}

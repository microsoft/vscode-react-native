// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { DebugSession } from "vscode";
import { v4 as uuidv4 } from "uuid";

export class RNSession {
    private _sessionId: string;
    private _vsCodeDebugSession: DebugSession;

    constructor(vsCodeDebugSession: DebugSession) {
        this._vsCodeDebugSession = vsCodeDebugSession;
        this._sessionId = uuidv4();
    }

    get sessionId(): string {
        return this._sessionId;
    }

    get vsCodeDebugSession(): DebugSession {
        return this._vsCodeDebugSession;
    }
}

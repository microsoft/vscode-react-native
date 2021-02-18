// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export interface InspectorView {
    handleMessage: () => void;
}

export class InspectorConsoleView implements InspectorView {
    public handleMessage() {}
}

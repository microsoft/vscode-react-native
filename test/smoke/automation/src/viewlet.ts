// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Code } from "./code";

export abstract class Viewlet {
    constructor(protected code: Code) {}

    public async waitForTitle(fn: (title: string) => boolean): Promise<void> {
        await this.code.waitForTextContent(
            ".monaco-workbench .part.sidebar > .title > .title-label > h2",
            undefined,
            fn,
        );
    }
}

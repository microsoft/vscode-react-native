// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter } from "./requestBodyFormatter";

export class JSONFormatter implements IFormatter {
    public format(body: string, contentType: string): string | any {
        if (
            contentType.startsWith("application/json") ||
            contentType.startsWith("application/hal+json") ||
            contentType.startsWith("text/javascript") ||
            contentType.startsWith("application/x-fb-flatbuffer")
        ) {
            try {
                return JSON.parse(body);
            } catch (SyntaxError) {
                // Multiple top level JSON roots, map them one by one
                return body.split("\n").map(json => JSON.parse(json));
            }
        }
    }
}

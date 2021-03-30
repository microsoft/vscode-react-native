// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request, Response } from "../networkMessageData";
import { IFormatter, decodeBody, FormattedBody } from "./requestBodyFormatter";

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L609-L653
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export class JSONFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): FormattedBody | null {
        return this.format(decodeBody(request, this.logger), contentType);
    }

    public formatResponse(response: Response, contentType: string): FormattedBody | null {
        return this.format(decodeBody(response, this.logger), contentType);
    }

    private format(body: string, contentType: string): FormattedBody | null {
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
        return null;
    }
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L609-L653
 */

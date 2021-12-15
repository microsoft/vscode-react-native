// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* eslint-disable */
/* eslint-enable prettier/prettier*/

import { IFormatter, decodeBody, FormattedBody } from "./requestBodyFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request, Response } from "../networkMessageData";
import * as querystring from "querystring";

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L704-L767
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export class GraphQLFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): FormattedBody | null {
        if (request.url.indexOf("graphql") > 0) {
            const decoded = decodeBody(request, this.logger);
            if (!decoded) {
                return null;
            }
            const data = querystring.parse(decoded);
            if (typeof data.variables === "string") {
                data.variables = JSON.parse(data.variables);
            }
            if (typeof data.query_params === "string") {
                data.query_params = JSON.parse(data.query_params);
            }
            return data;
        }
        return null;
    }

    public formatResponse(response: Response, contentType: string): FormattedBody | null {
        if (
            contentType.startsWith("application/json") ||
            contentType.startsWith("application/hal+json") ||
            contentType.startsWith("text/javascript") ||
            contentType.startsWith("text/html") ||
            contentType.startsWith("application/x-fb-flatbuffer")
        ) {
            let decoded = decodeBody(response, this.logger);
            try {
                const data = JSON.parse(decoded);
                return data;
            } catch (SyntaxError) {
                // Multiple top level JSON roots, map them one by one
                return decoded
                    .replace(/}{/g, "}\r\n{")
                    .split("\n")
                    .map(json => JSON.parse(json));
            }
        }
        return null;
    }
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L704-L767
 */

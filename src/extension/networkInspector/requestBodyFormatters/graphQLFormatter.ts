// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter, decodeBody } from "./requestBodyFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request, Response } from "../networkMessageData";
import * as querystring from "querystring";

export class GraphQLFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): string | any | null {
        if (request.url.indexOf("graphql") > 0) {
            const decoded = decodeBody(request, this.logger);
            if (!decoded) {
                return undefined;
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

    public formatResponse(response: Response, contentType: string): string | any | null {
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

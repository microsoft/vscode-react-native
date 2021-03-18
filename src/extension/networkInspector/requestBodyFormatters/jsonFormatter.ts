// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request, Response } from "../networkMessageData";
import { IFormatter, decodeBody } from "./requestBodyFormatter";

export class JSONFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): string | any | null {
        return this.format(decodeBody(request, this.logger), contentType);
    }

    public formatResponse(response: Response, contentType: string): string | any | null {
        return this.format(decodeBody(response, this.logger), contentType);
    }

    private format(body: string, contentType: string): string | any | null {
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

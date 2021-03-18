// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter, decodeBody } from "./requestBodyFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request } from "../networkMessageData";

export class FormUrlencodedFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): string | any | null {
        if (contentType.startsWith("application/x-www-form-urlencoded")) {
            const decoded = decodeBody(request, this.logger);
            if (!decoded) {
                return null;
            }
            return decoded;
        }
        return null;
    }
}

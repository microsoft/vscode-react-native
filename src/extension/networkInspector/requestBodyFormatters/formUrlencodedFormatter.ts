// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter, decodeBody, FormattedBody } from "./requestBodyFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { Request } from "../networkMessageData";

// The code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L769-L785
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export class FormUrlencodedFormatter implements IFormatter {
    constructor(private logger: OutputChannelLogger) {}

    public formatRequest(request: Request, contentType: string): FormattedBody | null {
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

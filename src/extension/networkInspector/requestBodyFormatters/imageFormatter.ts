// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter, FormattedBody } from "./requestBodyFormatter";
import { Response } from "../networkMessageData";

export class ImageFormatter implements IFormatter {
    public formatResponse(response: Response, contentType: string): FormattedBody | null {
        if (contentType.startsWith("image/") && response.data) {
            return response.data;
        }
        return null;
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IFormatter, FormattedBody } from "./requestBodyFormatter";
import { Response } from "../networkMessageData";

// The code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/RequestDetails.tsx#L482-L497
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export class ImageFormatter implements IFormatter {
    public formatResponse(response: Response, contentType: string): FormattedBody | null {
        if (contentType.startsWith("image/") && response.data) {
            return response.data;
        }
        return null;
    }
}

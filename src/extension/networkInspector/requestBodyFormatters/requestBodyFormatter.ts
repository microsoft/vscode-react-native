// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Request, Response, Header } from "../networkMessageData";
import { Base64 } from "js-base64";
import * as pako from "pako";
import { JSONFormatter } from "./jsonFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { ImageFormatter } from "./imageFormatter";
import { GraphQLFormatter } from "./graphQLFormatter";
import { FormUrlencodedFormatter } from "./formUrlencodedFormatter";
import { notNullOrUndefined } from "../../../common/utils";

export type FormattedBody = string | Record<string, any> | Array<Record<string, any>>;

export interface IFormatter {
    formatRequest?: (request: Request, contentType: string) => FormattedBody | null;
    formatResponse?: (response: Response, contentType: string) => FormattedBody | null;
}

export class RequestBodyFormatter {
    protected logger: OutputChannelLogger;
    private formatters: Array<IFormatter>;

    constructor(logger: OutputChannelLogger) {
        this.logger = logger;
        this.formatters = [
            new ImageFormatter(),
            new GraphQLFormatter(this.logger),
            new JSONFormatter(this.logger),
            new FormUrlencodedFormatter(this.logger),
        ];
    }

    public formatBody(container: Request | Response): FormattedBody {
        const contentType = getHeaderValue(container.headers, "content-type");

        for (let formatter of this.formatters) {
            try {
                let formattedRes = null;
                // if container is a response
                if ((<any>container).status) {
                    if (formatter.formatResponse) {
                        formattedRes = formatter.formatResponse(<Response>container, contentType);
                    }
                } else if (formatter.formatRequest) {
                    formattedRes = formatter.formatRequest(<Request>container, contentType);
                }

                if (notNullOrUndefined(formattedRes)) {
                    return formattedRes;
                }
            } catch (err) {
                this.logger.debug(
                    `RequestBodyFormatter exception from ${formatter.constructor.name} ${err.message}`,
                );
            }
        }

        return decodeBody(container, this.logger);
    }
}

// The code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/utils.tsx#L23-L60
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
export function decodeBody(container: Request | Response, logger?: OutputChannelLogger): string {
    if (!container.data) {
        return "";
    }

    try {
        const isGzip = getHeaderValue(container.headers, "Content-Encoding") === "gzip";
        if (isGzip) {
            try {
                const binStr = Base64.atob(container.data);
                const dataArr = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) {
                    dataArr[i] = binStr.charCodeAt(i);
                }
                // The request is gzipped, so convert the base64 back to the raw bytes first,
                // then inflate. pako will detect the BOM headers and return a proper utf-8 string right away
                return pako.inflate(dataArr, { to: "string" });
            } catch (e) {
                // on iOS, the stream send to flipper is already inflated, so the content-encoding will not
                // match the actual data anymore, and we should skip inflating.
                // In that case, we intentionally fall-through
                if (!e.toString().includes("incorrect header check")) {
                    throw e;
                }
            }
        }
        // If this is not a gzipped request, assume we are interested in a proper utf-8 string.
        //  - If the raw binary data in is needed, in base64 form, use container.data directly
        //  - either directly use container.data (for example)
        return Base64.decode(container.data);
    } catch (err) {
        logger?.debug(
            `Network inspector failed to decode request/response body (size: ${
                container.data.length
            }): ${err.toString()}`,
        );
        return "";
    }
}

// The code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/utils.tsx#L14-L21
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
export function getHeaderValue(headers: Array<Header>, key: string): string {
    for (const header of headers) {
        if (header.key.toLowerCase() === key.toLowerCase()) {
            return header.value;
        }
    }
    return "";
}

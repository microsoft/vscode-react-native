// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Request, Response, Header } from "../networkMessageData";
import { Base64 } from "js-base64";
import * as pako from "pako";
import { JSONFormatter } from "./jsonFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";

export interface IFormatter {
    format: (body: string, contentType: string) => string | any;
}

export class RequestBodyFormatter {
    protected logger: OutputChannelLogger;
    private formatters: Array<IFormatter>;

    constructor(logger: OutputChannelLogger) {
        this.logger = logger;
        this.formatters = [new JSONFormatter()];
    }

    public formatBody(container: Request | Response): string | any {
        let decodedBody = this.decodeBody(container);
        const contentType = this.getHeaderValue(container.headers, "content-type");

        if (decodedBody) {
            for (let formatter of this.formatters) {
                try {
                    return formatter.format(decodedBody, contentType);
                } catch (err) {
                    this.logger.debug(
                        `RequestBodyFormatter exception from ${formatter.constructor.name} ${err.message}`,
                    );
                }
            }
        } else {
            return decodedBody;
        }
    }

    public decodeBody(container: Request | Response): string {
        if (!container.data) {
            return "";
        }

        try {
            const isGzip = this.getHeaderValue(container.headers, "Content-Encoding") === "gzip";
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
                    if (!("" + e).includes("incorrect header check")) {
                        throw e;
                    }
                }
            }
            // If this is not a gzipped request, assume we are interested in a proper utf-8 string.
            //  - If the raw binary data in is needed, in base64 form, use container.data directly
            //  - either directly use container.data (for example)
            return Base64.decode(container.data);
        } catch (err) {
            this.logger.debug(
                `Flipper failed to decode request/response body (size: ${
                    container.data.length
                }): ${err.toString()}`,
            );
            return "";
        }
    }

    private getHeaderValue(headers: Array<Header>, key: string): string {
        for (const header of headers) {
            if (header.key.toLowerCase() === key.toLowerCase()) {
                return header.value;
            }
        }
        return "";
    }
}

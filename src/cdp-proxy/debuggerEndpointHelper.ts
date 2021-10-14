// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as URL from "url";
import * as ipModule from "ip";
const dns = require("dns").promises;
import * as http from "http";
import * as https from "https";
import { PromiseUtil } from "../common/node/promise";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { CancellationToken } from "vscode";

export class DebuggerEndpointHelper {
    private localv4: Buffer;
    private localv6: Buffer;

    constructor() {
        this.localv4 = ipModule.toBuffer("127.0.0.1");
        this.localv6 = ipModule.toBuffer("::1");
    }

    /**
     * Attempts to retrieve the debugger websocket URL for a process listening
     * at the given address, retrying until available.
     * @param browserURL -- Address like `http://localhost:1234`
     * @param cancellationToken -- Cancellation for this operation
     */
    public async retryGetWSEndpoint(
        browserURL: string,
        attemptNumber: number,
        cancellationToken: CancellationToken,
    ): Promise<string> {
        try {
            return await this.getWSEndpoint(browserURL);
        } catch (err) {
            if (attemptNumber < 1 || cancellationToken.isCancellationRequested) {
                const internalError = ErrorHelper.getInternalError(
                    InternalErrorCode.CouldNotConnectToDebugTarget,
                    browserURL,
                    err.message,
                );

                if (cancellationToken.isCancellationRequested) {
                    throw ErrorHelper.getNestedError(
                        internalError,
                        InternalErrorCode.CancellationTokenTriggered,
                    );
                }

                throw internalError;
            }

            await PromiseUtil.delay(700);
            return this.retryGetWSEndpoint(browserURL, --attemptNumber, cancellationToken);
        }
    }

    /**
     * Returns the debugger websocket URL a process listening at the given address.
     * @param browserURL -- Address like `http://localhost:1234`
     */
    public async getWSEndpoint(browserURL: string): Promise<string> {
        const jsonVersion = await this.fetchJson<{ webSocketDebuggerUrl?: string }>(
            URL.resolve(browserURL, "/json/version"),
        );
        if (jsonVersion.webSocketDebuggerUrl) {
            return jsonVersion.webSocketDebuggerUrl;
        }

        // Chrome its top-level debugg on /json/version, while Node does not.
        // Request both and return whichever one got us a string.
        const jsonList = await this.fetchJson<{ webSocketDebuggerUrl: string }[]>(
            URL.resolve(browserURL, "/json/list"),
        );
        if (jsonList.length) {
            return jsonList[0].webSocketDebuggerUrl;
        }

        throw new Error("Could not find any debuggable target");
    }

    /**
     * Fetches JSON content from the given URL.
     */
    private async fetchJson<T>(url: string): Promise<T> {
        const data = await this.fetch(url);
        try {
            return JSON.parse(data);
        } catch (err) {
            return {} as T;
        }
    }

    /**
     * Fetches content from the given URL.
     */
    private async fetch(url: string): Promise<string> {
        const isSecure = !url.startsWith("http://");
        const driver = isSecure ? https : http;
        const targetAddressIsLoopback = await this.isLoopback(url);

        return new Promise<string>((fulfill, reject) => {
            const requestOptions: https.RequestOptions = {};

            if (isSecure && targetAddressIsLoopback) {
                requestOptions.rejectUnauthorized = false;
            }

            const request = driver.get(url, requestOptions, response => {
                let data = "";
                response.setEncoding("utf8");
                response.on("data", (chunk: string) => (data += chunk));
                response.on("end", () => fulfill(data));
                response.on("error", reject);
            });

            request.on("error", reject);
            request.end();
        });
    }

    /**
     * Gets whether the IP is a loopback address.
     */
    private async isLoopback(address: string) {
        let ipOrHostname: string;
        try {
            const url = new URL.URL(address);
            // replace brackets in ipv6 addresses:
            ipOrHostname = url.hostname.replace(/^\[|\]$/g, "");
        } catch {
            ipOrHostname = address;
        }

        if (this.isLoopbackIp(ipOrHostname)) {
            return true;
        }

        try {
            const resolved = await dns.lookup(ipOrHostname);
            return this.isLoopbackIp(resolved.address);
        } catch {
            return false;
        }
    }

    /**
     * Checks if the given address, well-formed loopback IPs. We don't need exotic
     * variations like `127.1` because `dns.lookup()` will resolve the proper
     * version for us. The "right" way would be to parse the IP to an integer
     * like Go does (https://golang.org/pkg/net/#IP.IsLoopback), but this
     * is lightweight and works.
     */
    private isLoopbackIp(ipOrLocalhost: string) {
        if (ipOrLocalhost.toLowerCase() === "localhost") {
            return true;
        }

        let buf: Buffer;
        try {
            buf = ipModule.toBuffer(ipOrLocalhost);
        } catch {
            return false;
        }

        return buf.equals(this.localv4) || buf.equals(this.localv6);
    }
}

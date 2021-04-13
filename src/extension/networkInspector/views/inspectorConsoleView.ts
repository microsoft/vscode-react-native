// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { InspectorView } from "./inspectorView";
import { RequestParams } from "../clientDevice";
import { URL, URLSearchParams } from "url";
import * as vscode from "vscode";
import {
    Request,
    Response,
    Header,
    ResponseFollowupChunk,
    PartialResponse,
} from "../networkMessageData";
import { EditorColorThemesHelper, SystemColorTheme } from "../../../common/editorColorThemesHelper";
import { SettingsHelper } from "../../settingsHelper";
import { combineBase64Chunks } from "../requestBodyFormatters/utils";
import { FormattedBody } from "../requestBodyFormatters/requestBodyFormatter";
import { Base64 } from "js-base64";

interface ConsoleNetworkRequestDataView {
    title: string;
    networkRequestData: {
        URL: string;
        Method: string;
        Status: number;
        Duration: string;
        "Request Headers": Record<string, string>;
        "Response Headers": Record<string, string>;
        "Request Body": FormattedBody | null | undefined;
        "Request Query Parameters"?: Record<string, string> | undefined;
        "Response Body": FormattedBody | null | undefined;
    };
}

export class InspectorConsoleView extends InspectorView {
    private readonly maxResponseBodyLength = 75000;
    private readonly openDeveloperToolsCommand = "workbench.action.toggleDevTools";
    private readonly consoleLogsColors = {
        Blue: "#0000ff",
        Orange: "#f28b54",
    };

    private consoleLogsColor: string;

    public async init(): Promise<void> {
        if (!this.isInitialized) {
            this.isInitialized = true;
            await vscode.commands.executeCommand(this.openDeveloperToolsCommand);
            if (EditorColorThemesHelper.isAutoDetectColorSchemeEnabled()) {
                this.setupConsoleLogsColor(EditorColorThemesHelper.getCurrentSystemColorTheme());
            } else {
                this.setupConsoleLogsColor(
                    SettingsHelper.getNetworkInspectorConsoleLogsColorTheme(),
                );
            }
        }
    }

    public handleMessage(data: RequestParams): void {
        if (data.params) {
            switch (data.method) {
                case "newRequest":
                    this.handleRequest(data.params as Request);
                    break;
                case "newResponse":
                    this.handleResponse(data.params as Response);
                    break;
                case "partialResponse":
                    this.handlePartialResponse(data.params as Response | ResponseFollowupChunk);
                    break;
            }
        }
    }

    private setupConsoleLogsColor(systemColorTheme: SystemColorTheme): void {
        if (systemColorTheme === SystemColorTheme.Light) {
            this.consoleLogsColor = this.consoleLogsColors.Blue;
        } else {
            this.consoleLogsColor = this.consoleLogsColors.Orange;
        }
    }

    private handleRequest(data: Request): void {
        this.requests.set(data.id, data);
    }

    private handleResponse(data: Response): void {
        this.responses.set(data.id, data);
        if (this.requests.has(data.id)) {
            this.printNetworkRequestData(
                this.createNetworkRequestData(this.requests.get(data.id) as Request, data),
            );
        }
    }

    private handlePartialResponse(data: Response | ResponseFollowupChunk): void {
        /* Some clients (such as low end Android devices) struggle to serialise large payloads in one go, so partial responses allow them
        to split payloads into chunks and serialise each individually.

        Such responses will be distinguished between normal responses by both:
          * Being sent to the partialResponse method.
          * Having a totalChunks value > 1.

        The first chunk will always be included in the initial response. This response must have index 0.
        The remaining chunks will be sent in ResponseFollowupChunks, which each contain another piece of the payload, along with their index from 1 onwards.
        The payload of each chunk is individually encoded in the same way that full responses are.

        The order that initialResponse, and followup chunks are recieved is not guaranteed to be in index order.
        */

        let newPartialResponseEntry;
        let responseId;
        if (data.index !== undefined && data.index > 0) {
            // It's a follow up chunk
            const followupChunk: ResponseFollowupChunk = data as ResponseFollowupChunk;
            const partialResponseEntry = this.partialResponses.get(followupChunk.id) ?? {
                followupChunks: {},
            };

            newPartialResponseEntry = Object.assign({}, partialResponseEntry);
            newPartialResponseEntry.followupChunks[followupChunk.index] = followupChunk.data;
            responseId = followupChunk.id;
        } else {
            // It's an initial chunk
            const partialResponse: Response = data as Response;
            const partialResponseEntry = this.partialResponses.get(partialResponse.id) ?? {
                followupChunks: {},
            };
            newPartialResponseEntry = {
                ...partialResponseEntry,
                initialResponse: partialResponse,
            };
            responseId = partialResponse.id;
        }
        const response = this.assembleChunksIfResponseIsComplete(newPartialResponseEntry);
        if (response) {
            this.handleResponse(response);
            this.partialResponses.delete(responseId);
        } else {
            this.partialResponses.set(responseId, newPartialResponseEntry);
        }
    }

    /**
     * @preserve
     * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/index.tsx#L276-L324
     *
     * Copyright (c) Facebook, Inc. and its affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *
     * @format
     */
    private assembleChunksIfResponseIsComplete(
        partialResponseEntry: PartialResponse,
    ): Response | null {
        const numChunks = partialResponseEntry.initialResponse?.totalChunks;
        if (
            !partialResponseEntry.initialResponse ||
            !numChunks ||
            Object.keys(partialResponseEntry.followupChunks).length + 1 < numChunks
        ) {
            // Partial response not yet complete, do nothing.
            return null;
        }
        // Partial response has all required chunks, convert it to a full Response.

        const response: Response = partialResponseEntry.initialResponse;
        const allChunks: string[] =
            response.data != null
                ? [
                      response.data,
                      ...Object.entries(partialResponseEntry.followupChunks)
                          // It's important to parseInt here or it sorts lexicographically
                          .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                          .map(([_k, v]: [string, string]) => v),
                  ]
                : [];
        const data = combineBase64Chunks(allChunks);

        const newResponse = {
            ...response,
            // Currently data is always decoded at render time, so re-encode it to match the single response format.
            data: Base64.btoa(data),
        };

        return newResponse;
    }

    /**
     * @preserve
     * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/index.tsx#L276-L324
     */

    private createNetworkRequestData(
        request: Request,
        response: Response,
    ): ConsoleNetworkRequestDataView {
        const url = new URL(request.url);
        const networkRequestConsoleView = {
            title: `%cNetwork request: ${request.method} ${
                url ? url.host + url.pathname : "<unknown>"
            }`,
            networkRequestData: {
                URL: request.url,
                Method: request.method,
                Status: response.status,
                Duration: this.getRequestDurationString(request.timestamp, response.timestamp),
                "Request Headers": this.prepareHeadersViewObject(request.headers),
                "Response Headers": this.prepareHeadersViewObject(response.headers),
                "Request Body": this.requestBodyDecoder.formatBody(request),
                "Response Body": this.requestBodyDecoder.formatBody(response),
            },
        };

        if (url.search) {
            networkRequestConsoleView.networkRequestData[
                "Request Query Parameters"
            ] = this.retrieveURLSearchParams(url.searchParams);
        }

        return networkRequestConsoleView;
    }

    private retrieveURLSearchParams(searchParams: URLSearchParams): Record<string, string> {
        let formattedSearchParams = {};
        searchParams.forEach((value: string, key: string) => {
            formattedSearchParams[key] = value;
        });
        return formattedSearchParams;
    }

    private getRequestDurationString(requestTimestamp: number, responseTimestamp: number): string {
        return Math.abs(responseTimestamp - requestTimestamp) + "ms";
    }

    private prepareHeadersViewObject(headers: Header[]): Record<string, string> {
        return headers.reduce((headersViewObject, header) => {
            headersViewObject[header.key] = header.value;
            return headersViewObject;
        }, {});
    }

    private printNetworkRequestData(networkRequestData: ConsoleNetworkRequestDataView): void {
        const responseBody = networkRequestData.networkRequestData["Response Body"];
        if (
            responseBody &&
            typeof responseBody === "string" &&
            responseBody.length > this.maxResponseBodyLength
        ) {
            networkRequestData.networkRequestData["Response Body"] =
                responseBody.substring(0, this.maxResponseBodyLength) +
                "... (Response body exceeds output limit, the rest its part is omitted)";
        }

        console.log(
            networkRequestData.title,
            `color: ${this.consoleLogsColor}`,
            networkRequestData.networkRequestData,
        );
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { InspectorView } from "./inspectorView";
import { RequestParams } from "../clientDevice";
import { URL } from "url";
import * as vscode from "vscode";
import { Request, Response, Header } from "../networkMessageData";

interface ConsoleNetworkRequestDataView {
    title: string;
    networkRequestData: {
        URL: string;
        Method: string;
        Status: number;
        Duration: string;
        "Request Headers": Record<string, string>;
        "Response Headers": Record<string, string>;
        "Request Body": any | null | undefined;
        "Response Body": any | null | undefined;
    };
}

export class InspectorConsoleView extends InspectorView {
    private readonly maxResponseBodyLength = 75000;
    private readonly openDeveloperToolsCommand = "workbench.action.toggleDevTools";

    public async init(): Promise<void> {
        if (!this.isInitialized) {
            this.isInitialized = true;
            await vscode.commands.executeCommand(this.openDeveloperToolsCommand);
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
                    break;
            }
        }
    }

    public dispose(): any {}

    private handleRequest(data: Request) {
        this.requests.set(data.id, data);
    }

    private handleResponse(data: Response) {
        this.responses.set(data.id, data);
        if (this.requests.has(data.id)) {
            this.printNetworkRequestData(
                this.createNetworkRequestData(this.requests.get(data.id) as Request, data),
            );
        }
    }

    private createNetworkRequestData(
        request: Request,
        response: Response,
    ): ConsoleNetworkRequestDataView {
        const url = new URL(request.url);
        const networkRequestData = {
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
        return networkRequestData;
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

    // private handlePartialResponse() {}

    private printNetworkRequestData(networkRequestData: ConsoleNetworkRequestDataView) {
        const responseBody = networkRequestData.networkRequestData["Response Body"];
        if (responseBody && responseBody.length > this.maxResponseBodyLength) {
            networkRequestData.networkRequestData["Response Body"] =
                responseBody.substring(0, this.maxResponseBodyLength) +
                "... (Response body exceeds output limit, the rest its part is omitted)";
        }

        console.log(
            networkRequestData.title,
            "color: #1E90FF",
            networkRequestData.networkRequestData,
        );
    }
}

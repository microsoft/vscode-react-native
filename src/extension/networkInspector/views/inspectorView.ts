// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { RequestParams } from "../clientDevice";
import { Disposable } from "vscode";
import { Request, Response, PartialResponse } from "../networkMessageData";
import { RequestBodyFormatter } from "../requestBodyFormatters/requestBodyFormatter";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";

export enum InspectorViewType {
    console,
}

export abstract class InspectorView implements Disposable {
    protected requestBodyDecoder: RequestBodyFormatter;
    protected requests: Map<string, Request>;
    protected responses: Map<string, Response>;
    protected partialResponses: Map<string, PartialResponse>;
    protected isInitialized: boolean;
    protected logger: OutputChannelLogger;

    constructor(logger: OutputChannelLogger) {
        this.logger = logger;
        this.requests = new Map();
        this.responses = new Map();
        this.partialResponses = new Map();
        this.isInitialized = false;
        this.requestBodyDecoder = new RequestBodyFormatter(this.logger);
    }

    public dispose(): void {}

    public abstract init(): Promise<void>;
    public abstract handleMessage(data: RequestParams): void;
}

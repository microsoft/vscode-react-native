// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export type ResponseFollowupChunk = {
    id: string;
    totalChunks: number;
    index: number;
    data: string;
};

export type RequestId = string;

export type Header = {
    key: string;
    value: string;
};

export type Insights = {
    dnsLookupTime: number | null | undefined;
    connectTime: number | null | undefined;
    sslHandshakeTime: number | null | undefined;
    preTransferTime: number | null | undefined;
    redirectsTime: number | null | undefined;
    timeToFirstByte: number | null | undefined;
    transferTime: number | null | undefined;
    postProcessingTime: number | null | undefined;
    // Amount of transferred data can be different from total size of payload.
    bytesTransfered: number | null | undefined;
    transferSpeed: number | null | undefined;
    retries: RetryInsights | null | undefined;
};

export type RetryInsights = {
    count: number;
    limit: number;
    timeSpent: number;
};

export type Request = {
    id: RequestId;
    timestamp: number;
    method: string;
    url: string;
    headers: Array<Header>;
    data: string | null | undefined;
};

export type Response = {
    id: RequestId;
    timestamp: number;
    status: number;
    reason: string;
    headers: Array<Header>;
    data: string | null | undefined;
    isMock: boolean;
    insights: Insights | null | undefined;
    totalChunks?: number;
    index?: number;
};

export type PartialResponse = {
    initialResponse?: Response;
    followupChunks: { [id: number]: string };
};

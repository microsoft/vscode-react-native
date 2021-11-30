// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* eslint-disable */

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/types.tsx
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

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
    data?: string | null;
};

export type Response = {
    id: RequestId;
    timestamp: number;
    status: number;
    reason: string;
    headers: Array<Header>;
    data?: string | null;
    isMock: boolean;
    insights?: Insights | null;
    totalChunks?: number;
    index?: number;
};

export type PartialResponse = {
    initialResponse?: Response;
    followupChunks: { [id: number]: string };
};

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/types.tsx
 */

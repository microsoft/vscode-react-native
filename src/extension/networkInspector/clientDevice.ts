// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ReactiveSocket } from "rsocket-types";

export interface ClientIdConstituents {
    app: string;
    os: string;
    device: string;
    device_id: string;
}

export interface UninitializedClient {
    os: string;
    deviceName: string;
    appName: string;
}

export interface ClientCsrQuery {
    csr?: string | undefined;
    csr_path?: string | undefined;
}

export interface ClientQuery extends ClientIdConstituents {
    sdk_version?: number;
}

export interface SecureClientQuery extends ClientQuery, ClientCsrQuery {
    medium?: number;
}

export class ClientDevice {
    id: string;
    query: ClientQuery;
    connection: ReactiveSocket<any, any> | null | undefined;
    // logger: Logger;

    constructor(
        id: string,
        query: ClientQuery,
        connection: ReactiveSocket<any, any> | null | undefined,
    ) {
        this.id = id;
        this.query = query;
        this.connection = connection;
    }

    public async init() {}

    public onMessage(msg: string) {
        console.log(msg);
    }
}

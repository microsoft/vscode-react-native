// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ReactiveSocket } from "rsocket-types";
import { ClientOS } from "./clientUtils";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

// The code is borrowed from https://github.com/facebook/flipper/blob/master/desktop/app/src/Client.tsx

export interface ClientIdConstituents {
    app: string;
    os: ClientOS;
    device: string;
    device_id: string;
}

export interface UninitializedClient {
    os: ClientOS;
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

type Params = {
    api: string;
    method: string;
    params?: Record<string, any>;
};

type RequestMetadata = { method: string; id: number; params: Params | undefined };

type ErrorType = { message: string; stacktrace: string; name: string };

export class ClientDevice {
    private readonly networkInspectorPluginName: string;

    private _id: string;
    private _query: ClientQuery;
    private _connection: ReactiveSocket<any, any> | null | undefined;
    private logger: OutputChannelLogger;
    private messageIdCounter: number;
    private sdkVersion: number;
    private activePlugins: Set<string>;

    private requestCallbacks: Map<
        number,
        {
            resolve: (data: any) => void;
            reject: (err: Error) => void;
            metadata: RequestMetadata;
        }
    >;

    constructor(
        id: string,
        query: ClientQuery,
        connection: ReactiveSocket<any, any> | null | undefined,
        logger: OutputChannelLogger,
    ) {
        this.networkInspectorPluginName = "Network";

        this._id = id;
        this._query = query;
        this._connection = connection;
        this.logger = logger;
        this.messageIdCounter = 0;
        this.sdkVersion = query.sdk_version || 0;
        this.activePlugins = new Set();
        this.requestCallbacks = new Map();
    }

    get id(): string {
        return this._id;
    }

    get query(): ClientQuery {
        return this._query;
    }

    get connection(): ReactiveSocket<any, any> | null | undefined {
        return this._connection;
    }

    public async init(): Promise<void> {
        const plugins = await this.loadPlugins();
        if (plugins.includes(this.networkInspectorPluginName)) {
            this.initNetworkInspectorPlugin();
        }
    }

    public onMessage(msg: string): void {
        if (typeof msg !== "string") {
            return;
        }

        let rawData;
        try {
            rawData = JSON.parse(msg);
        } catch (err) {
            this.logger.error(`Invalid JSON: ${msg}`);
            return;
        }

        const data: {
            id?: number;
            method?: string;
            params?: Params;
            success?: Record<string, any>;
            error?: ErrorType;
        } = rawData;

        const { id, method } = data;

        if (id == null) {
            const { error } = data;
            if (error != null) {
                this.logger.error(
                    `Error received from device ${method ? `when calling ${method}` : ""}: ${
                        error.message
                    } + \nDevice Stack Trace: ${error.stacktrace}`,
                );
            } else if (method === "execute") {
                console.log(data);
            }
            return; // method === "execute";
        }

        if (this.sdkVersion < 1) {
            const callbacks = this.requestCallbacks.get(id);
            if (!callbacks) {
                return;
            }
            this.requestCallbacks.delete(id);
            this.onResponse(data, callbacks.resolve, callbacks.reject);
        }
    }

    private initNetworkInspectorPlugin(): void {
        this.activePlugins.add(this.networkInspectorPluginName);
        this.rawSend("init", { plugin: this.networkInspectorPluginName });
    }

    private async loadPlugins(): Promise<string[]> {
        const plugins = await this.rawCall<{ plugins: string[] }>("getPlugins", false).then(
            data => data.plugins,
        );
        return plugins;
    }

    private rawSend(method: string, params?: Record<string, any>): void {
        const data = {
            method,
            params,
        };
        if (this._connection) {
            this._connection.fireAndForget({ data: JSON.stringify(data) });
        }
    }

    private rawCall<T>(method: string, fromPlugin: boolean, params?: Params): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = this.messageIdCounter++;
            const metadata: RequestMetadata = {
                method,
                id,
                params,
            };

            if (this.sdkVersion < 1) {
                this.requestCallbacks.set(id, { reject, resolve, metadata });
            }

            const data = {
                id,
                method,
                params,
            };

            const plugin = params ? params.api : undefined;

            if (this.sdkVersion < 1) {
                if (this._connection) {
                    this._connection.fireAndForget({ data: JSON.stringify(data) });
                }
                return;
            }

            if (!fromPlugin || this.isAcceptingMessagesFromPlugin(plugin)) {
                this._connection!.requestResponse({
                    data: JSON.stringify(data),
                }).subscribe({
                    onComplete: payload => {
                        if (!fromPlugin || this.isAcceptingMessagesFromPlugin(plugin)) {
                            const response: {
                                success?: Record<string, any>;
                                error?: ErrorType;
                            } = JSON.parse(payload.data);

                            this.onResponse(response, resolve, reject);
                        }
                    },
                    onError: e => {
                        reject(e);
                    },
                });
            } else {
                reject(
                    new Error(
                        `Cannot send ${method}, client is not accepting messages for plugin ${plugin}`,
                    ),
                );
            }
        });
    }

    private onResponse(
        data: {
            success?: Record<string, any>;
            error?: ErrorType;
        },
        resolve: ((a: any) => any) | undefined,
        reject: (error: ErrorType) => any,
    ): void {
        if (data.success) {
            resolve && resolve(data.success);
        } else if (data.error) {
            reject(data.error);
            const { error } = data;
            if (error) {
                this.logger.debug(error.message);
            }
        }
    }

    private isAcceptingMessagesFromPlugin(plugin: string | null | undefined): boolean {
        return !!(this._connection && (!plugin || this.activePlugins.has(plugin)));
    }
}

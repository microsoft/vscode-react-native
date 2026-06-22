// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import proxyquire = require("proxyquire");

suite("networkInspectorServer", function () {
    type Deferred<T> = {
        promise: Promise<T>;
        resolve: (value: T) => void;
        reject: (error: Error) => void;
    };

    function createDeferred<T>(): Deferred<T> {
        let resolve!: (value: T) => void;
        let reject!: (error: Error) => void;
        const promise = new Promise<T>((promiseResolve, promiseReject) => {
            resolve = promiseResolve;
            reject = promiseReject;
        });
        return { promise, resolve, reject };
    }

    function createModule(
        options: {
            secureConfigError?: Error;
            clientInitPromise?: Promise<void>;
        } = {},
    ) {
        const logger = {
            info: sinon.stub(),
            debug: sinon.stub(),
            error: sinon.stub(),
        };
        const tipNotificationService = {
            setKnownDateForFeatureById: sinon.stub(),
            showTipNotification: sinon.stub(),
        };
        const processCertificateSigningRequest = sinon
            .stub()
            .returns(Promise.resolve({ deviceId: "device-id" }));
        const loadSecureServerConfig = options.secureConfigError
            ? sinon.stub().returns(Promise.reject(options.secureConfigError))
            : sinon.stub().returns(Promise.resolve({} as any));
        const closeConnection = sinon.stub();
        const clientInit = options.clientInitPromise || Promise.resolve();
        const clientDeviceInstances: any[] = [];
        const rsocketServerInstances: any[] = [];

        class FakeCertificateProvider {
            public loadSecureServerConfig = loadSecureServerConfig;
            public processCertificateSigningRequest = processCertificateSigningRequest;
        }

        class FakeClientDevice {
            public onMessage = sinon.stub();

            constructor(public id: string, public query: any, public connection: any) {
                clientDeviceInstances.push(this);
            }

            public init(): Promise<void> {
                return clientInit;
            }
        }

        class FakeRSocketTCPServer {
            constructor(public options: any) {}
        }

        class FakeRSocketServer {
            public stop = sinon.stub();

            constructor(public options: any) {
                rsocketServerInstances.push(this);
            }

            public start(): void {
                this.options.transport.options.serverFactory(sinon.stub());
            }
        }

        function createTransportServer() {
            return {
                on(event: string, callback: (error?: Error) => void) {
                    if (event === "listening") {
                        callback();
                    }
                    return this;
                },
            };
        }

        const module = proxyquire.noCallThru()(
            "../../../src/extension/networkInspector/networkInspectorServer",
            {
                "rsocket-core": {
                    RSocketServer: FakeRSocketServer,
                },
                "rsocket-tcp-server": {
                    default: FakeRSocketTCPServer,
                },
                net: {
                    createServer: sinon.stub().returns(createTransportServer()),
                },
                tls: {
                    createServer: sinon.stub().returns(createTransportServer()),
                },
                "./certificateProvider": {
                    CertificateProvider: FakeCertificateProvider,
                },
                "./clientDevice": {
                    ClientDevice: FakeClientDevice,
                },
                "./clientUtils": {
                    ClientOS: {
                        iOS: "iOS",
                        Android: "Android",
                        Windows: "Windows",
                        MacOS: "MacOS",
                    },
                    appNameWithUpdateHint: sinon.stub().returns("TestApp"),
                    buildClientId: sinon.stub().returns("client-id"),
                },
                "../log/OutputChannelLogger": {
                    OutputChannelLogger: {
                        getChannel: sinon.stub().returns(logger),
                    },
                },
                "../services/tipsNotificationsService/tipsNotificationService": {
                    TipNotificationService: {
                        getInstance: sinon.stub().returns(tipNotificationService),
                    },
                },
            },
        ) as typeof import("../../../src/extension/networkInspector/networkInspectorServer");

        return {
            NetworkInspectorServer: module.NetworkInspectorServer,
            logger,
            tipNotificationService,
            processCertificateSigningRequest,
            loadSecureServerConfig,
            closeConnection,
            clientDeviceInstances,
            rsocketServerInstances,
        };
    }

    function createClientQuery() {
        return {
            app: "TestApp",
            os: "Android",
            device: "emulator",
            device_id: "device-id",
            sdk_version: 3,
        };
    }

    test("should transform certificate exchange medium before signing certificates", () => {
        const { NetworkInspectorServer, processCertificateSigningRequest } = createModule();
        const server = new NetworkInspectorServer();
        (server as any).certificateProvider = {
            processCertificateSigningRequest,
        };

        const handler = (server as any).untrustedRequestHandler(
            {},
            {
                data: JSON.stringify(createClientQuery()),
            },
        );

        for (const [medium, expectedType] of [
            [1, "FS_ACCESS"],
            [2, "WWW"],
            [99, "FS_ACCESS"],
            [undefined, "FS_ACCESS"],
        ] as Array<[number | undefined, string]>) {
            handler.fireAndForget({
                data: JSON.stringify({
                    method: "signCertificate",
                    csr: "csr",
                    destination: "/tmp/cert/",
                    medium,
                }),
            });

            assert.strictEqual(processCertificateSigningRequest.lastCall.args[3], expectedType);
        }
    });

    test("should reject start when secure server config loading fails", async () => {
        const secureConfigError = new Error("secure config failed");
        const { NetworkInspectorServer, loadSecureServerConfig, tipNotificationService } =
            createModule({ secureConfigError });
        const server = new NetworkInspectorServer();

        await assert.rejects(async () => {
            await server.start({} as any);
        }, /secure config failed/);

        assert.strictEqual(loadSecureServerConfig.calledOnce, true);
        assert.strictEqual(tipNotificationService.setKnownDateForFeatureById.calledOnce, true);
        assert.strictEqual(tipNotificationService.showTipNotification.calledOnce, true);
    });

    test("should start and stop secure and insecure servers", async () => {
        const { NetworkInspectorServer, rsocketServerInstances } = createModule();
        const server = new NetworkInspectorServer();

        await server.start({} as any);
        await server.stop();

        assert.strictEqual(rsocketServerInstances.length, 2);
        assert.strictEqual(rsocketServerInstances[0].stop.calledOnce, true);
        assert.strictEqual(rsocketServerInstances[1].stop.calledOnce, true);
    });

    test("should add connections after client initialization and remove them", async () => {
        const initDeferred = createDeferred<void>();
        const { NetworkInspectorServer, clientDeviceInstances, closeConnection } = createModule({
            clientInitPromise: initDeferred.promise,
        });
        const server = new NetworkInspectorServer();
        const connection = {
            close: closeConnection,
        };

        const client = await (server as any).addConnection(
            connection,
            {
                ...createClientQuery(),
                medium: "FS_ACCESS",
            },
            {},
        );

        assert.strictEqual(client, clientDeviceInstances[0]);
        assert.strictEqual((server as any).connections.has("client-id"), false);

        initDeferred.resolve();
        await initDeferred.promise;

        assert.strictEqual((server as any).connections.get("client-id"), client);

        (server as any).removeConnection("client-id");

        assert.strictEqual(closeConnection.calledOnce, true);
        assert.strictEqual((server as any).connections.has("client-id"), false);
    });
});

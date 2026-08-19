// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import { AbstractDeviceTracker } from "../../src/extension/abstractDeviceTracker";

suite("abstractDeviceTracker", function () {
    class TestDeviceTracker extends AbstractDeviceTracker {
        private readonly queryImpl: () => Promise<void>;

        constructor(queryImpl: () => Promise<void>) {
            super();
            this.queryImpl = queryImpl;
        }

        public async start(): Promise<void> {
            await this.queryDevicesLoop();
        }

        public stop(): void {
            this.isStop = true;
        }

        protected async queryDevices(): Promise<void> {
            await this.queryImpl();
        }
    }

    test("should keep polling after a failed query", async () => {
        const clock = sinon.useFakeTimers();
        let queryCount = 0;
        const tracker = new TestDeviceTracker(async () => {
            queryCount += 1;
            if (queryCount === 1) {
                throw new Error("temporary query failure");
            }
        });

        try {
            await tracker.start();
            assert.strictEqual(queryCount, 1);

            clock.tick(3000);
            await Promise.resolve();
            assert.strictEqual(queryCount, 2);
        } finally {
            tracker.stop();
            clock.restore();
        }
    });
});

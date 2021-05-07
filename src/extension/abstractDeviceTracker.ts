// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "./log/OutputChannelLogger";

export abstract class AbstractDeviceTracker {
    protected logger: OutputChannelLogger;
    protected isStop: boolean;

    constructor() {
        this.logger = OutputChannelLogger.getMainChannel();
        this.isStop = false;
    }

    public abstract start(): Promise<void>;

    public abstract stop(): void;

    protected async queryDevicesLoop(): Promise<void> {
        try {
            await this.queryDevices();
            if (!this.isStop) {
                // It's important to schedule the next check AFTER the current one has completed
                // to avoid simultaneous queries which can cause multiple user input prompts.
                setTimeout(() => this.queryDevicesLoop(), 3000);
            }
        } catch (err) {
            this.logger.error(err.toString());
        }
    }

    protected abstract queryDevices(): Promise<void>;
}

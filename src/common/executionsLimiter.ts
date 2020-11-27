// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* This class can be used to limit how often can some code be executed e.g. Max once every 10 seconds */
export class ExecutionsLimiter {
    private executionToLastTimestamp: { [id: string]: number } = {};

    public execute(id: string, limitInSeconds: number, lambda: () => void): void {
        const now = new Date().getTime();

        const lastExecution = this.executionToLastTimestamp[id] || 0;
        if (now - lastExecution >= limitInSeconds * 1000) {
            this.executionToLastTimestamp[id] = now;
            lambda();
        }
    }
}

export class ExecutionsFilterBeforeTimestamp {
    private static MILLISECONDS_IN_ONE_SECOND = 1000;

    private sinceWhenToStopFiltering: number;

    constructor(delayInSeconds: number) {
        this.sinceWhenToStopFiltering =
            this.now() +
            delayInSeconds * ExecutionsFilterBeforeTimestamp.MILLISECONDS_IN_ONE_SECOND;
    }

    public execute(lambda: () => void): void {
        if (this.now() >= this.sinceWhenToStopFiltering) {
            lambda();
        }
    }

    private now(): number {
        return new Date().getTime();
    }
}

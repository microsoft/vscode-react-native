// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* This class can be used to limit how often can some code be executed e.g. Max once every 10 seconds */
export class ExecutionsLimiter {
    private executionToLastTimestamp: {[id: string]: number} = {};

    public execute(id: string, limitInSeconds: number, lambda: () => void) {
        const now = new Date().getTime();

        const lastExecution = this.executionToLastTimestamp[id] || 0;
        if (now - lastExecution >= limitInSeconds * 1000) {
            this.executionToLastTimestamp[id] = now;
            lambda();
        }
    }
}

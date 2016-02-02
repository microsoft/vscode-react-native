// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

/**
 * Utilities for working with promises.
 */
export class PromiseUtil<T> {
    /**
     * Retries an operation a given number of times. For each retry, a condition is checked.
     * If the condition is not satisfied after the maximum number of retries, and error is thrown.
     * Otherwise, the result of the operation is returned once the condition is satisfied.
     *
     * @param operation - the function to execute.
     * @param condition - the condition to check between iterations.
     * @param maxRetries - the maximum number of retries.
     * @param delay - time between iterations, in milliseconds.
     * @param failure - error description.
     */
    public retryAsync<T>(operation: () => Q.Promise<T>, condition: (result: T) => boolean | Q.Promise<boolean>, maxRetries: number, delay: number, failure: string): Q.Promise<T> {
        return this.retryAsyncIteration(operation, condition, maxRetries, 0, delay, failure);
    }

    private retryAsyncIteration<T>(operation: () => Q.Promise<T>, condition: (result: T) => boolean | Q.Promise<boolean>, maxRetries: number, iteration: number, delay: number, failure: string): Q.Promise<T> {
        return operation()
            .then(result => {
                return Q(result).then(condition).then((conditionResult => {
                    if (conditionResult) {
                        return result;
                    }

                    if (iteration < maxRetries) {
                        return Q.delay(delay).then(() => this.retryAsyncIteration(operation, condition, maxRetries, iteration + 1, delay, failure));
                    }

                    throw new Error(failure);
                }));
            });
    }
}
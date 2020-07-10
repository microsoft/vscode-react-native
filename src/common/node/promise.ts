// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Utilities for working with promises.
 */
export class PromiseUtil {
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
    public retryAsync<T>(operation: () => Promise<T>, condition: (result: T) => boolean | Promise<boolean>, maxRetries: number, delay: number, failure: string): Promise<T> {
        return this.retryAsyncIteration(operation, condition, maxRetries, 0, delay, failure);
    }

    public delay(duration: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, duration));
    }

    private retryAsyncIteration<T>(operation: () => Promise<T>, condition: (result: T) => boolean | Promise<boolean>, maxRetries: number, iteration: number, delay: number, failure: string): Promise<T> {
        return operation()
            .then(result => {
                return Promise.resolve(result).then(condition).then((conditionResult => {

                    if (conditionResult) {
                        return result;
                    }

                    if (iteration < maxRetries) {
                        return this.delay(delay).then(() => this.retryAsyncIteration(operation, condition, maxRetries, iteration + 1, delay, failure));
                    }

                    throw new Error(failure);
                }));
            });
    }
}
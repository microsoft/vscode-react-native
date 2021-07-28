// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Utilities for working with promises.
 */
export class PromiseUtil {
    public static forEach<T>(
        sources: T[],
        promiseGenerator: (source: T) => Promise<void>,
    ): Promise<void> {
        return Promise.all(
            sources.map(source => {
                return promiseGenerator(source);
            }),
        ).then(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
    }
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
    public static retryAsync<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        delay: number,
        failure: string,
    ): Promise<T> {
        return this.retryAsyncIteration(operation, condition, maxRetries, 0, delay, failure);
    }

    public static reduce<T>(
        sources: T[] | Promise<T[]>,
        generateAsyncOperation: (value: T) => Promise<void>,
    ): Promise<void> {
        let promisedSources: Promise<T[]>;
        if (sources instanceof Promise) {
            promisedSources = sources;
        } else {
            promisedSources = Promise.resolve(sources);
        }
        return promisedSources.then(resolvedSources => {
            return resolvedSources.reduce((previousReduction: Promise<void>, newSource: T) => {
                return previousReduction.then(() => {
                    return generateAsyncOperation(newSource);
                });
            }, Promise.resolve());
        });
    }

    public static async delay(duration: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, duration));
    }

    public static promiseCacheDecorator<T>(
        func: (...args: any[]) => Promise<T>,
        context: Record<string, any> | null = null,
    ): (...args: any[]) => Promise<T> {
        let promise: Promise<T>;
        return (...args: any[]): Promise<T> => {
            if (promise) {
                return promise;
            } else {
                promise = func.apply(context, args);
                return promise;
            }
        };
    }

    private static retryAsyncIteration<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        iteration: number,
        delay: number,
        failure: string,
    ): Promise<T> {
        return operation().then(result => {
            return Promise.resolve(result)
                .then(condition)
                .then(conditionResult => {
                    if (conditionResult) {
                        return result;
                    }

                    if (iteration < maxRetries) {
                        return PromiseUtil.delay(delay).then(() =>
                            this.retryAsyncIteration(
                                operation,
                                condition,
                                maxRetries,
                                iteration + 1,
                                delay,
                                failure,
                            ),
                        );
                    }

                    throw new Error(failure);
                });
        });
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Utilities for working with promises.
 */
export class PromiseUtil {
    public async forEach<T>(
        sources: T[],
        promiseGenerator: (source: T) => Promise<void>,
    ): Promise<void> {
        await Promise.all(
            sources.map(source => {
                return promiseGenerator(source);
            }),
        );
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
    public retryAsync<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        delay: number,
        failure: string,
    ): Promise<T> {
        return this.retryAsyncIteration(operation, condition, maxRetries, 0, delay, failure);
    }

    public async reduce<T>(
        sources: T[] | Promise<T[]>,
        generateAsyncOperation: (value: T) => Promise<void>,
    ): Promise<void> {
        let arraySources: T[];
        if (sources instanceof Promise) {
            arraySources = await sources;
        } else {
            arraySources = sources;
        }

        return arraySources.reduce(async (previousReduction: Promise<void>, newSource: T) => {
            await previousReduction;
            return generateAsyncOperation(newSource);
        }, Promise.resolve());
    }

    public static async delay(duration: number): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, duration));
    }

    public static promiseCacheDecorator<T>(
        func: (...args: any[]) => Promise<T>,
        context: Record<string, any> | null = null,
    ): (...args: any[]) => Promise<T> {
        let promise: Promise<T>;
        return (...args: any[]): Promise<T> => {
            if (!promise) {
                promise = func.apply(context, args);
            }
            return promise;
        };
    }

    private async retryAsyncIteration<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        iteration: number,
        delay: number,
        failure: string,
    ): Promise<T> {
        const result = await operation();
        const conditionResult = await condition(result);

        if (conditionResult) {
            return result;
        }

        if (iteration < maxRetries) {
            await PromiseUtil.delay(delay);
            return this.retryAsyncIteration(
                operation,
                condition,
                maxRetries,
                iteration + 1,
                delay,
                failure,
            );
        }

        throw new Error(failure);
    }
}

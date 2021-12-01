// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CancellationTokenSource, Disposable } from "vscode";

/**
 * Utilities for working with promises.
 */
export class PromiseUtil {
    public static async forEach<T>(
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
    public static retryAsync<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        delay: number,
        failure: string,
        cancellationTokenSource?: CancellationTokenSource,
    ): Promise<T> {
        return this.retryAsyncIteration(
            operation,
            condition,
            maxRetries,
            0,
            delay,
            failure,
            cancellationTokenSource,
        );
    }

    public static async reduce<T>(
        sources: T[] | Promise<T[]>,
        generateAsyncOperation: (value: T) => Promise<void>,
    ): Promise<void> {
        const arraySources: T[] = sources instanceof Promise ? await sources : sources;

        return arraySources.reduce(async (previousReduction: Promise<void>, newSource: T) => {
            await previousReduction;
            return generateAsyncOperation(newSource);
        }, Promise.resolve());
    }

    public static async delay(duration: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, duration));
    }

    public static waitUntil<T>(
        condition: () => Promise<T | null> | T | null,
        interval: number = 1000,
        timeout?: number,
    ): Promise<T | null> {
        return new Promise(async resolve => {
            let rejectTimeout: NodeJS.Timeout | undefined;
            let сheckInterval: NodeJS.Timeout | undefined;

            if (timeout) {
                rejectTimeout = setTimeout(() => {
                    cleanup();
                    resolve(null);
                }, timeout);
            }

            const cleanup = () => {
                if (rejectTimeout) {
                    clearTimeout(rejectTimeout);
                }
                if (сheckInterval) {
                    clearInterval(сheckInterval);
                }
            };

            const tryToResolve = async (): Promise<boolean> => {
                const result = await condition();
                if (result) {
                    cleanup();
                    resolve(result);
                }
                return !!result;
            };

            const resolved = await tryToResolve();
            if (resolved) {
                return;
            }

            сheckInterval = setInterval(async () => {
                await tryToResolve();
            }, interval);
        });
    }

    public static promiseCacheDecorator<T>(
        func: (...args: any[]) => Promise<T>,
        context: Record<string, any> | null = null,
    ): (...args: any[]) => Promise<T> {
        let promise: Promise<T> | undefined;
        return (...args: any[]): Promise<T> => {
            if (!promise) {
                promise = func.apply(context, args) as Promise<T>;
            }
            return promise;
        };
    }

    private static async retryAsyncIteration<T>(
        operation: () => Promise<T>,
        condition: (result: T) => boolean | Promise<boolean>,
        maxRetries: number,
        iteration: number,
        delay: number,
        failure: string,
        cancellationTokenSource?: CancellationTokenSource,
    ): Promise<T> {
        const result = await operation();
        const conditionResult = await condition(result);
        if (conditionResult) {
            return result;
        }

        if (
            iteration < maxRetries &&
            !(cancellationTokenSource && cancellationTokenSource.token.isCancellationRequested)
        ) {
            await PromiseUtil.delay(delay);
            return this.retryAsyncIteration(
                operation,
                condition,
                maxRetries,
                iteration + 1,
                delay,
                failure,
                cancellationTokenSource,
            );
        }

        throw new Error(failure);
    }
}

export class Delayer<T> implements Disposable {
    private timeout: any;
    private completionPromise: Promise<any> | null;
    private doResolve: ((value?: any | Promise<any>) => void) | null;
    private doReject: ((err: any) => void) | null;
    private task: { (): T | Promise<T> } | null;

    constructor() {
        this.timeout = null;
        this.completionPromise = null;
        this.doResolve = null;
        this.doReject = null;
        this.task = null;
    }

    public runWihtDelay(task: { (): T | Promise<T> }, delay: number): Promise<T> {
        this.task = task;
        this.cancelTimeout();

        if (!this.completionPromise) {
            this.completionPromise = new Promise((resolve, reject) => {
                this.doResolve = resolve;
                this.doReject = reject;
            }).then(() => {
                this.completionPromise = null;
                this.doResolve = null;
                if (this.task) {
                    const task = this.task;
                    this.task = null;
                    return task();
                }
                return undefined;
            });
        }

        this.timeout = setTimeout(() => {
            this.timeout = null;
            if (this.doResolve) {
                this.doResolve(null);
            }
        }, delay);

        return this.completionPromise;
    }

    public isRunning(): boolean {
        return this.timeout !== null;
    }

    public cancel(): void {
        this.cancelTimeout();

        if (this.completionPromise) {
            if (this.doReject) {
                this.doReject(new Error("Canceled"));
            }
            this.completionPromise = null;
        }
    }

    public dispose(): void {
        this.cancel();
    }

    private cancelTimeout(): void {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}

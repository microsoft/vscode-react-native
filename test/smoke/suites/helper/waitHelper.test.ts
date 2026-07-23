// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { WaitHelper } from "./waitHelper";

type TimerType = "timeout" | "interval";

type TimerTask = {
    id: number;
    type: TimerType;
    scheduledAt: number;
    delay: number;
    callback: () => void | Promise<void>;
};

class FakeClock {
    private now = 0;
    private nextId = 1;
    private tasks = new Map<number, TimerTask>();

    private originalSetTimeout!: typeof globalThis.setTimeout;
    private originalSetInterval!: typeof globalThis.setInterval;
    private originalClearTimeout!: typeof globalThis.clearTimeout;
    private originalClearInterval!: typeof globalThis.clearInterval;

    public install(): void {
        this.originalSetTimeout = globalThis.setTimeout;
        this.originalSetInterval = globalThis.setInterval;
        this.originalClearTimeout = globalThis.clearTimeout;
        this.originalClearInterval = globalThis.clearInterval;

        globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ..._args: any[]) => {
            return this.schedule("timeout", handler, timeout ?? 0);
        }) as unknown as typeof globalThis.setTimeout;

        globalThis.setInterval = ((handler: TimerHandler, timeout?: number, ..._args: any[]) => {
            return this.schedule("interval", handler, timeout ?? 0);
        }) as unknown as typeof globalThis.setInterval;

        globalThis.clearTimeout = ((id?: NodeJS.Timeout) => {
            this.tasks.delete(this.toId(id));
        }) as typeof globalThis.clearTimeout;

        globalThis.clearInterval = ((id?: NodeJS.Timeout) => {
            this.tasks.delete(this.toId(id));
        }) as typeof globalThis.clearInterval;
    }

    public restore(): void {
        globalThis.setTimeout = this.originalSetTimeout;
        globalThis.setInterval = this.originalSetInterval;
        globalThis.clearTimeout = this.originalClearTimeout;
        globalThis.clearInterval = this.originalClearInterval;
        this.tasks.clear();
    }

    public async tick(ms: number): Promise<void> {
        const target = this.now + ms;

        while (true) {
            const next = this.getNextTask(target);
            if (!next) {
                break;
            }

            this.now = next.scheduledAt;

            if (next.type === "timeout") {
                this.tasks.delete(next.id);
                await Promise.resolve(next.callback());
                continue;
            }

            await Promise.resolve(next.callback());

            if (this.tasks.has(next.id)) {
                const task = this.tasks.get(next.id);
                if (task) {
                    task.scheduledAt = this.now + task.delay;
                }
            }
        }

        this.now = target;
    }

    private schedule(type: TimerType, handler: TimerHandler, delay: number): NodeJS.Timeout {
        const callback = this.normalizeHandler(handler);
        const id = this.nextId++;
        this.tasks.set(id, {
            id,
            type,
            scheduledAt: this.now + Math.max(0, delay),
            delay: Math.max(0, delay),
            callback,
        });

        return id as unknown as NodeJS.Timeout;
    }

    private normalizeHandler(handler: TimerHandler): () => void | Promise<void> {
        if (typeof handler === "function") {
            return handler as () => void | Promise<void>;
        }

        return () => {
            // Keep parity with the native runtime that can evaluate string handlers.
            // eslint-disable-next-line no-eval
            eval(handler);
        };
    }

    private getNextTask(target: number): TimerTask | null {
        let nextTask: TimerTask | null = null;

        for (const task of this.tasks.values()) {
            if (task.scheduledAt > target) {
                continue;
            }

            if (!nextTask) {
                nextTask = task;
                continue;
            }

            if (task.scheduledAt < nextTask.scheduledAt) {
                nextTask = task;
                continue;
            }

            if (task.scheduledAt === nextTask.scheduledAt && task.id < nextTask.id) {
                nextTask = task;
            }
        }

        return nextTask;
    }

    private toId(id?: NodeJS.Timeout): number {
        return id as unknown as number;
    }
}

describe("WaitHelper", () => {
    let clock: FakeClock;

    beforeEach(() => {
        clock = new FakeClock();
        clock.install();
    });

    afterEach(() => {
        clock.restore();
    });

    describe("waitIsTrue", () => {
        it("returns true when condition eventually succeeds", async () => {
            let calls = 0;
            const resultPromise = WaitHelper.waitIsTrue(async () => ++calls >= 3, 100, 10);

            await clock.tick(30);

            assert.strictEqual(await resultPromise, true);
            assert.strictEqual(calls, 3);
        });

        it("returns false on timeout", async () => {
            let calls = 0;
            const resultPromise = WaitHelper.waitIsTrue(
                async () => {
                    calls += 1;
                    return false;
                },
                25,
                10,
            );

            await clock.tick(30);

            assert.strictEqual(await resultPromise, false);
            assert.strictEqual(calls, 2);
        });
    });

    describe("waitConditionUntil", () => {
        it("returns immediately when first check succeeds", async () => {
            let calls = 0;
            const expected = { value: "ready" };

            const result = await WaitHelper.waitConditionUntil(
                () => {
                    calls += 1;
                    return expected;
                },
                10,
                50,
            );

            assert.strictEqual(result, expected);
            assert.strictEqual(calls, 1);
        });

        it("returns value after polling", async () => {
            let calls = 0;
            const expected = { value: "eventual" };
            const resultPromise = WaitHelper.waitConditionUntil(
                () => {
                    calls += 1;
                    return calls >= 3 ? expected : null;
                },
                10,
                100,
            );

            await clock.tick(20);

            assert.strictEqual(await resultPromise, expected);
            assert.strictEqual(calls, 3);
        });

        it("returns null on timeout", async () => {
            let calls = 0;
            const resultPromise = WaitHelper.waitConditionUntil(
                () => {
                    calls += 1;
                    return null;
                },
                10,
                25,
            );

            await clock.tick(30);

            assert.strictEqual(await resultPromise, null);
            assert.strictEqual(calls, 3);
        });

        it("rejects when condition throws", async () => {
            const expectedError = new Error("condition failure");

            const resultPromise = WaitHelper.waitConditionUntil(
                () => {
                    throw expectedError;
                },
                10,
                100,
            );

            await assert.rejects(resultPromise, err => {
                assert.strictEqual(err, expectedError);
                return true;
            });
        });
    });
});

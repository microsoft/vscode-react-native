export class WaitHelper {
    public static async waitIsTrue(
        condition: () => Promise<boolean>,
        timeout: number = 30000,
        interval: number = 1000,
    ): Promise<boolean> {
        return new Promise(resolve => {
            const rejectTimeout = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeout);

            const сheckInterval = setInterval(async () => {
                if (await condition()) {
                    cleanup();
                    resolve(true);
                }
            }, interval);

            const cleanup = () => {
                clearTimeout(rejectTimeout);
                clearInterval(сheckInterval);
            };
        });
    }

    public static async wait(time?: number): Promise<void> {
        const times = time ? time : 2000;
        await new Promise<void>(resolve => {
            const timer = setTimeout(() => {
                clearTimeout(timer);
                resolve();
            }, times);
        });
    }

    public static async waitConditionUntil<T>(
        condition: () => Promise<T | null> | T | null,
        interval: number = 1000,
        timeout: number = 30000,
    ): Promise<T | null> {
        return new Promise(async (resolve, reject) => {
            let rejectTimeout: NodeJS.Timeout | undefined;
            // eslint-disable-next-line prefer-const
            let сheckInterval: NodeJS.Timeout | undefined;

            if (timeout) {
                rejectTimeout = setTimeout(() => {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
                try {
                    const result = await condition();
                    if (result) {
                        cleanup();
                        resolve(result);
                    }
                    return !!result;
                } catch (err) {
                    cleanup();
                    reject(err);
                    return false;
                }
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
}

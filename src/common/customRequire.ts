// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

interface CustomRequire extends NodeRequireFunction {
    cache: any;
}

// Portion of code was taken from https://github.com/sindresorhus/ow/blob/d62a06c192b892d504887f0b97fdc842e8cbf862/source/utils/node/require.ts
let customRequire: CustomRequire;

try {
    // Export `__non_webpack_require__` in Webpack environments to make sure it doesn't bundle modules loaded via this method
    customRequire =
        (global as any).__non_webpack_require__ === "function"
            ? (global as any).__non_webpack_require__
            : eval("require");
} catch {
    // Use a noop in case both `__non_webpack_require__` and `require` does not exist
    customRequire = ((() => {
        customRequire.cache = {}; // eslint-disable-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-empty-function
    }) as any) as CustomRequire;
}

export default customRequire;

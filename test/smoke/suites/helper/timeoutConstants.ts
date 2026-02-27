// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Timeout constants for smoke tests
 * Centralized configuration for all timeout values used across test suites
 */
export class TimeoutConstants {
    /** Activation timeout - 10 seconds */
    static readonly ACTIVATION_TIMEOUT = 10000;

    /** Application initialization sleep - 10 seconds */
    static readonly APPLICATION_INIT_SLEEP = 10000;

    /** Command palette visibility timeout - 5 seconds */
    static readonly COMMAND_PALETTE_TIMEOUT = 5000;

    /** Package loader timeout - 4 minutes (240 seconds) */
    static readonly PACKAGE_LOADER_TIMEOUT = 4 * 60 * 1000;

    /** Command executor timeout - 10 seconds */
    static readonly COMMAND_EXECUTOR_TIMEOUT = 10000;

    /** Clean & Restart Packager timeout - 5 minutes (300 seconds) */
    static readonly PACKAGER_CLEAN_RESTART_TIMEOUT = 300000;

    /** Packager state change timeout - 3 minutes (180 seconds) */
    static readonly PACKAGER_STATE_TIMEOUT = 180000;

    /** File explorer element visibility timeout - 10 seconds */
    static readonly FILE_EXPLORER_TIMEOUT = 10000;
}

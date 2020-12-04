// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ISpawnResult } from "./node/childProcess";
import { ErrorHelper } from "./error/errorHelper";
import { InternalErrorCode } from "./error/internalErrorCode";

export interface PatternToFailure {
    pattern: string | RegExp;
    errorCode: number;
}

/* This class transforms a spawn process to only succeed if all defined success patterns
   are found on stdout, and none of the failure patterns were found on stderr */
export class OutputVerifier {
    private generatePatternsForSuccess: () => Promise<string[]>;
    private generatePatternToFailure: () => Promise<PatternToFailure[]>;
    private platformName: string;

    private output = "";
    private errors = "";

    constructor(
        generatePatternsForSuccess: () => Promise<string[]>,
        generatePatternToFailure: () => Promise<PatternToFailure[]>,
        platformName: string,
    ) {
        this.generatePatternsForSuccess = generatePatternsForSuccess;
        this.generatePatternToFailure = generatePatternToFailure;
        this.platformName = platformName;
    }

    public process(spawnResult: ISpawnResult): Promise<void> {
        // Store all output
        this.store(spawnResult.stdout, newContent => (this.output += newContent));
        this.store(spawnResult.stderr, newContent => (this.errors += newContent));

        return spawnResult.outcome // Wait for the process to finish
            .then(this.generatePatternToFailure) // Generate the failure patterns to check
            .then(patterns => {
                const failureErrorCode = this.findAnyFailurePattern(patterns);
                if (failureErrorCode) {
                    return Promise.reject<string[]>(ErrorHelper.getInternalError(failureErrorCode)); // If at least one failure happened, we fail
                } else {
                    return this.generatePatternsForSuccess(); // If not we generate the success patterns
                }
            })
            .then(successPatterns => {
                if (!this.areAllSuccessPatternsPresent(successPatterns)) {
                    // If we don't find all the success patterns, we also fail
                    return Promise.reject<void>(
                        ErrorHelper.getInternalError(
                            InternalErrorCode.NotAllSuccessPatternsMatched,
                            this.platformName,
                            this.platformName,
                        ),
                    );
                } // else we found all the success patterns, so we succeed
                return Promise.resolve();
            });
    }

    private store(stream: NodeJS.ReadableStream, append: (newContent: string) => void) {
        stream.on("data", (data: Buffer) => {
            append(data.toString());
        });
    }

    // We check the failure patterns one by one, to see if any of those appeared on the errors. If they did, we return the associated error
    private findAnyFailurePattern(patterns: PatternToFailure[]): number | null {
        const errorsAndOutput = this.errors + this.output;
        const patternThatAppeared = patterns.find(pattern => {
            return pattern.pattern instanceof RegExp
                ? (pattern.pattern as RegExp).test(errorsAndOutput)
                : errorsAndOutput.indexOf(pattern.pattern as string) !== -1;
        });

        return patternThatAppeared ? patternThatAppeared.errorCode : null;
    }

    // We check that all the patterns appeared on the output
    private areAllSuccessPatternsPresent(successPatterns: string[]): boolean {
        return successPatterns.every(pattern => {
            let patternRe = new RegExp(pattern, "i");
            return patternRe.test(this.output);
        });
    }
}

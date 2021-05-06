// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ISpawnResult } from "./node/childProcess";
import { ErrorHelper } from "./error/errorHelper";
import { InternalErrorCode } from "./error/internalErrorCode";
import { InternalError } from "./error/internalError";

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

        let processError: InternalError;

        return spawnResult.outcome
            .catch(error => {
                processError = error;
            })
            .finally(() => {
                return Promise.resolve()
                    .then(this.generatePatternToFailure)
                    .then(patterns => {
                        const internalError = this.findAnyFailurePattern(patterns);
                        if (internalError) {
                            if (processError) {
                                return Promise.reject<string[]>(
                                    ErrorHelper.wrapError(processError, internalError),
                                );
                            }
                            return Promise.reject<string[]>(internalError);
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
            });
    }

    private store(stream: NodeJS.ReadableStream, append: (newContent: string) => void) {
        stream.on("data", (data: Buffer) => {
            append(data.toString());
        });
    }

    // We check the failure patterns one by one, to see if any of those appeared on the errors. If they did, we return the associated error
    private findAnyFailurePattern(patterns: PatternToFailure[]): InternalError | null {
        const errorsAndOutput = this.errors + this.output;
        let matches: RegExpMatchArray | null = [];
        const patternThatAppeared = patterns.find(pattern => {
            if (pattern.pattern instanceof RegExp) {
                matches = errorsAndOutput.match(pattern.pattern);
                return matches && matches.length;
            } else {
                const indexMatch = errorsAndOutput.indexOf(pattern.pattern as string);
                return indexMatch !== -1;
            }
        });

        const errorCode = patternThatAppeared ? patternThatAppeared.errorCode : null;

        if (errorCode) {
            return matches && matches.length
                ? ErrorHelper.getInternalError(errorCode, matches.join("\n"))
                : ErrorHelper.getInternalError(errorCode);
        }
        return null;
    }

    // We check that all the patterns appeared on the output
    private areAllSuccessPatternsPresent(successPatterns: string[]): boolean {
        return successPatterns.every(pattern => {
            let patternRe = new RegExp(pattern, "i");
            return patternRe.test(this.output);
        });
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {ISpawnResult} from "./node/childProcess";

export type PatternToFailure = {
    pattern: string | RegExp,
    message: string
};

/* This class transforms a spawn process to only succeed if all defined success patterns
   are found on stdout, and none of the failure patterns were found on stderr */
export class OutputVerifier {
    private generatePatternsForSuccess: () => Q.Promise<string[]>;
    private generatePatternToFailure: () => Q.Promise<PatternToFailure[]>;

    private output = "";
    private errors = "";

    constructor(generatePatternsForSuccess: () => Q.Promise<string[]>, generatePatternToFailure: () => Q.Promise<PatternToFailure[]>) {
        this.generatePatternsForSuccess = generatePatternsForSuccess;
        this.generatePatternToFailure = generatePatternToFailure;
    }

    public process(spawnResult: ISpawnResult): Q.Promise<void> {
        // Store all output
        this.store(spawnResult.stdout, new_content =>
            this.output += new_content);
        this.store(spawnResult.stderr, new_content =>
            this.errors += new_content);

        return spawnResult.outcome // Wait for the process to finish
            .then(this.generatePatternToFailure) // Generate the failure patterns to check
            .then(patterns => {
                const failureMessage = this.findAnyFailurePattern(patterns);
                if (failureMessage) {
                    return Q.reject<string[]>(new Error(failureMessage)); // If at least one failure happened, we fail
                } else {
                    return this.generatePatternsForSuccess(); // If not we generate the success patterns
                }
            }).then(successPatterns => {
                if (!this.areAllSuccessPatternsPresent(successPatterns)) { // If we don't find all the success patterns, we also fail
                    return Q.reject<void>(new Error("Unknown error: not all success patterns were matched"));
                } // else we found all the success patterns, so we succeed
                return Q.resolve(void 0);
            });
    }

    private store(stream: NodeJS.ReadableStream, append: (new_content: string) => void) {
        stream.on("data", (data: Buffer) => {
            append(data.toString());
        });
    }

    // We check the failure patterns one by one, to see if any of those appeared on the errors. If they did, we return the associated error
    private findAnyFailurePattern(patterns: PatternToFailure[]): string | null {
        const errorsAndOutput = this.errors + this.output;
        const patternThatAppeared = patterns.find(pattern => {
            return pattern.pattern instanceof RegExp ?
                (pattern.pattern as RegExp).test(errorsAndOutput) :
                errorsAndOutput.indexOf(pattern.pattern as string) !== -1;
        });

        return patternThatAppeared ? patternThatAppeared.message : null;
    }

    // We check that all the patterns appeared on the output
    private areAllSuccessPatternsPresent(successPatterns: string[]): boolean {
        return successPatterns.every(pattern => {
            let patternRe = new RegExp(pattern, "i");
            return patternRe.test(this.output);
        });
    }
}

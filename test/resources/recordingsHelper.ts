// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

const RECORDINGS_ROOT = path.resolve(__dirname, "processExecutionsRecordings");

interface TestUsingRecording {
    (expectation: string, recordingNames: string[], assertion?: () => void): Mocha.Test;
    (expectation: string, recordingNames: string[], assertion?: (done: Mocha.Done) => void): Mocha.Test;
    only(expectation: string, recordingNames: string[], assertion?: () => void): Mocha.Test;
    only(expectation: string, recordingNames: string[], assertion?: (done: Mocha.Done) => void): Mocha.Test;
    skip(expectation: string, recordingNames: string[], assertion?: () => void): void;
    skip(expectation: string, recordingNames: string[], assertion?: (done: Mocha.Done) => void): void;
}

export interface IRecordingConsumer {
    loadRecordingFromName(recordingName: string): Promise<void>;
    loadRecordingFromString(recordingName: string): Promise<void>;
}

/* This class makes it easy to create a test using a recording. Recommended usage is:
     const testWithRecordings = new RecordingsHelper(() => recordingConsumer).test;
     testWithRecordings("expects to do some test thing",
    [
        "path/to/recording",
        "path/to/recording"
    ], () => {
        // test code here
    });
*/
export class RecordingsHelper {
    public test: TestUsingRecording;

    private recordings: { [name: string]: string };

    constructor(private getRecordingConsumer: () => IRecordingConsumer) {
        this.recordings = {};
        this.initializeTest();
    }

    private initializeTest(): void {
        this.test = <TestUsingRecording>((testName: string, recordingNames: string[], code: () => Promise<void>): void => {
            if (code.length !== 0) { // Check how many arguments the function has
                throw new RangeError("(done: Mocha.Done) parameter is not supported. Please return a promise instead.");
            }
            const recordingsHelper = this;
            recordingNames.forEach(recordingName => {

                let recording: string = this.recordings[recordingName];
                if (!recording) {
                    recording = fs.readFileSync(path.resolve(RECORDINGS_ROOT, recordingName) + ".json", "utf8");
                    this.recordings[recordingName] = recording;
                }

                test(`${testName} using recording ${recordingName}`, function () { // We use function () because we need the this pointer
                    return recordingsHelper
                        .getRecordingConsumer()
                        .loadRecordingFromString(recording)
                        .then(code.bind(test));
                });
            });
        });
        this.test.skip = (expectation: string, recordingNames: string[], assertion?: (done: Mocha.Done) => void) => {
            test.skip(expectation, assertion);
        };
    }
}

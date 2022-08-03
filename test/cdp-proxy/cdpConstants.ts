// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const HERMES_NATIVE_FUNCTION_NAME: string = "(native)";
const HERMES_NATIVE_FUNCTION_SCRIPT_ID: string = "4294967295";
const ARRAY_REQUEST_PHRASE_MARKER: string = "Object.getOwnPropertyDescriptor";

const mockCallFrames: any = [
    {
        functionName: HERMES_NATIVE_FUNCTION_NAME,
        location: {
            scriptId: "1",
        },
    },
    {
        functionName: "name",
        location: {
            scriptId: HERMES_NATIVE_FUNCTION_SCRIPT_ID,
        },
    },
    {
        functionName: "name",
        location: {
            scriptId: "2",
        },
    },
    {
        functionName: "name1",
        location: {
            scriptId: "3",
        },
    },
];

const mockResults = {
    result: [
        {
            value: {
                type: "function",
                description: undefined,
            },
        },
        {
            value: {
                type: "function",
                description: "description",
            },
        },
    ],
};

export {
    HERMES_NATIVE_FUNCTION_NAME,
    HERMES_NATIVE_FUNCTION_SCRIPT_ID,
    ARRAY_REQUEST_PHRASE_MARKER,
    mockCallFrames,
    mockResults,
};

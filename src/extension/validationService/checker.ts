// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { getChecks } from "./checks";
import { CategoryE } from "./checks/types";

export const runChecks = async (): Promise<void> => {
    const outputChannel = OutputChannelLogger.getMainChannel();
    const toCheck = getChecks();

    const convertToEntries = (categ: CategoryE) => {
        return Promise.all(
            toCheck
                .filter(it => it.category === categ)
                .map(async it => [it, await it.exec()] as const),
        );
    };

    const checks = {
        [CategoryE.Common]: new Map(await convertToEntries(CategoryE.Common)),
        [CategoryE.Android]: new Map(await convertToEntries(CategoryE.Android)),
        [CategoryE.iOS]: new Map(await convertToEntries(CategoryE.iOS)),
    };

    outputChannel.info("Starting Environment check...");

    const statusToSymbol = {
        success: "✓",
        failure: "✖",
        "partial-success": "❔",
    };

    outputChannel.setFocusOnLogChannel();

    Object.entries(checks).forEach(async ([key, val]) => {
        if (val.size === 0) {
            return;
        }

        let outStr = `\n*** ${key} ***\n`;

        val.forEach((execResult, validation) => {
            outStr += ` ${statusToSymbol[execResult.status]} ${validation.label}`;

            if (execResult.status !== "success") {
                outStr += ` - ${validation.description}\n`;
                outStr += `  ${execResult.comment}`;
            }

            outStr += "\n";
        });

        outputChannel.logStream(outStr);
    });
};

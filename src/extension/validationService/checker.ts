// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { getChecks } from "./checks";
import { CategoryE } from "./checks/types";

export const runChecks = async (): Promise<void> => {
    const outputChannel = OutputChannelLogger.getMainChannel();
    const toCheck = getChecks();

    const categories = Object.values(CategoryE);

    const convertToEntries = (categ: CategoryE) => {
        return Promise.all(
            toCheck
                .filter(it => it.category === categ)
                .map(async it => [it, await it.exec()] as const),
        );
    };

    const checks = await Promise.all(
        categories.map(async it => new Map(await convertToEntries(it))),
    );

    outputChannel.log("Starting Environment check...", 3);

    const statusToSymbol = {
        success: "✓",
        failure: "✖",
        "partial-success": "❔",
    };

    outputChannel.setFocusOnLogChannel();

    Object.entries(checks).forEach(async ([key, val]) => {
        let outStr = `\n*** ${key} ***\n`;

        val.forEach((execResult, validation) => {
            console.log(execResult.status);
            console.log(statusToSymbol[execResult.status]);

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

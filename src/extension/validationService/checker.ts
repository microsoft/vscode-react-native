// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { getChecks } from "./checks";
import { CategoryE, ValidationI, ValidationResultT } from "./checks/types";
import { fromEntries } from "./util";

const evaluteChecks = async (checks: ValidationI[]) => {
    const execToEntries = (categ: CategoryE, toCheck: ValidationI[]) =>
        Promise.all(
            toCheck
                .filter(it => it.category === categ)
                .map(async it => [it, await it.exec()] as const),
        );

    return fromEntries(
        await Promise.all(
            Object.values(CategoryE).map(
                async it => [it, new Map(await execToEntries(it, checks))] as const,
            ),
        ),
    );
};

const statusToSymbol = {
    success: "✓",
    failure: "✖",
    "partial-success": "❔",
};

export const runChecks = async (options_?: Partial<Record<CategoryE, boolean>>): Promise<void> => {
    const options = Object.assign(
        { [CategoryE.Common]: true, [CategoryE.Android]: true, [CategoryE.iOS]: true },
        options_,
    );
    const outputChannel = OutputChannelLogger.getMainChannel();
    const checks = await evaluteChecks(getChecks().filter(it => options?.[it.category] === true));

    outputChannel.setFocusOnLogChannel();
    outputChannel.info("Starting Environment check...");

    let outStr = `<<< Dev Environment verification result >>>\n`;

    Object.entries(checks).forEach(async ([key, val]) => {
        if (val.size === 0) {
            return;
        }

        outStr += `\n*** ${key} ***\n`;

        val.forEach((execResult, validation) => {
            outStr += ` ${statusToSymbol[execResult.status]} ${validation.label}`;

            if (execResult.status !== "success") {
                outStr += ` - ${validation.description}\n`;
                outStr += `  ${execResult.comment}`;
            }

            outStr += "\n";
        });
    });

    const allPassed = ([] as ValidationResultT[])
        .concat(...Object.entries(checks).map(it => [...it[1].values()]))
        .every(it => it.status === "success");

    if (allPassed) {
        outStr += `\nAll the checks passed successfully!`;
    }

    outputChannel.logStream(outStr);
};

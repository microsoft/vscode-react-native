// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { getChecks } from "./checks";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./checks/types";
import { fromEntries } from "./util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();
const outputChannel = OutputChannelLogger.getMainChannel();

const evaluteChecks = async (checks: IValidation[]) => {
    const execToEntries = (categ: ValidationCategoryE, toCheck: IValidation[]) =>
        Promise.all(
            toCheck
                .filter(it => it.category === categ)
                .map(
                    async it =>
                        [
                            it,
                            await it.exec().catch(err => {
                                outputChannel.warning(`Check ${it.label} failed with error`);
                                outputChannel.warning(err);

                                return {
                                    status: "failure",
                                    comment: "Check execution failed",
                                } as ValidationResultT;
                            }),
                        ] as const,
                ),
        );

    return fromEntries(
        await Promise.all(
            Object.values(ValidationCategoryE).map(
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

export const runChecks = async (
    options_?: Partial<Record<ValidationCategoryE, boolean>>,
): Promise<void> => {
    const options = Object.assign(
        {
            [ValidationCategoryE.Common]: true,
            [ValidationCategoryE.Android]: true,
            [ValidationCategoryE.iOS]: true,
        },
        options_,
    );

    outputChannel.setFocusOnLogChannel();
    outputChannel.info(toLocale("DevEnvVerificationStart", "Starting Environment check..."));

    const checks = await evaluteChecks(getChecks().filter(it => options?.[it.category] === true));

    let outStr = `<<< ${toLocale(
        "DevEnvVerificationHeader",
        "Dev Environment verification result",
    )} >>>\n`;

    Object.entries(checks).forEach(async ([key, val]) => {
        if (val.size === 0) {
            return;
        }

        outStr += `\n*** ${key} ***\n`;

        val.forEach((execResult, validation) => {
            outStr += ` ${statusToSymbol[execResult.status]} ${validation.label}`;

            if (execResult.status !== "success") {
                outStr += ` - ${validation.description}\n`;
                outStr += `  ${execResult.comment || ""}`;
            }

            outStr += "\n";
        });
    });

    const allPassed = ([] as ValidationResultT[])
        .concat(...Object.entries(checks).map(it => [...it[1].values()]))
        .every(it => it.status === "success");

    if (allPassed) {
        outStr += `\n${toLocale(
            "DevEnvVerificationFooter",
            "All checks passed successfully!",
        )}\n\n`;
    }

    outputChannel.logStream(outStr);
};

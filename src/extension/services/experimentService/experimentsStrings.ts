// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export const PROMPT_TITLES = {
    RNT_PREVIEW_PROMPT: localize(
        "RNTPreviewPrompt",
        "Want to help us improve the React Native Tools Extension? Install the Preview version and give us feedback!",
    ),
};

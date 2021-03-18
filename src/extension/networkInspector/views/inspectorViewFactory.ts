// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { NETWORK_INSPECTOR_LOG_CHANNEL_NAME } from "../networkInspectorServer";
import { InspectorConsoleView } from "./inspectorConsoleView";
import { InspectorViewType, InspectorView } from "./inspectorView";

export class InspectorViewFactory {
    private static cachedInspectorViews = new Map<InspectorViewType, InspectorView>();

    public static getInspectorView(inspectorViewType: InspectorViewType): InspectorView {
        if (!InspectorViewFactory.cachedInspectorViews.has(inspectorViewType)) {
            if (inspectorViewType === InspectorViewType.console) {
                InspectorViewFactory.cachedInspectorViews.set(
                    InspectorViewType.console,
                    new InspectorConsoleView(
                        OutputChannelLogger.getChannel(NETWORK_INSPECTOR_LOG_CHANNEL_NAME),
                    ),
                );
            } else {
                throw new Error(`Unsupported inspector view type: ${inspectorViewType}`);
            }
        }
        return InspectorViewFactory.cachedInspectorViews.get(inspectorViewType) as InspectorView;
    }

    public static clearCache(): void {
        InspectorViewFactory.cachedInspectorViews.forEach(inspectorView => {
            inspectorView.dispose();
        });
        InspectorViewFactory.cachedInspectorViews.clear();
    }
}

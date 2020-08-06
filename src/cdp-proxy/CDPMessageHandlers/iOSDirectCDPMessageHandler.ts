// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";
export class IOSDirectCDPMessageHandler extends BaseCDPMessageHandler {
    public processApplicationCDPMessage(event: any) {
        if (event.result && event.result.properties) {
            event.result = { result: event.result.properties};
        }
        return {
            event,
            sendBack: false,
        };
    }
}
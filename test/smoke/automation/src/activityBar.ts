// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Code } from "./code";

export const enum ActivityBarPosition {
    LEFT = 0,
    RIGHT = 1,
}

export class ActivityBar {
    constructor(private code: Code) {}

    public async waitForActivityBar(position: ActivityBarPosition): Promise<void> {
        let positionClass: string;

        if (position === ActivityBarPosition.LEFT) {
            positionClass = "left";
        } else if (position === ActivityBarPosition.RIGHT) {
            positionClass = "right";
        } else {
            throw new Error("No such position for activity bar defined.");
        }

        await this.code.waitForElement(`.part.activitybar.${positionClass}`);
    }
}

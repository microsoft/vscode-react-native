// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.



export class DeviceDeployer {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public deploy(): Q.Promise<void> {
        throw new Error("Not Implemented");
    }
}
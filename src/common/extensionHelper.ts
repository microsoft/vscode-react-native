// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";

export function getExtensionVersion(): string | null {
    const packageJsonPath = findFileInFolderHierarchy(__dirname, "package.json");
    if (packageJsonPath) {
        return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).version;
    } else {
        return null;
    }
}

export function getExtensionName(): string | null {
    const packageJsonPath = findFileInFolderHierarchy(__dirname, "package.json");
    if (packageJsonPath) {
        return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).name;
    } else {
        return null;
    }
}

export function findFileInFolderHierarchy(dir: string, filename: string): string | null {
    let parentPath: string;
    let projectRoot: string = dir;
    let atFsRoot: boolean = false;

    while (!fs.existsSync(path.join(projectRoot, filename))) {
        // Navigate up one level until either config.xml is found
        parentPath = path.resolve(projectRoot, "..");
        if (parentPath !== projectRoot) {
            projectRoot = parentPath;
        } else {
            // we have reached the filesystem root
            atFsRoot = true;
            break;
        }
    }

    if (atFsRoot) {
        // We reached the fs root
        return null;
    }

    return path.join(projectRoot, filename);
}

export function generateRandomPortNumber(): number {
    return Math.round(Math.random() * 40000 + 3000);
}

export function getNodeModulesInFolderHierarhy(projectRoot: string): string {
    const nodeModulesPath = findFileInFolderHierarchy(projectRoot, "node_modules");
    return nodeModulesPath ? path.resolve(nodeModulesPath, "..") : projectRoot;
}

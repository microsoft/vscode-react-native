// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { Package } from "./node/package";

export function getExtensionVersion(): string | null {
    const packageJsonPath = findFileInFolderHierarchy(__dirname, "package.json");
    return packageJsonPath ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).version : null;
}

export function getExtensionName(): string | null {
    const packageJsonPath = findFileInFolderHierarchy(__dirname, "package.json");
    return packageJsonPath ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).name : null;
}

export function findFileInFolderHierarchy(dir: string, filename: string): string | null {
    let parentPath: string;
    let projectRoot: string = dir;

    while (!fs.existsSync(path.join(projectRoot, filename))) {
        // Navigate up one level until either config.xml is found
        parentPath = path.resolve(projectRoot, "..");
        if (parentPath !== projectRoot) {
            projectRoot = parentPath;
        } else {
            // we have reached the filesystem root
            return null;
        }
    }

    return path.join(projectRoot, filename);
}

export function generateRandomPortNumber(): number {
    return Math.round(Math.random() * 40000 + 3000);
}

export function getNodeModulesInFolderHierarchy(projectRoot: string): string | null {
    const NODE_MODULES_FOLDER = "node_modules";
    const REACT_NATIVE_MODULE = "react-native";
    const pathToReactNativeModule: string = path.join(NODE_MODULES_FOLDER, REACT_NATIVE_MODULE);

    const nodeModulesPath: string | null = findFileInFolderHierarchy(
        projectRoot,
        pathToReactNativeModule,
    );
    return nodeModulesPath ? path.resolve(nodeModulesPath, "..", "..") : null;
}

export function isWorkspaceTrusted(): boolean {
    // Remove after updating supported VS Code engine version to 1.57.0
    if (typeof (vscode.workspace as any).isTrusted === "boolean") {
        return (vscode.workspace as any).isTrusted;
    }
    return true;
}

export async function getVersionFromExtensionNodeModules(
    packageName: string,
): Promise<string | null> {
    const packageJsonPath = findFileInFolderHierarchy(__dirname, "package.json");
    if (packageJsonPath) {
        const rootDirecory = path.resolve(packageJsonPath, "..");
        try {
            return await new Package(rootDirecory).getPackageVersionFromNodeModules(packageName);
        } catch {
            return null;
        }
    }
    return null;
}

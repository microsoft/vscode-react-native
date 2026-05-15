// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import * as sinon from "sinon";
import {
    PackagerStatus,
    PackagerStatusIndicator,
} from "../../src/extension/packagerStatusIndicator";
import { SettingsHelper } from "../../src/extension/settingsHelper";

function makeFakeStatusBarItem(): vscode.StatusBarItem {
    return {
        id: "",
        name: "",
        text: "",
        tooltip: undefined,
        color: undefined,
        backgroundColor: undefined,
        command: undefined,
        accessibilityInformation: undefined,
        alignment: vscode.StatusBarAlignment.Left,
        priority: undefined,
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub(),
    } as unknown as vscode.StatusBarItem;
}

suite("PackagerStatusIndicator", function () {
    suite("extensionContext", function () {
        let createStatusBarItemStub: Sinon.SinonStub;
        let getShowIndicatorStub: Sinon.SinonStub;
        let getPatternStub: Sinon.SinonStub;
        let fakeToggleItem: vscode.StatusBarItem;
        let fakeRestartItem: vscode.StatusBarItem;
        let indicator: PackagerStatusIndicator;
        const PROJECT_ROOT = "/workspace";
        setup(() => {
            fakeRestartItem = makeFakeStatusBarItem();
            fakeToggleItem = makeFakeStatusBarItem();
            createStatusBarItemStub = sinon.stub(vscode.window, "createStatusBarItem");
            createStatusBarItemStub.onFirstCall().returns(fakeRestartItem);
            createStatusBarItemStub.onSecondCall().returns(fakeToggleItem);
            getShowIndicatorStub = sinon.stub(SettingsHelper, "getShowIndicator").returns(true);
            getPatternStub = sinon
                .stub(SettingsHelper, "getPackagerStatusIndicatorPattern")
                .returns(PackagerStatusIndicator.FULL_VERSION);
            indicator = new PackagerStatusIndicator(PROJECT_ROOT);
        });
        teardown(() => {
            indicator.dispose();
            createStatusBarItemStub.restore();
            getShowIndicatorStub.restore();
            getPatternStub.restore();
        });
        test("should display port in full version when packager starts with port", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 8081);
            assert.ok(
                (fakeToggleItem.text as string).includes(":8081"),
                `Expected text to contain ':8081', got: ${fakeToggleItem.text}`,
            );
        });
        test("should not display port in full version when packager starts without port", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED);
            assert.ok(
                !(fakeToggleItem.text as string).includes(":"),
                `Expected text to not contain port, got: ${fakeToggleItem.text}`,
            );
        });
        test("should clear port from status bar text when packager stops", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 8081);
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED);
            assert.ok(
                !(fakeToggleItem.text as string).includes(":8081"),
                `Expected text to not contain ':8081' after stop, got: ${fakeToggleItem.text}`,
            );
        });
        test("should display port in short version when packager starts with port", function () {
            getPatternStub.returns(PackagerStatusIndicator.SHORT_VERSION);
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 9090);
            assert.ok(
                (fakeToggleItem.text as string).includes(":9090"),
                `Expected short version text to contain ':9090', got: ${fakeToggleItem.text}`,
            );
        });
        test("should retain port across status transitions from starting to started", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTING, 8081);
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED);
            assert.ok(
                (fakeToggleItem.text as string).includes(":8081"),
                `Expected port to be retained after STARTED, got: ${fakeToggleItem.text}`,
            );
        });
        test("should update port when called with a new port value", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 8081);
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 9090);
            assert.ok(
                (fakeToggleItem.text as string).includes(":9090"),
                `Expected text to contain updated port ':9090', got: ${fakeToggleItem.text}`,
            );
            assert.ok(
                !(fakeToggleItem.text as string).includes(":8081"),
                `Expected old port ':8081' to be gone, got: ${fakeToggleItem.text}`,
            );
        });
        test("should show pending port setting change in status bar tooltip", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 8081);
            indicator.setPendingPackagerPort(9090);

            assert.ok(
                (fakeToggleItem.text as string).includes("$(warning)"),
                `Expected warning icon in text, got: ${fakeToggleItem.text}`,
            );
            assert.strictEqual(
                fakeToggleItem.tooltip,
                "Stop Packager\n\nRunning on port 8081.\nPort setting changed to 9090. It will be reset on next start.",
            );
        });
        test("should clear pending port setting change after port is applied", function () {
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 8081);
            indicator.setPendingPackagerPort(9090);
            indicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED, 9090);

            assert.ok(
                !(fakeToggleItem.text as string).includes("$(warning)"),
                `Expected warning icon to be cleared, got: ${fakeToggleItem.text}`,
            );
            assert.strictEqual(fakeToggleItem.tooltip, "Stop Packager");
        });
    });
});

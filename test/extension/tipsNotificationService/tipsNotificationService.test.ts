// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    TipNotificationService,
    TipNotificationConfig,
} from "../../../src/extension/tipsNotificationsService/tipsNotificationService";
// import * as Configstore from "configstore";
import * as assert from "assert";

suite("tipNotificationService", function () {
    // const configName = "reactNativeToolsConfig";
    // const config = new Configstore(configName);

    teardown(() => {
        (<any>TipNotificationService).instance = null;
    });

    suite("getOrCreateDefaultTipsConfig", function () {
        test("should return correct tips config", async () => {
            const tipNotificationService = TipNotificationService.getInstance();
            const downloadedTipsConfig: TipNotificationConfig = await (<any>tipNotificationService)
                .downloadConfigRequest;

            const numberType = "number";
            assert.strictEqual(typeof downloadedTipsConfig.daysAfterLastUsage, numberType);
            assert.strictEqual(typeof downloadedTipsConfig.firstTimeMaxDaysToRemind, numberType);
            assert.strictEqual(typeof downloadedTipsConfig.firstTimeMinDaysToRemind, numberType);
            assert.strictEqual(typeof downloadedTipsConfig.maxDaysToRemind, numberType);
            assert.strictEqual(typeof downloadedTipsConfig.minDaysToRemind, numberType);
        });
    });

    suite("showTipNotification", function () {
        test("should create config and fill shownDate into one of general tips", () => {
            // Precondition:
            // no tipsConfig
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // reactNativeToolsConfig has tipsConfig
            // one of tipsConfig.tips.generalTips has shownDate, others have not
        });

        test("should create config and fill shownDate into one of specific tips", () => {
            // Precondition:
            // no tipsConfig
            //
            // Action:
            // call showTipNotification with parameters false (to call showing a specific tip) and specificTipKey
            //
            // Check:
            // reactNativeToolsConfig has tipsConfig
            // one of tipsConfig.tips.specificTips has shownDate (with key === specificTipKey), others have not
        });

        test("should decrease daysLeftBeforeGeneralTip by one and no tip is shown", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is not 0
            // showTips is true
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // reactNativeToolsConfig.tipsConfig.tips has not changed
            // daysLeftBeforeGeneralTip is decreased by 1
        });

        test("should show another tip from general tips for first round", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is 0
            // showTips is true
            // one of tipsConfig.tips.generalTips has shownDate
            // allTipsShownFirstly is false
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // two of tipsConfig.tips.generalTips has shownDate
            // daysLeftBeforeGeneralTip is between tipsConfig.firstTimeMinDaysToRemind and tipsConfig.firstTimeMaxDaysToRemind
        });

        test("should show another tip from general tips for second round", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is 0
            // showTips is true
            // one of tipsConfig.tips.generalTips has shownDate
            // allTipsShownFirstly is true
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // one of tipsConfig.tips.generalTips has updated shownDate, others have not
            // daysLeftBeforeGeneralTip is between tipsConfig.minDaysToRemind and tipsConfig.maxDaysToRemind
        });

        test("should change allTipsShownFirstly from false to true", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is 0
            // showTips is true
            // only one of tipsConfig.tips.generalTips has not shownDate
            // allTipsShownFirstly is false
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // all tipsConfig.tips.generalTips have shownDate
            // allTipsShownFirstly is true
            // daysLeftBeforeGeneralTip is between tipsConfig.minDaysToRemind and tipsConfig.maxDaysToRemind
        });

        test("should not show general tip", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is 0
            // showTips is false
            //
            // Action:
            // call showTipNotification without parameters (to call showing a general random tip)
            //
            // Check:
            // reactNativeToolsConfig.tipsConfig.tips has not changed
        });

        test("should not show specific tip", () => {
            // Precondition:
            // tipsConfig exists
            // daysLeftBeforeGeneralTip is 0
            // showTips is false
            //
            // Action:
            // call showTipNotification with parameters false (to call showing a specific tip) and specificTipKey
            //
            // Check:
            // reactNativeToolsConfig.tipsConfig.tips has not changed
        });
    });

    suite("setKnownDateForFeatureById", function () {
        test("should add knownDate to general tip", () => {
            // Precondition:
            // tipsConfig exists
            //
            // Action:
            // call setKnownDateForFeatureById with one parameter (key of general tip)
            //
            // Check:
            // reactNativeToolsConfig.tipsConfig.tips.generalTips[key] has updated
        });

        test("should add knownDate to specific tip", () => {
            // Precondition:
            // tipsConfig exists
            //
            // Action:
            // call setKnownDateForFeatureById with two parameters - key of specific tip and false (not general tip)
            //
            // Check:
            // reactNativeToolsConfig.tipsConfig.tips.generalTips[key] has updated
        });
    });
});

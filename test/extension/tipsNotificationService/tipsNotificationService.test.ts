// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    TipNotificationService,
    TipNotificationConfig,
    TipsConfig,
} from "../../../src/extension/tipsNotificationsService/tipsNotificationService";
import * as Configstore from "configstore";
import * as assert from "assert";
import { window } from "vscode";
import * as sinon from "sinon";

interface RawTipInfo {
    knownDate?: string;
    shownDate?: string;
}

interface RawTipsConfig extends TipNotificationConfig {
    showTips: boolean;
    daysLeftBeforeGeneralTip: number;
    lastExtensionUsageDate?: string;
    allTipsShownFirstly: boolean;
    tips: {
        generalTips: { [tipId: string]: RawTipInfo };
        specificTips: { [tipId: string]: RawTipInfo };
    };
}

suite("tipNotificationService", function () {
    const configName = "reactNativeToolsConfig";
    const tipsConfigName = "tipsConfig";
    const config = new Configstore(configName);
    let tipNotificationService: TipNotificationService;
    let windowShowInformationMessageStub: Sinon.SinonStub;

    suiteSetup(() => {
        windowShowInformationMessageStub = sinon
            .stub(window, "showInformationMessage")
            .returns(Promise.resolve(undefined));
    });

    suiteTeardown(() => {
        windowShowInformationMessageStub.restore();
    });

    setup(() => {
        tipNotificationService = TipNotificationService.getInstance();
        config.delete(tipsConfigName);
    });

    // suiteTeardown(() => {
    //     if (tipNotificationService) {
    //         tipNotificationService.dispose();
    //     }
    // });

    teardown(() => {
        if (tipNotificationService) {
            tipNotificationService.dispose();
        }
        (<any>TipNotificationService).instance = null;
    });

    suite("initializeTipsConfig", function () {
        test("should create correct tips config", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipsConfig: TipsConfig = await (<any>tipNotificationService).tipsConfig;

            const numberType = "number";
            assert.strictEqual(typeof tipsConfig.daysAfterLastUsage, numberType);
            assert.strictEqual(typeof tipsConfig.firstTimeMaxDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.firstTimeMinDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.maxDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.minDaysToRemind, numberType);
        });
    });

    suite("showTipNotification", function () {
        test("should create config and fill shownDate into one of general tips", async () => {
            // config.delete(tipsConfigName);

            await tipNotificationService.showTipNotification();

            assert.ok(config.has(tipsConfigName));

            const tipsConfig: RawTipsConfig = config.get(tipsConfigName);
            let shownTips = Object.values(tipsConfig.tips.generalTips).filter(tip => tip.shownDate);

            assert.strictEqual(shownTips.length, 1);
        });

        test("should create config and fill shownDate into one of specific tips", async () => {
            const specificTipKey = "networkInspectorLogsColorTheme";

            // config.delete(tipsConfigName);

            await tipNotificationService.showTipNotification(false, specificTipKey);

            assert.ok(config.has(tipsConfigName));

            const tipsConfig: RawTipsConfig = config.get(tipsConfigName);

            assert.strictEqual(
                typeof tipsConfig.tips.specificTips[specificTipKey].shownDate,
                "string",
                `shownDate of ${specificTipKey} isn't set`,
            );
        });

        test("should decrease daysLeftBeforeGeneralTip by one and no tip is shown", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipsConfigBefore: TipsConfig = await (<any>tipNotificationService).tipsConfig;
            tipsConfigBefore.daysLeftBeforeGeneralTip = 5;
            tipsConfigBefore.lastExtensionUsageDate = new Date();
            tipsConfigBefore.lastExtensionUsageDate.setDate(
                tipsConfigBefore.lastExtensionUsageDate.getDate() - 1,
            );
            config.set(tipsConfigName, tipsConfigBefore);

            await tipNotificationService.showTipNotification();

            const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

            assert.deepStrictEqual(tipsConfigBefore.tips, tipsConfigAfter.tips);
            assert.deepStrictEqual(tipsConfigAfter.daysLeftBeforeGeneralTip, 4);
        });

        test("should show another tip from general tips for first round", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipsConfigBefore: TipsConfig = await (<any>tipNotificationService).tipsConfig;
            tipsConfigBefore.tips.generalTips["networkInspector"].shownDate = new Date();
            config.set(tipsConfigName, tipsConfigBefore);

            await tipNotificationService.showTipNotification();

            const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);
            let shownTips = Object.values(tipsConfigAfter.tips.generalTips).filter(
                tip => tip.shownDate,
            );

            assert.strictEqual(shownTips.length, 2);

            let assertCondition = () =>
                tipsConfigAfter.daysLeftBeforeGeneralTip >=
                    tipsConfigAfter.firstTimeMinDaysToRemind &&
                tipsConfigAfter.daysLeftBeforeGeneralTip <=
                    tipsConfigAfter.firstTimeMaxDaysToRemind;

            assert.strictEqual(assertCondition(), true);
        });

        test("should show another tip from general tips for second round", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipsConfigBefore: TipsConfig = await (<any>tipNotificationService).tipsConfig;
            const shownDate = new Date(2021, 6, 26);
            Object.values(tipsConfigBefore.tips.generalTips).forEach(tip => {
                tip.shownDate = shownDate;
            });
            tipsConfigBefore.allTipsShownFirstly = true;
            tipsConfigBefore.daysLeftBeforeGeneralTip = 0;
            config.set(tipsConfigName, tipsConfigBefore);

            await tipNotificationService.showTipNotification();

            const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);
            let shownTips = Object.values(tipsConfigAfter.tips.generalTips).filter(
                tip => Date.parse(tip.shownDate as string) > shownDate.getTime(),
            );

            assert.strictEqual(shownTips.length, 1);

            let assertCondition = () =>
                tipsConfigAfter.daysLeftBeforeGeneralTip >= tipsConfigAfter.minDaysToRemind &&
                tipsConfigAfter.daysLeftBeforeGeneralTip <= tipsConfigAfter.maxDaysToRemind;

            assert.strictEqual(assertCondition(), true);
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

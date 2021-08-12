// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    TipNotificationService,
    TipNotificationConfig,
    TipsConfig,
} from "../../../src/extension/tipsNotificationsService/tipsNotificationService";
import { SettingsHelper } from "../../../src/extension/settingsHelper";
// import { ExtensionConfigManager } from "../../../src/extension/extensionConfigManager";
import * as Configstore from "configstore";
import * as assert from "assert";
import { window } from "vscode";
import * as sinon from "sinon";

interface RawTipInfo {
    knownDate?: string;
    shownDate?: string;
}

interface RawTipsConfig extends TipNotificationConfig {
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

    setup(async function () {
        tipNotificationService = TipNotificationService.getInstance();
        config.delete(tipsConfigName);
        await SettingsHelper.setShowTips(true);
    });

    teardown(() => {
        if (tipNotificationService) {
            tipNotificationService.dispose();
        }
        (<any>TipNotificationService).instance = null;
    });

    suite("initializeTipsConfig", function () {
        test("should create correct tips config", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipsConfig: TipsConfig = (<any>tipNotificationService).tipsConfig;

            const numberType = "number";
            assert.strictEqual(typeof tipsConfig.daysAfterLastUsage, numberType);
            assert.strictEqual(typeof tipsConfig.firstTimeMaxDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.firstTimeMinDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.maxDaysToRemind, numberType);
            assert.strictEqual(typeof tipsConfig.minDaysToRemind, numberType);
        });
    });

    suite("showTipNotification", function () {
        suite("without user actions", function () {
            let windowShowInformationMessageStub: Sinon.SinonStub;

            suiteSetup(() => {
                windowShowInformationMessageStub = sinon
                    .stub(window, "showInformationMessage")
                    .returns(Promise.resolve(undefined));
            });

            suiteTeardown(() => {
                windowShowInformationMessageStub.restore();
            });

            test("should create config and fill shownDate into one of general tips", async () => {
                await tipNotificationService.showTipNotification("");

                assert.ok(config.has(tipsConfigName));

                const tipsConfig: RawTipsConfig = config.get(tipsConfigName);
                let shownTips = Object.values(tipsConfig.tips.generalTips).filter(
                    tip => tip.shownDate,
                );

                assert.strictEqual(shownTips.length, 1);
            });

            test("should create config and fill shownDate into one of specific tips", async () => {
                const specificTipKey = "networkInspectorLogsColorTheme";

                await tipNotificationService.showTipNotification("", false, specificTipKey);

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
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
                tipsConfigBefore.daysLeftBeforeGeneralTip = 5;
                tipsConfigBefore.lastExtensionUsageDate = new Date();
                tipsConfigBefore.lastExtensionUsageDate.setDate(
                    tipsConfigBefore.lastExtensionUsageDate.getDate() - 1,
                );
                config.set(tipsConfigName, tipsConfigBefore);

                await tipNotificationService.showTipNotification("");

                const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

                assert.deepStrictEqual(tipsConfigBefore.tips, tipsConfigAfter.tips);
                assert.deepStrictEqual(tipsConfigAfter.daysLeftBeforeGeneralTip, 4);
            });

            test("should show another tip from general tips for the first round", async () => {
                await (<any>tipNotificationService).initializeTipsConfig();
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
                tipsConfigBefore.tips.generalTips["networkInspector"].shownDate = new Date();
                config.set(tipsConfigName, tipsConfigBefore);

                await tipNotificationService.showTipNotification("");

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

            test("should show another tip from general tips for the second round", async () => {
                await (<any>tipNotificationService).initializeTipsConfig();
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
                const shownDate = new Date(2021, 6, 26);
                Object.values(tipsConfigBefore.tips.generalTips).forEach(tip => {
                    tip.shownDate = shownDate;
                });
                tipsConfigBefore.allTipsShownFirstly = true;
                tipsConfigBefore.daysLeftBeforeGeneralTip = 0;
                config.set(tipsConfigName, tipsConfigBefore);

                await tipNotificationService.showTipNotification("");

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

            test("should change allTipsShownFirstly from false to true in case all general tips have been shown for the first time", async () => {
                await (<any>tipNotificationService).initializeTipsConfig();
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
                const shownDate = new Date(2021, 6, 26);
                const generalTipsKeysBefore = Object.keys(tipsConfigBefore.tips.generalTips);

                for (let i = 0; i < generalTipsKeysBefore.length - 1; i++) {
                    tipsConfigBefore.tips.generalTips[
                        generalTipsKeysBefore[i]
                    ].shownDate = shownDate;
                }

                config.set(tipsConfigName, tipsConfigBefore);

                await tipNotificationService.showTipNotification("");

                const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

                const shownTips = Object.values(tipsConfigAfter.tips.generalTips).filter(
                    tip => tip.shownDate,
                );

                assert.strictEqual(shownTips.length, generalTipsKeysBefore.length);
                assert.strictEqual(tipsConfigAfter.allTipsShownFirstly, true);

                let assertCondition = () =>
                    tipsConfigAfter.daysLeftBeforeGeneralTip >= tipsConfigAfter.minDaysToRemind &&
                    tipsConfigAfter.daysLeftBeforeGeneralTip <= tipsConfigAfter.maxDaysToRemind;

                assert.strictEqual(assertCondition(), true);
            });

            test("should not show a general tip", async () => {
                await SettingsHelper.setShowTips(false);
                await (<any>tipNotificationService).initializeTipsConfig();

                await tipNotificationService.showTipNotification("");

                const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

                const shownGeneralTips = Object.values(tipsConfigAfter.tips.generalTips).filter(
                    tip => tip.shownDate,
                );
                const shownSpecificTips = Object.values(tipsConfigAfter.tips.specificTips).filter(
                    tip => tip.shownDate,
                );

                assert.strictEqual(shownGeneralTips.length, 0);
                assert.strictEqual(shownSpecificTips.length, 0);
            });

            test("should not show a specific tip", async () => {
                await SettingsHelper.setShowTips(false);
                await (<any>tipNotificationService).initializeTipsConfig();

                await tipNotificationService.showTipNotification(
                    "",
                    false,
                    "networkInspectorLogsColorTheme",
                );

                const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

                const shownGeneralTips = Object.values(tipsConfigAfter.tips.generalTips).filter(
                    tip => tip.shownDate,
                );
                const shownSpecificTips = Object.values(tipsConfigAfter.tips.specificTips).filter(
                    tip => tip.shownDate,
                );

                assert.strictEqual(shownGeneralTips.length, 0);
                assert.strictEqual(shownSpecificTips.length, 0);
            });

            // test("should update tips config after updating tips storage in new version of extension", async () => {
            //     await SettingsHelper.setShowTips(false);
            //     await (<any>tipNotificationService).initializeTipsConfig();

            //     const tipsConfigInitial = (TipNotificationService.getInstance() as any).parseDatesInRawConfig(
            //         ExtensionConfigManager.config.get(
            //             (TipNotificationService as any).TIPS_CONFIG_NAME,
            //         ),
            //     );

            //     await tipNotificationService.showTipNotification(
            //         "1.1.1",
            //         false,
            //         "networkInspectorLogsColorTheme",
            //     );

            //     const tipsConfigUpdated = (TipNotificationService.getInstance() as any).parseDatesInRawConfig(
            //         ExtensionConfigManager.config.get(
            //             (TipNotificationService as any).TIPS_CONFIG_NAME,
            //         ),
            //     );

            //     assert.notStrictEqual(tipsConfigInitial, tipsConfigUpdated);
            // });
        });

        suite("with user actions", function () {
            test("should not show tips after the user has disabled the display of tips", async () => {
                let windowShowInformationMessageStub = sinon
                    .stub(window, "showInformationMessage")
                    .returns(Promise.resolve("Don't show tips again"));

                await (<any>tipNotificationService).initializeTipsConfig();

                await tipNotificationService.showTipNotification("");

                const tipsConfigAfterDisplayingTip: RawTipsConfig = config.get(tipsConfigName);

                const shownGeneralTipsAfterDisplayingTip = Object.values(
                    tipsConfigAfterDisplayingTip.tips.generalTips,
                ).filter(tip => tip.shownDate);

                assert.strictEqual(shownGeneralTipsAfterDisplayingTip.length, 1);
                assert.strictEqual(SettingsHelper.getShowTips(), false);

                windowShowInformationMessageStub.restore();
            });
        });
    });

    suite("setKnownDateForFeatureById", function () {
        test("should add knownDate to a general tip", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipKey = "debuggingRNWAndMacOSApps";

            await tipNotificationService.setKnownDateForFeatureById(tipKey);

            const tipsConfigAfterAddingKnownDate: RawTipsConfig = config.get(tipsConfigName);

            assert.strictEqual(
                typeof tipsConfigAfterAddingKnownDate.tips.generalTips[tipKey].knownDate,
                "string",
                `knownDate of ${tipKey} isn't set`,
            );

            await tipNotificationService.setKnownDateForFeatureById(tipKey);

            const tipsConfigAfterUpdatingKnownDate: RawTipsConfig = config.get(tipsConfigName);

            const addedKnownDate = new Date(
                tipsConfigAfterAddingKnownDate.tips.generalTips[tipKey].knownDate as string,
            );
            const updatedKnownDate = new Date(
                tipsConfigAfterUpdatingKnownDate.tips.generalTips[tipKey].knownDate as string,
            );

            assert.strictEqual(updatedKnownDate.getTime() > addedKnownDate.getTime(), true);
        });

        test("should add knownDate to a specific tip", async () => {
            await (<any>tipNotificationService).initializeTipsConfig();
            const tipKey = "networkInspectorLogsColorTheme";

            await tipNotificationService.setKnownDateForFeatureById(tipKey, false);

            const tipsConfigAfter: RawTipsConfig = config.get(tipsConfigName);

            assert.strictEqual(
                typeof tipsConfigAfter.tips.specificTips[tipKey].knownDate,
                "string",
                `knownDate of ${tipKey} isn't set`,
            );
        });
    });
});

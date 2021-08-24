// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    TipNotificationService,
    TipNotificationConfig,
    TipsConfig,
} from "../../../src/extension/tipsNotificationsService/tipsNotificationService";
import { SettingsHelper } from "../../../src/extension/settingsHelper";
import * as Configstore from "configstore";
import * as assert from "assert";
import { window } from "vscode";
import * as sinon from "sinon";
import * as proxyquire from "proxyquire";
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
                await tipNotificationService.showTipNotification();

                assert.ok(config.has(tipsConfigName));

                const tipsConfig: RawTipsConfig = config.get(tipsConfigName);
                let shownTips = Object.values(tipsConfig.tips.generalTips).filter(
                    tip => tip.shownDate,
                );

                assert.strictEqual(shownTips.length, 1);
            });

            test("should create config and fill shownDate into one of specific tips", async () => {
                const specificTipKey = "networkInspectorLogsColorTheme";

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
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
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

            test("should show another tip from general tips for the first round", async () => {
                await (<any>tipNotificationService).initializeTipsConfig();
                const tipsConfigBefore: TipsConfig = (<any>tipNotificationService).tipsConfig;
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

                await tipNotificationService.showTipNotification();

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

                await tipNotificationService.showTipNotification();

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
        });

        suite("with user actions", function () {
            test("should not show tips after the user has disabled the display of tips", async () => {
                let windowShowInformationMessageStub = sinon
                    .stub(window, "showInformationMessage")
                    .returns(Promise.resolve("Don't show tips again"));

                await (<any>tipNotificationService).initializeTipsConfig();

                await tipNotificationService.showTipNotification();

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

    suite("updateTipsConfig", function () {
        const tipsNotificationServicePath =
            "../../../src/extension/tipsNotificationsService/tipsNotificationService";

        const mockedTipsStorageBefore = {
            generalTips: {
                elementInspector: {
                    text: "Element Inspector Tip Text",
                    anchorLink: "#react-native-commands-in-the-command-palette",
                },
                customEnvVariables: {
                    text: "Custom Env Variables Tip Text",
                    anchorLink: "#custom-environment-variables",
                },
            },
            specificTips: {
                networkInspectorLogsColorTheme: {
                    text: "Network Inspector Logs Tip Text",
                    anchorLink: "#network-inspector-logs-theme",
                },
            },
        };

        const expectedTipsConfigGeneralTipsBefore = {
            customEnvVariables: {},
            elementInspector: {},
        };

        const expectedTipsConfigSpecificTipsBefore = {
            networkInspectorLogsColorTheme: {},
        };

        test("should update config after deleting a tip from storage", async () => {
            const mockedTipsNotificationServiceBefore = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageBefore,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceBefore = mockedTipsNotificationServiceBefore.getInstance();

            await (<any>mockedTipsNotificationServiceInstanceBefore).initializeTipsConfig();

            const tipsConfigInitial = (<any>(
                mockedTipsNotificationServiceInstanceBefore
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const mockedTipsStorageAfter = {
                generalTips: {
                    elementInspector: {
                        text: "Element Inspector Tip Text",
                        anchorLink: "#react-native-commands-in-the-command-palette",
                    },
                },
                specificTips: {
                    networkInspectorLogsColorTheme: {
                        text: "Network Inspector Logs Tip Text",
                        anchorLink: "#network-inspector-logs-theme",
                    },
                },
            };

            const mockedTipsNotificationServiceAfter = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageAfter,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceAfter = mockedTipsNotificationServiceAfter.getInstance();

            await mockedTipsNotificationServiceInstanceAfter.updateTipsConfig();

            const tipsConfigUpdated = (<any>(
                mockedTipsNotificationServiceInstanceAfter
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const expectedTipsConfigGeneralTipsAfter = {
                elementInspector: {},
            };

            const expectedTipsConfigSpecificTipsAfter = {
                networkInspectorLogsColorTheme: {},
            };

            assert.notDeepStrictEqual(tipsConfigInitial, tipsConfigUpdated);

            assert.deepStrictEqual(
                tipsConfigInitial.tips.generalTips,
                expectedTipsConfigGeneralTipsBefore,
            );
            assert.deepStrictEqual(
                tipsConfigInitial.tips.specificTips,
                expectedTipsConfigSpecificTipsBefore,
            );

            assert.deepStrictEqual(
                tipsConfigUpdated.tips.generalTips,
                expectedTipsConfigGeneralTipsAfter,
            );
            assert.deepStrictEqual(
                tipsConfigUpdated.tips.specificTips,
                expectedTipsConfigSpecificTipsAfter,
            );
        });

        test("should update config after adding a tip to storage", async () => {
            const mockedTipsNotificationServiceBefore = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageBefore,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceBefore = mockedTipsNotificationServiceBefore.getInstance();

            await SettingsHelper.setShowTips(false);
            await (<any>mockedTipsNotificationServiceInstanceBefore).initializeTipsConfig();

            const tipsConfigInitial = (<any>(
                mockedTipsNotificationServiceInstanceBefore
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const mockedTipsStorageAfter = {
                generalTips: {
                    elementInspector: {
                        text: "Element Inspector Tip Text",
                        anchorLink: "#react-native-commands-in-the-command-palette",
                    },
                    customEnvVariables: {
                        text: "Custom Env Variables Tip Text",
                        anchorLink: "#custom-environment-variables",
                    },
                    networkInspector: {
                        text: "Network Inspector Tip Text",
                        anchorLink: "#network-inspector",
                    },
                },
                specificTips: {
                    networkInspectorLogsColorTheme: {
                        text: "Network Inspector Logs Tip Text",
                        anchorLink: "#network-inspector-logs-theme",
                    },
                },
            };

            const mockedTipsNotificationServiceAfter = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageAfter,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceAfter = mockedTipsNotificationServiceAfter.getInstance();

            await mockedTipsNotificationServiceInstanceAfter.updateTipsConfig();

            const tipsConfigUpdated = (<any>(
                mockedTipsNotificationServiceInstanceAfter
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const expectedTipsConfigGeneralTipsAfter = {
                elementInspector: {},
                customEnvVariables: {},
                networkInspector: {},
            };

            const expectedTipsConfigSpecificTipsAfter = {
                networkInspectorLogsColorTheme: {},
            };

            assert.notDeepStrictEqual(tipsConfigInitial, tipsConfigUpdated);

            assert.deepStrictEqual(
                tipsConfigInitial.tips.generalTips,
                expectedTipsConfigGeneralTipsBefore,
            );
            assert.deepStrictEqual(
                tipsConfigInitial.tips.specificTips,
                expectedTipsConfigSpecificTipsBefore,
            );

            assert.deepStrictEqual(
                tipsConfigUpdated.tips.generalTips,
                expectedTipsConfigGeneralTipsAfter,
            );
            assert.deepStrictEqual(
                tipsConfigUpdated.tips.specificTips,
                expectedTipsConfigSpecificTipsAfter,
            );
        });

        test("should update config after updating tips storage", async () => {
            const mockedTipsNotificationServiceBefore = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageBefore,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceBefore = mockedTipsNotificationServiceBefore.getInstance();

            await (<any>mockedTipsNotificationServiceInstanceBefore).initializeTipsConfig();

            const tipsConfigInitial = (<any>(
                mockedTipsNotificationServiceInstanceBefore
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const mockedTipsStorageAfter = {
                generalTips: {
                    elementInspector: {
                        text: "Element Inspector Tip Text",
                        anchorLink: "#react-native-commands-in-the-command-palette",
                    },
                    networkInspector: {
                        text: "Network Inspector Tip Text",
                        anchorLink: "#network-inspector",
                    },
                },
                specificTips: {
                    networkInspectorLogsColorTheme: {
                        text: "Network Inspector Logs Tip Text",
                        anchorLink: "#network-inspector-logs-theme",
                    },
                },
            };

            const mockedTipsNotificationServiceAfter = proxyquire(tipsNotificationServicePath, {
                "./tipsStorage": {
                    default: mockedTipsStorageAfter,
                },
            })["TipNotificationService"];
            const mockedTipsNotificationServiceInstanceAfter = mockedTipsNotificationServiceAfter.getInstance();

            await mockedTipsNotificationServiceInstanceAfter.updateTipsConfig();

            const tipsConfigUpdated = (<any>(
                mockedTipsNotificationServiceInstanceAfter
            )).parseDatesInRawConfig(config.get(tipsConfigName));

            const expectedTipsConfigGeneralTipsAfter = {
                elementInspector: {},
                networkInspector: {},
            };

            const expectedTipsConfigSpecificTipsAfter = {
                networkInspectorLogsColorTheme: {},
            };

            assert.notDeepStrictEqual(tipsConfigInitial, tipsConfigUpdated);

            assert.deepStrictEqual(
                tipsConfigInitial.tips.generalTips,
                expectedTipsConfigGeneralTipsBefore,
            );
            assert.deepStrictEqual(
                tipsConfigInitial.tips.specificTips,
                expectedTipsConfigSpecificTipsBefore,
            );

            assert.deepStrictEqual(
                tipsConfigUpdated.tips.generalTips,
                expectedTipsConfigGeneralTipsAfter,
            );
            assert.deepStrictEqual(
                tipsConfigUpdated.tips.specificTips,
                expectedTipsConfigSpecificTipsAfter,
            );
        });
    });
});

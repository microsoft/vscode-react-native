// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { IConfig, retryDownloadConfig } from "../remoteConfigHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { ExtensionConfigManager } from "../extensionConfigManager";
import tipsStorage from "./tipsStorage";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import { SettingsHelper } from "../../extension/settingsHelper";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import * as path from "path";

enum TipNotificationAction {
    GET_MORE_INFO = "tipsMoreInfo",
    DO_NOT_SHOW_AGAIN = "tipsDoNotShow",
    SHOWN = "tipShown",
}

export interface TipNotificationConfig extends IConfig {
    firstTimeMinDaysToRemind: number;
    firstTimeMaxDaysToRemind: number;
    minDaysToRemind: number;
    maxDaysToRemind: number;
    daysAfterLastUsage: number;
}

export interface TipInfo {
    knownDate?: Date;
    shownDate?: Date;
}

export interface Tips {
    [tipId: string]: TipInfo;
}

export interface AllTips {
    generalTips: Tips;
    specificTips: Tips;
}

export interface TipsConfig extends TipNotificationConfig {
    daysLeftBeforeGeneralTip: number;
    lastExtensionUsageDate?: Date;
    allTipsShownFirstly: boolean;
    tips: AllTips;
}

export interface GeneratedTipResponse {
    selection: string | undefined;
    tipKey: string;
}

export class TipNotificationService implements vscode.Disposable {
    private static instance: TipNotificationService;

    private readonly TIPS_NOTIFICATIONS_LOG_CHANNEL_NAME: string;
    private readonly TIPS_CONFIG_NAME: string;
    private readonly endpointURL: string;
    private readonly downloadConfigRequest: Promise<TipNotificationConfig>;
    private readonly getMoreInfoButtonText: string;
    private readonly doNotShowTipsAgainButtonText: string;

    private cancellationTokenSource: vscode.CancellationTokenSource;
    private _tipsConfig: TipsConfig | null;
    private logger: OutputChannelLogger;
    private showTips: boolean;

    public static getInstance(): TipNotificationService {
        if (!TipNotificationService.instance) {
            TipNotificationService.instance = new TipNotificationService();
        }

        return TipNotificationService.instance;
    }

    public dispose(): void {
        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();
    }

    private constructor() {
        this.endpointURL =
            "https://microsoft.github.io/vscode-react-native/tipsNotifications/tipsNotificationsConfig.json";
        this.TIPS_NOTIFICATIONS_LOG_CHANNEL_NAME = "Tips Notifications";
        this.TIPS_CONFIG_NAME = "tipsConfig";
        this.getMoreInfoButtonText = "Get more info";
        this.doNotShowTipsAgainButtonText = "Don't show tips again";

        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this._tipsConfig = null;
        this.downloadConfigRequest = retryDownloadConfig<TipNotificationConfig>(
            this.endpointURL,
            this.cancellationTokenSource,
        );
        this.showTips = SettingsHelper.getShowTips();
        this.logger = OutputChannelLogger.getChannel(
            this.TIPS_NOTIFICATIONS_LOG_CHANNEL_NAME,
            true,
        );
    }

    public async showTipNotification(
        isGeneralTip: boolean = true,
        specificTipKey?: string,
    ): Promise<void> {
        if (!isGeneralTip && !specificTipKey) {
            this.logger.debug("The specific tip key parameter isn't passed for a specific tip");
            return;
        }

        await this.initializeTipsConfig();

        if (!this.showTips) {
            return;
        }

        const curDate: Date = new Date();
        let tipResponse: GeneratedTipResponse | undefined;

        if (isGeneralTip) {
            this.deleteOutdatedKnownDate();
            if (this.tipsConfig.daysLeftBeforeGeneralTip === 0) {
                tipResponse = await this.showRandomGeneralTipNotification();
            } else {
                if (
                    this.tipsConfig.lastExtensionUsageDate &&
                    !this.areSameDates(curDate, this.tipsConfig.lastExtensionUsageDate)
                ) {
                    this.tipsConfig.daysLeftBeforeGeneralTip--;
                }
            }
        } else {
            tipResponse = await this.showSpecificTipNotification(<string>specificTipKey);
        }

        if (tipResponse) {
            await this.handleUserActionOnTip(tipResponse, isGeneralTip);
        }

        this.tipsConfig.lastExtensionUsageDate = curDate;
        ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, this.tipsConfig);
    }

    public async setKnownDateForFeatureById(
        key: string,
        isGeneralTip: boolean = true,
    ): Promise<void> {
        await this.initializeTipsConfig();

        if (isGeneralTip) {
            this.tipsConfig.tips.generalTips[key].knownDate = new Date();
        } else {
            this.tipsConfig.tips.specificTips[key].knownDate = new Date();
        }

        ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, this.tipsConfig);
    }

    public updateTipsConfig(): void {
        if (!ExtensionConfigManager.config.has(this.TIPS_CONFIG_NAME)) {
            return;
        }

        const tipsConfig = this.tipsConfig;

        tipsConfig.tips.generalTips = this.updateConfigTipsFromStorage(
            tipsStorage.generalTips,
            tipsConfig.tips.generalTips,
        );

        tipsConfig.tips.specificTips = this.updateConfigTipsFromStorage(
            tipsStorage.specificTips,
            tipsConfig.tips.specificTips,
        );

        this._tipsConfig = tipsConfig;
        ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, tipsConfig);
    }

    private updateConfigTipsFromStorage(
        storageTips: Record<string, unknown>,
        configTips: Tips,
    ): Tips {
        for (let key in configTips) {
            if (!(key in storageTips)) {
                delete configTips[key];
            }
        }

        for (let key in storageTips) {
            if (!(key in configTips)) {
                configTips[key] = {};
            }
        }

        return configTips;
    }

    private get tipsConfig(): TipsConfig {
        if (!this._tipsConfig) {
            if (!ExtensionConfigManager.config.has(this.TIPS_CONFIG_NAME)) {
                throw new Error("Could not find Tips config in the config store.");
            } else {
                this._tipsConfig = this.parseDatesInRawConfig(
                    ExtensionConfigManager.config.get(this.TIPS_CONFIG_NAME),
                );
            }
        }
        return this._tipsConfig;
    }

    private async handleUserActionOnTip(
        tipResponse: GeneratedTipResponse,
        isGeneralTip: boolean,
    ): Promise<void> {
        const { selection, tipKey } = tipResponse;

        if (selection === this.getMoreInfoButtonText) {
            this.sendTipNotificationActionTelemetry(tipKey, TipNotificationAction.GET_MORE_INFO);

            const readmeFile: string | null = findFileInFolderHierarchy(__dirname, "README.md");

            if (readmeFile) {
                const anchorLink: string = isGeneralTip
                    ? this.getGeneralTipNotificationAnchorLinkByKey(tipKey)
                    : this.getSpecificTipNotificationAnchorLinkByKey(tipKey);

                const uriFile = vscode.Uri.parse(
                    path.normalize(`file://${readmeFile}${anchorLink}`),
                );

                vscode.commands.executeCommand("markdown.showPreview", uriFile);
            }
        }

        if (selection === this.doNotShowTipsAgainButtonText) {
            this.sendTipNotificationActionTelemetry(
                tipKey,
                TipNotificationAction.DO_NOT_SHOW_AGAIN,
            );
            this.showTips = false;
            await SettingsHelper.setShowTips(this.showTips);
        }
    }

    private async initializeTipsConfig(): Promise<void> {
        this.showTips = SettingsHelper.getShowTips();
        if (this._tipsConfig) {
            return;
        }

        let tipsConfig: TipsConfig;
        if (!ExtensionConfigManager.config.has(this.TIPS_CONFIG_NAME)) {
            tipsConfig = {
                daysLeftBeforeGeneralTip: 0,
                firstTimeMinDaysToRemind: 3,
                firstTimeMaxDaysToRemind: 6,
                minDaysToRemind: 6,
                maxDaysToRemind: 10,
                daysAfterLastUsage: 30,
                allTipsShownFirstly: false,
                tips: {
                    generalTips: {},
                    specificTips: {},
                },
            };

            tipsConfig = await this.mergeRemoteConfigToLocal(tipsConfig);

            Object.keys(tipsStorage.generalTips).forEach(key => {
                tipsConfig.tips.generalTips[key] = {};
            });

            Object.keys(tipsStorage.specificTips).forEach(key => {
                tipsConfig.tips.specificTips[key] = {};
            });

            ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, tipsConfig);
        } else {
            tipsConfig = this.parseDatesInRawConfig(
                ExtensionConfigManager.config.get(this.TIPS_CONFIG_NAME),
            );
        }

        this._tipsConfig = tipsConfig;
    }

    private async showRandomGeneralTipNotification(): Promise<GeneratedTipResponse> {
        let generalTipsForRandom: Array<string>;
        const generalTips: Tips = this.tipsConfig.tips.generalTips;
        const generalTipsKeys: Array<string> = Object.keys(this.tipsConfig.tips.generalTips);

        if (!this.tipsConfig.allTipsShownFirstly) {
            generalTipsForRandom = generalTipsKeys.filter(
                tipId => !generalTips[tipId].knownDate && !generalTips[tipId].shownDate,
            );
            if (generalTipsForRandom.length === 1) {
                this.tipsConfig.allTipsShownFirstly = true;
            }
        } else {
            generalTipsForRandom = generalTipsKeys.sort((tipId1, tipId2) => {
                return (
                    // According to ECMAScript standard: The exact moment of midnight at the beginning of
                    // 01 January, 1970 UTC is represented by the value +0.
                    (generalTips[tipId2].shownDate ?? new Date(+0)).getTime() -
                    (generalTips[tipId1].shownDate ?? new Date(+0)).getTime()
                );
            });
        }

        let leftIndex: number;

        switch (generalTipsForRandom.length) {
            case 0:
                return {
                    selection: undefined,
                    tipKey: "",
                };
            case 1:
                leftIndex = 0;
                break;
            case 2:
                leftIndex = 1;
                break;
            default:
                leftIndex = 2;
        }

        const randIndex: number = this.getRandomIntInclusive(
            leftIndex,
            generalTipsForRandom.length - 1,
        );
        const selectedGeneralTipKey: string = generalTipsForRandom[randIndex];
        const tipNotificationText = this.getGeneralTipNotificationTextByKey(selectedGeneralTipKey);

        this.tipsConfig.tips.generalTips[selectedGeneralTipKey].shownDate = new Date();

        this._tipsConfig = await this.mergeRemoteConfigToLocal(this.tipsConfig);
        const daysBeforeNextTip: number = this.tipsConfig.allTipsShownFirstly
            ? this.getRandomIntInclusive(
                  this.tipsConfig.minDaysToRemind,
                  this.tipsConfig.maxDaysToRemind,
              )
            : this.getRandomIntInclusive(
                  this.tipsConfig.firstTimeMinDaysToRemind,
                  this.tipsConfig.firstTimeMaxDaysToRemind,
              );

        this.tipsConfig.daysLeftBeforeGeneralTip = daysBeforeNextTip;

        ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, this.tipsConfig);

        this.sendShowTipNotificationTelemetry(selectedGeneralTipKey);

        return {
            selection: await vscode.window.showInformationMessage(
                tipNotificationText,
                ...[this.getMoreInfoButtonText, this.doNotShowTipsAgainButtonText],
            ),
            tipKey: selectedGeneralTipKey,
        };
    }

    private async showSpecificTipNotification(
        tipKey: string,
    ): Promise<GeneratedTipResponse | undefined> {
        if (this.tipsConfig.tips.specificTips[tipKey].shownDate) {
            return;
        }

        const tipNotificationText = this.getSpecificTipNotificationTextByKey(tipKey);

        this.tipsConfig.tips.specificTips[tipKey].shownDate = new Date();
        ExtensionConfigManager.config.set(this.TIPS_CONFIG_NAME, this.tipsConfig);

        this.sendShowTipNotificationTelemetry(tipKey);

        return {
            selection: await vscode.window.showInformationMessage(
                tipNotificationText,
                ...[this.getMoreInfoButtonText, this.doNotShowTipsAgainButtonText],
            ),
            tipKey,
        };
    }

    private async mergeRemoteConfigToLocal(tipsConfig: TipsConfig): Promise<TipsConfig> {
        const remoteConfig = await this.downloadConfigRequest;
        tipsConfig.firstTimeMinDaysToRemind = remoteConfig.firstTimeMinDaysToRemind;
        tipsConfig.firstTimeMaxDaysToRemind = remoteConfig.firstTimeMaxDaysToRemind;
        tipsConfig.minDaysToRemind = remoteConfig.minDaysToRemind;
        tipsConfig.maxDaysToRemind = remoteConfig.maxDaysToRemind;
        tipsConfig.daysAfterLastUsage = remoteConfig.daysAfterLastUsage;
        return tipsConfig;
    }

    private getGeneralTipNotificationTextByKey(key: string): string {
        return tipsStorage.generalTips[key].text;
    }

    private getSpecificTipNotificationTextByKey(key: string): string {
        return tipsStorage.specificTips[key].text;
    }

    private getGeneralTipNotificationAnchorLinkByKey(key: string): string {
        return tipsStorage.generalTips[key].anchorLink;
    }

    private getSpecificTipNotificationAnchorLinkByKey(key: string): string {
        return tipsStorage.specificTips[key].anchorLink;
    }

    private deleteOutdatedKnownDate(): void {
        const dateNow: Date = new Date();
        const generalTips: Tips = this.tipsConfig.tips.generalTips;
        const generalTipsKeys: Array<string> = Object.keys(this.tipsConfig.tips.generalTips);

        generalTipsKeys
            .filter(tipKey => {
                const knownDate = generalTips[tipKey].knownDate ?? new Date();
                return (
                    generalTips[tipKey].knownDate &&
                    this.getDifferenceInDays(knownDate, dateNow) >
                        this.tipsConfig.daysAfterLastUsage
                );
            })
            .forEach(tipKey => {
                delete generalTips[tipKey].knownDate;
            });
    }

    private areSameDates(date1: Date, date2: Date): boolean {
        return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
        );
    }

    private getDifferenceInDays(date1: Date, date2: Date): number {
        const diffInMs = Math.abs(date2.getTime() - date1.getTime());
        return diffInMs / (1000 * 60 * 60 * 24);
    }

    private getRandomIntInclusive(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    private parseDatesInRawConfig(rawTipsConfig: TipsConfig): TipsConfig {
        if (rawTipsConfig.lastExtensionUsageDate) {
            rawTipsConfig.lastExtensionUsageDate = new Date(rawTipsConfig.lastExtensionUsageDate);
        }

        const parseDatesInTips = (tipsKeys: string[], tipsType: "generalTips" | "specificTips") => {
            tipsKeys.forEach(tipKey => {
                let tip = rawTipsConfig.tips[tipsType][tipKey];
                if (tip.knownDate) {
                    rawTipsConfig.tips[tipsType][tipKey].knownDate = new Date(tip.knownDate);
                }
                if (tip.shownDate) {
                    if (tip.shownDate) {
                        rawTipsConfig.tips[tipsType][tipKey].shownDate = new Date(tip.shownDate);
                    }
                }
            });
        };

        parseDatesInTips(Object.keys(rawTipsConfig.tips.specificTips), "specificTips");
        parseDatesInTips(Object.keys(rawTipsConfig.tips.generalTips), "generalTips");

        return rawTipsConfig;
    }

    private sendShowTipNotificationTelemetry(tipKey: string): void {
        const showTipNotificationEvent = TelemetryHelper.createTelemetryEvent(
            "showTipNotification",
            {
                tipKey,
            },
        );

        Telemetry.send(showTipNotificationEvent);
    }

    private sendTipNotificationActionTelemetry(
        tipKey: string,
        tipNotificationAction: TipNotificationAction,
    ): void {
        const tipNotificationActionEvent = TelemetryHelper.createTelemetryEvent(
            "tipNotificationAction",
            {
                tipKey,
                tipNotificationAction,
            },
        );

        Telemetry.send(tipNotificationActionEvent);
    }
}

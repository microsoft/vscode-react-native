// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { IConfig, retryDownloadConfig } from "../remoteConfigHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { ExtensionConfigManager } from "../extensionConfigManager";
import tipsStorage from "./tipsStorage";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
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
    knownDate?: Date | string;
    shownDate?: Date | string;
}

export interface Tips {
    [tipId: string]: TipInfo;
}

export interface AllTips {
    generalTips: Tips;
    specificTips: Tips;
}

export interface TipsConfig extends TipNotificationConfig {
    showTips: boolean;
    daysLeftBeforeGeneralTip: number;
    lastExtensionUsageDate?: Date | string;
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
    private readonly endpointURL: string;
    private readonly downloadConfigRequest: Promise<TipNotificationConfig>;
    private readonly getMoreInfoButtonText: string;
    private readonly doNotShowTipsAgainButtonText: string;

    private cancellationTokenSource: vscode.CancellationTokenSource;
    private logger: OutputChannelLogger;

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
        this.getMoreInfoButtonText = "Get more info";
        this.doNotShowTipsAgainButtonText = "Don't show tips again";

        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this.downloadConfigRequest = retryDownloadConfig<TipNotificationConfig>(
            this.endpointURL,
            this.cancellationTokenSource,
        );
        this.logger = OutputChannelLogger.getChannel(this.TIPS_NOTIFICATIONS_LOG_CHANNEL_NAME);
    }

    public async showTipNotification(
        isGeneralTip: boolean = true,
        specificTipKey?: string,
    ): Promise<void> {
        if (!isGeneralTip && !specificTipKey) {
            this.logger.debug("The specific tip key parameter isn't passed for a specific tip");
            return;
        }

        const config: TipsConfig = await this.getOrCreateDefaultTipsConfig();

        if (!config.showTips) {
            return;
        }

        const curDate: Date = new Date();
        let tipResponse: GeneratedTipResponse | undefined;

        if (isGeneralTip) {
            this.deleteOutdatedKnownDate(config);
            if (config.daysLeftBeforeGeneralTip === 0) {
                tipResponse = await this.showRandomGeneralTipNotification(config);
            } else {
                if (
                    config.lastExtensionUsageDate &&
                    !this.areSameDates(curDate, new Date(config.lastExtensionUsageDate))
                ) {
                    config.daysLeftBeforeGeneralTip--;
                }
            }
        } else {
            tipResponse = await this.showSpecificTipNotification(config, <string>specificTipKey);
        }

        if (tipResponse) {
            await this.handleUserActionOnTip(tipResponse, isGeneralTip, config);
        }

        config.lastExtensionUsageDate = curDate;
        ExtensionConfigManager.config.set("tipsConfig", config);
    }

    public async setKnownDateForFeatureById(
        key: string,
        isGeneralTip: boolean = true,
    ): Promise<void> {
        const config: TipsConfig = await this.getOrCreateDefaultTipsConfig();

        if (isGeneralTip) {
            config.tips.generalTips[key].knownDate = new Date();
        } else {
            config.tips.specificTips[key].knownDate = new Date();
        }

        ExtensionConfigManager.config.set("tipsConfig", config);
    }

    private async handleUserActionOnTip(
        tipResponse: GeneratedTipResponse,
        isGeneralTip: boolean,
        config: TipsConfig,
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
            config.showTips = false;
            ExtensionConfigManager.config.set("tipsConfig", config);
        }
    }

    private async getOrCreateDefaultTipsConfig(): Promise<TipsConfig> {
        if (ExtensionConfigManager.config.has("tipsConfig")) {
            return ExtensionConfigManager.config.get("tipsConfig");
        }

        let tipsConfig: TipsConfig = {
            showTips: true,
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

        return tipsConfig;
    }

    private async showRandomGeneralTipNotification(
        config: TipsConfig,
    ): Promise<GeneratedTipResponse> {
        let generalTipsForRandom: Array<string>;
        const generalTips: Tips = config.tips.generalTips;
        const generalTipsKeys: Array<string> = Object.keys(config.tips.generalTips);

        if (!config.allTipsShownFirstly) {
            generalTipsForRandom = generalTipsKeys.filter(
                tipId => !generalTips[tipId].knownDate && !generalTips[tipId].shownDate,
            );
        } else {
            generalTipsForRandom = generalTipsKeys.sort((tipId1, tipId2) => {
                return (
                    new Date(generalTips[tipId2].shownDate ?? "").getTime() -
                    new Date(generalTips[tipId1].shownDate ?? "").getTime()
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

        config.tips.generalTips[selectedGeneralTipKey].shownDate = new Date();

        const daysBeforeNextTip: number = config.allTipsShownFirstly
            ? this.getRandomIntInclusive(config.minDaysToRemind, config.maxDaysToRemind)
            : this.getRandomIntInclusive(
                  config.firstTimeMinDaysToRemind,
                  config.firstTimeMaxDaysToRemind,
              );

        config.daysLeftBeforeGeneralTip = daysBeforeNextTip;

        ExtensionConfigManager.config.set("tipsConfig", config);

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
        config: TipsConfig,
        tipKey: string,
    ): Promise<GeneratedTipResponse | undefined> {
        if (config.tips.specificTips[tipKey].shownDate) {
            return;
        }

        const tipNotificationText = this.getSpecificTipNotificationTextByKey(tipKey);

        config.tips.specificTips[tipKey].shownDate = new Date();
        ExtensionConfigManager.config.set("tipsConfig", config);

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

    private deleteOutdatedKnownDate(config: TipsConfig): void {
        const dateNow: Date = new Date();
        const generalTips: Tips = config.tips.generalTips;
        const generalTipsKeys: Array<string> = Object.keys(config.tips.generalTips);

        generalTipsKeys
            .filter(tipKey => {
                const knownDate = new Date(generalTips[tipKey].knownDate ?? "");
                return (
                    generalTips[tipKey].knownDate &&
                    this.getDifferenceInDays(knownDate, dateNow) > config.daysAfterLastUsage
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

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { IConfig, retryDownloadConfig } from "../serviceHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { Telemetry } from "../../common/telemetry";
import { ExtensionConfigManager } from "../extensionConfigManager";
import tipsStorage from "./tipsStorage";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import * as path from "path";

const getMoreInfoButtonText: string = "Get more info";
const doNotShowTipsAgainButtonText: string = "Don't show tips again";

enum TipNotificationTelemetryEvents {
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
    showTips: boolean;
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

    private readonly endpointURL: string;
    private cancellationTokenSource: vscode.CancellationTokenSource;

    public readonly downloadConfigRequest: Promise<TipNotificationConfig>;

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

        this.downloadConfigRequest = retryDownloadConfig<TipNotificationConfig>(
            this.endpointURL,
            this.cancellationTokenSource,
        );
    }

    private async getOrCreateDefaultTipsConfig(): Promise<TipsConfig> {
        if (ExtensionConfigManager.config.has("tipsConfig")) {
            return ExtensionConfigManager.config.get("tipsConfig");
        }

        const tipNotificationService: TipNotificationService = TipNotificationService.getInstance();
        const remoteConfig = await tipNotificationService.downloadConfigRequest;
        const tipsConfig: TipsConfig = {
            showTips: true,
            daysLeftBeforeGeneralTip: 0,
            firstTimeMinDaysToRemind: remoteConfig.firstTimeMinDaysToRemind,
            firstTimeMaxDaysToRemind: remoteConfig.firstTimeMaxDaysToRemind,
            minDaysToRemind: remoteConfig.minDaysToRemind,
            maxDaysToRemind: remoteConfig.maxDaysToRemind,
            daysAfterLastUsage: remoteConfig.daysAfterLastUsage,
            allTipsShownFirstly: false,
            tips: {
                generalTips: {},
                specificTips: {},
            },
        };

        Object.keys(tipsStorage.generalTips).forEach(key => {
            tipsConfig.tips.generalTips[key] = {};
        });

        Object.keys(tipsStorage.specificTips).forEach(key => {
            tipsConfig.tips.specificTips[key] = {};
        });

        return tipsConfig;
    }

    public async showTipNotification(
        isGeneralTip: boolean = true,
        specificTipKey?: string,
    ): Promise<void> {
        if (!isGeneralTip && !specificTipKey) {
            return;
        }

        const readmeFile: string | null = findFileInFolderHierarchy(__dirname, "README.md");
        const config: TipsConfig = await this.getOrCreateDefaultTipsConfig();

        if (!config.showTips || !readmeFile) {
            return;
        }

        if (isGeneralTip) {
            this.deleteOutdatedKnownDate(config);
        }

        if (!isGeneralTip || config.daysLeftBeforeGeneralTip === 0) {
            const { selection, tipKey } = isGeneralTip
                ? await this.showRandomGeneralTipNotification(config)
                : await this.showSpecificTipNotification(config, <string>specificTipKey);

            if (selection === getMoreInfoButtonText) {
                this.sendTipNotificationTelemetry(
                    tipKey,
                    TipNotificationTelemetryEvents.GET_MORE_INFO,
                );

                const anchorLink: string = isGeneralTip
                    ? this.getGeneralTipNotificationAnchorLinkByKey(tipKey)
                    : this.getSpecificTipNotificationAnchorLinkByKey(tipKey);

                const uriFile = vscode.Uri.parse(
                    path.normalize(`file://${readmeFile}${anchorLink}`),
                );

                vscode.commands.executeCommand("markdown.showPreview", uriFile);
            }

            if (selection === doNotShowTipsAgainButtonText) {
                this.sendTipNotificationTelemetry(
                    tipKey,
                    TipNotificationTelemetryEvents.DO_NOT_SHOW_AGAIN,
                );

                config.showTips = false;
                ExtensionConfigManager.config.set("tipsConfig", config);
            }
        } else {
            const curDate: Date = new Date();
            if (
                config.lastExtensionUsageDate &&
                !this.areSameDates(curDate, new Date(config.lastExtensionUsageDate))
            ) {
                config.daysLeftBeforeGeneralTip--;
                config.lastExtensionUsageDate = curDate;

                ExtensionConfigManager.config.set("tipsConfig", config);
            }
        }
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

    private async showRandomGeneralTipNotification(
        config: TipsConfig,
    ): Promise<GeneratedTipResponse> {
        let generalTipsForRandom: Array<string>;
        const generalTips: Tips = config.tips.generalTips;
        const generalTipsKeys: Array<string> = Object.keys(config.tips.generalTips);

        if (config.allTipsShownFirstly) {
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

        config.lastExtensionUsageDate = new Date();
        config.daysLeftBeforeGeneralTip = daysBeforeNextTip;

        ExtensionConfigManager.config.set("tipsConfig", config);

        this.sendTipNotificationTelemetry(
            selectedGeneralTipKey,
            TipNotificationTelemetryEvents.SHOWN,
        );

        return {
            selection: await vscode.window.showInformationMessage(
                tipNotificationText,
                ...[getMoreInfoButtonText, doNotShowTipsAgainButtonText],
            ),
            tipKey: selectedGeneralTipKey,
        };
    }

    private async showSpecificTipNotification(
        config: TipsConfig,
        tipKey: string,
    ): Promise<GeneratedTipResponse> {
        const tipNotificationText = this.getSpecificTipNotificationTextByKey(tipKey);

        config.tips.specificTips[tipKey].shownDate = new Date();
        config.lastExtensionUsageDate = new Date();

        ExtensionConfigManager.config.set("tipsConfig", config);

        this.sendTipNotificationTelemetry(tipKey, TipNotificationTelemetryEvents.SHOWN);

        return {
            selection: await vscode.window.showInformationMessage(
                tipNotificationText,
                ...[getMoreInfoButtonText, doNotShowTipsAgainButtonText],
            ),
            tipKey,
        };
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

    private deleteOutdatedKnownDate(config: TipsConfig) {
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

    private sendTipNotificationTelemetry(
        tipKey: string,
        tipNotificationResultStatus: TipNotificationTelemetryEvents,
    ): void {
        const showTipNotificationEvent = TelemetryHelper.createTelemetryEvent(
            "showTipNotification",
        );

        TelemetryHelper.addTelemetryEventProperty(
            showTipNotificationEvent,
            tipKey,
            tipNotificationResultStatus,
            false,
        );

        Telemetry.send(showTipNotificationEvent);
    }
}

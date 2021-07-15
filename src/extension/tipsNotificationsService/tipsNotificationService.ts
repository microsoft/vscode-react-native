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

export interface TipsConfig {
    showTips: boolean;
    daysLeftBeforeTip: number;
    lastExtensionUsageDate?: Date;
    firstTimeMinDaysToRemind: number;
    firstTimeMaxDaysToRemind: number;
    minDaysToRemind: number;
    maxDaysToRemind: number;
    daysAfterLastUsage: number;
    allTipsShownFirstly: boolean;
    tips: AllTips;
}

export interface GeneratedTipResponse {
    selection: Thenable<string | undefined>;
    tipKey: string;
}

export class TipNotificationService implements vscode.Disposable {
    private static instance: TipNotificationService;

    private readonly endpointURL: string;
    private cancellationTokenSource: vscode.CancellationTokenSource;

    public readonly downloadConfigRequest: Promise<TipNotificationConfig>;

    public static create(): TipNotificationService {
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
}

export async function showGeneralTipNotification(): Promise<void> {
    const readmeFile: string | null = findFileInFolderHierarchy(__dirname, "README.md");

    let config: TipsConfig = await getOrCreateDefaultTipsConfig();

    updateOutdatedKnownDate(config);

    if (config.showTips && config.daysLeftBeforeTip === 0 && readmeFile) {
        const { selection: selectedButton, tipKey } = showRandomGeneralTipNotification(config);

        selectedButton.then(selection => {
            if (selection === getMoreInfoButtonText) {
                sendTipNotificationTelemetry(tipKey, TipNotificationTelemetryEvents.GET_MORE_INFO);

                const anchorLink: string = getGeneralTipNotificationAnchorLinkByKey(tipKey);
                const uriFile = vscode.Uri.parse(
                    path.normalize(`file://${readmeFile}${anchorLink}`),
                );

                vscode.commands.executeCommand("markdown.showPreview", uriFile);
            }
            if (selection === doNotShowTipsAgainButtonText) {
                sendTipNotificationTelemetry(
                    tipKey,
                    TipNotificationTelemetryEvents.DO_NOT_SHOW_AGAIN,
                );

                config.showTips = false;
                ExtensionConfigManager.config.set("tipsConfig", config);
            }
        });
    } else {
        const curDate: Date = new Date();
        if (
            config.lastExtensionUsageDate &&
            !areSameDates(curDate, new Date(config.lastExtensionUsageDate))
        ) {
            config.daysLeftBeforeTip--;
            config.lastExtensionUsageDate = curDate;

            ExtensionConfigManager.config.set("tipsConfig", config);
        }
    }
}

export async function setKnownDateForFeatureGeneralTipByKey(key: string): Promise<void> {
    let config: TipsConfig = await getOrCreateDefaultTipsConfig();
    config.tips.generalTips[key].knownDate = new Date();
    ExtensionConfigManager.config.set("tipsConfig", config);
}

async function getOrCreateDefaultTipsConfig(): Promise<TipsConfig> {
    if (ExtensionConfigManager.config.has("tipsConfig")) {
        return ExtensionConfigManager.config.get("tipsConfig");
    }

    const tipNotificationService: TipNotificationService = TipNotificationService.create();
    const remoteConfig = await tipNotificationService.downloadConfigRequest;
    const tipsConfig: TipsConfig = {
        showTips: true,
        daysLeftBeforeTip: 0,
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

function showRandomGeneralTipNotification(config: TipsConfig): GeneratedTipResponse {
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
                selection: new Promise(() => undefined),
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

    const randIndex: number = getRandomIntInclusive(leftIndex, generalTipsForRandom.length - 1);
    const selectedGeneralTipKey: string = generalTipsForRandom[randIndex];
    const tipNotificationText = getGeneralTipNotificationTextByKey(selectedGeneralTipKey);

    config.tips.generalTips[selectedGeneralTipKey].shownDate = new Date();

    const daysBeforeNextTip: number = config.allTipsShownFirstly
        ? getRandomIntInclusive(config.minDaysToRemind, config.maxDaysToRemind)
        : getRandomIntInclusive(config.firstTimeMinDaysToRemind, config.firstTimeMaxDaysToRemind);

    config.lastExtensionUsageDate = new Date();
    config.daysLeftBeforeTip = daysBeforeNextTip;

    ExtensionConfigManager.config.set("tipsConfig", config);

    sendTipNotificationTelemetry(selectedGeneralTipKey, TipNotificationTelemetryEvents.SHOWN);

    return {
        selection: vscode.window.showInformationMessage(
            tipNotificationText,
            ...[getMoreInfoButtonText, doNotShowTipsAgainButtonText],
        ),
        tipKey: selectedGeneralTipKey,
    };
}

export function getGeneralTipNotificationTextByKey(key: string): string {
    return tipsStorage.generalTips[key].text;
}

export function getSpecificTipNotificationTextByKey(key: string): string {
    return tipsStorage.specificTips[key].text;
}

export function getGeneralTipNotificationAnchorLinkByKey(key: string): string {
    return tipsStorage.generalTips[key].anchorLink;
}

export function getSpecificTipNotificationAnchorLinkByKey(key: string): string {
    return tipsStorage.specificTips[key].anchorLink;
}

function updateOutdatedKnownDate(config: TipsConfig) {
    const dateNow: Date = new Date();
    const generalTips: Tips = config.tips.generalTips;
    const generalTipsKeys: Array<string> = Object.keys(config.tips.generalTips);

    generalTipsKeys
        .filter(tipKey => {
            const knownDate = new Date(generalTips[tipKey].knownDate ?? "");
            return (
                generalTips[tipKey].knownDate &&
                getDifferenceInDays(knownDate, dateNow) > config.daysAfterLastUsage
            );
        })
        .forEach(tipKey => {
            generalTips[tipKey].knownDate = undefined;
        });
}

function areSameDates(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

function getDifferenceInDays(date1: Date, date2: Date): number {
    const diffInMs = Math.abs(date2.getTime() - date1.getTime());
    return diffInMs / (1000 * 60 * 60 * 24);
}

function getRandomIntInclusive(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sendTipNotificationTelemetry(
    tipKey: string,
    tipNotificationResultStatus: TipNotificationTelemetryEvents,
): void {
    const showTipNotificationEvent = TelemetryHelper.createTelemetryEvent("showTipNotification");

    TelemetryHelper.addTelemetryEventProperty(
        showTipNotificationEvent,
        tipKey,
        tipNotificationResultStatus,
        false,
    );

    Telemetry.send(showTipNotificationEvent);
}

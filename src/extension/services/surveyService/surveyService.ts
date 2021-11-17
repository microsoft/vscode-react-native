// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { IConfig, retryDownloadConfig } from "../remoteConfigHelper";
import { ExtensionConfigManager } from "../../extensionConfigManager";
import { TelemetryHelper } from "../../../common/telemetryHelper";
import { Telemetry } from "../../../common/telemetry";
import { areSameDates } from "../../../common/utils";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

enum SurveyNotificationReaction {
    ACCEPT = "accept",
    CANCEL = "cancel",
}

interface RemoteSurveyConfig extends IConfig {
    shortPeriodToRemind: number;
    longPeriodToRemind: number;
    popCoveragePercent: number;
    surveyUrl: string;
    enabled: boolean;
}

export interface SurveyConfig extends RemoteSurveyConfig {
    daysLeftBeforeSurvey: number;
    lastExtensionUsageDate?: Date;
}

export class SurveyService implements vscode.Disposable {
    private static instance: SurveyService;

    private readonly SURVEY_CONFIG_NAME: string;
    private readonly endpointURL: string;
    private readonly downloadConfigRequest: Promise<RemoteSurveyConfig>;

    private cancellationTokenSource: vscode.CancellationTokenSource;
    private _surveyConfig: SurveyConfig | null;
    private extensionFirstTimeInstalled: boolean;

    public static getInstance(): SurveyService {
        if (!SurveyService.instance) {
            SurveyService.instance = new SurveyService();
        }

        return SurveyService.instance;
    }

    private constructor() {
        this.endpointURL =
            "https://microsoft.github.io/vscode-react-native/surveys/surveyConfig.json";
        this.SURVEY_CONFIG_NAME = "surveyConfig";

        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        this._surveyConfig = null;
        this.extensionFirstTimeInstalled = false;
        this.downloadConfigRequest = retryDownloadConfig<RemoteSurveyConfig>(
            this.endpointURL,
            this.cancellationTokenSource,
        );
    }

    public async promptSurvey(): Promise<void> {
        await this.initializeSurveyConfig();

        if (!this.surveyConfig.enabled) {
            return;
        }

        const curDate: Date = new Date();

        if (this.surveyConfig.daysLeftBeforeSurvey === 0) {
            this._surveyConfig = await this.mergeRemoteConfigToLocal(this.surveyConfig);
            if (this.isCandidate()) {
                await this.showSurveyNotification();
                this.surveyConfig.daysLeftBeforeSurvey = this.surveyConfig.longPeriodToRemind;
            } else {
                this.surveyConfig.daysLeftBeforeSurvey = this.surveyConfig.shortPeriodToRemind;
            }
        } else if (
            this.surveyConfig.lastExtensionUsageDate &&
            !areSameDates(curDate, this.surveyConfig.lastExtensionUsageDate)
        ) {
            this.surveyConfig.daysLeftBeforeSurvey--;
        }

        this.surveyConfig.lastExtensionUsageDate = curDate;
        ExtensionConfigManager.config.set(this.SURVEY_CONFIG_NAME, this.surveyConfig);
    }

    public setExtensionFirstTimeInstalled(extensionFirstTimeInstalled: boolean): void {
        this.extensionFirstTimeInstalled = extensionFirstTimeInstalled;
    }

    public dispose(): void {
        this.cancellationTokenSource.cancel();
        this.cancellationTokenSource.dispose();
    }

    private async initializeSurveyConfig(): Promise<void> {
        if (this._surveyConfig) {
            return;
        }

        let surveyConfig: SurveyConfig;
        if (!ExtensionConfigManager.config.has(this.SURVEY_CONFIG_NAME)) {
            surveyConfig = {
                shortPeriodToRemind: 30,
                longPeriodToRemind: 90,
                popCoveragePercent: 0.1,
                enabled: false,
                daysLeftBeforeSurvey: this.extensionFirstTimeInstalled ? 30 : 5,
                surveyUrl: "",
            };

            surveyConfig = await this.mergeRemoteConfigToLocal(surveyConfig);

            ExtensionConfigManager.config.set(this.SURVEY_CONFIG_NAME, surveyConfig);
        } else {
            surveyConfig = this.prepareRawConfig(
                ExtensionConfigManager.config.get(this.SURVEY_CONFIG_NAME),
            );
        }

        this._surveyConfig = surveyConfig;
    }

    private async showSurveyNotification(): Promise<void> {
        const giveFeedbackButtonText = localize("giveFeedback", "Give Feedback");
        const remindLaterButtonText = localize("remindLater", "Remind Me later");
        const notificationText = localize(
            "surveyNotificationText",
            "Got a moment to help the React Native Tools team? Please tell us about your experience with the extension so far.",
        );
        const surveyName = "satisfactionSurvey";

        this.sendPromptSurveyTelemetry(surveyName);

        const selection = await vscode.window.showInformationMessage(
            notificationText,
            giveFeedbackButtonText,
            remindLaterButtonText,
        );

        if (!selection || selection === remindLaterButtonText) {
            this.sendSurveyNotificationReactionTelemetry(
                surveyName,
                SurveyNotificationReaction.CANCEL,
            );
        }
        if (selection === giveFeedbackButtonText && this.surveyConfig.surveyUrl) {
            vscode.env.openExternal(vscode.Uri.parse(this.surveyConfig.surveyUrl));
            this.sendSurveyNotificationReactionTelemetry(
                surveyName,
                SurveyNotificationReaction.ACCEPT,
            );
        }
    }

    private get surveyConfig(): SurveyConfig {
        if (!this._surveyConfig) {
            if (!ExtensionConfigManager.config.has(this.SURVEY_CONFIG_NAME)) {
                throw new Error("Could not find Survey config in the config store.");
            } else {
                this._surveyConfig = this.prepareRawConfig(
                    ExtensionConfigManager.config.get(this.SURVEY_CONFIG_NAME),
                );
            }
        }
        return this._surveyConfig as SurveyConfig;
    }

    private isCandidate(): boolean {
        return this.surveyConfig.popCoveragePercent > Math.random();
    }

    private prepareRawConfig(rawSurveyConfig: SurveyConfig): SurveyConfig {
        if (rawSurveyConfig.lastExtensionUsageDate) {
            rawSurveyConfig.lastExtensionUsageDate = new Date(
                rawSurveyConfig.lastExtensionUsageDate,
            );
        }
        return rawSurveyConfig;
    }

    private async mergeRemoteConfigToLocal(surveyConfig: SurveyConfig): Promise<SurveyConfig> {
        const remoteConfig = await this.downloadConfigRequest;
        surveyConfig.shortPeriodToRemind = remoteConfig.shortPeriodToRemind;
        surveyConfig.longPeriodToRemind = remoteConfig.longPeriodToRemind;
        surveyConfig.popCoveragePercent = remoteConfig.popCoveragePercent;
        surveyConfig.surveyUrl = remoteConfig.surveyUrl;
        surveyConfig.enabled = remoteConfig.enabled;
        return surveyConfig;
    }

    private sendPromptSurveyTelemetry(surveyName: string): void {
        const promptUserSurveyEvent = TelemetryHelper.createTelemetryEvent("promptUserSurvey", {
            surveyName,
        });

        Telemetry.send(promptUserSurveyEvent);
    }

    private sendSurveyNotificationReactionTelemetry(
        surveyName: string,
        surveyNotificationReaction: SurveyNotificationReaction,
    ): void {
        const surveyNotificationReactionEvent = TelemetryHelper.createTelemetryEvent(
            "surveyNotificationReaction",
            {
                surveyName,
                userReaction: surveyNotificationReaction,
            },
        );

        Telemetry.send(surveyNotificationReactionEvent);
    }
}

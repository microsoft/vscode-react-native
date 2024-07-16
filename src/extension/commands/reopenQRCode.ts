// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { QRCodeContentProvider } from "../qrCodeContentProvider";
import { Command } from "./util/command";
import { getQRCodeUrl } from "../exponent/exponentPlatform";

export class ReopenQRCode extends Command {
    codeName = "reopenQRCode";
    label = "Reopen QR Code in Expo";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToReopenQRCode);
    private qrCodeContentProvider: QRCodeContentProvider = new QRCodeContentProvider();

    async baseFn(): Promise<void> {
        if (getQRCodeUrl()) {
            const exponentPage = vscode.window.createWebviewPanel(
                "Expo QR Code",
                "Expo QR Code",
                vscode.ViewColumn.Two,
                {},
            );
            exponentPage.webview.html = this.qrCodeContentProvider.provideTextDocumentContent(
                vscode.Uri.parse(getQRCodeUrl()),
            );
        } else {
            throw ErrorHelper.getInternalError(InternalErrorCode.FailedToReopenQRCode);
        }
    }
}

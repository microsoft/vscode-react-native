"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const hashUtils = require("./hash-utils");
const jwt = require("jsonwebtoken");
const path = require("path");
const fileUtils = require("../../utils/file-utils");
const CURRENT_CLAIM_VERSION = '1.0.0';
const METADATA_FILE_NAME = '.codepushrelease';
function sign(privateKeyPath, updateContentsPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!privateKeyPath) {
            return Promise.resolve(null);
        }
        let privateKey;
        let signatureFilePath;
        try {
            privateKey = yield fileUtils.readFile(privateKeyPath);
        }
        catch (err) {
            return Promise.reject(new Error(`The path specified for the signing key ("${privateKeyPath}") was not valid.`));
        }
        // If releasing a single file, copy the file to a temporary 'CodePush' directory in which to publish the release
        if (!fileUtils.isDirectory(updateContentsPath)) {
            updateContentsPath = fileUtils.copyFileToTmpDir(updateContentsPath);
        }
        signatureFilePath = path.join(updateContentsPath, METADATA_FILE_NAME);
        let prevSignatureExists = true;
        try {
            yield fileUtils.access(signatureFilePath, fs.constants.F_OK);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                prevSignatureExists = false;
            }
            else {
                return Promise.reject(new Error(`Could not delete previous release signature at ${signatureFilePath}.
                Please, check your access rights.`));
            }
        }
        if (prevSignatureExists) {
            console.log(`Deleting previous release signature at ${signatureFilePath}`);
            yield fileUtils.rmDir(signatureFilePath);
        }
        const hash = yield hashUtils.generatePackageHashFromDirectory(updateContentsPath, path.join(updateContentsPath, '..'));
        const claims = {
            claimVersion: CURRENT_CLAIM_VERSION,
            contentHash: hash
        };
        return new Promise((resolve, reject) => {
            jwt.sign(claims, privateKey, { algorithm: 'RS256' }, (err, signedJwt) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    reject(new Error('The specified signing key file was not valid'));
                }
                try {
                    fs.writeFileSync(signatureFilePath, signedJwt);
                    console.log(`Generated a release signature and wrote it to ${signatureFilePath}`);
                    resolve(null);
                }
                catch (error) {
                    reject(error);
                }
            }));
        });
    });
}
exports.default = sign;

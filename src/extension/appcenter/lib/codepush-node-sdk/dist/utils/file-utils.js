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
const path = require("path");
const os = require("os");
const rimraf = require("rimraf");
const temp = require("temp");
const _ = require("lodash");
const noop = require('node-noop').noop;
function fileExists(file) {
    try {
        return fs.statSync(file).isFile();
    }
    catch (e) {
        return false;
    }
}
exports.fileExists = fileExists;
function isBinaryOrZip(path) {
    return path.search(/\.zip$/i) !== -1
        || path.search(/\.apk$/i) !== -1
        || path.search(/\.ipa$/i) !== -1;
}
exports.isBinaryOrZip = isBinaryOrZip;
function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}
exports.isDirectory = isDirectory;
function copyFileToTmpDir(filePath) {
    if (!isDirectory(filePath)) {
        const outputFolderPath = temp.mkdirSync('code-push');
        rimraf.sync(outputFolderPath);
        fs.mkdirSync(outputFolderPath);
        const outputFilePath = path.join(outputFolderPath, path.basename(filePath));
        fs.writeFileSync(outputFilePath, fs.readFileSync(filePath));
        return outputFolderPath;
    }
}
exports.copyFileToTmpDir = copyFileToTmpDir;
function generateRandomFilename(length) {
    let filename = '';
    const validChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        filename += validChar.charAt(Math.floor(Math.random() * validChar.length));
    }
    return filename;
}
exports.generateRandomFilename = generateRandomFilename;
function fileDoesNotExistOrIsDirectory(path) {
    try {
        return isDirectory(path);
    }
    catch (error) {
        return true;
    }
}
exports.fileDoesNotExistOrIsDirectory = fileDoesNotExistOrIsDirectory;
function createEmptyTmpReleaseFolder(folderPath) {
    rimraf.sync(folderPath);
    fs.mkdirSync(folderPath);
}
exports.createEmptyTmpReleaseFolder = createEmptyTmpReleaseFolder;
function removeReactTmpDir() {
    rimraf.sync(`${os.tmpdir()}/react-*`);
}
exports.removeReactTmpDir = removeReactTmpDir;
function normalizePath(filePath) {
    // replace all backslashes coming from cli running on windows machines by slashes
    return filePath.replace(/\\/g, '/');
}
exports.normalizePath = normalizePath;
function walk(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = yield stat(dir);
        if (stats.isDirectory()) {
            var files = [];
            for (const file of yield readdir(dir)) {
                files = files.concat(yield walk(path.join(dir, file)));
            }
            return files;
        }
        else {
            return [dir];
        }
    });
}
exports.walk = walk;
function stat(path) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield callFs(fs.stat, path))[0];
    });
}
exports.stat = stat;
function readdir(path) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield callFs(fs.readdir, path))[0];
    });
}
exports.readdir = readdir;
function readFile(...args) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield callFs(fs.readFile, ...args))[0];
    });
}
exports.readFile = readFile;
function access(path, mode) {
    return __awaiter(this, void 0, void 0, function* () {
        return callFs(fs.access, path, mode).then(() => { noop(); });
    });
}
exports.access = access;
function rmDir(source, recursive = true) {
    if (recursive) {
        return new Promise((resolve, reject) => {
            rimraf(source, err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    else {
        return callFs(fs.rmdir, source).then(() => { noop(); });
    }
}
exports.rmDir = rmDir;
function mkTempDir(affixes) {
    return callTemp(temp.mkdir, affixes);
}
exports.mkTempDir = mkTempDir;
function callTemp(func, ...args) {
    return new Promise((resolve, reject) => {
        func.apply(temp, _.concat(args, [
            (err, result) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            }
        ]));
    });
}
function callFs(func, ...args) {
    return new Promise((resolve, reject) => {
        func.apply(fs, _.concat(args, [
            (err, ...args) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(args);
                }
            }
        ]));
    });
}

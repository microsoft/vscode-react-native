:: This script is called 'atom' to surpass the react-native
:: editor selection. It has nothing to do with the atom editor.
:: It can be safetly removed when the PR to support vscode in
:: react native gets accepted:
:: https://github.com/facebook/react-native/pull/7757
::
:: Usage:
:: ../path/atom.cmd filename:filenumber

:: Windows
@echo off

IF [%1] == [] (
   echo "Missing filename."
   exit 1
)
node "%~dp0..\out\extension\openFileAtLocation.js" "%1"

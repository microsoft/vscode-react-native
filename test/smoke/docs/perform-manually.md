# Manual smoke tests

These are the scenarios that should be tested during manual smoke testing:

## Windows
|Debug  scenario|Does it work?|If no, then why?|Is it an extension bug?|
|---|---|---|---|
|Debug Android on device||||
|Debug Android on emulator||||
|Debug Android (Hermes) - Experimental on device||||
|Debug Android (Hermes) - Experimental on emulator||||
|Debug Expo Android on device (Tunnel, LAN, localhost)||||
|Debug Expo iOS on device||||
|Debug Expo Android on emulator||||
|Debug Expo (pure React Native) Android on emulator||||
|Debug Expo (pure React Native) Android on device (Tunnel, LAN, localhost)||||
|Debug Expo (pure React Native) iOS on device||||
|Debug RNW app||||

## Ubuntu
|Debug  scenario|Does it work?|If no, then why?|Is it an extension bug?|
|---|---|---|---|
|Debug Android on device||||
|Debug Android on emulator||||
|Debug Android (Hermes) - Experimental on device||||
|Debug Android (Hermes) - Experimental on emulator||||
|Debug Expo Android on device (Tunnel, LAN, localhost)||||
|Debug Expo iOS on device||||
|Debug Expo Android on emulator||||
|Debug Expo (pure React Native) Android on emulator||||
|Debug Expo (pure React Native) Android on device (Tunnel, LAN, localhost)||||
|Debug Expo (pure React Native) iOS on device||||

## macOS
|Debug  scenario|Does it work?|If no, then why?|Is it an extension bug?|
|---|---|---|---|
|Debug Android on device||||
|Debug Android on emulator||||
|Debug Android (Hermes) - Experimental on device||||
|Debug Android (Hermes) - Experimental on emulator||||
|Debug iOS on simulator||||
|Debug iOS on device||||
|Debug Expo Android on device (Tunnel, LAN, localhost)||||
|Debug Expo iOS on device||||
|Debug Expo Android on emulator||||
|Debug Expo iOS on simulator||||
|Debug Expo (pure React Native) Android on emulator||||
|Debug Expo (pure React Native) iOS on simulator||||
|Debug Expo (pure React Native) Android on device (Tunnel, LAN, localhost)||||
|Debug Expo (pure React Native) iOS on device||||
|Debug RN macOS app||||

### Script for generating test apps

```bash
#!/bin/bash -x
# usage: script.sh <directory for test apps> #
mkdir $1
cd $1
npm i react-native-cli expo-cli -g
react-native init rn_app
# This is required by Expo sdk in order to be able to debug rn_app under Expo
cd rn_app && npm i expo --save-dev && cd ..
# `echo -ne '\n'`` is for emulating of pressing ENTER to confirm basic expo configuration creation
echo -ne '\n' | expo init -t tabs --name expo_app  --workflow managed expo_app
```

It happens that sometimes the latest expo version hasn't supported the latest React Native version yet (which is unfortunate, because we cannot use rn_app for debugging via Expo scenarios).
In that case you need to get latest version appeared in the list in error, for example: `Error: React Native version not supported by Expo. Major versions supported: 0.33.0, 0.36.0, 0.37.0, 0.40.0, 0.41.0, 0.42.0, 0.43.0, 0.44.0, 0.45.0, 0.46.1, 0.47.1, 0.48.4, 0.49.3, 0.50.3, 0.51.0, 0.52.0, 0.54.2, 0.55.2, 0.55.4, 0.57.1, 0.27.0, 0.31.0 (error code 1101)` and create another application using `react-native init rn_app_expo --verrsion="NEEDED_VERSION"`
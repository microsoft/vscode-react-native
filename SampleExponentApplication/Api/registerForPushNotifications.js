/**
 * @providesModule registerForPushNotificationsAsync
 */

import { NativeModules, Platform } from 'react-native';
const { ExponentNotifications } = NativeModules;

import callApiAsync from 'callApiAsync';

// Until we implement this on iOS..
if (Platform.OS === 'ios') {
  ExponentNotifications = {
    getExponentPushTokenAsync: async () => {
      return new Promise(resolve => resolve('fake-token'));
    }
  }
}

let previousTimeout = 0;
let times = 0;
const maxTimes = 5;

export default async function registerForPushNotificationsAsync() {
  try {
    let token = await ExponentNotifications.getExponentPushTokenAsync();
    await callApiAsync('tokens', [], { 'token[value]': token }, {method: 'post'});

    previousTimeout = 0;
    times = 0;
  } catch (e) {
    if (times < maxTimes) {
      const timeForDelay = previousTimeout + (500 * times++);
      console.log(`Retrying push notification registration (${timeForDelay}, ${previousTimeout}, ${times})...`);
      await sleep(timeForDelay)
      previousTimeout = timeForDelay;
      await registerForPushNotificationsAsync();
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

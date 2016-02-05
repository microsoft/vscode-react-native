'use strict';
import React, {
  AppRegistry,
  Component,
  StyleSheet,
  Text,
  View,
  TouchableNativeFeedback,
  Alert
} from 'react-native';

// import {SampleApplication} from './sampleApplication';

class SampleApplication extends Component {
    showMessage() {
        Alert.alert(
        'Alert Title',
        'You pressed a button',
        [
            {text: 'Ask me later', onPress: () =>
                console.log('Ask me later pressed')},
            {text: 'Cancel', onPress: () =>
                console.log('Cancel Pressed'), style: 'cancel'},
            {text: 'OK', onPress: () =>
                console.log('OK Pressed')},
        ]);
    }

  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.android.js
        </Text>
        <Text style={styles.instructions}>
          Shake or press menu button for dev menu
        </Text>
        <TouchableNativeFeedback onPress={() => this.showMessage()}>
        <View>
            <Text>Toggle</Text>
            </View>
        </TouchableNativeFeedback>
      </View>
    );
  }
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('SampleApplication', () => SampleApplication);

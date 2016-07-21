import React from 'react';
import {
  AppRegistry,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Font } from 'exponent';
import {
  NavigationProvider,
  StackNavigation,
  TabNavigation,
  TabNavigationItem,
} from '@exponent/ex-navigation';

import registerForPushNotificationsAsync from 'registerForPushNotificationsAsync';
import Router from 'Router';

class AppContainer extends React.Component {

  state = {
    assetsLoaded: false,
  };

  async componentWillMount() {
    // Register for push notifications
    registerForPushNotificationsAsync();

    // Load mandatory assets
    await Font.loadAsync({
      awesome: 'https://github.com/FortAwesome/Font-Awesome/raw/master/fonts/fontawesome-webfont.ttf',
    });

    this.setState({assetsLoaded: true});
  }


  render() {
    if (!this.state.assetsLoaded) {
      return <View />;
    }

    let { exp: { manifest } } = this.props;

    return (
      <View style={styles.container}>
        <NavigationProvider router={Router}>
          <StackNavigation
            id="root"
            initialRoute={Router.getRoute('tabNavigationLayout', {manifest})}
          />
        </NavigationProvider>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 0 : 24,
  },
});

AppRegistry.registerComponent('main', () => AppContainer);

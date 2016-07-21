/**
 * @providesModule TabNavigationLayout
 */

import React, { PropTypes } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  StackNavigation,
  TabNavigation,
  TabNavigationItem,
} from '@exponent/ex-navigation';

import Colors from 'Colors';
import FontAwesomeIcon from 'FontAwesomeIcon';
import Router from 'Router';

export default class TabNavigationLayout extends React.Component {
  static propTypes = {
    manifest: PropTypes.object.isRequired,
  };

  render() {
    let { manifest } = this.props;

    return (
      <TabNavigation initialTab="home">
        <TabNavigationItem
          id="home"
          renderIcon={isSelected => this._renderIcon('cog', isSelected)}>
          <StackNavigation initialRoute={Router.getRoute('home', {manifest})} />
        </TabNavigationItem>

        <TabNavigationItem
          id="links"
          renderIcon={isSelected => this._renderIcon('icon-book', isSelected)}>
          <StackNavigation initialRoute={Router.getRoute('links')} />
        </TabNavigationItem>

        <TabNavigationItem
          id="other-a"
          renderIcon={isSelected => this._renderIcon('icon-ban-circle', isSelected)}>
          <StackNavigation initialRoute={Router.getRoute('links')} />
        </TabNavigationItem>

        <TabNavigationItem
          id="other-b"
          renderIcon={isSelected => this._renderIcon('icon-ban-circle', isSelected)}>
          <StackNavigation initialRoute={Router.getRoute('links')} />
        </TabNavigationItem>
      </TabNavigation>
    );
  }

  _renderIcon(name, isSelected) {
    return (
      <FontAwesomeIcon
        name={name}
        size={32}
        color={isSelected ? Colors.tabIconSelected : Colors.tabIconDefault}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  selectedTab: {
    color: '#2f95dc',
  },
});

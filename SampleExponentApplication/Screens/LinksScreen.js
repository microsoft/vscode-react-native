/**
 * @providesModule LinksScreen
 */

import React from 'react';
import {
  Linking,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  View
} from 'react-native';
import ResponsiveImage from '@exponent/react-native-responsive-image';

import BrandedNavigationTitle from 'BrandedNavigationTitle';

export default class LinksScreen extends React.Component {
  static route = {
    navigationBar: {
      renderTitle: () => <BrandedNavigationTitle />
    },
  }

  render() {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.optionsTitleText}>
          Resources
        </Text>

        <TouchableOpacity style={styles.optionsContainer} onPress={this._handlePressSlack}>
          <View style={styles.option}>
            <View style={styles.optionIconContainer}>
              <SlackIcon />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionText}>
                 Join us on Slack
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionsContainer} onPress={this._handlePressDocs}>
          <View style={styles.option}>
            <View style={styles.optionIconContainer}>
              <ExponentIcon />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionText}>
                Read the Exponent documentation
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionsContainer} onPress={this._handlePressShowcase}>
          <View style={styles.option}>
            <View style={styles.optionIconContainer}>
              <ExponentIcon style={{tintColor:"#888"}} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionText}>
                Explore the Exponent API Showcase
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  _handlePressSlack = () => {
    Linking.openURL('https://slack.exponentjs.com');
  }

  _handlePressDocs = () => {
    Linking.openURL('http://docs.getexponent.com');
  }

  _handlePressShowcase = () => {
    Linking.openURL('exp://exp.host/@jesse/exponent-showcase');
  }
}

const SlackIcon = () => (
  <ResponsiveImage
    sources={{
      2: {uri: 'https://s3.amazonaws.com/exp-us-standard/slack-icon@2x.png'},
      3: {uri: 'https://s3.amazonaws.com/exp-us-standard/slack-icon@3x.png'},
    }}
    fadeDuration={0}
    style={{width: 20, height: 20}}
  />
);

const ExponentIcon = (props) => (
  <ResponsiveImage
    sources={{
      2: {uri: 'https://s3.amazonaws.com/exp-us-standard/exponent-icon@2x.png'},
      3: {uri: 'https://s3.amazonaws.com/exp-us-standard/exponent-icon@3x.png'},
    }}
    resizeMode="contain"
    fadeDuration={0}
    style={[{width: 20, height: 20, marginTop: 1}, props.style]}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 15,
  },
  optionsTitleText: {
    fontSize: 16,
    marginLeft: 15,
    marginTop: 9,
    marginBottom: 12,
  },
  optionsContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDEDED',
  },
  optionIconContainer: {
    marginRight: 9,
  },
  option: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  optionText: {
    fontSize: 15,
    marginTop: 2,
  },
});

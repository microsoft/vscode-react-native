/**
 * @providesModule ConfigScreen
 */

import React, { PropTypes } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import BrandedNavigationTitle from 'BrandedNavigationTitle';

export default class ConfigScreen extends React.Component {
  static propTypes = {
    manifest: PropTypes.object.isRequired,
  }

  static route = {
    navigationBar: {
      renderTitle: () => <BrandedNavigationTitle />,
    },
  }

  _renderTitle() {
    let { manifest } = this.props;

    return (
      <View style={styles.titleContainer}>
        <View style={styles.titleIconContainer}>
          <AppIconPreview iconUrl={manifest.iconUrl} />
        </View>

        <View style={styles.titleTextContainer}>
          <Text style={styles.nameText} numberOfLines={1}>
            {manifest.name}
          </Text>

          <Text style={styles.slugText} numberOfLines={1}>
            {manifest.slug}
          </Text>

          <Text style={styles.descriptionText}>
            {manifest.description}
          </Text>
        </View>
      </View>
    );
  }

  render() {
    let { manifest } = this.props;

    return (
      <ScrollView style={styles.container}>
        {this._renderTitle()}

        <SectionHeader title="sdkVersion" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.sdkVersion}
          </Text>
        </SectionContent>

        <SectionHeader title="version" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.version}
          </Text>
        </SectionContent>

        <SectionHeader title="orientation" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.orientation}
          </Text>
        </SectionContent>

        <SectionHeader title="primaryColor" />
        <SectionContent>
          <Color value={manifest.primaryColor} />
        </SectionContent>

        <SectionHeader title="iconUrl" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.iconUrl}
          </Text>
        </SectionContent>

        <SectionHeader title="loading: iconUrl" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.loading && manifest.loading.iconUrl}
          </Text>
        </SectionContent>

        <SectionHeader title="notification: iconUrl" />
        <SectionContent>
          <Text style={styles.sectionContentText}>
            {manifest.notification && manifest.notification.iconUrl}
          </Text>
        </SectionContent>

        <SectionHeader title="notification: color" />
        <SectionContent>
          {manifest.notification && <Color value={manifest.notification.color} />}
        </SectionContent>
      </ScrollView>
    );
  }
}

const Color = ({value}) => {
  if (!value) {
    return <View />;
  } else {
    return (
      <View style={styles.colorContainer}>
        <View style={[styles.colorPreview, {backgroundColor: value}]} />
        <View style={styles.colorTextContainer}>
          <Text style={styles.sectionContentText}>
            {value}
          </Text>
        </View>
      </View>
    );
  }
}

const SectionHeader = ({title}) => {
  return (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeaderText}>
        {title}
      </Text>
    </View>
  );
}

const SectionContent = (props) => {
  return (
    <View style={styles.sectionContentContainer}>
      {props.children}
    </View>
  );
}

const AppIconPreview = ({iconUrl}) => {
  if (!iconUrl) {
    iconUrl = 'https://s3.amazonaws.com/exp-brand-assets/ExponentEmptyManifest_192.png';
  }

  return (
    <Image
      source={{uri: iconUrl}}
      style={{width: 64, height: 64}}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 15,
    flexDirection: 'row',
  },
  titleIconContainer: {
    marginRight: 15,
    paddingTop: 2,
  },
  sectionHeaderContainer: {
    backgroundColor: '#fbfbfb',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ededed',
  },
  sectionHeaderText: {
    fontSize: 14,
  },
  sectionContentContainer: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 15,
  },
  sectionContentText: {
    color: '#808080',
    fontSize: 14,
  },
  nameText: {
    fontWeight: '600',
    fontSize: 20,
  },
  slugText: {
    color: '#a39f9f',
    fontSize: 14,
    marginTop: -1,
    backgroundColor: 'transparent',
  },
  descriptionText: {
    fontSize: 14,
    marginTop: 6,
    color: '#4d4d4d',
  },
  colorContainer: {
    flexDirection: 'row',
  },
  colorPreview: {
    width: 17,
    height: 17,
    borderRadius: 2,
    marginRight: 6,
  },
  colorTextContainer: {
    flex: 1,
  },
});

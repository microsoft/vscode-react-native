/**
 * @providesModule FontAwesomeIcon
 */

import React from 'react';
import { Text, View } from 'react-native';
import { Font } from 'exponent';

const IconMap = {
  'cog': '\uf013',
  'icon-book': '\uf02d',
  'icon-ban-circle': '\uf05e',
}

export default class FontAwesomeIcon extends React.Component {
  static defaultProps = {
    size: 20,
    color: '#888',
  };

  render() {
    return (
      <Text style={{
        ...Font.style('awesome'),
        fontSize: this.props.size,
        color: this.props.color
      }}>
        {IconMap[this.props.name]}
      </Text>
    );
  }
}

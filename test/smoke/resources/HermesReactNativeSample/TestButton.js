import React, { Component } from 'react';
import { View, Button } from 'react-native';

export default class TestButton extends Component {
    constructor(props) {
      super(props);
      this.handleClick = this.handleClick.bind(this);
    }
    handleClick() {
      let testBoleanValue = true;
      console.log('Test output from Hermes debuggee');
    }
    render() {
      return (
      <View style={{marginTop: 10}}>
          <Button
            onPress={this.handleClick}
            title="Test Button"
          />
      </View>
      );
    }
  }



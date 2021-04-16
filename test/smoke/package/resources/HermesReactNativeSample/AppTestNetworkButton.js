import React, { Component } from 'react';
import { View, Button } from 'react-native';

export default class AppTestNetworkButton extends Component {
    constructor(props) {
      super(props);
      this.handleClick = this.handleClick.bind(this);
    }
    handleClick() {
      fetch('http://localhost:7321/post_sample',{
        method: "POST",
        headers: {
        'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({testStr: "test", testObj: {testNum: 1234, testStr1: "test1"}})
      })
      .then(response => {
        return response.json();
      })
      .then(data => {
        console.log(data);
      })
      .catch(err => {
        console.log(err);
      });
    }
    render() {
      return (
      <View style={{marginTop: 10}}>
          <Button
            onPress={this.handleClick}
            title="Test Network Button"
          />
      </View>
      );
    }
  }



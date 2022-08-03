// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
class Hello {
    constructor(public msg: string) {}
    public sayHello() {
        return this.msg;
    }
}

const hello = new Hello("HelloWorld!");

console.log(hello.sayHello());

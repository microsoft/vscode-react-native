import * as childProcess from "./childProcess";
import * as file from "./fileSystem";

export module Node {
    export var ChildProcess = childProcess.ChildProcess;
    export var FileSystem = file.FileSystem;
}

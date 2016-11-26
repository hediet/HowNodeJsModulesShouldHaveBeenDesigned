var m = require("./AlternativeModuleLoader");
m.setRepoPath(__dirname + "/node_modules2");

var lib1 = require("lib1");
var lib2 = require("lib2");

lib1();
lib2();
lib1();

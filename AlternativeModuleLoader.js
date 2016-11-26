"use strict";
var Module = require("module");
var globalDependencyInfo;
var globalId = 1;
function parseModuleName(moduleName) {
    if (moduleName.substr(2) === "./" || moduleName.substr(2) === "..")
        return { isRelative: true, path: moduleName };
    var parts = moduleName.split("/", 2);
    var packageName = parts[0];
    var path = parts.length > 1 ? ("/" + parts[1]) : "";
    return { isRelative: false, packageName: packageName, path: path };
}
function isReference(x) {
    return x["ref"] !== undefined;
}
var repoPath; // must not end with "/"
function setRepoPath(path) {
    repoPath = path;
    globalDependencyInfo = require(path + '/deps.json');
    Module._load = function (request, parent) {
        if (!parent.dependencyInfo) {
            parent.dependencyInfo = globalDependencyInfo;
        }
        var p = parseModuleName(request);
        var cacheExtra = 0;
        var dep = undefined;
        if (!p.isRelative && parent.dependencyInfo.deps[p.packageName] !== undefined) {
            var dep2 = parent.dependencyInfo.deps[p.packageName];
            while (isReference(dep2)) {
                dep2 = globalDependencyInfo.shared[dep2.ref];
            }
            dep = dep2;
            if (dep2.id === undefined) {
                dep2.id = globalId++;
            }
            cacheExtra = dep2.id;
            request = repoPath + "/" + dep2.packageId + p.path + "/index.js";
        }
        else
            dep = parent.dependencyInfo;
        var filename = Module._resolveFilename(request, parent, false);
        var cacheKey = filename + cacheExtra;
        var cachedModule = Module._cache[cacheKey];
        if (cachedModule) {
            return cachedModule.exports;
        }
        var module = new Module(filename, parent);
        module.dependencyInfo = dep;
        Module._cache[cacheKey] = module;
        tryModuleLoad(module, filename, cacheKey);
        return module.exports;
    };
}
exports.setRepoPath = setRepoPath;
var originalLoad = Module._load;
function tryModuleLoad(module, filename, cacheKey) {
    var threw = true;
    try {
        module.load(filename);
        threw = false;
    }
    finally {
        if (threw) {
            delete Module._cache[cacheKey];
        }
    }
}

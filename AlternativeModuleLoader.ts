import * as Module from "module";
import * as NativeModule from "native_module";
import * as util from "util";


interface DependencyInfo {
	deps: { [importName: string]: Dependency|DependencyReference };
	id?: number;
}

interface PackageInfo extends DependencyInfo {
	shared: { [key: string]: Dependency|DependencyReference };
}

interface Dependency extends DependencyInfo {
	packageId: string;
}



var globalDependencyInfo: PackageInfo;
var globalId = 1;


interface DependencyReference {
	ref: string;
}

interface ParseResult {
	isRelative: boolean;
	packageName?: string;
	path: string; // is empty or starts with "/"
}

function parseModuleName(moduleName: string): ParseResult {
	if (moduleName.substr(2) === "./" || moduleName.substr(2) === "..")
		return { isRelative: true, path: moduleName };
	
	const parts = moduleName.split("/", 2);
	const packageName = parts[0];
	const path = parts.length > 1 ? ("/" + parts[1]) : "";

	return { isRelative: false, packageName, path };
}


interface IModule {
	parent: IModule|undefined;
	dependencyInfo: DependencyInfo;
	load(filename: string);
}

function isReference(x: any): x is DependencyReference {
	return x["ref"] !== undefined;
}

let repoPath: string; // must not end with "/"

export function setRepoPath(path: string) {
	repoPath = path;
	
	globalDependencyInfo = require(path + '/deps.json');


	Module._load = function(request: string, parent: IModule) {

		if (!parent.dependencyInfo) {
			parent.dependencyInfo = globalDependencyInfo;
		}

		const p = parseModuleName(request);
		let cacheExtra = 0;
		let dep: DependencyInfo|undefined = undefined;

		if (!p.isRelative && parent.dependencyInfo.deps[p.packageName] !== undefined) {
			let dep2 = parent.dependencyInfo.deps[p.packageName];
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

		const cacheKey = filename + cacheExtra;

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

const originalLoad = Module._load;



function tryModuleLoad(module: IModule, filename: string, cacheKey: string) {
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
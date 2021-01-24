

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// include: shell_pthreads.js


// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

// ENVIRONMENT_IS_PTHREAD=true will have been preset in worker.js. Make it false in the main runtime thread.
var ENVIRONMENT_IS_PTHREAD = Module['ENVIRONMENT_IS_PTHREAD'] || false;
if (ENVIRONMENT_IS_PTHREAD) {
  // Grab imports from the pthread to local scope.
  buffer = Module['buffer'];
  // Note that not all runtime fields are imported above
}

// end include: shell_pthreads.js
// In MODULARIZE mode _scriptDir needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptDir = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : undefined;

if (ENVIRONMENT_IS_WORKER) {
  _scriptDir = self.location.href;
}
else if (ENVIRONMENT_IS_NODE) {
  _scriptDir = __filename;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

  var nodeWorkerThreads;
  try {
    nodeWorkerThreads = require('worker_threads');
  } catch (e) {
    console.error('The "worker_threads" module is not supported in this node.js build - perhaps a newer version is needed?');
    throw e;
  }
  global.Worker = nodeWorkerThreads.Worker;

} else
if (ENVIRONMENT_IS_SHELL) {

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  if (ENVIRONMENT_IS_NODE) {

// include: node_shell_read.js


read_ = function shell_read(filename, binary) {
  var ret = tryParseAsDataURI(filename);
  if (ret) {
    return binary ? ret : ret.toString();
  }
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

// end include: node_shell_read.js
  } else
  {

// include: web_or_worker_shell_read.js


  read_ = function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

if (ENVIRONMENT_IS_NODE) {
  // Polyfill the performance object, which emscripten pthreads support
  // depends on for good timing.
  if (typeof performance === 'undefined') {
    global.performance = require('perf_hooks').performance;
  }
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module['arguments']) arguments_ = Module['arguments'];if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) Object.defineProperty(Module, 'arguments', { configurable: true, get: function() { abort('Module.arguments has been replaced with plain arguments_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
if (Module['thisProgram']) thisProgram = Module['thisProgram'];if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) Object.defineProperty(Module, 'thisProgram', { configurable: true, get: function() { abort('Module.thisProgram has been replaced with plain thisProgram (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
if (Module['quit']) quit_ = Module['quit'];if (!Object.getOwnPropertyDescriptor(Module, 'quit')) Object.defineProperty(Module, 'quit', { configurable: true, get: function() { abort('Module.quit has been replaced with plain quit_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
assert(typeof Module['TOTAL_MEMORY'] === 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
if (!Object.getOwnPropertyDescriptor(Module, 'read')) Object.defineProperty(Module, 'read', { configurable: true, get: function() { abort('Module.read has been replaced with plain read_ (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) Object.defineProperty(Module, 'readAsync', { configurable: true, get: function() { abort('Module.readAsync has been replaced with plain readAsync (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) Object.defineProperty(Module, 'readBinary', { configurable: true, get: function() { abort('Module.readBinary has been replaced with plain readBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) Object.defineProperty(Module, 'setWindowTitle', { configurable: true, get: function() { abort('Module.setWindowTitle has been replaced with plain setWindowTitle (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

assert(ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER || ENVIRONMENT_IS_NODE, 'Pthreads do not work in this environment yet (need Web Workers, or an alternative to them)');




var STACK_ALIGN = 16;

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {
  return func;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    for (var i = 0; i < wasmTable.length; i++) {
      var item = wasmTable.get(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    wasmTable.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction: ' + func);
    var wrapped = convertJsFunctionToWasm(func, sig);
    wasmTable.set(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(wasmTable.get(index));
  freeTableIndexes.push(index);
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {
  assert(typeof func !== 'undefined');

  return addFunctionWasm(func, sig);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

// JS library code refers to Atomics in the manner used from asm.js, provide
// the same API here.
var Atomics_load = Atomics.load;
var Atomics_store = Atomics.store;
var Atomics_compareExchange = Atomics.compareExchange;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) Object.defineProperty(Module, 'wasmBinary', { configurable: true, get: function() { abort('Module.wasmBinary has been replaced with plain wasmBinary (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });
var noExitRuntime;if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];if (!Object.getOwnPropertyDescriptor(Module, 'noExitRuntime')) Object.defineProperty(Module, 'noExitRuntime', { configurable: true, get: function() { abort('Module.noExitRuntime has been replaced with plain noExitRuntime (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });

// include: wasm2js.js


// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
/** @suppress{duplicate, const} */
var
WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  Memory: function(opts) {
    this.buffer = new SharedArrayBuffer(opts['initial'] * 65536);
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
  },

  Instance: function(module, info) {
    // TODO: use the module and info somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(asmLibraryArg) {
function Table(ret) {
  // grow method not included; table is not growable
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var memorySegments = {};
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
    return uint8Array;
  }
memorySegments[0] = base64DecodeToExistingUint8Array(new Uint8Array(1189), 0, "UGhpbG9zb3BoZXIgJWQ6IBtbOTRtIHRoaW5raW5nIBtbMG0gZm9yICVkIHNlY29uZHMuCgBQaGlsb3NvcGhlciAlZDogG1s5Mm0gZWF0aW5nIBtbMG0gZm9yICVkIHNlY29uZHMuCgAtKyAgIDBYMHgAKG51bGwpAAAAAAAAAAARAAoAERERAAAAAAUAAAAAAAAJAAAAAAsAAAAAAAAAABEADwoREREDCgcAAQAJCwsAAAkGCwAACwAGEQAAABEREQAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAARAAoKERERAAoAAAIACQsAAAAJAAsAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAMAAAAAAkMAAAAAAAMAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAA0AAAAEDQAAAAAJDgAAAAAADgAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAPAAAAAA8AAAAACRAAAAAAABAAABAAABIAAAASEhIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAABISEgAAAAAAAAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAoAAAAACgAAAAAJCwAAAAAACwAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAwAAAAACQwAAAAAAAwAAAwAADAxMjM0NTY3ODlBQkNERUYtMFgrMFggMFgtMHgrMHggMHgAaW5mAElORgBuYW4ATkFOAC4AdGhyb3cgJ0NhbmNlbGVkIScAL2Ivcy93L2lyL2svaW5zdGFsbC9lbXNjcmlwdGVuL3N5c3RlbS9saWIvcHRocmVhZC9saWJyYXJ5X3B0aHJlYWQuYwBjYWxsAF9lbXNjcmlwdGVuX2RvX2Rpc3BhdGNoX3RvX3RocmVhZAB0YXJnZXRfdGhyZWFkAG51bV9hcmdzKzEgPD0gRU1fUVVFVUVEX0pTX0NBTExfTUFYX0FSR1MAZW1zY3JpcHRlbl9ydW5faW5fbWFpbl9ydW50aW1lX3RocmVhZF9qcwBxAF9lbXNjcmlwdGVuX2NhbGxfb25fdGhyZWFkAHsgc2V0VGltZW91dChmdW5jdGlvbigpIHsgX19lbXNjcmlwdGVuX2RvX2Rpc3BhdGNoX3RvX3RocmVhZCgkMCwgJDEpOyB9LCAwKTsgfQBFTV9GVU5DX1NJR19OVU1fRlVOQ19BUkdVTUVOVFMocS0+ZnVuY3Rpb25FbnVtKSA8PSBFTV9RVUVVRURfQ0FMTF9NQVhfQVJHUwBfZG9fY2FsbAAwICYmICJJbnZhbGlkIEVtc2NyaXB0ZW4gcHRocmVhZCBfZG9fY2FsbCBvcGNvZGUhIgB0YXJnZXQAR2V0UXVldWUAZW1fcXVldWVkX2NhbGxfbWFsbG9jAACwCAAAKHZvaWQpPDo6PnsgUFRocmVhZC5pbml0UnVudGltZSgpOyB9AA==");
memorySegments[1] = base64DecodeToExistingUint8Array(new Uint8Array(156), 0, "ABNQAAAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAABwAAAKgMAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwCAAA");
memorySegments[2] = base64DecodeToExistingUint8Array(new Uint8Array(2464), 0, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==");

  var scratchBuffer = new ArrayBuffer(16);
  var i32ScratchView = new Int32Array(scratchBuffer);
  var f32ScratchView = new Float32Array(scratchBuffer);
  var f64ScratchView = new Float64Array(scratchBuffer);
  
  function wasm2js_scratch_load_i32(index) {
    return i32ScratchView[index];
  }
      
  function wasm2js_scratch_store_i32(index, value) {
    i32ScratchView[index] = value;
  }
      
  function wasm2js_scratch_load_f64() {
    return f64ScratchView[0];
  }
      
  function wasm2js_scratch_store_f64(value) {
    f64ScratchView[0] = value;
  }
      
  function wasm2js_atomic_wait_i32(ptr, expected, timeoutLow, timeoutHigh) {
    if (timeoutLow != -1 || timeoutHigh != -1) throw 'unsupported timeout';
    var view = new Int32Array(bufferView.buffer); // TODO cache
    var result = Atomics.wait(view, ptr, expected);
    if (result == 'ok') return 0;
    if (result == 'not-equal') return 1;
    if (result == 'timed-out') return 2;
    throw 'bad result ' + result;
  }
      
  function wasm2js_memory_init(segment, dest, offset, size) {
    // TODO: traps on invalid things
    bufferView.set(memorySegments[segment].subarray(offset, offset + size), dest);
  }
      
  function wasm2js_data_drop(segment) {
    // TODO: traps on invalid things
    memorySegments[segment] = new Uint8Array(0);
  }
      
  function wasm2js_memory_fill(dest, value, size) {
    dest = dest >>> 0;
    size = size >>> 0;
    if (dest + size > bufferView.length) throw "trap: invalid memory.fill";
    bufferView.fill(value, dest, dest + size);
  }
      
  function wasm2js_memory_copy(dest, source, size) {
    // TODO: traps on invalid things
    bufferView.copyWithin(dest, source, source + size);
  }
      
function asmFunc(env) {
 var memory = env.memory;
 var buffer = memory.buffer;
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var abort = env.abort;
 var nan = NaN;
 var infinity = Infinity;
 var fimport$0 = env.pthread_create;
 var fimport$1 = env.pthread_join;
 var fimport$2 = env.emscripten_futex_wake;
 var fimport$3 = env.pthread_cleanup_push;
 var fimport$4 = env.pthread_cleanup_pop;
 var fimport$5 = env.__clock_gettime;
 var fimport$6 = env.emscripten_get_now;
 var fimport$7 = env.emscripten_futex_wait;
 var fimport$8 = env.emscripten_conditional_set_current_thread_status;
 var fimport$9 = env.emscripten_asm_const_int;
 var fimport$10 = env.__assert_fail;
 var fimport$11 = env.emscripten_set_current_thread_status;
 var fimport$12 = env._emscripten_notify_thread_queue;
 var fimport$13 = env.emscripten_webgl_create_context;
 var fimport$14 = env.emscripten_set_canvas_element_size;
 var fimport$15 = env.emscripten_receive_on_main_thread_js;
 var fimport$16 = env.emscripten_resize_heap;
 var fimport$17 = env.emscripten_memcpy_big;
 var fimport$18 = env.fd_write;
 var fimport$19 = env.initPthreadsJS;
 var fimport$20 = env.setTempRet0;
 var global$0 = 5247744;
 var global$1 = 0;
 var global$2 = 0;
 var global$3 = 0;
 var global$4 = 0;
 var global$5 = 0;
 var global$6 = 0;
 var global$7 = 0;
 var global$8 = 2652;
 var __wasm_intrinsics_temp_i64 = 0;
 var __wasm_intrinsics_temp_i64$hi = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function $0() {
  $96();
  $132();
  $134();
 }
 
 function $1($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $2() {
  if (Atomics.compareExchange(HEAP32, 4848 >> 2, 0, 1) | 0) {
   wasm2js_atomic_wait_i32(4848 | 0, 1 | 0, -1 | 0, -1 | 0) | 0
  } else {
   wasm2js_memory_init(0, 1024, 0, 1189);
   wasm2js_memory_init(1, 2216, 0, 156);
   wasm2js_memory_init(2, 2384, 0, 2464);
   Atomics.store(HEAP32, 4848 >> 2, 2);
   Atomics.notify(HEAP32, 4848 >> 2, -1);
  }
  wasm2js_data_drop(0);
  wasm2js_data_drop(1);
  wasm2js_data_drop(2);
 }
 
 function $3($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $9_1 = 0, $22_1 = 0, $30_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  $9_1 = 2400 + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 20) | 0;
  HEAP32[($9_1 + 16 | 0) >> 2] = (HEAP32[($9_1 + 16 | 0) >> 2] | 0) + 1 | 0;
  label$1 : {
   label$2 : {
    if (!((HEAP32[(0 + 2384 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
     break label$2
    }
    $17(2540 | 0) | 0;
    break label$1;
   }
   $17(2556 | 0) | 0;
  }
  $22_1 = 2400;
  $27($22_1 + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 20) | 0 | 0) | 0;
  $30_1 = $22_1 + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 20) | 0;
  HEAP32[($30_1 + 16 | 0) >> 2] = (HEAP32[($30_1 + 16 | 0) >> 2] | 0) + -1 | 0;
  global$0 = $3_1 + 16 | 0;
  return;
 }
 
 function $4($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  label$1 : {
   if (!((HEAP32[((2400 + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 20) | 0) + 16 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
    break label$1
   }
   HEAP32[(0 + 2384 | 0) >> 2] = (HEAP32[(0 + 2384 | 0) >> 2] | 0) + 1 | 0;
   $17(2400 + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 20) | 0 | 0) | 0;
   $27(2540 | 0) | 0;
   HEAP32[(0 + 2384 | 0) >> 2] = (HEAP32[(0 + 2384 | 0) >> 2] | 0) + -1 | 0;
  }
  global$0 = $3_1 + 16 | 0;
  return;
 }
 
 function $5($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  label$1 : {
   if (HEAP32[(2576 + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) {
    break label$1
   }
   if (!((HEAP32[(2576 + (((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 7 | 0) - 1 | 0 | 0) % (7 | 0) | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (1 | 0) & 1 | 0)) {
    break label$1
   }
   if (!((HEAP32[(2576 + ((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0 | 0) % (7 | 0) | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (1 | 0) & 1 | 0)) {
    break label$1
   }
   HEAP32[(2576 + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 1;
   $4(HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0);
  }
  global$0 = $3_1 + 16 | 0;
  return;
 }
 
 function $6($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $5_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  $5_1 = 2576;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  $27(2556 | 0) | 0;
  HEAP32[($5_1 + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
  $5(HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0);
  label$1 : {
   if (!((HEAP32[($5_1 + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (1 | 0) & 1 | 0)) {
    break label$1
   }
   $3(HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0);
  }
  label$2 : {
   label$3 : {
    if (!((HEAP32[(0 + 2384 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
     break label$3
    }
    $17(2540 | 0) | 0;
    break label$2;
   }
   $17(2556 | 0) | 0;
  }
  global$0 = $3_1 + 16 | 0;
  return;
 }
 
 function $7($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  $27(2556 | 0) | 0;
  HEAP32[(2576 + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 2;
  $5((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 7 | 0) - 1 | 0 | 0) % (7 | 0) | 0 | 0);
  $5(((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0 | 0) % (7 | 0) | 0 | 0);
  label$1 : {
   label$2 : {
    if (!((HEAP32[(0 + 2384 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
     break label$2
    }
    $17(2540 | 0) | 0;
    break label$1;
   }
   $17(2556 | 0) | 0;
  }
  global$0 = $3_1 + 16 | 0;
  return;
 }
 
 function $8() {
  var $2_1 = 0, $3_1 = 0, $14_1 = 0, $15_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  $3_1 = 0;
  $16(2556 | 0, $3_1 | 0, 1 | 0) | 0;
  $16(2540 | 0, $3_1 | 0, $3_1 | 0) | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $3_1;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (7 | 0) & 1 | 0)) {
     break label$1
    }
    $14_1 = 0;
    $15_1 = 2400;
    HEAP32[(2576 + ((HEAP32[($2_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 2;
    $16($15_1 + Math_imul(HEAP32[($2_1 + 12 | 0) >> 2] | 0, 20) | 0 | 0, $14_1 | 0, $14_1 | 0) | 0;
    HEAP32[(($15_1 + Math_imul(HEAP32[($2_1 + 12 | 0) >> 2] | 0, 20) | 0) + 16 | 0) >> 2] = $14_1;
    HEAP32[($2_1 + 12 | 0) >> 2] = (HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $9($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $6_1 = 0, $11_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  label$1 : while (1) {
   HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 2] | 0;
   $6_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
   HEAP32[($3_1 + 4 | 0) >> 2] = 5;
   HEAP32[$3_1 >> 2] = $6_1;
   $122(1024 | 0, $3_1 | 0) | 0;
   $12(5 | 0) | 0;
   $6(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0);
   $11_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
   HEAP32[($3_1 + 20 | 0) >> 2] = 5;
   HEAP32[($3_1 + 16 | 0) >> 2] = $11_1;
   $122(1077 | 0, $3_1 + 16 | 0 | 0) | 0;
   $12(5 | 0) | 0;
   $7(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0);
   continue label$1;
  };
 }
 
 function $10() {
  var $2_1 = 0, $3_1 = 0, $16_1 = 0;
  $2_1 = global$0 - 128 | 0;
  global$0 = $2_1;
  $3_1 = 0;
  HEAP32[($2_1 + 124 | 0) >> 2] = $3_1;
  $8();
  $15($2_1 | 0) | 0;
  HEAP32[($2_1 + 120 | 0) >> 2] = $3_1;
  label$1 : {
   label$2 : while (1) {
    if (!((HEAP32[($2_1 + 120 | 0) >> 2] | 0 | 0) < (7 | 0) & 1 | 0)) {
     break label$1
    }
    $16_1 = $2_1 + 80 | 0;
    HEAP32[($16_1 + ((HEAP32[($2_1 + 120 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = HEAP32[($2_1 + 120 | 0) >> 2] | 0;
    fimport$0(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 120 | 0) >> 2] | 0) << 2 | 0) | 0 | 0, 0 | 0, 1 | 0, $16_1 + ((HEAP32[($2_1 + 120 | 0) >> 2] | 0) << 2 | 0) | 0 | 0) | 0;
    HEAP32[($2_1 + 120 | 0) >> 2] = (HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 1 | 0;
    continue label$2;
   };
  }
  HEAP32[($2_1 + 120 | 0) >> 2] = 0;
  label$3 : {
   label$4 : while (1) {
    if (!((HEAP32[($2_1 + 120 | 0) >> 2] | 0 | 0) < (7 | 0) & 1 | 0)) {
     break label$3
    }
    fimport$1(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 120 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 0 | 0) | 0;
    HEAP32[($2_1 + 120 | 0) >> 2] = (HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 1 | 0;
    continue label$4;
   };
  }
  global$0 = $2_1 + 128 | 0;
  return 0 | 0;
 }
 
 function $11($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  return $10() | 0 | 0;
 }
 
 function $12($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = 0;
  $0_1 = $14($1_1 + 8 | 0 | 0, $1_1 + 8 | 0 | 0) | 0;
  $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return ($0_1 ? $2_1 : 0) | 0;
 }
 
 function $13() {
  return ($89() | 0) + 48 | 0 | 0;
 }
 
 function $14($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  label$1 : {
   label$2 : {
    if (!$0_1) {
     break label$2
    }
    $2_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
    if ($2_1 >>> 0 > 999999999 >>> 0) {
     break label$2
    }
    $0_1 = HEAP32[$0_1 >> 2] | 0;
    if (($0_1 | 0) > (-1 | 0)) {
     break label$1
    }
   }
   HEAP32[($13() | 0) >> 2] = 28;
   return -1 | 0;
  }
  $71(+(+($2_1 | 0) / 1.0e6 + +($0_1 | 0) * 1.0e3));
  return 0 | 0;
 }
 
 function $15($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 48 | 0;
  wasm2js_memory_fill($1_1 + 4 | 0, 0, 44);
  wasm2js_memory_copy($0_1, $1_1 + 4 | 0, 44);
  return 0 | 0;
 }
 
 function $16($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  label$1 : {
   if (($2_1 | 0) > (-1 | 0)) {
    break label$1
   }
   HEAP32[($13() | 0) >> 2] = 28;
   return -1 | 0;
  }
  HEAP32[$0_1 >> 2] = $2_1;
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = !$1_1 << 7 | 0;
  return 0 | 0;
 }
 
 function $17($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $1_1 = 0, $3_1 = 0;
  $1_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
  label$1 : while (1) {
   $2_1 = HEAP32[$0_1 >> 2] | 0;
   $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
   label$2 : {
    if (($2_1 | 0) != (2147483647 | 0)) {
     break label$2
    }
    HEAP32[($13() | 0) >> 2] = 61;
    return -1 | 0;
   }
   if (($18($0_1 | 0, $2_1 | 0, ($2_1 + ($2_1 >>> 31 | 0) | 0) + 1 | 0 | 0) | 0 | 0) != ($2_1 | 0)) {
    continue label$1
   }
   break label$1;
  };
  label$3 : {
   label$4 : {
    if (($2_1 | 0) < (0 | 0)) {
     break label$4
    }
    if (!$3_1) {
     break label$3
    }
   }
   $19($0_1 | 0, $1_1 | 0);
  }
  return 0 | 0;
 }
 
 function $18($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return Atomics.compareExchange(HEAP32, $0_1 >> 2, $1_1, $2_1) | 0 | 0;
 }
 
 function $19($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  fimport$2($0_1 | 0, 1 | 0) | 0;
 }
 
 function $20($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $4_1 = 0, $2_1 = 0;
  label$1 : {
   label$2 : {
    label$3 : while (1) {
     $1_1 = HEAP32[$0_1 >> 2] | 0;
     if (($1_1 | 0) < (1 | 0)) {
      break label$2
     }
     $2_1 = $1_1 + -1 | 0;
     $3_1 = 0;
     $4_1 = 0;
     label$4 : {
      if (($1_1 | 0) != (1 | 0)) {
       break label$4
      }
      $4_1 = (HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0);
     }
     if (($21($0_1 | 0, $1_1 | 0, $2_1 - $4_1 | 0 | 0) | 0 | 0) != ($1_1 | 0)) {
      continue label$3
     }
     break label$1;
    };
   }
   HEAP32[($13() | 0) >> 2] = 6;
   $3_1 = -1;
  }
  return $3_1 | 0;
 }
 
 function $21($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return Atomics.compareExchange(HEAP32, $0_1 >> 2, $1_1, $2_1) | 0 | 0;
 }
 
 function $22($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0;
  $70();
  label$1 : {
   if (!($20($0_1 | 0) | 0)) {
    break label$1
   }
   $2_1 = $0_1 + 4 | 0;
   $3_1 = 100;
   label$2 : {
    label$3 : while (1) {
     if (!$3_1) {
      break label$2
     }
     if ((HEAP32[$0_1 >> 2] | 0 | 0) > (0 | 0)) {
      break label$2
     }
     $3_1 = $3_1 + -1 | 0;
     if (!(HEAP32[$2_1 >> 2] | 0)) {
      continue label$3
     }
     break label$3;
    };
   }
   if (!($20($0_1 | 0) | 0)) {
    break label$1
   }
   label$4 : {
    label$5 : {
     label$6 : while (1) {
      $23($2_1 | 0);
      $24($0_1 | 0);
      fimport$3(2 | 0, $2_1 | 0);
      $3_1 = $29($0_1 | 0, -1 | 0, 0 | 0, $1_1 | 0, HEAP32[($0_1 + 8 | 0) >> 2] | 0 | 0) | 0;
      fimport$4(1 | 0);
      label$7 : {
       if (!$3_1) {
        break label$7
       }
       if (($3_1 | 0) == (27 | 0)) {
        break label$7
       }
       if (($3_1 | 0) != (11 | 0)) {
        break label$5
       }
       HEAP32[($13() | 0) >> 2] = 27;
       break label$4;
      }
      if (!($20($0_1 | 0) | 0)) {
       break label$1
      }
      continue label$6;
     };
    }
    HEAP32[($13() | 0) >> 2] = $3_1;
   }
   return -1 | 0;
  }
  return 0 | 0;
 }
 
 function $23($0_1) {
  $0_1 = $0_1 | 0;
  Atomics.add(HEAP32, $0_1 >> 2, 1);
 }
 
 function $24($0_1) {
  $0_1 = $0_1 | 0;
  Atomics.compareExchange(HEAP32, $0_1 >> 2, 0, -1) | 0;
 }
 
 function $25($0_1) {
  $0_1 = $0_1 | 0;
  $26($0_1 | 0);
 }
 
 function $26($0_1) {
  $0_1 = $0_1 | 0;
  Atomics.sub(HEAP32, $0_1 >> 2, 1);
 }
 
 function $27($0_1) {
  $0_1 = $0_1 | 0;
  return $22($0_1 | 0, 0 | 0) | 0 | 0;
 }
 
 function $28() {
  return $89() | 0 | 0;
 }
 
 function $29($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $6_1 = 0, $7_1 = 0.0, $5_1 = 0, $8_1 = 0.0;
  $5_1 = global$0 - 16 | 0;
  global$0 = $5_1;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      if ($3_1) {
       break label$4
      }
      $7_1 = infinity;
      break label$3;
     }
     $6_1 = 28;
     if ((HEAP32[($3_1 + 4 | 0) >> 2] | 0) >>> 0 > 999999999 >>> 0) {
      break label$1
     }
     if (fimport$5($2_1 | 0, $5_1 + 8 | 0 | 0) | 0) {
      break label$1
     }
     $6_1 = (HEAP32[$3_1 >> 2] | 0) - (HEAP32[($5_1 + 8 | 0) >> 2] | 0) | 0;
     HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
     $3_1 = (HEAP32[($3_1 + 4 | 0) >> 2] | 0) - (HEAP32[($5_1 + 12 | 0) >> 2] | 0) | 0;
     HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
     label$5 : {
      if (($3_1 | 0) > (-1 | 0)) {
       break label$5
      }
      $3_1 = $3_1 + 1e9 | 0;
      HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
      $6_1 = $6_1 + -1 | 0;
      HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
     }
     if (($6_1 | 0) < (0 | 0)) {
      break label$2
     }
     $7_1 = +($3_1 | 0) / 1.0e6 + +(Math_imul($6_1, 1e3) | 0);
    }
    label$6 : {
     label$7 : {
      label$8 : {
       $3_1 = $92() | 0;
       if ($3_1) {
        break label$8
       }
       if ((HEAP32[(($28() | 0) + 60 | 0) >> 2] | 0 | 0) != (1 | 0)) {
        break label$7
       }
      }
      $8_1 = $7_1 + +fimport$6();
      label$9 : while (1) {
       label$10 : {
        if (!($69($28() | 0 | 0) | 0)) {
         break label$10
        }
        $6_1 = 11;
        break label$1;
       }
       label$11 : {
        if (!$3_1) {
         break label$11
        }
        $85();
       }
       $7_1 = $8_1 - +fimport$6();
       if ($7_1 <= 0.0) {
        break label$2
       }
       $7_1 = Math_min($7_1, 100.0);
       $6_1 = 0 - (fimport$7($0_1 | 0, $1_1 | 0, +($3_1 ? ($7_1 > 1.0 ? 1.0 : $7_1) : $7_1)) | 0) | 0;
       if (($6_1 | 0) == (73 | 0)) {
        continue label$9
       }
       break label$6;
      };
     }
     $6_1 = 0 - (fimport$7($0_1 | 0, $1_1 | 0, +$7_1) | 0) | 0;
    }
    if (($6_1 | 0) == (11 | 0)) {
     break label$1
    }
    if (($6_1 | 0) == (27 | 0)) {
     break label$1
    }
    if (($6_1 | 0) == (73 | 0)) {
     break label$1
    }
    $6_1 = 0;
    break label$1;
   }
   $6_1 = 73;
  }
  global$0 = $5_1 + 16 | 0;
  return $6_1 | 0;
 }
 
 function $30($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 16 | 0;
  global$0 = $5_1;
  $31(1 | 0, $5_1 + 12 | 0 | 0) | 0;
  fimport$8(1 | 0, 4 | 0);
  $0_1 = $29($0_1 | 0, $1_1 | 0, $2_1 | 0, $3_1 | 0, $4_1 | 0) | 0;
  fimport$8(4 | 0, 1 | 0);
  $31(HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0, 0 | 0) | 0;
  global$0 = $5_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $31($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = 28;
  label$1 : {
   if ($0_1 >>> 0 > 2 >>> 0) {
    break label$1
   }
   $2_1 = $89() | 0;
   label$2 : {
    if (!$1_1) {
     break label$2
    }
    HEAP32[$1_1 >> 2] = HEAP32[($2_1 + 56 | 0) >> 2] | 0;
   }
   HEAP32[($2_1 + 56 | 0) >> 2] = $0_1;
   $2_1 = 0;
  }
  return $2_1 | 0;
 }
 
 function $32($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $3_1 = 0, $6_1 = 0, $5_1 = 0, $1_1 = 0, $4_1 = 0;
  $1_1 = HEAP32[$0_1 >> 2] | 0;
  $2_1 = $89() | 0;
  $3_1 = HEAP32[($2_1 + 40 | 0) >> 2] | 0;
  $4_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
  $5_1 = $4_1 & 2147483647 | 0;
  label$1 : {
   label$2 : {
    if (($1_1 & 3 | 0 | 0) != (1 | 0)) {
     break label$2
    }
    if (($5_1 | 0) != ($3_1 | 0)) {
     break label$2
    }
    $6_1 = 6;
    $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
    if ($5_1 >>> 0 > 2147483646 >>> 0) {
     break label$1
    }
    HEAP32[($0_1 + 20 | 0) >> 2] = $5_1 + 1 | 0;
    return 0 | 0;
   }
   $6_1 = 56;
   if (($5_1 | 0) == (2147483647 | 0)) {
    break label$1
   }
   label$3 : {
    if (!((HEAPU8[$0_1 >> 0] | 0) & 128 | 0)) {
     break label$3
    }
    label$4 : {
     if (HEAP32[($2_1 + 156 | 0) >> 2] | 0) {
      break label$4
     }
     HEAP32[($2_1 + 156 | 0) >> 2] = -12;
    }
    $6_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
    HEAP32[($2_1 + 160 | 0) >> 2] = $0_1 + 16 | 0;
    $3_1 = $6_1 ? $3_1 | -2147483648 | 0 : $3_1;
   }
   label$5 : {
    label$6 : {
     label$7 : {
      if (!$5_1) {
       break label$7
      }
      if (!($1_1 & 4 | 0)) {
       break label$6
      }
      if (!($4_1 & 1073741824 | 0)) {
       break label$6
      }
     }
     if (($33($0_1 + 4 | 0 | 0, $4_1 | 0, $3_1 | 0) | 0 | 0) == ($4_1 | 0)) {
      break label$5
     }
    }
    HEAP32[($2_1 + 160 | 0) >> 2] = 0;
    return 10 | 0;
   }
   $3_1 = HEAP32[($2_1 + 152 | 0) >> 2] | 0;
   $6_1 = $2_1 + 152 | 0;
   HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
   HEAP32[($0_1 + 16 | 0) >> 2] = $3_1;
   $1_1 = $0_1 + 16 | 0;
   label$8 : {
    if (($3_1 | 0) == ($6_1 | 0)) {
     break label$8
    }
    HEAP32[($3_1 + -4 | 0) >> 2] = $1_1;
   }
   HEAP32[($2_1 + 152 | 0) >> 2] = $1_1;
   $6_1 = 0;
   HEAP32[($2_1 + 160 | 0) >> 2] = 0;
   if (!$5_1) {
    break label$1
   }
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | 8 | 0;
   $6_1 = 62;
  }
  return $6_1 | 0;
 }
 
 function $33($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return Atomics.compareExchange(HEAP32, $0_1 >> 2, $1_1, $2_1) | 0 | 0;
 }
 
 function $34($0_1) {
  $0_1 = $0_1 | 0;
  label$1 : {
   if ((HEAPU8[$0_1 >> 0] | 0) & 15 | 0) {
    break label$1
   }
   return ($33($0_1 + 4 | 0 | 0, 0 | 0, 10 | 0) | 0) & 10 | 0 | 0;
  }
  return $32($0_1 | 0) | 0 | 0;
 }
 
 function $35($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0, $6_1 = 0, $5_1 = 0, $4_1 = 0;
  label$1 : {
   label$2 : {
    $2_1 = HEAP32[$0_1 >> 2] | 0;
    if ($2_1 & 15 | 0) {
     break label$2
    }
    $3_1 = 0;
    if (!($36($0_1 + 4 | 0 | 0, 0 | 0, 10 | 0) | 0)) {
     break label$1
    }
    $2_1 = HEAP32[$0_1 >> 2] | 0;
   }
   $3_1 = $34($0_1 | 0) | 0;
   if (($3_1 | 0) != (10 | 0)) {
    break label$1
   }
   $4_1 = ($2_1 ^ -1 | 0) & 128 | 0;
   $5_1 = $0_1 + 8 | 0;
   $2_1 = $0_1 + 4 | 0;
   $3_1 = 100;
   label$3 : {
    label$4 : while (1) {
     if (!$3_1) {
      break label$3
     }
     if (!(HEAP32[$2_1 >> 2] | 0)) {
      break label$3
     }
     $3_1 = $3_1 + -1 | 0;
     if (!(HEAP32[$5_1 >> 2] | 0)) {
      continue label$4
     }
     break label$4;
    };
   }
   $3_1 = $34($0_1 | 0) | 0;
   if (($3_1 | 0) != (10 | 0)) {
    break label$1
   }
   label$5 : while (1) {
    label$6 : {
     $3_1 = HEAP32[$2_1 >> 2] | 0;
     if (!$3_1) {
      break label$6
     }
     $6_1 = HEAP32[$0_1 >> 2] | 0;
     label$7 : {
      if (!($3_1 & 1073741824 | 0)) {
       break label$7
      }
      if ($6_1 & 4 | 0) {
       break label$6
      }
     }
     label$8 : {
      if (($6_1 & 3 | 0 | 0) != (2 | 0)) {
       break label$8
      }
      if (($3_1 & 2147483647 | 0 | 0) != (HEAP32[(($89() | 0) + 40 | 0) >> 2] | 0 | 0)) {
       break label$8
      }
      return 16 | 0;
     }
     $37($5_1 | 0);
     $6_1 = $3_1 | -2147483648 | 0;
     $36($2_1 | 0, $3_1 | 0, $6_1 | 0) | 0;
     $3_1 = $30($2_1 | 0, $6_1 | 0, 0 | 0, $1_1 | 0, $4_1 | 0) | 0;
     $38($5_1 | 0);
     if (!$3_1) {
      break label$6
     }
     if (($3_1 | 0) != (27 | 0)) {
      break label$1
     }
    }
    $3_1 = $34($0_1 | 0) | 0;
    if (($3_1 | 0) == (10 | 0)) {
     continue label$5
    }
    break label$5;
   };
  }
  return $3_1 | 0;
 }
 
 function $36($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return Atomics.compareExchange(HEAP32, $0_1 >> 2, $1_1, $2_1) | 0 | 0;
 }
 
 function $37($0_1) {
  $0_1 = $0_1 | 0;
  Atomics.add(HEAP32, $0_1 >> 2, 1);
 }
 
 function $38($0_1) {
  $0_1 = $0_1 | 0;
  Atomics.sub(HEAP32, $0_1 >> 2, 1);
 }
 
 function $39($0_1) {
  $0_1 = $0_1 | 0;
  label$1 : {
   if ((HEAPU8[$0_1 >> 0] | 0) & 15 | 0) {
    break label$1
   }
   if ($40($0_1 + 4 | 0 | 0) | 0) {
    break label$1
   }
   return 0 | 0;
  }
  return $35($0_1 | 0, 0 | 0) | 0 | 0;
 }
 
 function $40($0_1) {
  $0_1 = $0_1 | 0;
  return Atomics.compareExchange(HEAP32, $0_1 >> 2, 0, 10) | 0 | 0;
 }
 
 function $41() {
  $42();
 }
 
 function $42() {
  Atomics.add(HEAP32, (0 + 2604 | 0) >> 2, 1);
 }
 
 function $43() {
  label$1 : {
   if (($44() | 0 | 0) != (1 | 0)) {
    break label$1
   }
   if (!(HEAP32[(0 + 2608 | 0) >> 2] | 0)) {
    break label$1
   }
   $45();
  }
 }
 
 function $44() {
  return Atomics.add(HEAP32, (0 + 2604 | 0) >> 2, -1) | 0;
 }
 
 function $45() {
  fimport$2(2604 | 0, 2147483647 | 0) | 0;
 }
 
 function $46($0_1) {
  $0_1 = $0_1 | 0;
  var $6_1 = 0, $7_1 = 0, $1_1 = 0, $5_1 = 0, $2_1 = 0, $4_1 = 0, $3_1 = 0;
  $1_1 = HEAP32[$0_1 >> 2] | 0;
  $2_1 = ($1_1 ^ -1 | 0) & 128 | 0;
  $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    label$3 : {
     $4_1 = $1_1 & 15 | 0;
     if ($4_1) {
      break label$3
     }
     break label$2;
    }
    $5_1 = $89() | 0;
    $6_1 = 63;
    if (((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & 2147483647 | 0 | 0) != (HEAP32[($5_1 + 40 | 0) >> 2] | 0 | 0)) {
     break label$1
    }
    label$4 : {
     if (($1_1 & 3 | 0 | 0) != (1 | 0)) {
      break label$4
     }
     $6_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
     if (!$6_1) {
      break label$4
     }
     HEAP32[($0_1 + 20 | 0) >> 2] = $6_1 + -1 | 0;
     return 0 | 0;
    }
    label$5 : {
     if ($2_1) {
      break label$5
     }
     HEAP32[($5_1 + 160 | 0) >> 2] = $0_1 + 16 | 0;
     $41();
    }
    $7_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
    $6_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
    HEAP32[$7_1 >> 2] = $6_1;
    if (($6_1 | 0) == ($5_1 + 152 | 0 | 0)) {
     break label$2
    }
    HEAP32[($6_1 + -4 | 0) >> 2] = $7_1;
   }
   $7_1 = $0_1 + 4 | 0;
   $0_1 = $47($7_1 | 0, (($1_1 << 28 | 0) >> 31 | 0) & 2147483647 | 0 | 0) | 0;
   label$6 : {
    if (!$4_1) {
     break label$6
    }
    if ($2_1) {
     break label$6
    }
    HEAP32[($5_1 + 160 | 0) >> 2] = 0;
    $43();
   }
   $6_1 = 0;
   label$7 : {
    if ($3_1) {
     break label$7
    }
    if (($0_1 | 0) > (-1 | 0)) {
     break label$1
    }
   }
   $48($7_1 | 0, $2_1 | 0);
  }
  return $6_1 | 0;
 }
 
 function $47($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  return Atomics.exchange(HEAP32, $0_1 >> 2, $1_1) | 0;
 }
 
 function $48($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  fimport$2($0_1 | 0, 1 | 0) | 0;
 }
 
 function $49($0_1) {
  $0_1 = $0_1 | 0;
  return Atomics.load(HEAP32, $0_1 >> 2) | 0 | 0;
 }
 
 function $50($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  Atomics.store(HEAP32, $0_1 >> 2, $1_1);
  return $1_1 | 0;
 }
 
 function $51($0_1) {
  $0_1 = $0_1 | 0;
  return ($0_1 + -48 | 0) >>> 0 < 10 >>> 0 | 0;
 }
 
 function $52($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  $3_1 = ($2_1 | 0) != (0 | 0);
  label$1 : {
   label$2 : {
    label$3 : {
     if (!$2_1) {
      break label$3
     }
     if (!($0_1 & 3 | 0)) {
      break label$3
     }
     $4_1 = $1_1 & 255 | 0;
     label$4 : while (1) {
      if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($4_1 | 0)) {
       break label$2
      }
      $0_1 = $0_1 + 1 | 0;
      $2_1 = $2_1 + -1 | 0;
      $3_1 = ($2_1 | 0) != (0 | 0);
      if (!$2_1) {
       break label$3
      }
      if ($0_1 & 3 | 0) {
       continue label$4
      }
      break label$4;
     };
    }
    if (!$3_1) {
     break label$1
    }
   }
   label$5 : {
    if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($1_1 & 255 | 0 | 0)) {
     break label$5
    }
    if ($2_1 >>> 0 < 4 >>> 0) {
     break label$5
    }
    $4_1 = Math_imul($1_1 & 255 | 0, 16843009);
    label$6 : while (1) {
     $3_1 = (HEAP32[$0_1 >> 2] | 0) ^ $4_1 | 0;
     if ((($3_1 ^ -1 | 0) & ($3_1 + -16843009 | 0) | 0) & -2139062144 | 0) {
      break label$5
     }
     $0_1 = $0_1 + 4 | 0;
     $2_1 = $2_1 + -4 | 0;
     if ($2_1 >>> 0 > 3 >>> 0) {
      continue label$6
     }
     break label$6;
    };
   }
   if (!$2_1) {
    break label$1
   }
   $3_1 = $1_1 & 255 | 0;
   label$7 : while (1) {
    label$8 : {
     if ((HEAPU8[$0_1 >> 0] | 0 | 0) != ($3_1 | 0)) {
      break label$8
     }
     return $0_1 | 0;
    }
    $0_1 = $0_1 + 1 | 0;
    $2_1 = $2_1 + -1 | 0;
    if ($2_1) {
     continue label$7
    }
    break label$7;
   };
  }
  return 0 | 0;
 }
 
 function $53($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = 1;
  label$1 : {
   label$2 : {
    if (!$0_1) {
     break label$2
    }
    if ($1_1 >>> 0 <= 127 >>> 0) {
     break label$1
    }
    label$3 : {
     label$4 : {
      if (HEAP32[(HEAP32[(($89() | 0) + 172 | 0) >> 2] | 0) >> 2] | 0) {
       break label$4
      }
      if (($1_1 & -128 | 0 | 0) == (57216 | 0)) {
       break label$1
      }
      HEAP32[($13() | 0) >> 2] = 25;
      break label$3;
     }
     label$5 : {
      if ($1_1 >>> 0 > 2047 >>> 0) {
       break label$5
      }
      HEAP8[($0_1 + 1 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 6 | 0 | 192 | 0;
      return 2 | 0;
     }
     label$6 : {
      label$7 : {
       if ($1_1 >>> 0 < 55296 >>> 0) {
        break label$7
       }
       if (($1_1 & -8192 | 0 | 0) != (57344 | 0)) {
        break label$6
       }
      }
      HEAP8[($0_1 + 2 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 12 | 0 | 224 | 0;
      HEAP8[($0_1 + 1 | 0) >> 0] = ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0;
      return 3 | 0;
     }
     label$8 : {
      if (($1_1 + -65536 | 0) >>> 0 > 1048575 >>> 0) {
       break label$8
      }
      HEAP8[($0_1 + 3 | 0) >> 0] = $1_1 & 63 | 0 | 128 | 0;
      HEAP8[$0_1 >> 0] = $1_1 >>> 18 | 0 | 240 | 0;
      HEAP8[($0_1 + 2 | 0) >> 0] = ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0;
      HEAP8[($0_1 + 1 | 0) >> 0] = ($1_1 >>> 12 | 0) & 63 | 0 | 128 | 0;
      return 4 | 0;
     }
     HEAP32[($13() | 0) >> 2] = 25;
    }
    $3_1 = -1;
   }
   return $3_1 | 0;
  }
  HEAP8[$0_1 >> 0] = $1_1;
  return 1 | 0;
 }
 
 function $54($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return 0 | 0;
  }
  return $53($0_1 | 0, $1_1 | 0, 0 | 0) | 0 | 0;
 }
 
 function $55($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $2_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, $3_1 = 0, $10_1 = 0, $3$hi = 0;
  label$1 : {
   wasm2js_scratch_store_f64(+$0_1);
   i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
   $3_1 = wasm2js_scratch_load_i32(0 | 0) | 0;
   $3$hi = i64toi32_i32$0;
   i64toi32_i32$2 = $3_1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 52;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = 0;
    $10_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    $10_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = $10_1 & 2047 | 0;
   if (($2_1 | 0) == (2047 | 0)) {
    break label$1
   }
   label$2 : {
    if ($2_1) {
     break label$2
    }
    label$3 : {
     label$4 : {
      if ($0_1 != 0.0) {
       break label$4
      }
      $2_1 = 0;
      break label$3;
     }
     $0_1 = +$55(+($0_1 * 18446744073709551615.0), $1_1 | 0);
     $2_1 = (HEAP32[$1_1 >> 2] | 0) + -64 | 0;
    }
    HEAP32[$1_1 >> 2] = $2_1;
    return +$0_1;
   }
   HEAP32[$1_1 >> 2] = $2_1 + -1022 | 0;
   i64toi32_i32$1 = $3$hi;
   i64toi32_i32$0 = $3_1;
   i64toi32_i32$2 = -2146435073;
   i64toi32_i32$3 = -1;
   i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
   i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
   i64toi32_i32$0 = 1071644672;
   i64toi32_i32$3 = 0;
   i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
   wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$1 | i64toi32_i32$3 | 0 | 0);
   wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$0 | 0);
   $0_1 = +wasm2js_scratch_load_f64();
  }
  return +$0_1;
 }
 
 function $56($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $6_1 = 0, $7_1 = 0;
  $5_1 = global$0 - 208 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 204 | 0) >> 2] = $2_1;
  $2_1 = 0;
  wasm2js_memory_fill($5_1 + 160 | 0, 0, 40);
  HEAP32[($5_1 + 200 | 0) >> 2] = HEAP32[($5_1 + 204 | 0) >> 2] | 0;
  label$1 : {
   label$2 : {
    if (($57(0 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0 | 0) >= (0 | 0)) {
     break label$2
    }
    $1_1 = -1;
    break label$1;
   }
   label$3 : {
    if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
     break label$3
    }
    $2_1 = $123($0_1 | 0) | 0;
   }
   $6_1 = HEAP32[$0_1 >> 2] | 0;
   label$4 : {
    if ((HEAP8[($0_1 + 74 | 0) >> 0] | 0 | 0) > (0 | 0)) {
     break label$4
    }
    HEAP32[$0_1 >> 2] = $6_1 & -33 | 0;
   }
   $6_1 = $6_1 & 32 | 0;
   label$5 : {
    label$6 : {
     if (!(HEAP32[($0_1 + 48 | 0) >> 2] | 0)) {
      break label$6
     }
     $1_1 = $57($0_1 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0;
     break label$5;
    }
    HEAP32[($0_1 + 48 | 0) >> 2] = 80;
    HEAP32[($0_1 + 16 | 0) >> 2] = $5_1 + 80 | 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = $5_1;
    HEAP32[($0_1 + 20 | 0) >> 2] = $5_1;
    $7_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
    HEAP32[($0_1 + 44 | 0) >> 2] = $5_1;
    $1_1 = $57($0_1 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0;
    if (!$7_1) {
     break label$5
    }
    FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
    HEAP32[($0_1 + 48 | 0) >> 2] = 0;
    HEAP32[($0_1 + 44 | 0) >> 2] = $7_1;
    HEAP32[($0_1 + 28 | 0) >> 2] = 0;
    HEAP32[($0_1 + 16 | 0) >> 2] = 0;
    $3_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
    HEAP32[($0_1 + 20 | 0) >> 2] = 0;
    $1_1 = $3_1 ? $1_1 : -1;
   }
   $3_1 = HEAP32[$0_1 >> 2] | 0;
   HEAP32[$0_1 >> 2] = $3_1 | $6_1 | 0;
   $1_1 = $3_1 & 32 | 0 ? -1 : $1_1;
   if (!$2_1) {
    break label$1
   }
   $124($0_1 | 0);
  }
  global$0 = $5_1 + 208 | 0;
  return $1_1 | 0;
 }
 
 function $57($0_1, $1_1, $2_1, $3_1, $4_1, $5_1, $6_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  $6_1 = $6_1 | 0;
  var $7_1 = 0, $13_1 = 0, $14_1 = 0, $19_1 = 0, i64toi32_i32$1 = 0, $15_1 = 0, $12_1 = 0, $20_1 = 0, i64toi32_i32$0 = 0, $17_1 = 0, $11_1 = 0, $18_1 = 0, i64toi32_i32$2 = 0, $16_1 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $9_1 = 0, $22_1 = 0, $22$hi = 0, $10_1 = 0, $21_1 = 0, $30_1 = 0, $31_1 = 0, $32_1 = 0, $8_1 = 0, $275 = 0;
  $7_1 = global$0 - 80 | 0;
  global$0 = $7_1;
  HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
  $8_1 = $7_1 + 55 | 0;
  $9_1 = $7_1 + 56 | 0;
  $10_1 = 0;
  $11_1 = 0;
  $1_1 = 0;
  label$1 : {
   label$2 : while (1) {
    label$3 : {
     if (($11_1 | 0) < (0 | 0)) {
      break label$3
     }
     label$4 : {
      if (($1_1 | 0) <= (2147483647 - $11_1 | 0 | 0)) {
       break label$4
      }
      HEAP32[($13() | 0) >> 2] = 61;
      $11_1 = -1;
      break label$3;
     }
     $11_1 = $1_1 + $11_1 | 0;
    }
    $12_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
    $1_1 = $12_1;
    label$5 : {
     label$6 : {
      label$7 : {
       label$8 : {
        label$9 : {
         $13_1 = HEAPU8[$1_1 >> 0] | 0;
         if (!$13_1) {
          break label$9
         }
         label$10 : while (1) {
          label$11 : {
           label$12 : {
            label$13 : {
             $13_1 = $13_1 & 255 | 0;
             if ($13_1) {
              break label$13
             }
             $13_1 = $1_1;
             break label$12;
            }
            if (($13_1 | 0) != (37 | 0)) {
             break label$11
            }
            $13_1 = $1_1;
            label$14 : while (1) {
             if ((HEAPU8[($1_1 + 1 | 0) >> 0] | 0 | 0) != (37 | 0)) {
              break label$12
             }
             $14_1 = $1_1 + 2 | 0;
             HEAP32[($7_1 + 76 | 0) >> 2] = $14_1;
             $13_1 = $13_1 + 1 | 0;
             $15_1 = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
             $1_1 = $14_1;
             if (($15_1 | 0) == (37 | 0)) {
              continue label$14
             }
             break label$14;
            };
           }
           $1_1 = $13_1 - $12_1 | 0;
           label$15 : {
            if (!$0_1) {
             break label$15
            }
            $58($0_1 | 0, $12_1 | 0, $1_1 | 0);
           }
           if ($1_1) {
            continue label$2
           }
           $1_1 = $51(HEAP8[((HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0 | 0) | 0;
           $13_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
           label$16 : {
            label$17 : {
             if (!$1_1) {
              break label$17
             }
             if ((HEAPU8[($13_1 + 2 | 0) >> 0] | 0 | 0) != (36 | 0)) {
              break label$17
             }
             $1_1 = $13_1 + 3 | 0;
             $16_1 = (HEAP8[($13_1 + 1 | 0) >> 0] | 0) + -48 | 0;
             $10_1 = 1;
             break label$16;
            }
            $1_1 = $13_1 + 1 | 0;
            $16_1 = -1;
           }
           HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
           $17_1 = 0;
           label$18 : {
            label$19 : {
             $15_1 = HEAP8[$1_1 >> 0] | 0;
             $14_1 = $15_1 + -32 | 0;
             if ($14_1 >>> 0 <= 31 >>> 0) {
              break label$19
             }
             $13_1 = $1_1;
             break label$18;
            }
            $17_1 = 0;
            $13_1 = $1_1;
            $14_1 = 1 << $14_1 | 0;
            if (!($14_1 & 75913 | 0)) {
             break label$18
            }
            label$20 : while (1) {
             $13_1 = $1_1 + 1 | 0;
             HEAP32[($7_1 + 76 | 0) >> 2] = $13_1;
             $17_1 = $14_1 | $17_1 | 0;
             $15_1 = HEAP8[($1_1 + 1 | 0) >> 0] | 0;
             $14_1 = $15_1 + -32 | 0;
             if ($14_1 >>> 0 >= 32 >>> 0) {
              break label$18
             }
             $1_1 = $13_1;
             $14_1 = 1 << $14_1 | 0;
             if ($14_1 & 75913 | 0) {
              continue label$20
             }
             break label$20;
            };
           }
           label$21 : {
            label$22 : {
             if (($15_1 | 0) != (42 | 0)) {
              break label$22
             }
             label$23 : {
              label$24 : {
               if (!($51(HEAP8[($13_1 + 1 | 0) >> 0] | 0 | 0) | 0)) {
                break label$24
               }
               $13_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
               if ((HEAPU8[($13_1 + 2 | 0) >> 0] | 0 | 0) != (36 | 0)) {
                break label$24
               }
               HEAP32[((((HEAP8[($13_1 + 1 | 0) >> 0] | 0) << 2 | 0) + $4_1 | 0) + -192 | 0) >> 2] = 10;
               $1_1 = $13_1 + 3 | 0;
               $18_1 = HEAP32[((((HEAP8[($13_1 + 1 | 0) >> 0] | 0) << 3 | 0) + $3_1 | 0) + -384 | 0) >> 2] | 0;
               $10_1 = 1;
               break label$23;
              }
              if ($10_1) {
               break label$8
              }
              $10_1 = 0;
              $18_1 = 0;
              label$25 : {
               if (!$0_1) {
                break label$25
               }
               $1_1 = HEAP32[$2_1 >> 2] | 0;
               HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
               $18_1 = HEAP32[$1_1 >> 2] | 0;
              }
              $1_1 = (HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 1 | 0;
             }
             HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
             if (($18_1 | 0) > (-1 | 0)) {
              break label$21
             }
             $18_1 = 0 - $18_1 | 0;
             $17_1 = $17_1 | 8192 | 0;
             break label$21;
            }
            $18_1 = $59($7_1 + 76 | 0 | 0) | 0;
            if (($18_1 | 0) < (0 | 0)) {
             break label$8
            }
            $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
           }
           $19_1 = -1;
           label$26 : {
            if ((HEAPU8[$1_1 >> 0] | 0 | 0) != (46 | 0)) {
             break label$26
            }
            label$27 : {
             if ((HEAPU8[($1_1 + 1 | 0) >> 0] | 0 | 0) != (42 | 0)) {
              break label$27
             }
             label$28 : {
              if (!($51(HEAP8[($1_1 + 2 | 0) >> 0] | 0 | 0) | 0)) {
               break label$28
              }
              $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
              if ((HEAPU8[($1_1 + 3 | 0) >> 0] | 0 | 0) != (36 | 0)) {
               break label$28
              }
              HEAP32[((((HEAP8[($1_1 + 2 | 0) >> 0] | 0) << 2 | 0) + $4_1 | 0) + -192 | 0) >> 2] = 10;
              $19_1 = HEAP32[((((HEAP8[($1_1 + 2 | 0) >> 0] | 0) << 3 | 0) + $3_1 | 0) + -384 | 0) >> 2] | 0;
              $1_1 = $1_1 + 4 | 0;
              HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
              break label$26;
             }
             if ($10_1) {
              break label$8
             }
             label$29 : {
              label$30 : {
               if ($0_1) {
                break label$30
               }
               $19_1 = 0;
               break label$29;
              }
              $1_1 = HEAP32[$2_1 >> 2] | 0;
              HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
              $19_1 = HEAP32[$1_1 >> 2] | 0;
             }
             $1_1 = (HEAP32[($7_1 + 76 | 0) >> 2] | 0) + 2 | 0;
             HEAP32[($7_1 + 76 | 0) >> 2] = $1_1;
             break label$26;
            }
            HEAP32[($7_1 + 76 | 0) >> 2] = $1_1 + 1 | 0;
            $19_1 = $59($7_1 + 76 | 0 | 0) | 0;
            $1_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
           }
           $13_1 = 0;
           label$31 : while (1) {
            $14_1 = $13_1;
            $20_1 = -1;
            if (((HEAP8[$1_1 >> 0] | 0) + -65 | 0) >>> 0 > 57 >>> 0) {
             break label$1
            }
            $15_1 = $1_1 + 1 | 0;
            HEAP32[($7_1 + 76 | 0) >> 2] = $15_1;
            $13_1 = HEAP8[$1_1 >> 0] | 0;
            $1_1 = $15_1;
            $13_1 = HEAPU8[(($13_1 + Math_imul($14_1, 58) | 0) + 1087 | 0) >> 0] | 0;
            if (($13_1 + -1 | 0) >>> 0 < 8 >>> 0) {
             continue label$31
            }
            break label$31;
           };
           label$32 : {
            label$33 : {
             label$34 : {
              if (($13_1 | 0) == (19 | 0)) {
               break label$34
              }
              if (!$13_1) {
               break label$1
              }
              label$35 : {
               if (($16_1 | 0) < (0 | 0)) {
                break label$35
               }
               HEAP32[($4_1 + ($16_1 << 2 | 0) | 0) >> 2] = $13_1;
               i64toi32_i32$2 = $3_1 + ($16_1 << 3 | 0) | 0;
               i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
               i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
               $275 = i64toi32_i32$0;
               i64toi32_i32$0 = $7_1;
               HEAP32[($7_1 + 64 | 0) >> 2] = $275;
               HEAP32[($7_1 + 68 | 0) >> 2] = i64toi32_i32$1;
               break label$33;
              }
              if (!$0_1) {
               break label$5
              }
              $60($7_1 + 64 | 0 | 0, $13_1 | 0, $2_1 | 0, $6_1 | 0);
              $15_1 = HEAP32[($7_1 + 76 | 0) >> 2] | 0;
              break label$32;
             }
             $20_1 = -1;
             if (($16_1 | 0) > (-1 | 0)) {
              break label$1
             }
            }
            $1_1 = 0;
            if (!$0_1) {
             continue label$2
            }
           }
           $21_1 = $17_1 & -65537 | 0;
           $13_1 = $17_1 & 8192 | 0 ? $21_1 : $17_1;
           $20_1 = 0;
           $16_1 = 1128;
           $17_1 = $9_1;
           label$36 : {
            label$37 : {
             label$38 : {
              label$39 : {
               label$40 : {
                label$41 : {
                 label$42 : {
                  label$43 : {
                   label$44 : {
                    label$45 : {
                     label$46 : {
                      label$47 : {
                       label$48 : {
                        label$49 : {
                         label$50 : {
                          label$51 : {
                           $1_1 = HEAP8[($15_1 + -1 | 0) >> 0] | 0;
                           $1_1 = $14_1 ? (($1_1 & 15 | 0 | 0) == (3 | 0) ? $1_1 & -33 | 0 : $1_1) : $1_1;
                           switch ($1_1 + -88 | 0 | 0) {
                           case 11:
                            break label$36;
                           case 9:
                           case 13:
                           case 14:
                           case 15:
                            break label$37;
                           case 27:
                            break label$42;
                           case 12:
                           case 17:
                            break label$45;
                           case 23:
                            break label$46;
                           case 0:
                           case 32:
                            break label$47;
                           case 24:
                            break label$48;
                           case 22:
                            break label$49;
                           case 29:
                            break label$50;
                           case 1:
                           case 2:
                           case 3:
                           case 4:
                           case 5:
                           case 6:
                           case 7:
                           case 8:
                           case 10:
                           case 16:
                           case 18:
                           case 19:
                           case 20:
                           case 21:
                           case 25:
                           case 26:
                           case 28:
                           case 30:
                           case 31:
                            break label$6;
                           default:
                            break label$51;
                           };
                          }
                          $17_1 = $9_1;
                          label$52 : {
                           switch ($1_1 + -65 | 0 | 0) {
                           case 0:
                           case 4:
                           case 5:
                           case 6:
                            break label$37;
                           case 2:
                            break label$40;
                           case 1:
                           case 3:
                            break label$6;
                           default:
                            break label$52;
                           };
                          }
                          if (($1_1 | 0) == (83 | 0)) {
                           break label$41
                          }
                          break label$7;
                         }
                         $20_1 = 0;
                         $16_1 = 1128;
                         i64toi32_i32$2 = $7_1;
                         i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                         i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                         $22_1 = i64toi32_i32$1;
                         $22$hi = i64toi32_i32$0;
                         break label$44;
                        }
                        $1_1 = 0;
                        label$53 : {
                         switch ($14_1 & 255 | 0 | 0) {
                         case 0:
                          HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                          continue label$2;
                         case 1:
                          HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                          continue label$2;
                         case 2:
                          i64toi32_i32$1 = $11_1;
                          i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                          i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                          HEAP32[i64toi32_i32$1 >> 2] = $11_1;
                          HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
                          continue label$2;
                         case 3:
                          HEAP16[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 1] = $11_1;
                          continue label$2;
                         case 4:
                          HEAP8[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 0] = $11_1;
                          continue label$2;
                         case 6:
                          HEAP32[(HEAP32[($7_1 + 64 | 0) >> 2] | 0) >> 2] = $11_1;
                          continue label$2;
                         case 7:
                          break label$53;
                         default:
                          continue label$2;
                         };
                        }
                        i64toi32_i32$1 = $11_1;
                        i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                        i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                        HEAP32[i64toi32_i32$1 >> 2] = $11_1;
                        HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
                        continue label$2;
                       }
                       $19_1 = $19_1 >>> 0 > 8 >>> 0 ? $19_1 : 8;
                       $13_1 = $13_1 | 8 | 0;
                       $1_1 = 120;
                      }
                      $20_1 = 0;
                      $16_1 = 1128;
                      i64toi32_i32$2 = $7_1;
                      i64toi32_i32$0 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                      i64toi32_i32$1 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                      $12_1 = $61(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, $9_1 | 0, $1_1 & 32 | 0 | 0) | 0;
                      if (!($13_1 & 8 | 0)) {
                       break label$43
                      }
                      i64toi32_i32$2 = $7_1;
                      i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                      i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                      if (!(i64toi32_i32$1 | i64toi32_i32$0 | 0)) {
                       break label$43
                      }
                      $16_1 = ($1_1 >>> 4 | 0) + 1128 | 0;
                      $20_1 = 2;
                      break label$43;
                     }
                     $20_1 = 0;
                     $16_1 = 1128;
                     i64toi32_i32$2 = $7_1;
                     i64toi32_i32$0 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                     i64toi32_i32$1 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                     $12_1 = $62(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, $9_1 | 0) | 0;
                     if (!($13_1 & 8 | 0)) {
                      break label$43
                     }
                     $1_1 = $9_1 - $12_1 | 0;
                     $19_1 = ($19_1 | 0) > ($1_1 | 0) ? $19_1 : $1_1 + 1 | 0;
                     break label$43;
                    }
                    label$60 : {
                     i64toi32_i32$2 = $7_1;
                     i64toi32_i32$1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                     i64toi32_i32$0 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                     $22_1 = i64toi32_i32$1;
                     $22$hi = i64toi32_i32$0;
                     i64toi32_i32$2 = i64toi32_i32$1;
                     i64toi32_i32$1 = -1;
                     i64toi32_i32$3 = -1;
                     if ((i64toi32_i32$0 | 0) > (i64toi32_i32$1 | 0)) {
                      $30_1 = 1
                     } else {
                      if ((i64toi32_i32$0 | 0) >= (i64toi32_i32$1 | 0)) {
                       if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
                        $31_1 = 0
                       } else {
                        $31_1 = 1
                       }
                       $32_1 = $31_1;
                      } else {
                       $32_1 = 0
                      }
                      $30_1 = $32_1;
                     }
                     if ($30_1) {
                      break label$60
                     }
                     i64toi32_i32$2 = $22$hi;
                     i64toi32_i32$2 = 0;
                     i64toi32_i32$3 = 0;
                     i64toi32_i32$0 = $22$hi;
                     i64toi32_i32$1 = $22_1;
                     i64toi32_i32$5 = (i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0) + i64toi32_i32$0 | 0;
                     i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
                     $22_1 = i64toi32_i32$3 - i64toi32_i32$1 | 0;
                     $22$hi = i64toi32_i32$5;
                     i64toi32_i32$3 = $7_1;
                     HEAP32[($7_1 + 64 | 0) >> 2] = $22_1;
                     HEAP32[($7_1 + 68 | 0) >> 2] = i64toi32_i32$5;
                     $20_1 = 1;
                     $16_1 = 1128;
                     break label$44;
                    }
                    label$61 : {
                     if (!($13_1 & 2048 | 0)) {
                      break label$61
                     }
                     $20_1 = 1;
                     $16_1 = 1129;
                     break label$44;
                    }
                    $20_1 = $13_1 & 1 | 0;
                    $16_1 = $20_1 ? 1130 : 1128;
                   }
                   i64toi32_i32$5 = $22$hi;
                   $12_1 = $63($22_1 | 0, i64toi32_i32$5 | 0, $9_1 | 0) | 0;
                  }
                  $13_1 = ($19_1 | 0) > (-1 | 0) ? $13_1 & -65537 | 0 : $13_1;
                  i64toi32_i32$2 = $7_1;
                  i64toi32_i32$5 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                  i64toi32_i32$3 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
                  $22_1 = i64toi32_i32$5;
                  $22$hi = i64toi32_i32$3;
                  label$62 : {
                   if ($19_1) {
                    break label$62
                   }
                   i64toi32_i32$3 = $22$hi;
                   if (!!($22_1 | i64toi32_i32$3 | 0)) {
                    break label$62
                   }
                   $19_1 = 0;
                   $12_1 = $9_1;
                   break label$7;
                  }
                  i64toi32_i32$3 = $22$hi;
                  $1_1 = ($9_1 - $12_1 | 0) + !($22_1 | i64toi32_i32$3 | 0) | 0;
                  $19_1 = ($19_1 | 0) > ($1_1 | 0) ? $19_1 : $1_1;
                  break label$7;
                 }
                 $20_1 = 0;
                 $1_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                 $12_1 = $1_1 ? $1_1 : 1138;
                 $1_1 = $52($12_1 | 0, 0 | 0, $19_1 | 0) | 0;
                 $17_1 = $1_1 ? $1_1 : $12_1 + $19_1 | 0;
                 $13_1 = $21_1;
                 $19_1 = $1_1 ? $1_1 - $12_1 | 0 : $19_1;
                 break label$6;
                }
                label$63 : {
                 if (!$19_1) {
                  break label$63
                 }
                 $14_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
                 break label$39;
                }
                $1_1 = 0;
                $64($0_1 | 0, 32 | 0, $18_1 | 0, 0 | 0, $13_1 | 0);
                break label$38;
               }
               HEAP32[($7_1 + 12 | 0) >> 2] = 0;
               i64toi32_i32$2 = $7_1;
               i64toi32_i32$3 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
               i64toi32_i32$5 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
               HEAP32[($7_1 + 8 | 0) >> 2] = i64toi32_i32$3;
               HEAP32[($7_1 + 64 | 0) >> 2] = $7_1 + 8 | 0;
               $19_1 = -1;
               $14_1 = $7_1 + 8 | 0;
              }
              $1_1 = 0;
              label$64 : {
               label$65 : while (1) {
                $15_1 = HEAP32[$14_1 >> 2] | 0;
                if (!$15_1) {
                 break label$64
                }
                label$66 : {
                 $15_1 = $54($7_1 + 4 | 0 | 0, $15_1 | 0) | 0;
                 $12_1 = ($15_1 | 0) < (0 | 0);
                 if ($12_1) {
                  break label$66
                 }
                 if ($15_1 >>> 0 > ($19_1 - $1_1 | 0) >>> 0) {
                  break label$66
                 }
                 $14_1 = $14_1 + 4 | 0;
                 $1_1 = $15_1 + $1_1 | 0;
                 if ($19_1 >>> 0 > $1_1 >>> 0) {
                  continue label$65
                 }
                 break label$64;
                }
                break label$65;
               };
               $20_1 = -1;
               if ($12_1) {
                break label$1
               }
              }
              $64($0_1 | 0, 32 | 0, $18_1 | 0, $1_1 | 0, $13_1 | 0);
              label$67 : {
               if ($1_1) {
                break label$67
               }
               $1_1 = 0;
               break label$38;
              }
              $14_1 = 0;
              $15_1 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
              label$68 : while (1) {
               $12_1 = HEAP32[$15_1 >> 2] | 0;
               if (!$12_1) {
                break label$38
               }
               $12_1 = $54($7_1 + 4 | 0 | 0, $12_1 | 0) | 0;
               $14_1 = $12_1 + $14_1 | 0;
               if (($14_1 | 0) > ($1_1 | 0)) {
                break label$38
               }
               $58($0_1 | 0, $7_1 + 4 | 0 | 0, $12_1 | 0);
               $15_1 = $15_1 + 4 | 0;
               if ($14_1 >>> 0 < $1_1 >>> 0) {
                continue label$68
               }
               break label$68;
              };
             }
             $64($0_1 | 0, 32 | 0, $18_1 | 0, $1_1 | 0, $13_1 ^ 8192 | 0 | 0);
             $1_1 = ($18_1 | 0) > ($1_1 | 0) ? $18_1 : $1_1;
             continue label$2;
            }
            $1_1 = FUNCTION_TABLE[$5_1 | 0]($0_1, +HEAPF64[($7_1 + 64 | 0) >> 3], $18_1, $19_1, $13_1, $1_1) | 0;
            continue label$2;
           }
           i64toi32_i32$2 = $7_1;
           i64toi32_i32$5 = HEAP32[($7_1 + 64 | 0) >> 2] | 0;
           i64toi32_i32$3 = HEAP32[($7_1 + 68 | 0) >> 2] | 0;
           HEAP8[($7_1 + 55 | 0) >> 0] = i64toi32_i32$5;
           $19_1 = 1;
           $12_1 = $8_1;
           $17_1 = $9_1;
           $13_1 = $21_1;
           break label$6;
          }
          $14_1 = $1_1 + 1 | 0;
          HEAP32[($7_1 + 76 | 0) >> 2] = $14_1;
          $13_1 = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
          $1_1 = $14_1;
          continue label$10;
         };
        }
        $20_1 = $11_1;
        if ($0_1) {
         break label$1
        }
        if (!$10_1) {
         break label$5
        }
        $1_1 = 1;
        label$69 : {
         label$70 : while (1) {
          $13_1 = HEAP32[($4_1 + ($1_1 << 2 | 0) | 0) >> 2] | 0;
          if (!$13_1) {
           break label$69
          }
          $60($3_1 + ($1_1 << 3 | 0) | 0 | 0, $13_1 | 0, $2_1 | 0, $6_1 | 0);
          $20_1 = 1;
          $1_1 = $1_1 + 1 | 0;
          if (($1_1 | 0) != (10 | 0)) {
           continue label$70
          }
          break label$1;
         };
        }
        $20_1 = 1;
        if ($1_1 >>> 0 >= 10 >>> 0) {
         break label$1
        }
        label$71 : while (1) {
         if (HEAP32[($4_1 + ($1_1 << 2 | 0) | 0) >> 2] | 0) {
          break label$8
         }
         $20_1 = 1;
         $1_1 = $1_1 + 1 | 0;
         if (($1_1 | 0) == (10 | 0)) {
          break label$1
         }
         continue label$71;
        };
       }
       $20_1 = -1;
       break label$1;
      }
      $17_1 = $9_1;
     }
     $15_1 = $17_1 - $12_1 | 0;
     $17_1 = ($19_1 | 0) < ($15_1 | 0) ? $15_1 : $19_1;
     $14_1 = $20_1 + $17_1 | 0;
     $1_1 = ($18_1 | 0) < ($14_1 | 0) ? $14_1 : $18_1;
     $64($0_1 | 0, 32 | 0, $1_1 | 0, $14_1 | 0, $13_1 | 0);
     $58($0_1 | 0, $16_1 | 0, $20_1 | 0);
     $64($0_1 | 0, 48 | 0, $1_1 | 0, $14_1 | 0, $13_1 ^ 65536 | 0 | 0);
     $64($0_1 | 0, 48 | 0, $17_1 | 0, $15_1 | 0, 0 | 0);
     $58($0_1 | 0, $12_1 | 0, $15_1 | 0);
     $64($0_1 | 0, 32 | 0, $1_1 | 0, $14_1 | 0, $13_1 ^ 8192 | 0 | 0);
     continue label$2;
    }
    break label$2;
   };
   $20_1 = 0;
  }
  global$0 = $7_1 + 80 | 0;
  return $20_1 | 0;
 }
 
 function $58($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  label$1 : {
   if ((HEAPU8[$0_1 >> 0] | 0) & 32 | 0) {
    break label$1
   }
   $117($1_1 | 0, $2_1 | 0, $0_1 | 0) | 0;
  }
 }
 
 function $59($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $3_1 = 0;
  $1_1 = 0;
  label$1 : {
   if (!($51(HEAP8[(HEAP32[$0_1 >> 2] | 0) >> 0] | 0 | 0) | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $2_1 = HEAP32[$0_1 >> 2] | 0;
    $3_1 = HEAP8[$2_1 >> 0] | 0;
    HEAP32[$0_1 >> 2] = $2_1 + 1 | 0;
    $1_1 = ($3_1 + Math_imul($1_1, 10) | 0) + -48 | 0;
    if ($51(HEAP8[($2_1 + 1 | 0) >> 0] | 0 | 0) | 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $1_1 | 0;
 }
 
 function $60($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $23_1 = 0, $31_1 = 0, $41_1 = 0, $49_1 = 0, $57_1 = 0, $65_1 = 0, $73_1 = 0;
  label$1 : {
   if ($1_1 >>> 0 > 20 >>> 0) {
    break label$1
   }
   label$2 : {
    switch ($1_1 + -9 | 0 | 0) {
    case 0:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     HEAP32[$0_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
     return;
    case 1:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
     i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
     $23_1 = i64toi32_i32$0;
     i64toi32_i32$0 = $0_1;
     HEAP32[i64toi32_i32$0 >> 2] = $23_1;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     return;
    case 2:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$1 = HEAP32[$1_1 >> 2] | 0;
     i64toi32_i32$0 = 0;
     $31_1 = i64toi32_i32$1;
     i64toi32_i32$1 = $0_1;
     HEAP32[i64toi32_i32$1 >> 2] = $31_1;
     HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
     return;
    case 3:
     $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
     i64toi32_i32$0 = HEAP32[$1_1 >> 2] | 0;
     i64toi32_i32$1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
     $41_1 = i64toi32_i32$0;
     i64toi32_i32$0 = $0_1;
     HEAP32[i64toi32_i32$0 >> 2] = $41_1;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     return;
    case 4:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$1 = HEAP16[$1_1 >> 1] | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     $49_1 = i64toi32_i32$1;
     i64toi32_i32$1 = $0_1;
     HEAP32[i64toi32_i32$1 >> 2] = $49_1;
     HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
     return;
    case 5:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$0 = HEAPU16[$1_1 >> 1] | 0;
     i64toi32_i32$1 = 0;
     $57_1 = i64toi32_i32$0;
     i64toi32_i32$0 = $0_1;
     HEAP32[i64toi32_i32$0 >> 2] = $57_1;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     return;
    case 6:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$1 = HEAP8[$1_1 >> 0] | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     $65_1 = i64toi32_i32$1;
     i64toi32_i32$1 = $0_1;
     HEAP32[i64toi32_i32$1 >> 2] = $65_1;
     HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
     return;
    case 7:
     $1_1 = HEAP32[$2_1 >> 2] | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 4 | 0;
     i64toi32_i32$0 = HEAPU8[$1_1 >> 0] | 0;
     i64toi32_i32$1 = 0;
     $73_1 = i64toi32_i32$0;
     i64toi32_i32$0 = $0_1;
     HEAP32[i64toi32_i32$0 >> 2] = $73_1;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     return;
    case 8:
     $1_1 = ((HEAP32[$2_1 >> 2] | 0) + 7 | 0) & -8 | 0;
     HEAP32[$2_1 >> 2] = $1_1 + 8 | 0;
     HEAPF64[$0_1 >> 3] = +HEAPF64[$1_1 >> 3];
     return;
    case 9:
     break label$2;
    default:
     break label$1;
    };
   }
   FUNCTION_TABLE[$3_1 | 0]($0_1, $2_1);
  }
 }
 
 function $61($0_1, $0$hi, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, i64toi32_i32$2 = 0, $9_1 = 0;
  label$1 : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    HEAP8[$1_1 >> 0] = HEAPU8[(($0_1 & 15 | 0) + 1616 | 0) >> 0] | 0 | $2_1 | 0;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 4;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $9_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $9_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $9_1;
    $0$hi = i64toi32_i32$1;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $1_1 | 0;
 }
 
 function $62($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, i64toi32_i32$2 = 0, $8_1 = 0;
  label$1 : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break label$1
   }
   label$2 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    HEAP8[$1_1 >> 0] = $0_1 & 7 | 0 | 48 | 0;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 3;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $8_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $8_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $8_1;
    $0$hi = i64toi32_i32$1;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $1_1 | 0;
 }
 
 function $63($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $2_1 = 0, i64toi32_i32$3 = 0, $5_1 = 0, i64toi32_i32$5 = 0, $5$hi = 0, $3_1 = 0, $16_1 = 0, $16$hi = 0, $4_1 = 0;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 1;
    i64toi32_i32$3 = 0;
    if (i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
     break label$2
    }
    i64toi32_i32$2 = $0$hi;
    $5_1 = $0_1;
    $5$hi = i64toi32_i32$2;
    break label$1;
   }
   label$3 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_udiv($0_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $5_1 = i64toi32_i32$0;
    $5$hi = i64toi32_i32$2;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_mul($5_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $16_1 = i64toi32_i32$0;
    $16$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = $16$hi;
    i64toi32_i32$1 = $16_1;
    i64toi32_i32$5 = ($0_1 >>> 0 < i64toi32_i32$1 >>> 0) + i64toi32_i32$0 | 0;
    i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
    HEAP8[$1_1 >> 0] = $0_1 - i64toi32_i32$1 | 0 | 48 | 0;
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$3 = 9;
    i64toi32_i32$1 = -1;
    $2_1 = $0$hi >>> 0 > i64toi32_i32$3 >>> 0 | (($0$hi | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$1 >>> 0 | 0) | 0;
    i64toi32_i32$2 = $5$hi;
    $0_1 = $5_1;
    $0$hi = i64toi32_i32$2;
    if ($2_1) {
     continue label$3
    }
    break label$3;
   };
  }
  label$4 : {
   i64toi32_i32$2 = $5$hi;
   $2_1 = $5_1;
   if (!$2_1) {
    break label$4
   }
   label$5 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    $3_1 = ($2_1 >>> 0) / (10 >>> 0) | 0;
    HEAP8[$1_1 >> 0] = $2_1 - Math_imul($3_1, 10) | 0 | 48 | 0;
    $4_1 = $2_1 >>> 0 > 9 >>> 0;
    $2_1 = $3_1;
    if ($4_1) {
     continue label$5
    }
    break label$5;
   };
  }
  return $1_1 | 0;
 }
 
 function $64($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 256 | 0;
  global$0 = $5_1;
  label$1 : {
   if (($2_1 | 0) <= ($3_1 | 0)) {
    break label$1
   }
   if ($4_1 & 73728 | 0) {
    break label$1
   }
   $2_1 = $2_1 - $3_1 | 0;
   $3_1 = $2_1 >>> 0 < 256 >>> 0;
   $111($5_1 | 0, $1_1 & 255 | 0 | 0, ($3_1 ? $2_1 : 256) | 0) | 0;
   label$2 : {
    if ($3_1) {
     break label$2
    }
    label$3 : while (1) {
     $58($0_1 | 0, $5_1 | 0, 256 | 0);
     $2_1 = $2_1 + -256 | 0;
     if ($2_1 >>> 0 > 255 >>> 0) {
      continue label$3
     }
     break label$3;
    };
   }
   $58($0_1 | 0, $5_1 | 0, $2_1 | 0);
  }
  global$0 = $5_1 + 256 | 0;
 }
 
 function $65($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return $56($0_1 | 0, $1_1 | 0, $2_1 | 0, 3 | 0, 4 | 0) | 0 | 0;
 }
 
 function $66($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = +$1_1;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $11_1 = 0, $18_1 = 0, $17_1 = 0, $23_1 = 0, $6_1 = 0, $10_1 = 0, i64toi32_i32$1 = 0, $14_1 = 0, i64toi32_i32$0 = 0, $21_1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $16_1 = 0, $19_1 = 0, $22_1 = 0, $12_1 = 0, $26_1 = 0.0, $20_1 = 0, $24_1 = 0, $9_1 = 0, $24$hi = 0, $8_1 = 0, $13_1 = 0, $15_1 = 0, $7_1 = 0, $44_1 = 0, $45_1 = 0, $46_1 = 0, $25$hi = 0, $47_1 = 0, $25_1 = 0, $158 = 0, $160$hi = 0, $162$hi = 0, $164 = 0, $164$hi = 0, $166$hi = 0, $170 = 0, $170$hi = 0, $822 = 0;
  $6_1 = global$0 - 560 | 0;
  global$0 = $6_1;
  $7_1 = 0;
  HEAP32[($6_1 + 44 | 0) >> 2] = 0;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $68(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$0;
    $24$hi = i64toi32_i32$1;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$0 = -1;
    i64toi32_i32$3 = -1;
    if ((i64toi32_i32$1 | 0) > (i64toi32_i32$0 | 0)) {
     $44_1 = 1
    } else {
     if ((i64toi32_i32$1 | 0) >= (i64toi32_i32$0 | 0)) {
      if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
       $45_1 = 0
      } else {
       $45_1 = 1
      }
      $46_1 = $45_1;
     } else {
      $46_1 = 0
     }
     $44_1 = $46_1;
    }
    if ($44_1) {
     break label$2
    }
    $8_1 = 1;
    $9_1 = 1632;
    $1_1 = -$1_1;
    i64toi32_i32$2 = $68(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$2;
    $24$hi = i64toi32_i32$1;
    break label$1;
   }
   $8_1 = 1;
   label$3 : {
    if (!($4_1 & 2048 | 0)) {
     break label$3
    }
    $9_1 = 1635;
    break label$1;
   }
   $9_1 = 1638;
   if ($4_1 & 1 | 0) {
    break label$1
   }
   $8_1 = 0;
   $7_1 = 1;
   $9_1 = 1633;
  }
  label$4 : {
   label$5 : {
    i64toi32_i32$1 = $24$hi;
    i64toi32_i32$3 = $24_1;
    i64toi32_i32$2 = 2146435072;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
    i64toi32_i32$1 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
    i64toi32_i32$3 = 2146435072;
    i64toi32_i32$0 = 0;
    if ((i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) {
     break label$5
    }
    $10_1 = $8_1 + 3 | 0;
    $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 & -65537 | 0 | 0);
    $58($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $11_1 = $5_1 & 32 | 0;
    $58($0_1 | 0, ($1_1 != $1_1 ? ($11_1 ? 1659 : 1663) : $11_1 ? 1651 : 1655) | 0, 3 | 0);
    $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
    break label$4;
   }
   $12_1 = $6_1 + 16 | 0;
   label$6 : {
    label$7 : {
     label$8 : {
      label$9 : {
       $1_1 = +$55(+$1_1, $6_1 + 44 | 0 | 0);
       $1_1 = $1_1 + $1_1;
       if ($1_1 == 0.0) {
        break label$9
       }
       $11_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
       HEAP32[($6_1 + 44 | 0) >> 2] = $11_1 + -1 | 0;
       $13_1 = $5_1 | 32 | 0;
       if (($13_1 | 0) != (97 | 0)) {
        break label$8
       }
       break label$6;
      }
      $13_1 = $5_1 | 32 | 0;
      if (($13_1 | 0) == (97 | 0)) {
       break label$6
      }
      $14_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
      $15_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
      break label$7;
     }
     $15_1 = $11_1 + -29 | 0;
     HEAP32[($6_1 + 44 | 0) >> 2] = $15_1;
     $14_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
     $1_1 = $1_1 * 268435456.0;
    }
    $16_1 = ($15_1 | 0) < (0 | 0) ? $6_1 + 48 | 0 : $6_1 + 336 | 0;
    $17_1 = $16_1;
    label$10 : while (1) {
     label$11 : {
      label$12 : {
       if (!($1_1 < 4294967296.0 & $1_1 >= 0.0 | 0)) {
        break label$12
       }
       $11_1 = ~~$1_1 >>> 0;
       break label$11;
      }
      $11_1 = 0;
     }
     HEAP32[$17_1 >> 2] = $11_1;
     $17_1 = $17_1 + 4 | 0;
     $1_1 = ($1_1 - +($11_1 >>> 0)) * 1.0e9;
     if ($1_1 != 0.0) {
      continue label$10
     }
     break label$10;
    };
    label$13 : {
     label$14 : {
      if (($15_1 | 0) >= (1 | 0)) {
       break label$14
      }
      $3_1 = $15_1;
      $11_1 = $17_1;
      $18_1 = $16_1;
      break label$13;
     }
     $18_1 = $16_1;
     $3_1 = $15_1;
     label$15 : while (1) {
      $3_1 = ($3_1 | 0) < (29 | 0) ? $3_1 : 29;
      label$16 : {
       $11_1 = $17_1 + -4 | 0;
       if ($11_1 >>> 0 < $18_1 >>> 0) {
        break label$16
       }
       i64toi32_i32$1 = 0;
       $25_1 = $3_1;
       $25$hi = i64toi32_i32$1;
       i64toi32_i32$1 = 0;
       $24_1 = 0;
       $24$hi = i64toi32_i32$1;
       label$17 : while (1) {
        $158 = $11_1;
        i64toi32_i32$0 = $11_1;
        i64toi32_i32$1 = HEAP32[$11_1 >> 2] | 0;
        i64toi32_i32$2 = 0;
        $160$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $25$hi;
        i64toi32_i32$2 = $160$hi;
        i64toi32_i32$0 = i64toi32_i32$1;
        i64toi32_i32$1 = $25$hi;
        i64toi32_i32$3 = $25_1;
        i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
         $47_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
         $47_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
        }
        $162$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $24$hi;
        i64toi32_i32$2 = $24_1;
        i64toi32_i32$0 = 0;
        i64toi32_i32$3 = -1;
        i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
        $164 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
        $164$hi = i64toi32_i32$0;
        i64toi32_i32$0 = $162$hi;
        i64toi32_i32$1 = $47_1;
        i64toi32_i32$2 = $164$hi;
        i64toi32_i32$3 = $164;
        i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
        i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
        if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
        }
        $24_1 = i64toi32_i32$4;
        $24$hi = i64toi32_i32$5;
        $166$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_udiv(i64toi32_i32$4 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $24_1 = i64toi32_i32$1;
        $24$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_mul($24_1 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $170 = i64toi32_i32$1;
        $170$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $166$hi;
        i64toi32_i32$0 = i64toi32_i32$4;
        i64toi32_i32$1 = $170$hi;
        i64toi32_i32$3 = $170;
        i64toi32_i32$2 = i64toi32_i32$0 - i64toi32_i32$3 | 0;
        i64toi32_i32$4 = (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$1 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
        HEAP32[$158 >> 2] = i64toi32_i32$2;
        $11_1 = $11_1 + -4 | 0;
        if ($11_1 >>> 0 >= $18_1 >>> 0) {
         continue label$17
        }
        break label$17;
       };
       i64toi32_i32$4 = $24$hi;
       $11_1 = $24_1;
       if (!$11_1) {
        break label$16
       }
       $18_1 = $18_1 + -4 | 0;
       HEAP32[$18_1 >> 2] = $11_1;
      }
      label$18 : {
       label$19 : while (1) {
        $11_1 = $17_1;
        if ($11_1 >>> 0 <= $18_1 >>> 0) {
         break label$18
        }
        $17_1 = $11_1 + -4 | 0;
        if (!(HEAP32[$17_1 >> 2] | 0)) {
         continue label$19
        }
        break label$19;
       };
      }
      $3_1 = (HEAP32[($6_1 + 44 | 0) >> 2] | 0) - $3_1 | 0;
      HEAP32[($6_1 + 44 | 0) >> 2] = $3_1;
      $17_1 = $11_1;
      if (($3_1 | 0) > (0 | 0)) {
       continue label$15
      }
      break label$15;
     };
    }
    label$20 : {
     if (($3_1 | 0) > (-1 | 0)) {
      break label$20
     }
     $19_1 = (($14_1 + 25 | 0 | 0) / (9 | 0) | 0) + 1 | 0;
     $20_1 = ($13_1 | 0) == (102 | 0);
     label$21 : while (1) {
      $10_1 = ($3_1 | 0) < (-9 | 0) ? 9 : 0 - $3_1 | 0;
      label$22 : {
       label$23 : {
        if ($18_1 >>> 0 < $11_1 >>> 0) {
         break label$23
        }
        $18_1 = HEAP32[$18_1 >> 2] | 0 ? $18_1 : $18_1 + 4 | 0;
        break label$22;
       }
       $21_1 = 1e9 >>> $10_1 | 0;
       $22_1 = (-1 << $10_1 | 0) ^ -1 | 0;
       $3_1 = 0;
       $17_1 = $18_1;
       label$24 : while (1) {
        $23_1 = HEAP32[$17_1 >> 2] | 0;
        HEAP32[$17_1 >> 2] = ($23_1 >>> $10_1 | 0) + $3_1 | 0;
        $3_1 = Math_imul($23_1 & $22_1 | 0, $21_1);
        $17_1 = $17_1 + 4 | 0;
        if ($17_1 >>> 0 < $11_1 >>> 0) {
         continue label$24
        }
        break label$24;
       };
       $18_1 = HEAP32[$18_1 >> 2] | 0 ? $18_1 : $18_1 + 4 | 0;
       if (!$3_1) {
        break label$22
       }
       HEAP32[$11_1 >> 2] = $3_1;
       $11_1 = $11_1 + 4 | 0;
      }
      $3_1 = (HEAP32[($6_1 + 44 | 0) >> 2] | 0) + $10_1 | 0;
      HEAP32[($6_1 + 44 | 0) >> 2] = $3_1;
      $17_1 = $20_1 ? $16_1 : $18_1;
      $11_1 = (($11_1 - $17_1 | 0) >> 2 | 0 | 0) > ($19_1 | 0) ? $17_1 + ($19_1 << 2 | 0) | 0 : $11_1;
      if (($3_1 | 0) < (0 | 0)) {
       continue label$21
      }
      break label$21;
     };
    }
    $17_1 = 0;
    label$25 : {
     if ($18_1 >>> 0 >= $11_1 >>> 0) {
      break label$25
     }
     $17_1 = Math_imul(($16_1 - $18_1 | 0) >> 2 | 0, 9);
     $3_1 = 10;
     $23_1 = HEAP32[$18_1 >> 2] | 0;
     if ($23_1 >>> 0 < 10 >>> 0) {
      break label$25
     }
     label$26 : while (1) {
      $17_1 = $17_1 + 1 | 0;
      $3_1 = Math_imul($3_1, 10);
      if ($23_1 >>> 0 >= $3_1 >>> 0) {
       continue label$26
      }
      break label$26;
     };
    }
    label$27 : {
     $3_1 = ($14_1 - (($13_1 | 0) == (102 | 0) ? 0 : $17_1) | 0) - (($14_1 | 0) != (0 | 0) & ($13_1 | 0) == (103 | 0) | 0) | 0;
     if (($3_1 | 0) >= (Math_imul(($11_1 - $16_1 | 0) >> 2 | 0, 9) + -9 | 0 | 0)) {
      break label$27
     }
     $23_1 = $3_1 + 9216 | 0;
     $21_1 = ($23_1 | 0) / (9 | 0) | 0;
     $10_1 = (($21_1 << 2 | 0) + (($15_1 | 0) < (0 | 0) ? $6_1 + 48 | 0 | 4 | 0 : $6_1 + 340 | 0) | 0) + -4096 | 0;
     $3_1 = 10;
     label$28 : {
      $23_1 = $23_1 - Math_imul($21_1, 9) | 0;
      if (($23_1 | 0) > (7 | 0)) {
       break label$28
      }
      label$29 : while (1) {
       $3_1 = Math_imul($3_1, 10);
       $23_1 = $23_1 + 1 | 0;
       if (($23_1 | 0) != (8 | 0)) {
        continue label$29
       }
       break label$29;
      };
     }
     $21_1 = HEAP32[$10_1 >> 2] | 0;
     $22_1 = ($21_1 >>> 0) / ($3_1 >>> 0) | 0;
     $23_1 = $21_1 - Math_imul($22_1, $3_1) | 0;
     label$30 : {
      label$31 : {
       $19_1 = $10_1 + 4 | 0;
       if (($19_1 | 0) != ($11_1 | 0)) {
        break label$31
       }
       if (!$23_1) {
        break label$30
       }
      }
      $20_1 = $3_1 >>> 1 | 0;
      $26_1 = $23_1 >>> 0 < $20_1 >>> 0 ? .5 : ($19_1 | 0) == ($11_1 | 0) ? (($23_1 | 0) == ($20_1 | 0) ? 1.0 : 1.5) : 1.5;
      $1_1 = $22_1 & 1 | 0 ? 9007199254740994.0 : 9007199254740992.0;
      label$32 : {
       if ($7_1) {
        break label$32
       }
       if ((HEAPU8[$9_1 >> 0] | 0 | 0) != (45 | 0)) {
        break label$32
       }
       $26_1 = -$26_1;
       $1_1 = -$1_1;
      }
      $23_1 = $21_1 - $23_1 | 0;
      HEAP32[$10_1 >> 2] = $23_1;
      if ($1_1 + $26_1 == $1_1) {
       break label$30
      }
      $17_1 = $23_1 + $3_1 | 0;
      HEAP32[$10_1 >> 2] = $17_1;
      label$33 : {
       if ($17_1 >>> 0 < 1e9 >>> 0) {
        break label$33
       }
       label$34 : while (1) {
        HEAP32[$10_1 >> 2] = 0;
        label$35 : {
         $10_1 = $10_1 + -4 | 0;
         if ($10_1 >>> 0 >= $18_1 >>> 0) {
          break label$35
         }
         $18_1 = $18_1 + -4 | 0;
         HEAP32[$18_1 >> 2] = 0;
        }
        $17_1 = (HEAP32[$10_1 >> 2] | 0) + 1 | 0;
        HEAP32[$10_1 >> 2] = $17_1;
        if ($17_1 >>> 0 > 999999999 >>> 0) {
         continue label$34
        }
        break label$34;
       };
      }
      $17_1 = Math_imul(($16_1 - $18_1 | 0) >> 2 | 0, 9);
      $3_1 = 10;
      $23_1 = HEAP32[$18_1 >> 2] | 0;
      if ($23_1 >>> 0 < 10 >>> 0) {
       break label$30
      }
      label$36 : while (1) {
       $17_1 = $17_1 + 1 | 0;
       $3_1 = Math_imul($3_1, 10);
       if ($23_1 >>> 0 >= $3_1 >>> 0) {
        continue label$36
       }
       break label$36;
      };
     }
     $3_1 = $10_1 + 4 | 0;
     $11_1 = $11_1 >>> 0 > $3_1 >>> 0 ? $3_1 : $11_1;
    }
    label$37 : {
     label$38 : while (1) {
      $3_1 = $11_1;
      $23_1 = $11_1 >>> 0 <= $18_1 >>> 0;
      if ($23_1) {
       break label$37
      }
      $11_1 = $3_1 + -4 | 0;
      if (!(HEAP32[$11_1 >> 2] | 0)) {
       continue label$38
      }
      break label$38;
     };
    }
    label$39 : {
     label$40 : {
      if (($13_1 | 0) == (103 | 0)) {
       break label$40
      }
      $19_1 = $4_1 & 8 | 0;
      break label$39;
     }
     $11_1 = $14_1 ? $14_1 : 1;
     $10_1 = ($11_1 | 0) > ($17_1 | 0) & ($17_1 | 0) > (-5 | 0) | 0;
     $14_1 = ($10_1 ? $17_1 ^ -1 | 0 : -1) + $11_1 | 0;
     $5_1 = ($10_1 ? -1 : -2) + $5_1 | 0;
     $19_1 = $4_1 & 8 | 0;
     if ($19_1) {
      break label$39
     }
     $11_1 = -9;
     label$41 : {
      if ($23_1) {
       break label$41
      }
      $10_1 = HEAP32[($3_1 + -4 | 0) >> 2] | 0;
      if (!$10_1) {
       break label$41
      }
      $23_1 = 10;
      $11_1 = 0;
      if (($10_1 >>> 0) % (10 >>> 0) | 0) {
       break label$41
      }
      label$42 : while (1) {
       $21_1 = $11_1;
       $11_1 = $11_1 + 1 | 0;
       $23_1 = Math_imul($23_1, 10);
       if (!(($10_1 >>> 0) % ($23_1 >>> 0) | 0)) {
        continue label$42
       }
       break label$42;
      };
      $11_1 = $21_1 ^ -1 | 0;
     }
     $23_1 = Math_imul(($3_1 - $16_1 | 0) >> 2 | 0, 9);
     label$43 : {
      if (($5_1 & -33 | 0 | 0) != (70 | 0)) {
       break label$43
      }
      $19_1 = 0;
      $11_1 = ($23_1 + $11_1 | 0) + -9 | 0;
      $11_1 = ($11_1 | 0) > (0 | 0) ? $11_1 : 0;
      $14_1 = ($14_1 | 0) < ($11_1 | 0) ? $14_1 : $11_1;
      break label$39;
     }
     $19_1 = 0;
     $11_1 = (($17_1 + $23_1 | 0) + $11_1 | 0) + -9 | 0;
     $11_1 = ($11_1 | 0) > (0 | 0) ? $11_1 : 0;
     $14_1 = ($14_1 | 0) < ($11_1 | 0) ? $14_1 : $11_1;
    }
    $22_1 = $14_1 | $19_1 | 0;
    $23_1 = ($22_1 | 0) != (0 | 0);
    label$44 : {
     label$45 : {
      $21_1 = $5_1 & -33 | 0;
      if (($21_1 | 0) != (70 | 0)) {
       break label$45
      }
      $11_1 = ($17_1 | 0) > (0 | 0) ? $17_1 : 0;
      break label$44;
     }
     label$46 : {
      $11_1 = $17_1 >> 31 | 0;
      i64toi32_i32$4 = 0;
      $11_1 = $63(($17_1 + $11_1 | 0) ^ $11_1 | 0 | 0, i64toi32_i32$4 | 0, $12_1 | 0) | 0;
      if (($12_1 - $11_1 | 0 | 0) > (1 | 0)) {
       break label$46
      }
      label$47 : while (1) {
       $11_1 = $11_1 + -1 | 0;
       HEAP8[$11_1 >> 0] = 48;
       if (($12_1 - $11_1 | 0 | 0) < (2 | 0)) {
        continue label$47
       }
       break label$47;
      };
     }
     $20_1 = $11_1 + -2 | 0;
     HEAP8[$20_1 >> 0] = $5_1;
     HEAP8[($11_1 + -1 | 0) >> 0] = ($17_1 | 0) < (0 | 0) ? 45 : 43;
     $11_1 = $12_1 - $20_1 | 0;
    }
    $10_1 = ((($8_1 + $14_1 | 0) + $23_1 | 0) + $11_1 | 0) + 1 | 0;
    $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 | 0);
    $58($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $64($0_1 | 0, 48 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 65536 | 0 | 0);
    label$48 : {
     label$49 : {
      label$50 : {
       label$51 : {
        if (($21_1 | 0) != (70 | 0)) {
         break label$51
        }
        $21_1 = $6_1 + 16 | 0 | 8 | 0;
        $17_1 = $6_1 + 16 | 0 | 9 | 0;
        $23_1 = $18_1 >>> 0 > $16_1 >>> 0 ? $16_1 : $18_1;
        $18_1 = $23_1;
        label$52 : while (1) {
         i64toi32_i32$5 = $18_1;
         i64toi32_i32$4 = HEAP32[$18_1 >> 2] | 0;
         i64toi32_i32$0 = 0;
         $11_1 = $63(i64toi32_i32$4 | 0, i64toi32_i32$0 | 0, $17_1 | 0) | 0;
         label$53 : {
          label$54 : {
           if (($18_1 | 0) == ($23_1 | 0)) {
            break label$54
           }
           if ($11_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break label$53
           }
           label$55 : while (1) {
            $11_1 = $11_1 + -1 | 0;
            HEAP8[$11_1 >> 0] = 48;
            if ($11_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label$55
            }
            break label$53;
           };
          }
          if (($11_1 | 0) != ($17_1 | 0)) {
           break label$53
          }
          HEAP8[($6_1 + 24 | 0) >> 0] = 48;
          $11_1 = $21_1;
         }
         $58($0_1 | 0, $11_1 | 0, $17_1 - $11_1 | 0 | 0);
         $18_1 = $18_1 + 4 | 0;
         if ($18_1 >>> 0 <= $16_1 >>> 0) {
          continue label$52
         }
         break label$52;
        };
        $11_1 = 0;
        if (!$22_1) {
         break label$49
        }
        $58($0_1 | 0, 1667 | 0, 1 | 0);
        if ($18_1 >>> 0 >= $3_1 >>> 0) {
         break label$50
        }
        if (($14_1 | 0) < (1 | 0)) {
         break label$50
        }
        label$56 : while (1) {
         label$57 : {
          i64toi32_i32$5 = $18_1;
          i64toi32_i32$0 = HEAP32[$18_1 >> 2] | 0;
          i64toi32_i32$4 = 0;
          $11_1 = $63(i64toi32_i32$0 | 0, i64toi32_i32$4 | 0, $17_1 | 0) | 0;
          if ($11_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
           break label$57
          }
          label$58 : while (1) {
           $11_1 = $11_1 + -1 | 0;
           HEAP8[$11_1 >> 0] = 48;
           if ($11_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
            continue label$58
           }
           break label$58;
          };
         }
         $58($0_1 | 0, $11_1 | 0, (($14_1 | 0) < (9 | 0) ? $14_1 : 9) | 0);
         $11_1 = $14_1 + -9 | 0;
         $18_1 = $18_1 + 4 | 0;
         if ($18_1 >>> 0 >= $3_1 >>> 0) {
          break label$49
         }
         $23_1 = ($14_1 | 0) > (9 | 0);
         $14_1 = $11_1;
         if ($23_1) {
          continue label$56
         }
         break label$49;
        };
       }
       label$59 : {
        if (($14_1 | 0) < (0 | 0)) {
         break label$59
        }
        $21_1 = $3_1 >>> 0 > $18_1 >>> 0 ? $3_1 : $18_1 + 4 | 0;
        $22_1 = $6_1 + 16 | 0 | 8 | 0;
        $3_1 = $6_1 + 16 | 0 | 9 | 0;
        $16_1 = ($19_1 | 0) != (0 | 0) ^ 1 | 0;
        $17_1 = $18_1;
        label$60 : while (1) {
         label$61 : {
          i64toi32_i32$5 = $17_1;
          i64toi32_i32$4 = HEAP32[$17_1 >> 2] | 0;
          i64toi32_i32$0 = 0;
          $11_1 = $63(i64toi32_i32$4 | 0, i64toi32_i32$0 | 0, $3_1 | 0) | 0;
          if (($11_1 | 0) != ($3_1 | 0)) {
           break label$61
          }
          HEAP8[($6_1 + 24 | 0) >> 0] = 48;
          $11_1 = $22_1;
         }
         label$62 : {
          label$63 : {
           if (($17_1 | 0) == ($18_1 | 0)) {
            break label$63
           }
           if ($11_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break label$62
           }
           label$64 : while (1) {
            $11_1 = $11_1 + -1 | 0;
            HEAP8[$11_1 >> 0] = 48;
            if ($11_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label$64
            }
            break label$62;
           };
          }
          $58($0_1 | 0, $11_1 | 0, 1 | 0);
          $11_1 = $11_1 + 1 | 0;
          if (($14_1 | 0) < (1 | 0) & $16_1 | 0) {
           break label$62
          }
          $58($0_1 | 0, 1667 | 0, 1 | 0);
         }
         $23_1 = $3_1 - $11_1 | 0;
         $58($0_1 | 0, $11_1 | 0, (($14_1 | 0) > ($23_1 | 0) ? $23_1 : $14_1) | 0);
         $14_1 = $14_1 - $23_1 | 0;
         $17_1 = $17_1 + 4 | 0;
         if ($17_1 >>> 0 >= $21_1 >>> 0) {
          break label$59
         }
         if (($14_1 | 0) > (-1 | 0)) {
          continue label$60
         }
         break label$60;
        };
       }
       $64($0_1 | 0, 48 | 0, $14_1 + 18 | 0 | 0, 18 | 0, 0 | 0);
       $58($0_1 | 0, $20_1 | 0, $12_1 - $20_1 | 0 | 0);
       break label$48;
      }
      $11_1 = $14_1;
     }
     $64($0_1 | 0, 48 | 0, $11_1 + 9 | 0 | 0, 9 | 0, 0 | 0);
    }
    $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
    break label$4;
   }
   $17_1 = $5_1 & 32 | 0;
   $14_1 = $17_1 ? $9_1 + 9 | 0 : $9_1;
   label$65 : {
    if ($3_1 >>> 0 > 11 >>> 0) {
     break label$65
    }
    $11_1 = 12 - $3_1 | 0;
    if (!$11_1) {
     break label$65
    }
    $26_1 = 8.0;
    label$66 : while (1) {
     $26_1 = $26_1 * 16.0;
     $11_1 = $11_1 + -1 | 0;
     if ($11_1) {
      continue label$66
     }
     break label$66;
    };
    label$67 : {
     if ((HEAPU8[$14_1 >> 0] | 0 | 0) != (45 | 0)) {
      break label$67
     }
     $1_1 = -($26_1 + (-$1_1 - $26_1));
     break label$65;
    }
    $1_1 = $1_1 + $26_1 - $26_1;
   }
   label$68 : {
    $11_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
    $822 = $11_1;
    $11_1 = $11_1 >> 31 | 0;
    i64toi32_i32$0 = 0;
    $11_1 = $63(($822 + $11_1 | 0) ^ $11_1 | 0 | 0, i64toi32_i32$0 | 0, $12_1 | 0) | 0;
    if (($11_1 | 0) != ($12_1 | 0)) {
     break label$68
    }
    HEAP8[($6_1 + 15 | 0) >> 0] = 48;
    $11_1 = $6_1 + 15 | 0;
   }
   $22_1 = $8_1 | 2 | 0;
   $18_1 = HEAP32[($6_1 + 44 | 0) >> 2] | 0;
   $21_1 = $11_1 + -2 | 0;
   HEAP8[$21_1 >> 0] = $5_1 + 15 | 0;
   HEAP8[($11_1 + -1 | 0) >> 0] = ($18_1 | 0) < (0 | 0) ? 45 : 43;
   $23_1 = $4_1 & 8 | 0;
   $18_1 = $6_1 + 16 | 0;
   label$69 : while (1) {
    $11_1 = $18_1;
    label$70 : {
     label$71 : {
      if (!(Math_abs($1_1) < 2147483648.0)) {
       break label$71
      }
      $18_1 = ~~$1_1;
      break label$70;
     }
     $18_1 = -2147483648;
    }
    HEAP8[$11_1 >> 0] = HEAPU8[($18_1 + 1616 | 0) >> 0] | 0 | $17_1 | 0;
    $1_1 = ($1_1 - +($18_1 | 0)) * 16.0;
    label$72 : {
     $18_1 = $11_1 + 1 | 0;
     if (($18_1 - ($6_1 + 16 | 0) | 0 | 0) != (1 | 0)) {
      break label$72
     }
     label$73 : {
      if ($23_1) {
       break label$73
      }
      if (($3_1 | 0) > (0 | 0)) {
       break label$73
      }
      if ($1_1 == 0.0) {
       break label$72
      }
     }
     HEAP8[($11_1 + 1 | 0) >> 0] = 46;
     $18_1 = $11_1 + 2 | 0;
    }
    if ($1_1 != 0.0) {
     continue label$69
    }
    break label$69;
   };
   label$74 : {
    label$75 : {
     if (!$3_1) {
      break label$75
     }
     if ((($18_1 - ($6_1 + 16 | 0) | 0) + -2 | 0 | 0) >= ($3_1 | 0)) {
      break label$75
     }
     $11_1 = (($3_1 + $12_1 | 0) - $21_1 | 0) + 2 | 0;
     break label$74;
    }
    $11_1 = (($12_1 - ($6_1 + 16 | 0) | 0) - $21_1 | 0) + $18_1 | 0;
   }
   $10_1 = $11_1 + $22_1 | 0;
   $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 | 0);
   $58($0_1 | 0, $14_1 | 0, $22_1 | 0);
   $64($0_1 | 0, 48 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 65536 | 0 | 0);
   $18_1 = $18_1 - ($6_1 + 16 | 0) | 0;
   $58($0_1 | 0, $6_1 + 16 | 0 | 0, $18_1 | 0);
   $17_1 = $12_1 - $21_1 | 0;
   $64($0_1 | 0, 48 | 0, $11_1 - ($18_1 + $17_1 | 0) | 0 | 0, 0 | 0, 0 | 0);
   $58($0_1 | 0, $21_1 | 0, $17_1 | 0);
   $64($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
  }
  global$0 = $6_1 + 560 | 0;
  return (($10_1 | 0) < ($2_1 | 0) ? $2_1 : $10_1) | 0;
 }
 
 function $67($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $2_1 = 0, $12_1 = 0, $12$hi = 0, $14_1 = 0, $14$hi = 0;
  $2_1 = ((HEAP32[$1_1 >> 2] | 0) + 15 | 0) & -16 | 0;
  HEAP32[$1_1 >> 2] = $2_1 + 16 | 0;
  i64toi32_i32$2 = $2_1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $12_1 = i64toi32_i32$0;
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
  $14_1 = i64toi32_i32$1;
  $14$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $12$hi;
  i64toi32_i32$1 = $14$hi;
  HEAPF64[$0_1 >> 3] = +$95($12_1 | 0, i64toi32_i32$0 | 0, $14_1 | 0, i64toi32_i32$1 | 0);
 }
 
 function $68($0_1) {
  $0_1 = +$0_1;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  wasm2js_scratch_store_f64(+$0_1);
  i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
  i64toi32_i32$1 = wasm2js_scratch_load_i32(0 | 0) | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function $69($0_1) {
  $0_1 = $0_1 | 0;
  return (HEAP32[$0_1 >> 2] | 0 | 0) == (2 | 0) | 0;
 }
 
 function $70() {
  var $0_1 = 0, $1_1 = 0;
  $0_1 = global$0 - 16 | 0;
  global$0 = $0_1;
  label$1 : {
   $1_1 = $28() | 0;
   if (HEAP32[($1_1 + 56 | 0) >> 2] | 0) {
    break label$1
   }
   if (!($69($1_1 | 0) | 0)) {
    break label$1
   }
   HEAP8[($0_1 + 15 | 0) >> 0] = 0;
   fimport$9(1669 | 0, $0_1 + 15 | 0 | 0, 0 | 0) | 0;
  }
  global$0 = $0_1 + 16 | 0;
 }
 
 function $71($0_1) {
  $0_1 = +$0_1;
  var $3_1 = 0.0, $2_1 = 0.0, $1_1 = 0;
  $2_1 = +fimport$6();
  $70();
  $72();
  $1_1 = $92() | 0;
  fimport$8(1 | 0, 2 | 0);
  label$1 : {
   $0_1 = $2_1 + $0_1;
   if (+fimport$6() < $0_1 ^ 1 | 0) {
    break label$1
   }
   $2_1 = +(($1_1 ? 1 : 100) | 0);
   label$2 : while (1) {
    $70();
    $72();
    label$3 : {
     $3_1 = $0_1 - +fimport$6();
     $3_1 = $3_1 > $2_1 ? $2_1 : $3_1;
     if ($3_1 >= .1 ^ 1 | 0) {
      break label$3
     }
     fimport$7(2612 | 0, 0 | 0, +$3_1) | 0;
    }
    if (+fimport$6() < $0_1) {
     continue label$2
    }
    break label$2;
   };
  }
  fimport$8(2 | 0, 1 | 0);
 }
 
 function $72() {
  var $2_1 = 0, $0_1 = 0, $1_1 = 0, $3_1 = 0;
  label$1 : {
   label$2 : {
    if (!($92() | 0)) {
     break label$2
    }
    if (HEAPU8[(0 + 2648 | 0) >> 0] | 0) {
     break label$1
    }
    HEAP8[(0 + 2648 | 0) >> 0] = 1;
   }
   $39(2620 | 0) | 0;
   label$3 : {
    $0_1 = $73($28() | 0 | 0) | 0;
    if ($0_1) {
     break label$3
    }
    $46(2620 | 0) | 0;
    if (!($92() | 0)) {
     break label$1
    }
    HEAP8[(0 + 2648 | 0) >> 0] = 0;
    return;
   }
   label$4 : {
    $1_1 = $0_1 + 8 | 0;
    $2_1 = $49($1_1 | 0) | 0;
    $3_1 = $0_1 + 12 | 0;
    if (($2_1 | 0) == ($49($3_1 | 0) | 0 | 0)) {
     break label$4
    }
    label$5 : while (1) {
     $46(2620 | 0) | 0;
     $74(HEAP32[((HEAP32[($0_1 + 4 | 0) >> 2] | 0) + ($2_1 << 2 | 0) | 0) >> 2] | 0 | 0);
     $39(2620 | 0) | 0;
     $2_1 = ($2_1 + 1 | 0 | 0) % (128 | 0) | 0;
     $50($1_1 | 0, $2_1 | 0) | 0;
     if (($2_1 | 0) != ($49($3_1 | 0) | 0 | 0)) {
      continue label$5
     }
     break label$5;
    };
   }
   $46(2620 | 0) | 0;
   fimport$2($1_1 | 0, 2147483647 | 0) | 0;
   if (!($92() | 0)) {
    break label$1
   }
   HEAP8[(0 + 2648 | 0) >> 0] = 0;
  }
 }
 
 function $73($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  label$1 : {
   if (!$0_1) {
    break label$1
   }
   label$2 : {
    $1_1 = HEAP32[(0 + 2656 | 0) >> 2] | 0;
    if (!$1_1) {
     break label$2
    }
    label$3 : while (1) {
     label$4 : {
      if ((HEAP32[$1_1 >> 2] | 0 | 0) != ($0_1 | 0)) {
       break label$4
      }
      return $1_1 | 0;
     }
     $1_1 = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
     if ($1_1) {
      continue label$3
     }
     break label$3;
    };
   }
   return 0 | 0;
  }
  fimport$10(2133 | 0, 1687 | 0, 385 | 0, 2140 | 0);
  abort();
 }
 
 function $74($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     $1_1 = HEAP32[$0_1 >> 2] | 0;
     if (($1_1 & 402653184 | 0 | 0) == (402653184 | 0)) {
      break label$3
     }
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             label$12 : {
              label$13 : {
               label$14 : {
                label$15 : {
                 label$16 : {
                  label$17 : {
                   label$18 : {
                    label$19 : {
                     label$20 : {
                      label$21 : {
                       label$22 : {
                        label$23 : {
                         label$24 : {
                          label$25 : {
                           label$26 : {
                            label$27 : {
                             label$28 : {
                              label$29 : {
                               if (($1_1 | 0) > (234881023 | 0)) {
                                break label$29
                               }
                               label$30 : {
                                if (($1_1 | 0) > (100663335 | 0)) {
                                 break label$30
                                }
                                label$31 : {
                                 if (($1_1 | 0) > (67108863 | 0)) {
                                  break label$31
                                 }
                                 label$32 : {
                                  switch ($1_1 + -33554432 | 0 | 0) {
                                  case 2:
                                   break label$27;
                                  case 0:
                                   break label$28;
                                  case 1:
                                   break label$5;
                                  default:
                                   break label$32;
                                  };
                                 }
                                 if (($1_1 | 0) == (-2126512128 | 0)) {
                                  break label$4
                                 }
                                 if ($1_1) {
                                  break label$5
                                 }
                                 FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0]();
                                 break label$1;
                                }
                                label$33 : {
                                 if (($1_1 | 0) > (100663295 | 0)) {
                                  break label$33
                                 }
                                 switch ($1_1 + -67108872 | 0 | 0) {
                                 case 2:
                                  break label$25;
                                 case 0:
                                  break label$26;
                                 case 1:
                                  break label$5;
                                 default:
                                  break label$6;
                                 };
                                }
                                if (($1_1 | 0) == (100663296 | 0)) {
                                 break label$24
                                }
                                if (($1_1 | 0) != (100663328 | 0)) {
                                 break label$5
                                }
                                FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]));
                                break label$1;
                               }
                               label$34 : {
                                if (($1_1 | 0) > (134217895 | 0)) {
                                 break label$34
                                }
                                label$35 : {
                                 switch ($1_1 + -100663336 | 0 | 0) {
                                 case 2:
                                  break label$22;
                                 case 0:
                                  break label$23;
                                 case 1:
                                  break label$5;
                                 default:
                                  break label$35;
                                 };
                                }
                                if (($1_1 | 0) == (134217728 | 0)) {
                                 break label$21
                                }
                                if (($1_1 | 0) != (134217760 | 0)) {
                                 break label$5
                                }
                                FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]), HEAP32[($0_1 + 40 | 0) >> 2] | 0);
                                break label$1;
                               }
                               label$36 : {
                                if (($1_1 | 0) > (167772839 | 0)) {
                                 break label$36
                                }
                                switch ($1_1 + -134217896 | 0 | 0) {
                                case 2:
                                 break label$19;
                                case 0:
                                 break label$20;
                                case 1:
                                 break label$5;
                                default:
                                 break label$18;
                                };
                               }
                               if (($1_1 | 0) == (167772840 | 0)) {
                                break label$17
                               }
                               if (($1_1 | 0) != (201326592 | 0)) {
                                break label$5
                               }
                               FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0);
                               break label$1;
                              }
                              label$37 : {
                               if (($1_1 | 0) > (637534207 | 0)) {
                                break label$37
                               }
                               label$38 : {
                                if (($1_1 | 0) > (369098751 | 0)) {
                                 break label$38
                                }
                                label$39 : {
                                 if (($1_1 | 0) > (301989887 | 0)) {
                                  break label$39
                                 }
                                 if (($1_1 | 0) == (234881024 | 0)) {
                                  break label$16
                                 }
                                 if (($1_1 | 0) != (268435456 | 0)) {
                                  break label$5
                                 }
                                 FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0);
                                 break label$1;
                                }
                                if (($1_1 | 0) == (301989888 | 0)) {
                                 break label$15
                                }
                                if (($1_1 | 0) != (335544320 | 0)) {
                                 break label$5
                                }
                                FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0, HEAP32[($0_1 + 80 | 0) >> 2] | 0, HEAP32[($0_1 + 88 | 0) >> 2] | 0);
                                break label$1;
                               }
                               label$40 : {
                                if (($1_1 | 0) > (570425343 | 0)) {
                                 break label$40
                                }
                                if (($1_1 | 0) == (369098752 | 0)) {
                                 break label$14
                                }
                                if (($1_1 | 0) != (536870912 | 0)) {
                                 break label$5
                                }
                                HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0]() | 0;
                                break label$1;
                               }
                               if (($1_1 | 0) == (570425344 | 0)) {
                                break label$13
                               }
                               if (($1_1 | 0) == (603979776 | 0)) {
                                break label$12
                               }
                               if (($1_1 | 0) != (622854144 | 0)) {
                                break label$5
                               }
                               HEAP32[($0_1 + 176 | 0) >> 2] = fimport$13(HEAP32[($0_1 + 16 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0 | 0) | 0;
                               break label$1;
                              }
                              label$41 : {
                               if (($1_1 | 0) > (704643071 | 0)) {
                                break label$41
                               }
                               label$42 : {
                                if (($1_1 | 0) > (671088639 | 0)) {
                                 break label$42
                                }
                                if (($1_1 | 0) == (637534208 | 0)) {
                                 break label$11
                                }
                                if (($1_1 | 0) != (657457152 | 0)) {
                                 break label$5
                                }
                                HEAP32[($0_1 + 176 | 0) >> 2] = fimport$14(HEAP32[($0_1 + 16 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0 | 0) | 0;
                                break label$1;
                               }
                               if (($1_1 | 0) == (671088640 | 0)) {
                                break label$10
                               }
                               if (($1_1 | 0) != (687865856 | 0)) {
                                break label$5
                               }
                               HEAP32[($0_1 + 176 | 0) >> 2] = fimport$0(HEAP32[($0_1 + 16 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0) | 0;
                               break label$1;
                              }
                              label$43 : {
                               if (($1_1 | 0) > (771751935 | 0)) {
                                break label$43
                               }
                               if (($1_1 | 0) == (704643072 | 0)) {
                                break label$9
                               }
                               if (($1_1 | 0) != (738197504 | 0)) {
                                break label$5
                               }
                               HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0) | 0;
                               break label$1;
                              }
                              if (($1_1 | 0) == (771751936 | 0)) {
                               break label$8
                              }
                              if (($1_1 | 0) == (805306368 | 0)) {
                               break label$7
                              }
                              if (($1_1 | 0) != (838860800 | 0)) {
                               break label$5
                              }
                              HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0, HEAP32[($0_1 + 80 | 0) >> 2] | 0) | 0;
                              break label$1;
                             }
                             FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0);
                             break label$1;
                            }
                            FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](Math_fround(HEAPF32[($0_1 + 16 | 0) >> 2]));
                            break label$1;
                           }
                           FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]));
                           break label$1;
                          }
                          FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](Math_fround(HEAPF32[($0_1 + 16 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]));
                          break label$1;
                         }
                         FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0);
                         break label$1;
                        }
                        FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]));
                        break label$1;
                       }
                       FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](Math_fround(HEAPF32[($0_1 + 16 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]));
                       break label$1;
                      }
                      FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0);
                      break label$1;
                     }
                     FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 40 | 0) >> 2]));
                     break label$1;
                    }
                    FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](Math_fround(HEAPF32[($0_1 + 16 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 40 | 0) >> 2]));
                    break label$1;
                   }
                   if (($1_1 | 0) != (167772160 | 0)) {
                    break label$5
                   }
                   FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0);
                   break label$1;
                  }
                  FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, Math_fround(HEAPF32[($0_1 + 24 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 32 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 40 | 0) >> 2]), Math_fround(HEAPF32[($0_1 + 48 | 0) >> 2]));
                  break label$1;
                 }
                 FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0);
                 break label$1;
                }
                FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0, HEAP32[($0_1 + 80 | 0) >> 2] | 0);
                break label$1;
               }
               FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0, HEAP32[($0_1 + 80 | 0) >> 2] | 0, HEAP32[($0_1 + 88 | 0) >> 2] | 0, HEAP32[($0_1 + 96 | 0) >> 2] | 0);
               break label$1;
              }
              HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0) | 0;
              break label$1;
             }
             HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0) | 0;
             break label$1;
            }
            HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0) | 0;
            break label$1;
           }
           HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0) | 0;
           break label$1;
          }
          HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
          break label$1;
         }
         HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0) | 0;
         break label$1;
        }
        HEAP32[($0_1 + 176 | 0) >> 2] = FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0, HEAP32[($0_1 + 32 | 0) >> 2] | 0, HEAP32[($0_1 + 40 | 0) >> 2] | 0, HEAP32[($0_1 + 48 | 0) >> 2] | 0, HEAP32[($0_1 + 56 | 0) >> 2] | 0, HEAP32[($0_1 + 64 | 0) >> 2] | 0, HEAP32[($0_1 + 72 | 0) >> 2] | 0) | 0;
        break label$1;
       }
       if (($1_1 | 0) == (67108864 | 0)) {
        break label$2
       }
      }
      fimport$10(2082 | 0, 1687 | 0, 351 | 0, 2073 | 0);
      abort();
     }
     HEAPF64[($0_1 + 176 | 0) >> 3] = +fimport$15(HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[($0_1 + 16 | 0) >> 2] | 0 | 0, $0_1 + 24 | 0 | 0);
     break label$1;
    }
    fimport$10(1998 | 0, 1687 | 0, 207 | 0, 2073 | 0);
    abort();
   }
   FUNCTION_TABLE[HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0](HEAP32[($0_1 + 16 | 0) >> 2] | 0, HEAP32[($0_1 + 24 | 0) >> 2] | 0);
  }
  label$44 : {
   if (!(HEAP32[($0_1 + 188 | 0) >> 2] | 0)) {
    break label$44
   }
   $75($0_1 | 0);
   return;
  }
  HEAP32[($0_1 + 8 | 0) >> 2] = 1;
  fimport$2($0_1 + 8 | 0 | 0, 2147483647 | 0) | 0;
 }
 
 function $75($0_1) {
  $0_1 = $0_1 | 0;
  label$1 : {
   if (!$0_1) {
    break label$1
   }
   $105(HEAP32[($0_1 + 184 | 0) >> 2] | 0 | 0);
  }
  $105($0_1 | 0);
 }
 
 function $76($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = +$1_1;
  var $3_1 = 0.0, $2_1 = 0;
  label$1 : {
   $2_1 = $0_1 + 8 | 0;
   $0_1 = $49($2_1 | 0) | 0;
   if ($0_1) {
    break label$1
   }
   $3_1 = +fimport$6();
   fimport$11(5 | 0);
   $0_1 = 0;
   label$2 : {
    $1_1 = $3_1 + $1_1;
    if ($3_1 < $1_1 ^ 1 | 0) {
     break label$2
    }
    label$3 : while (1) {
     fimport$7($2_1 | 0, 0 | 0, +($1_1 - $3_1)) | 0;
     $0_1 = $49($2_1 | 0) | 0;
     $3_1 = +fimport$6();
     if ($0_1) {
      break label$2
     }
     if ($3_1 < $1_1) {
      continue label$3
     }
     break label$3;
    };
   }
   fimport$11(1 | 0);
  }
  return ($0_1 ? 0 : -8) | 0;
 }
 
 function $77($0_1) {
  $0_1 = $0_1 | 0;
  HEAP32[(0 + 2616 | 0) >> 2] = $0_1;
 }
 
 function $78() {
  return HEAP32[(0 + 2616 | 0) >> 2] | 0 | 0;
 }
 
 function $79($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $6_1 = 0, $7_1 = 0, $3_1 = 0, $5_1 = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     if (!$1_1) {
      break label$3
     }
     label$4 : {
      switch ($0_1 | 0) {
      case 0:
       fimport$10(1794 | 0, 1687 | 0, 468 | 0, 1760 | 0);
       abort();
      case 1:
       $0_1 = $78() | 0;
       break;
      default:
       break label$4;
      };
     }
     label$7 : {
      label$8 : {
       if (($0_1 | 0) == (2 | 0)) {
        break label$8
       }
       if (($0_1 | 0) != ($28() | 0 | 0)) {
        break label$7
       }
      }
      $74($1_1 | 0);
      return 1 | 0;
     }
     $39(2620 | 0) | 0;
     label$9 : {
      $2_1 = $80($0_1 | 0) | 0;
      if (HEAP32[($2_1 + 4 | 0) >> 2] | 0) {
       break label$9
      }
      HEAP32[($2_1 + 4 | 0) >> 2] = $103(512 | 0) | 0;
     }
     label$10 : {
      $3_1 = $2_1 + 8 | 0;
      $4_1 = $49($3_1 | 0) | 0;
      $5_1 = $2_1 + 12 | 0;
      $6_1 = $49($5_1 | 0) | 0;
      $7_1 = ($6_1 + 1 | 0 | 0) % (128 | 0) | 0;
      if (($4_1 | 0) != ($7_1 | 0)) {
       break label$10
      }
      label$11 : while (1) {
       $46(2620 | 0) | 0;
       if (($0_1 | 0) != ($78() | 0 | 0)) {
        break label$2
       }
       fimport$7($3_1 | 0, $4_1 | 0, +(infinity)) | 0;
       $39(2620 | 0) | 0;
       $4_1 = $49($3_1 | 0) | 0;
       $6_1 = $49($5_1 | 0) | 0;
       $7_1 = ($6_1 + 1 | 0 | 0) % (128 | 0) | 0;
       if (($4_1 | 0) == ($7_1 | 0)) {
        continue label$11
       }
       break label$11;
      };
     }
     HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + ($6_1 << 2 | 0) | 0) >> 2] = $1_1;
     label$12 : {
      if (($4_1 | 0) != ($6_1 | 0)) {
       break label$12
      }
      if (fimport$12($0_1 | 0, $78() | 0 | 0) | 0) {
       break label$12
      }
      $75($1_1 | 0);
      $46(2620 | 0) | 0;
      break label$1;
     }
     $50($5_1 | 0, $7_1 | 0) | 0;
     $46(2620 | 0) | 0;
     break label$1;
    }
    fimport$10(1755 | 0, 1687 | 0, 458 | 0, 1760 | 0);
    abort();
   }
   $75($1_1 | 0);
  }
  return 0 | 0;
 }
 
 function $80($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$0 = 0, $2_1 = 0;
  label$1 : {
   $1_1 = $73($0_1 | 0) | 0;
   if ($1_1) {
    break label$1
   }
   $1_1 = $103(20 | 0) | 0;
   i64toi32_i32$0 = 0;
   HEAP32[($1_1 + 12 | 0) >> 2] = 0;
   HEAP32[($1_1 + 16 | 0) >> 2] = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   HEAP32[($1_1 + 4 | 0) >> 2] = 0;
   HEAP32[($1_1 + 8 | 0) >> 2] = i64toi32_i32$0;
   HEAP32[$1_1 >> 2] = $0_1;
   label$2 : {
    label$3 : {
     $0_1 = HEAP32[(0 + 2656 | 0) >> 2] | 0;
     if ($0_1) {
      break label$3
     }
     $0_1 = 2656;
     break label$2;
    }
    label$4 : while (1) {
     $2_1 = $0_1;
     $0_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
     if ($0_1) {
      continue label$4
     }
     break label$4;
    };
    $0_1 = $2_1 + 16 | 0;
   }
   HEAP32[$0_1 >> 2] = $1_1;
  }
  return $1_1 | 0;
 }
 
 function $81($0_1) {
  $0_1 = $0_1 | 0;
  $79($78() | 0 | 0, $0_1 | 0) | 0;
 }
 
 function $82($0_1) {
  $0_1 = $0_1 | 0;
  $81($0_1 | 0);
  $76($0_1 | 0, +(infinity)) | 0;
 }
 
 function $83($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 192 | 0;
  global$0 = $3_1;
  wasm2js_memory_fill($3_1, 0, 192);
  HEAP32[($3_1 + 24 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 176 | 0) >> 2] = 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = $1_1;
  HEAP32[$3_1 >> 2] = $0_1;
  $82($3_1 | 0);
  $0_1 = HEAP32[($3_1 + 176 | 0) >> 2] | 0;
  global$0 = $3_1 + 192 | 0;
  return $0_1 | 0;
 }
 
 function $84($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 192 | 0;
  global$0 = $5_1;
  wasm2js_memory_fill($5_1, 0, 192);
  HEAP32[($5_1 + 40 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 176 | 0) >> 2] = 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = $1_1;
  HEAP32[$5_1 >> 2] = $0_1;
  $82($5_1 | 0);
  $0_1 = HEAP32[($5_1 + 176 | 0) >> 2] | 0;
  global$0 = $5_1 + 192 | 0;
  return $0_1 | 0;
 }
 
 function $85() {
  label$1 : {
   if (!($91() | 0)) {
    break label$1
   }
   $72();
  }
 }
 
 function $86($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $5_1 = 0, i64toi32_i32$0 = 0, $6_1 = 0, i64toi32_i32$2 = 0, $7_1 = 0.0, i64toi32_i32$1 = 0, $40_1 = 0;
  $4_1 = global$0 - 192 | 0;
  global$0 = $4_1;
  label$1 : {
   label$2 : {
    if (!$3_1) {
     break label$2
    }
    HEAP32[($4_1 + 184 | 0) >> 2] = 0;
    HEAP32[($4_1 + 8 | 0) >> 2] = 0;
    $5_1 = $4_1;
    break label$1;
   }
   $5_1 = $87() | 0;
  }
  HEAP32[($5_1 + 4 | 0) >> 2] = $0_1;
  HEAP32[$5_1 >> 2] = -2126512128;
  HEAP32[($5_1 + 188 | 0) >> 2] = 1 - $3_1 | 0;
  label$3 : {
   if (($1_1 | 0) >= (20 | 0)) {
    break label$3
   }
   HEAP32[($5_1 + 16 | 0) >> 2] = $1_1;
   $0_1 = 0;
   label$4 : {
    if (($1_1 | 0) <= (0 | 0)) {
     break label$4
    }
    label$5 : while (1) {
     $6_1 = $0_1 + 1 | 0;
     i64toi32_i32$2 = $2_1 + ($0_1 << 3 | 0) | 0;
     i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
     i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
     $40_1 = i64toi32_i32$0;
     i64toi32_i32$0 = ($5_1 + ($6_1 << 3 | 0) | 0) + 16 | 0;
     HEAP32[i64toi32_i32$0 >> 2] = $40_1;
     HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
     $0_1 = $6_1;
     if (($0_1 | 0) != ($1_1 | 0)) {
      continue label$5
     }
     break label$5;
    };
   }
   label$6 : {
    label$7 : {
     if (!$3_1) {
      break label$7
     }
     $82($4_1 | 0);
     $7_1 = +HEAPF64[($4_1 + 176 | 0) >> 3];
     break label$6;
    }
    $81($5_1 | 0);
    $7_1 = 0.0;
   }
   global$0 = $4_1 + 192 | 0;
   return +$7_1;
  }
  fimport$10(1808 | 0, 1687 | 0, 761 | 0, 1849 | 0);
  abort();
 }
 
 function $87() {
  var $0_1 = 0;
  label$1 : {
   $0_1 = $103(192 | 0) | 0;
   if ($0_1) {
    break label$1
   }
   fimport$10(1755 | 0, 1687 | 0, 173 | 0, 2149 | 0);
   abort();
  }
  HEAP32[($0_1 + 184 | 0) >> 2] = 0;
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = 0;
  return $0_1 | 0;
 }
 
 function $88($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $6_1 = 0, $7_1 = 0, i64toi32_i32$0 = 0, $11_1 = 0, i64toi32_i32$1 = 0, $56_1 = 0;
  $6_1 = global$0 - 16 | 0;
  global$0 = $6_1;
  label$1 : {
   $7_1 = $87() | 0;
   if (!$7_1) {
    break label$1
   }
   HEAP32[($7_1 + 184 | 0) >> 2] = $4_1;
   HEAP32[($7_1 + 4 | 0) >> 2] = $3_1;
   HEAP32[$7_1 >> 2] = $2_1;
   HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
   label$2 : {
    $4_1 = ($2_1 >>> 25 | 0) & 15 | 0;
    if (!$4_1) {
     break label$2
    }
    $2_1 = $2_1 & 33554431 | 0;
    $3_1 = 0;
    label$3 : while (1) {
     label$4 : {
      label$5 : {
       switch ($2_1 & 3 | 0 | 0) {
       default:
        $5_1 = HEAP32[($6_1 + 12 | 0) >> 2] | 0;
        HEAP32[($6_1 + 12 | 0) >> 2] = $5_1 + 4 | 0;
        HEAP32[(($7_1 + ($3_1 << 3 | 0) | 0) + 16 | 0) >> 2] = HEAP32[$5_1 >> 2] | 0;
        break label$4;
       case 1:
        $5_1 = ((HEAP32[($6_1 + 12 | 0) >> 2] | 0) + 7 | 0) & -8 | 0;
        HEAP32[($6_1 + 12 | 0) >> 2] = $5_1 + 8 | 0;
        i64toi32_i32$0 = HEAP32[$5_1 >> 2] | 0;
        i64toi32_i32$1 = HEAP32[($5_1 + 4 | 0) >> 2] | 0;
        $56_1 = i64toi32_i32$0;
        i64toi32_i32$0 = ($7_1 + ($3_1 << 3 | 0) | 0) + 16 | 0;
        HEAP32[i64toi32_i32$0 >> 2] = $56_1;
        HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
        break label$4;
       case 2:
        $5_1 = ((HEAP32[($6_1 + 12 | 0) >> 2] | 0) + 7 | 0) & -8 | 0;
        HEAP32[($6_1 + 12 | 0) >> 2] = $5_1 + 8 | 0;
        HEAPF32[(($7_1 + ($3_1 << 3 | 0) | 0) + 16 | 0) >> 2] = Math_fround(+HEAPF64[$5_1 >> 3]);
        break label$4;
       case 3:
        break label$5;
       };
      }
      $5_1 = ((HEAP32[($6_1 + 12 | 0) >> 2] | 0) + 7 | 0) & -8 | 0;
      HEAP32[($6_1 + 12 | 0) >> 2] = $5_1 + 8 | 0;
      HEAPF64[(($7_1 + ($3_1 << 3 | 0) | 0) + 16 | 0) >> 3] = +HEAPF64[$5_1 >> 3];
     }
     $2_1 = $2_1 >>> 2 | 0;
     $3_1 = $3_1 + 1 | 0;
     if (($3_1 | 0) != ($4_1 | 0)) {
      continue label$3
     }
     break label$3;
    };
   }
   HEAP32[($7_1 + 188 | 0) >> 2] = 1;
   label$9 : {
    label$10 : {
     if (!$0_1) {
      break label$10
     }
     $2_1 = 0;
     HEAP8[($6_1 + 11 | 0) >> 0] = 0;
     $11_1 = 26985;
     HEAP8[($6_1 + 9 | 0) >> 0] = $11_1;
     HEAP8[($6_1 + 10 | 0) >> 0] = $11_1 >>> 8 | 0;
     HEAP32[$6_1 >> 2] = $1_1;
     HEAP32[($6_1 + 4 | 0) >> 2] = $7_1;
     fimport$9(1919 | 0, $6_1 + 9 | 0 | 0, $6_1 | 0) | 0;
     break label$9;
    }
    $2_1 = $79($1_1 | 0, $7_1 | 0) | 0;
   }
   global$0 = $6_1 + 16 | 0;
   return $2_1 | 0;
  }
  fimport$10(1890 | 0, 1687 | 0, 863 | 0, 1892 | 0);
  abort();
 }
 
 function $89() {
  return global$3 | 0;
 }
 
 function $90($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  global$3 = $0_1;
  global$4 = $1_1;
  global$5 = $2_1;
 }
 
 function $91() {
  return global$5 | 0;
 }
 
 function $92() {
  return global$4 | 0;
 }
 
 function $93($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  label$1 : {
   label$2 : {
    if (!($3_1 & 64 | 0)) {
     break label$2
    }
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $18_1 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $18_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $2_1 = $18_1;
    $2$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $1_1 = 0;
    $1$hi = i64toi32_i32$1;
    break label$1;
   }
   if (!$3_1) {
    break label$1
   }
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $20_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $20_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $21_1 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
    $21_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $2_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $2$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $22_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $22_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $1_1 = $22_1;
   $1$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $94($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  label$1 : {
   label$2 : {
    if (!($3_1 & 64 | 0)) {
     break label$2
    }
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$2 = $2_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $1_1 = $18_1;
    $1$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $2_1 = 0;
    $2$hi = i64toi32_i32$1;
    break label$1;
   }
   if (!$3_1) {
    break label$1
   }
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $20_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $20_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$1 = $1_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $21_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $1_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $1$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = $22_1;
   $2$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $95($0_1, $0$hi, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $4_1 = 0, $4$hi = 0, $5$hi = 0, $5_1 = 0, $2_1 = 0, $3_1 = 0, $43_1 = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, $49_1 = 0, $50_1 = 0, $12_1 = 0, $12$hi = 0, $14$hi = 0, $17_1 = 0, $17$hi = 0, $19$hi = 0, $34_1 = 0, $34$hi = 0, $37_1 = 0, $39_1 = 0, $44_1 = 0, $44$hi = 0, $46$hi = 0, $74_1 = 0, $74$hi = 0, $78$hi = 0, $81_1 = 0, $81$hi = 0, $83_1 = 0, $83$hi = 0, $87_1 = 0, $87$hi = 0, $89_1 = 0, $90$hi = 0, $100$hi = 0, $107_1 = 0, $107$hi = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  label$1 : {
   label$2 : {
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = 2147483647;
    i64toi32_i32$3 = -1;
    i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
    $4_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
    $4$hi = i64toi32_i32$1;
    i64toi32_i32$0 = $4_1;
    i64toi32_i32$2 = -1006698496;
    i64toi32_i32$3 = 0;
    i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    $12_1 = i64toi32_i32$4;
    $12$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $4$hi;
    i64toi32_i32$1 = $4_1;
    i64toi32_i32$0 = -1140785152;
    i64toi32_i32$3 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $14$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $12$hi;
    i64toi32_i32$5 = $12_1;
    i64toi32_i32$1 = $14$hi;
    i64toi32_i32$3 = i64toi32_i32$2;
    if (i64toi32_i32$4 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$5 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
     break label$2
    }
    i64toi32_i32$5 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 60;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = 0;
     $43_1 = i64toi32_i32$5 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$4 = i64toi32_i32$5 >>> i64toi32_i32$0 | 0;
     $43_1 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$0 | 0) | 0;
    }
    $17_1 = $43_1;
    $17$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $1$hi;
    i64toi32_i32$5 = $1_1;
    i64toi32_i32$3 = 0;
    i64toi32_i32$1 = 4;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$3 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     $45_1 = 0;
    } else {
     i64toi32_i32$3 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$0 | 0) | 0;
     $45_1 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
    }
    $19$hi = i64toi32_i32$3;
    i64toi32_i32$3 = $17$hi;
    i64toi32_i32$4 = $17_1;
    i64toi32_i32$5 = $19$hi;
    i64toi32_i32$1 = $45_1;
    i64toi32_i32$5 = i64toi32_i32$3 | i64toi32_i32$5 | 0;
    $4_1 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    $4$hi = i64toi32_i32$5;
    label$3 : {
     i64toi32_i32$5 = $0$hi;
     i64toi32_i32$3 = $0_1;
     i64toi32_i32$4 = 268435455;
     i64toi32_i32$1 = -1;
     i64toi32_i32$4 = i64toi32_i32$5 & i64toi32_i32$4 | 0;
     $0_1 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
     $0$hi = i64toi32_i32$4;
     i64toi32_i32$5 = $0_1;
     i64toi32_i32$3 = 134217728;
     i64toi32_i32$1 = 1;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$5 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0) {
      break label$3
     }
     i64toi32_i32$5 = $4$hi;
     i64toi32_i32$1 = $4_1;
     i64toi32_i32$4 = 1073741824;
     i64toi32_i32$3 = 1;
     i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
     i64toi32_i32$2 = i64toi32_i32$5 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $5_1 = i64toi32_i32$0;
     $5$hi = i64toi32_i32$2;
     break label$1;
    }
    i64toi32_i32$2 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$1 = 1073741824;
    i64toi32_i32$3 = 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
    i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
    }
    $5_1 = i64toi32_i32$4;
    $5$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$5 = 134217728;
    i64toi32_i32$3 = 0;
    i64toi32_i32$5 = i64toi32_i32$0 ^ i64toi32_i32$5 | 0;
    i64toi32_i32$0 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$2 | 0) | 0) {
     break label$1
    }
    i64toi32_i32$0 = $5$hi;
    i64toi32_i32$0 = $4$hi;
    i64toi32_i32$3 = $4_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$2 = 1;
    i64toi32_i32$5 = i64toi32_i32$0 & i64toi32_i32$5 | 0;
    $34_1 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
    $34$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $5$hi;
    i64toi32_i32$0 = $5_1;
    i64toi32_i32$3 = $34$hi;
    i64toi32_i32$2 = $34_1;
    i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
    i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $5_1 = i64toi32_i32$1;
    $5$hi = i64toi32_i32$4;
    break label$1;
   }
   label$4 : {
    i64toi32_i32$4 = $0$hi;
    $37_1 = !($0_1 | i64toi32_i32$4 | 0);
    i64toi32_i32$4 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$0 = 2147418112;
    i64toi32_i32$2 = 0;
    $39_1 = i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$5 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
    i64toi32_i32$5 = i64toi32_i32$4;
    i64toi32_i32$2 = $4_1;
    i64toi32_i32$4 = 2147418112;
    i64toi32_i32$0 = 0;
    if ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & (i64toi32_i32$5 | 0) == (i64toi32_i32$4 | 0) | 0 ? $37_1 : $39_1) {
     break label$4
    }
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$0 = $0_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$4 = 60;
    i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
     i64toi32_i32$5 = 0;
     $46_1 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
    } else {
     i64toi32_i32$5 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
     $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$3 | 0) | 0;
    }
    $44_1 = $46_1;
    $44$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$4 = 4;
    i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
     $47_1 = 0;
    } else {
     i64toi32_i32$0 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
     $47_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
    }
    $46$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $44$hi;
    i64toi32_i32$5 = $44_1;
    i64toi32_i32$2 = $46$hi;
    i64toi32_i32$4 = $47_1;
    i64toi32_i32$2 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
    i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
    i64toi32_i32$5 = 524287;
    i64toi32_i32$4 = -1;
    i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
    i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
    i64toi32_i32$0 = 2146959360;
    i64toi32_i32$4 = 0;
    i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$0 | 0;
    $5_1 = i64toi32_i32$2 | i64toi32_i32$4 | 0;
    $5$hi = i64toi32_i32$0;
    break label$1;
   }
   i64toi32_i32$0 = 2146435072;
   $5_1 = 0;
   $5$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$5 = $4_1;
   i64toi32_i32$2 = 1140785151;
   i64toi32_i32$4 = -1;
   if (i64toi32_i32$0 >>> 0 > i64toi32_i32$2 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$5 >>> 0 > i64toi32_i32$4 >>> 0 | 0) | 0) {
    break label$1
   }
   i64toi32_i32$5 = 0;
   $5_1 = 0;
   $5$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $4$hi;
   i64toi32_i32$4 = $4_1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$2 = 48;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $48_1 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
    $48_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$3 | 0) | 0;
   }
   $3_1 = $48_1;
   if ($3_1 >>> 0 < 15249 >>> 0) {
    break label$1
   }
   i64toi32_i32$0 = $0$hi;
   i64toi32_i32$0 = $1$hi;
   i64toi32_i32$5 = $1_1;
   i64toi32_i32$4 = 65535;
   i64toi32_i32$2 = -1;
   i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
   i64toi32_i32$0 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
   i64toi32_i32$5 = 65536;
   i64toi32_i32$2 = 0;
   i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
   $4_1 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
   $4$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $0$hi;
   i64toi32_i32$0 = $4$hi;
   $93($2_1 + 16 | 0 | 0, $0_1 | 0, i64toi32_i32$5 | 0, $4_1 | 0, i64toi32_i32$0 | 0, $3_1 + -15233 | 0 | 0);
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$5 = $4$hi;
   $94($2_1 | 0, $0_1 | 0, i64toi32_i32$0 | 0, $4_1 | 0, i64toi32_i32$5 | 0, 15361 - $3_1 | 0 | 0);
   i64toi32_i32$4 = $2_1;
   i64toi32_i32$5 = HEAP32[i64toi32_i32$4 >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 4 | 0) >> 2] | 0;
   $4_1 = i64toi32_i32$5;
   $4$hi = i64toi32_i32$0;
   i64toi32_i32$4 = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$2 = 60;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$5 = 0;
    $49_1 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
   } else {
    i64toi32_i32$5 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
    $49_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$3 | 0) | 0;
   }
   $74_1 = $49_1;
   $74$hi = i64toi32_i32$5;
   i64toi32_i32$0 = $2_1 + 8 | 0;
   i64toi32_i32$5 = HEAP32[i64toi32_i32$0 >> 2] | 0;
   i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$2 = 4;
   i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
    i64toi32_i32$5 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
    $50_1 = 0;
   } else {
    i64toi32_i32$5 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$3 | 0) | 0;
    $50_1 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
   }
   $78$hi = i64toi32_i32$5;
   i64toi32_i32$5 = $74$hi;
   i64toi32_i32$4 = $74_1;
   i64toi32_i32$0 = $78$hi;
   i64toi32_i32$2 = $50_1;
   i64toi32_i32$0 = i64toi32_i32$5 | i64toi32_i32$0 | 0;
   $5_1 = i64toi32_i32$4 | i64toi32_i32$2 | 0;
   $5$hi = i64toi32_i32$0;
   label$5 : {
    i64toi32_i32$0 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$4 = 268435455;
    i64toi32_i32$2 = -1;
    i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
    $81_1 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
    $81$hi = i64toi32_i32$4;
    i64toi32_i32$0 = $2_1;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 16 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 20 | 0) >> 2] | 0;
    $83_1 = i64toi32_i32$4;
    $83$hi = i64toi32_i32$5;
    i64toi32_i32$0 = (i64toi32_i32$0 + 16 | 0) + 8 | 0;
    i64toi32_i32$5 = HEAP32[i64toi32_i32$0 >> 2] | 0;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
    $87_1 = i64toi32_i32$5;
    $87$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $83$hi;
    i64toi32_i32$0 = $83_1;
    i64toi32_i32$5 = $87$hi;
    i64toi32_i32$2 = $87_1;
    i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 0;
    $89_1 = (i64toi32_i32$4 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$4 = 0;
    $90$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $81$hi;
    i64toi32_i32$2 = $81_1;
    i64toi32_i32$5 = $90$hi;
    i64toi32_i32$0 = $89_1;
    i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
    $4_1 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
    $4$hi = i64toi32_i32$5;
    i64toi32_i32$4 = $4_1;
    i64toi32_i32$2 = 134217728;
    i64toi32_i32$0 = 1;
    if (i64toi32_i32$5 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$5 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0 | 0) | 0) {
     break label$5
    }
    i64toi32_i32$4 = $5$hi;
    i64toi32_i32$0 = $5_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$2 = 1;
    i64toi32_i32$3 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
    i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $5_1 = i64toi32_i32$3;
    $5$hi = i64toi32_i32$1;
    break label$1;
   }
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$4 = $4_1;
   i64toi32_i32$0 = 134217728;
   i64toi32_i32$2 = 0;
   i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
   i64toi32_i32$1 = i64toi32_i32$4 ^ i64toi32_i32$2 | 0;
   i64toi32_i32$4 = 0;
   i64toi32_i32$2 = 0;
   if ((i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$4 | 0) | 0) {
    break label$1
   }
   i64toi32_i32$1 = $5$hi;
   i64toi32_i32$2 = $5_1;
   i64toi32_i32$0 = 0;
   i64toi32_i32$4 = 1;
   i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
   $100$hi = i64toi32_i32$0;
   i64toi32_i32$0 = i64toi32_i32$1;
   i64toi32_i32$0 = $100$hi;
   i64toi32_i32$1 = i64toi32_i32$2 & i64toi32_i32$4 | 0;
   i64toi32_i32$2 = $5$hi;
   i64toi32_i32$4 = $5_1;
   i64toi32_i32$5 = i64toi32_i32$1 + i64toi32_i32$4 | 0;
   i64toi32_i32$3 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
   if (i64toi32_i32$5 >>> 0 < i64toi32_i32$4 >>> 0) {
    i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
   }
   $5_1 = i64toi32_i32$5;
   $5$hi = i64toi32_i32$3;
  }
  global$0 = $2_1 + 32 | 0;
  i64toi32_i32$3 = $5$hi;
  i64toi32_i32$3 = $1$hi;
  i64toi32_i32$0 = $1_1;
  i64toi32_i32$1 = -2147483648;
  i64toi32_i32$4 = 0;
  i64toi32_i32$1 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
  $107_1 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
  $107$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $5$hi;
  i64toi32_i32$3 = $5_1;
  i64toi32_i32$0 = $107$hi;
  i64toi32_i32$4 = $107_1;
  i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
  wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$3 | i64toi32_i32$4 | 0 | 0);
  wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$0 | 0);
  return +(+wasm2js_scratch_load_f64());
 }
 
 function $96() {
  global$7 = 5247744;
  global$6 = (4852 + 15 | 0) & -16 | 0;
 }
 
 function $97($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  global$7 = $0_1;
  global$6 = $1_1;
 }
 
 function $98() {
  return global$0 - global$6 | 0 | 0;
 }
 
 function $99() {
  return global$6 | 0;
 }
 
 function $100($0_1) {
  $0_1 = $0_1 | 0;
  HEAP32[$0_1 >> 2] = 0;
  return 0 | 0;
 }
 
 function $101($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $2_1 = 0, $3_1 = 0, $4_1 = 0, $5_1 = 0, $20_1 = 0, $28_1 = 0, $32_1 = 0;
  $2_1 = global$0 - 32 | 0;
  $3_1 = $2_1 + 24 | 0;
  HEAP32[$3_1 >> 2] = 0;
  $4_1 = $2_1 + 16 | 0;
  i64toi32_i32$1 = $4_1;
  i64toi32_i32$0 = 0;
  HEAP32[i64toi32_i32$1 >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  $5_1 = $2_1 + 8 | 0;
  i64toi32_i32$1 = $5_1;
  i64toi32_i32$0 = 0;
  HEAP32[i64toi32_i32$1 >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$1 = $2_1;
  i64toi32_i32$0 = 0;
  HEAP32[i64toi32_i32$1 >> 2] = 0;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = i64toi32_i32$1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$1 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] | 0;
  $20_1 = i64toi32_i32$0;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $20_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  HEAP32[(i64toi32_i32$0 + 24 | 0) >> 2] = HEAP32[$3_1 >> 2] | 0;
  i64toi32_i32$2 = $4_1;
  i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $28_1 = i64toi32_i32$1;
  i64toi32_i32$1 = $0_1 + 16 | 0;
  HEAP32[i64toi32_i32$1 >> 2] = $28_1;
  HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$2 = $5_1;
  i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
  $32_1 = i64toi32_i32$0;
  i64toi32_i32$0 = $0_1 + 8 | 0;
  HEAP32[i64toi32_i32$0 >> 2] = $32_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
  label$1 : {
   if (!$1_1) {
    break label$1
   }
   HEAP32[$0_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
  }
  return 0 | 0;
 }
 
 function $102($0_1) {
  $0_1 = $0_1 | 0;
  return 0 | 0;
 }
 
 function $103($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $5_1 = 0, $4_1 = 0, $3_1 = 0, $7_1 = 0, $2_1 = 0, $11_1 = 0, $6_1 = 0, $8_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $9_1 = 0, $10_1 = 0, $84_1 = 0, $97_1 = 0, $108_1 = 0, $116_1 = 0, $124_1 = 0, $218 = 0, $229 = 0, $237 = 0, $245 = 0, $280 = 0, $355 = 0, $362 = 0, $369 = 0, $460 = 0, $471 = 0, $479 = 0, $487 = 0, $1203 = 0, $1210 = 0, $1217 = 0, $1339 = 0, $1341 = 0, $1402 = 0, $1409 = 0, $1416 = 0, $1649 = 0, $1656 = 0, $1663 = 0;
  label$1 : {
   if (HEAP32[(0 + 2660 | 0) >> 2] | 0) {
    break label$1
   }
   $104();
  }
  label$2 : {
   label$3 : {
    if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
     break label$3
    }
    $1_1 = 0;
    if ($39(3132 | 0) | 0) {
     break label$2
    }
   }
   label$4 : {
    label$5 : {
     label$6 : {
      label$7 : {
       label$8 : {
        label$9 : {
         label$10 : {
          label$11 : {
           label$12 : {
            label$13 : {
             label$14 : {
              label$15 : {
               if ($0_1 >>> 0 > 244 >>> 0) {
                break label$15
               }
               label$16 : {
                $2_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
                $3_1 = $0_1 >>> 0 < 11 >>> 0 ? 16 : ($0_1 + 11 | 0) & -8 | 0;
                $1_1 = $3_1 >>> 3 | 0;
                $0_1 = $2_1 >>> $1_1 | 0;
                if (!($0_1 & 3 | 0)) {
                 break label$16
                }
                $3_1 = (($0_1 ^ -1 | 0) & 1 | 0) + $1_1 | 0;
                $4_1 = $3_1 << 3 | 0;
                $0_1 = HEAP32[($4_1 + 2732 | 0) >> 2] | 0;
                $1_1 = $0_1 + 8 | 0;
                label$17 : {
                 label$18 : {
                  $5_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                  $4_1 = $4_1 + 2724 | 0;
                  if (($5_1 | 0) != ($4_1 | 0)) {
                   break label$18
                  }
                  HEAP32[(0 + 2684 | 0) >> 2] = $2_1 & (__wasm_rotl_i32(-2 | 0, $3_1 | 0) | 0) | 0;
                  break label$17;
                 }
                 HEAP32[(0 + 2700 | 0) >> 2] | 0;
                 HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
                 HEAP32[($4_1 + 8 | 0) >> 2] = $5_1;
                }
                $5_1 = $3_1 << 3 | 0;
                HEAP32[($0_1 + 4 | 0) >> 2] = $5_1 | 3 | 0;
                $0_1 = $0_1 + $5_1 | 0;
                HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
                break label$4;
               }
               $6_1 = HEAP32[(0 + 2692 | 0) >> 2] | 0;
               if ($3_1 >>> 0 <= $6_1 >>> 0) {
                break label$14
               }
               label$19 : {
                if (!$0_1) {
                 break label$19
                }
                label$20 : {
                 label$21 : {
                  $84_1 = $0_1 << $1_1 | 0;
                  $0_1 = 2 << $1_1 | 0;
                  $0_1 = $84_1 & ($0_1 | (0 - $0_1 | 0) | 0) | 0;
                  $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                  $97_1 = $0_1;
                  $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                  $1_1 = $97_1 >>> $0_1 | 0;
                  $5_1 = ($1_1 >>> 5 | 0) & 8 | 0;
                  $108_1 = $5_1 | $0_1 | 0;
                  $0_1 = $1_1 >>> $5_1 | 0;
                  $1_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                  $116_1 = $108_1 | $1_1 | 0;
                  $0_1 = $0_1 >>> $1_1 | 0;
                  $1_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                  $124_1 = $116_1 | $1_1 | 0;
                  $0_1 = $0_1 >>> $1_1 | 0;
                  $1_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                  $5_1 = ($124_1 | $1_1 | 0) + ($0_1 >>> $1_1 | 0) | 0;
                  $4_1 = $5_1 << 3 | 0;
                  $0_1 = HEAP32[($4_1 + 2732 | 0) >> 2] | 0;
                  $1_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                  $4_1 = $4_1 + 2724 | 0;
                  if (($1_1 | 0) != ($4_1 | 0)) {
                   break label$21
                  }
                  $2_1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
                  HEAP32[(0 + 2684 | 0) >> 2] = $2_1;
                  break label$20;
                 }
                 HEAP32[(0 + 2700 | 0) >> 2] | 0;
                 HEAP32[($1_1 + 12 | 0) >> 2] = $4_1;
                 HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
                }
                $1_1 = $0_1 + 8 | 0;
                HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
                $4_1 = $0_1 + $3_1 | 0;
                $7_1 = $5_1 << 3 | 0;
                $5_1 = $7_1 - $3_1 | 0;
                HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
                HEAP32[($0_1 + $7_1 | 0) >> 2] = $5_1;
                label$22 : {
                 if (!$6_1) {
                  break label$22
                 }
                 $7_1 = $6_1 >>> 3 | 0;
                 $3_1 = ($7_1 << 3 | 0) + 2724 | 0;
                 $0_1 = HEAP32[(0 + 2704 | 0) >> 2] | 0;
                 label$23 : {
                  label$24 : {
                   $7_1 = 1 << $7_1 | 0;
                   if ($2_1 & $7_1 | 0) {
                    break label$24
                   }
                   HEAP32[(0 + 2684 | 0) >> 2] = $2_1 | $7_1 | 0;
                   $7_1 = $3_1;
                   break label$23;
                  }
                  $7_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
                 }
                 HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
                 HEAP32[($7_1 + 12 | 0) >> 2] = $0_1;
                 HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
                 HEAP32[($0_1 + 8 | 0) >> 2] = $7_1;
                }
                HEAP32[(0 + 2704 | 0) >> 2] = $4_1;
                HEAP32[(0 + 2692 | 0) >> 2] = $5_1;
                break label$4;
               }
               $8_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
               if (!$8_1) {
                break label$14
               }
               $0_1 = ($8_1 & (0 - $8_1 | 0) | 0) + -1 | 0;
               $218 = $0_1;
               $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
               $1_1 = $218 >>> $0_1 | 0;
               $5_1 = ($1_1 >>> 5 | 0) & 8 | 0;
               $229 = $5_1 | $0_1 | 0;
               $0_1 = $1_1 >>> $5_1 | 0;
               $1_1 = ($0_1 >>> 2 | 0) & 4 | 0;
               $237 = $229 | $1_1 | 0;
               $0_1 = $0_1 >>> $1_1 | 0;
               $1_1 = ($0_1 >>> 1 | 0) & 2 | 0;
               $245 = $237 | $1_1 | 0;
               $0_1 = $0_1 >>> $1_1 | 0;
               $1_1 = ($0_1 >>> 1 | 0) & 1 | 0;
               $4_1 = HEAP32[(((($245 | $1_1 | 0) + ($0_1 >>> $1_1 | 0) | 0) << 2 | 0) + 2988 | 0) >> 2] | 0;
               $1_1 = ((HEAP32[($4_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
               $5_1 = $4_1;
               label$25 : {
                label$26 : while (1) {
                 label$27 : {
                  $0_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
                  if ($0_1) {
                   break label$27
                  }
                  $0_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                  if (!$0_1) {
                   break label$25
                  }
                 }
                 $5_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                 $280 = $5_1;
                 $5_1 = $5_1 >>> 0 < $1_1 >>> 0;
                 $1_1 = $5_1 ? $280 : $1_1;
                 $4_1 = $5_1 ? $0_1 : $4_1;
                 $5_1 = $0_1;
                 continue label$26;
                };
               }
               $9_1 = $4_1 + $3_1 | 0;
               if ($9_1 >>> 0 <= $4_1 >>> 0) {
                break label$13
               }
               $10_1 = HEAP32[($4_1 + 24 | 0) >> 2] | 0;
               label$28 : {
                $7_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
                if (($7_1 | 0) == ($4_1 | 0)) {
                 break label$28
                }
                label$29 : {
                 $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
                 if ((HEAP32[(0 + 2700 | 0) >> 2] | 0) >>> 0 > $0_1 >>> 0) {
                  break label$29
                 }
                 HEAP32[($0_1 + 12 | 0) >> 2] | 0;
                }
                HEAP32[($0_1 + 12 | 0) >> 2] = $7_1;
                HEAP32[($7_1 + 8 | 0) >> 2] = $0_1;
                break label$5;
               }
               label$30 : {
                $5_1 = $4_1 + 20 | 0;
                $0_1 = HEAP32[$5_1 >> 2] | 0;
                if ($0_1) {
                 break label$30
                }
                $0_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
                if (!$0_1) {
                 break label$12
                }
                $5_1 = $4_1 + 16 | 0;
               }
               label$31 : while (1) {
                $11_1 = $5_1;
                $7_1 = $0_1;
                $5_1 = $0_1 + 20 | 0;
                $0_1 = HEAP32[$5_1 >> 2] | 0;
                if ($0_1) {
                 continue label$31
                }
                $5_1 = $7_1 + 16 | 0;
                $0_1 = HEAP32[($7_1 + 16 | 0) >> 2] | 0;
                if ($0_1) {
                 continue label$31
                }
                break label$31;
               };
               HEAP32[$11_1 >> 2] = 0;
               break label$5;
              }
              $3_1 = -1;
              if ($0_1 >>> 0 > -65 >>> 0) {
               break label$14
              }
              $0_1 = $0_1 + 11 | 0;
              $3_1 = $0_1 & -8 | 0;
              $6_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
              if (!$6_1) {
               break label$14
              }
              $11_1 = 31;
              label$32 : {
               if ($3_1 >>> 0 > 16777215 >>> 0) {
                break label$32
               }
               $0_1 = $0_1 >>> 8 | 0;
               $355 = $0_1;
               $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
               $1_1 = $355 << $0_1 | 0;
               $362 = $1_1;
               $1_1 = (($1_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
               $5_1 = $362 << $1_1 | 0;
               $369 = $5_1;
               $5_1 = (($5_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
               $0_1 = (($369 << $5_1 | 0) >>> 15 | 0) - ($0_1 | $1_1 | 0 | $5_1 | 0) | 0;
               $11_1 = ($0_1 << 1 | 0 | (($3_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
              }
              $1_1 = 0 - $3_1 | 0;
              label$33 : {
               label$34 : {
                label$35 : {
                 label$36 : {
                  $5_1 = HEAP32[(($11_1 << 2 | 0) + 2988 | 0) >> 2] | 0;
                  if ($5_1) {
                   break label$36
                  }
                  $0_1 = 0;
                  $7_1 = 0;
                  break label$35;
                 }
                 $0_1 = 0;
                 $4_1 = $3_1 << (($11_1 | 0) == (31 | 0) ? 0 : 25 - ($11_1 >>> 1 | 0) | 0) | 0;
                 $7_1 = 0;
                 label$37 : while (1) {
                  label$38 : {
                   $2_1 = ((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                   if ($2_1 >>> 0 >= $1_1 >>> 0) {
                    break label$38
                   }
                   $1_1 = $2_1;
                   $7_1 = $5_1;
                   if ($1_1) {
                    break label$38
                   }
                   $1_1 = 0;
                   $7_1 = $5_1;
                   $0_1 = $5_1;
                   break label$34;
                  }
                  $2_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
                  $5_1 = HEAP32[(($5_1 + (($4_1 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
                  $0_1 = $2_1 ? (($2_1 | 0) == ($5_1 | 0) ? $0_1 : $2_1) : $0_1;
                  $4_1 = $4_1 << 1 | 0;
                  if ($5_1) {
                   continue label$37
                  }
                  break label$37;
                 };
                }
                label$39 : {
                 if ($0_1 | $7_1 | 0) {
                  break label$39
                 }
                 $0_1 = 2 << $11_1 | 0;
                 $0_1 = ($0_1 | (0 - $0_1 | 0) | 0) & $6_1 | 0;
                 if (!$0_1) {
                  break label$14
                 }
                 $0_1 = ($0_1 & (0 - $0_1 | 0) | 0) + -1 | 0;
                 $460 = $0_1;
                 $0_1 = ($0_1 >>> 12 | 0) & 16 | 0;
                 $5_1 = $460 >>> $0_1 | 0;
                 $4_1 = ($5_1 >>> 5 | 0) & 8 | 0;
                 $471 = $4_1 | $0_1 | 0;
                 $0_1 = $5_1 >>> $4_1 | 0;
                 $5_1 = ($0_1 >>> 2 | 0) & 4 | 0;
                 $479 = $471 | $5_1 | 0;
                 $0_1 = $0_1 >>> $5_1 | 0;
                 $5_1 = ($0_1 >>> 1 | 0) & 2 | 0;
                 $487 = $479 | $5_1 | 0;
                 $0_1 = $0_1 >>> $5_1 | 0;
                 $5_1 = ($0_1 >>> 1 | 0) & 1 | 0;
                 $0_1 = HEAP32[(((($487 | $5_1 | 0) + ($0_1 >>> $5_1 | 0) | 0) << 2 | 0) + 2988 | 0) >> 2] | 0;
                }
                if (!$0_1) {
                 break label$33
                }
               }
               label$40 : while (1) {
                $2_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
                $4_1 = $2_1 >>> 0 < $1_1 >>> 0;
                label$41 : {
                 $5_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
                 if ($5_1) {
                  break label$41
                 }
                 $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
                }
                $1_1 = $4_1 ? $2_1 : $1_1;
                $7_1 = $4_1 ? $0_1 : $7_1;
                $0_1 = $5_1;
                if ($0_1) {
                 continue label$40
                }
                break label$40;
               };
              }
              if (!$7_1) {
               break label$14
              }
              if ($1_1 >>> 0 >= ((HEAP32[(0 + 2692 | 0) >> 2] | 0) - $3_1 | 0) >>> 0) {
               break label$14
              }
              $11_1 = $7_1 + $3_1 | 0;
              if ($11_1 >>> 0 <= $7_1 >>> 0) {
               break label$13
              }
              $8_1 = HEAP32[($7_1 + 24 | 0) >> 2] | 0;
              label$42 : {
               $4_1 = HEAP32[($7_1 + 12 | 0) >> 2] | 0;
               if (($4_1 | 0) == ($7_1 | 0)) {
                break label$42
               }
               label$43 : {
                $0_1 = HEAP32[($7_1 + 8 | 0) >> 2] | 0;
                if ((HEAP32[(0 + 2700 | 0) >> 2] | 0) >>> 0 > $0_1 >>> 0) {
                 break label$43
                }
                HEAP32[($0_1 + 12 | 0) >> 2] | 0;
               }
               HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
               HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
               break label$6;
              }
              label$44 : {
               $5_1 = $7_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                break label$44
               }
               $0_1 = HEAP32[($7_1 + 16 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$11
               }
               $5_1 = $7_1 + 16 | 0;
              }
              label$45 : while (1) {
               $2_1 = $5_1;
               $4_1 = $0_1;
               $5_1 = $0_1 + 20 | 0;
               $0_1 = HEAP32[$5_1 >> 2] | 0;
               if ($0_1) {
                continue label$45
               }
               $5_1 = $4_1 + 16 | 0;
               $0_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
               if ($0_1) {
                continue label$45
               }
               break label$45;
              };
              HEAP32[$2_1 >> 2] = 0;
              break label$6;
             }
             label$46 : {
              $0_1 = HEAP32[(0 + 2692 | 0) >> 2] | 0;
              if ($0_1 >>> 0 < $3_1 >>> 0) {
               break label$46
              }
              $1_1 = HEAP32[(0 + 2704 | 0) >> 2] | 0;
              label$47 : {
               label$48 : {
                $5_1 = $0_1 - $3_1 | 0;
                if ($5_1 >>> 0 < 16 >>> 0) {
                 break label$48
                }
                HEAP32[(0 + 2692 | 0) >> 2] = $5_1;
                $4_1 = $1_1 + $3_1 | 0;
                HEAP32[(0 + 2704 | 0) >> 2] = $4_1;
                HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
                HEAP32[($1_1 + $0_1 | 0) >> 2] = $5_1;
                HEAP32[($1_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
                break label$47;
               }
               HEAP32[(0 + 2704 | 0) >> 2] = 0;
               HEAP32[(0 + 2692 | 0) >> 2] = 0;
               HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
               $0_1 = $1_1 + $0_1 | 0;
               HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
              }
              $1_1 = $1_1 + 8 | 0;
              break label$4;
             }
             label$49 : {
              $0_1 = HEAP32[(0 + 2696 | 0) >> 2] | 0;
              if ($0_1 >>> 0 <= $3_1 >>> 0) {
               break label$49
              }
              $1_1 = $0_1 - $3_1 | 0;
              HEAP32[(0 + 2696 | 0) >> 2] = $1_1;
              $0_1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
              $5_1 = $0_1 + $3_1 | 0;
              HEAP32[(0 + 2708 | 0) >> 2] = $5_1;
              HEAP32[($5_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
              HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
              $1_1 = $0_1 + 8 | 0;
              break label$4;
             }
             $1_1 = 0;
             label$50 : {
              if (HEAP32[(0 + 2660 | 0) >> 2] | 0) {
               break label$50
              }
              $104();
             }
             $0_1 = HEAP32[(0 + 2668 | 0) >> 2] | 0;
             $11_1 = $3_1 + 47 | 0;
             $7_1 = ($0_1 + $11_1 | 0) & (0 - $0_1 | 0) | 0;
             if ($7_1 >>> 0 <= $3_1 >>> 0) {
              break label$4
             }
             $1_1 = 0;
             label$51 : {
              $0_1 = HEAP32[(0 + 3124 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$51
              }
              $5_1 = HEAP32[(0 + 3116 | 0) >> 2] | 0;
              $4_1 = $5_1 + $7_1 | 0;
              if ($4_1 >>> 0 <= $5_1 >>> 0) {
               break label$4
              }
              if ($4_1 >>> 0 > $0_1 >>> 0) {
               break label$4
              }
             }
             $2_1 = 0;
             $4_1 = -1;
             if ((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 4 | 0) {
              break label$7
             }
             $6_1 = 0;
             label$52 : {
              label$53 : {
               label$54 : {
                $1_1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
                if (!$1_1) {
                 break label$54
                }
                $0_1 = 3160;
                label$55 : while (1) {
                 label$56 : {
                  $5_1 = HEAP32[$0_1 >> 2] | 0;
                  if ($5_1 >>> 0 > $1_1 >>> 0) {
                   break label$56
                  }
                  if (($5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0) >>> 0 > $1_1 >>> 0) {
                   break label$53
                  }
                 }
                 $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                 if ($0_1) {
                  continue label$55
                 }
                 break label$55;
                };
               }
               $39(3184 | 0) | 0;
               $4_1 = $109(0 | 0) | 0;
               if (($4_1 | 0) == (-1 | 0)) {
                break label$9
               }
               $2_1 = $7_1;
               label$57 : {
                $0_1 = HEAP32[(0 + 2664 | 0) >> 2] | 0;
                $1_1 = $0_1 + -1 | 0;
                if (!($1_1 & $4_1 | 0)) {
                 break label$57
                }
                $2_1 = ($7_1 - $4_1 | 0) + (($1_1 + $4_1 | 0) & (0 - $0_1 | 0) | 0) | 0;
               }
               label$58 : {
                if ($2_1 >>> 0 > $3_1 >>> 0) {
                 break label$58
                }
                $6_1 = 0;
                break label$9;
               }
               label$59 : {
                if ($2_1 >>> 0 <= 2147483646 >>> 0) {
                 break label$59
                }
                $6_1 = 0;
                break label$9;
               }
               $6_1 = 0;
               label$60 : {
                $0_1 = HEAP32[(0 + 3124 | 0) >> 2] | 0;
                if (!$0_1) {
                 break label$60
                }
                $1_1 = HEAP32[(0 + 3116 | 0) >> 2] | 0;
                $5_1 = $1_1 + $2_1 | 0;
                if ($5_1 >>> 0 <= $1_1 >>> 0) {
                 break label$9
                }
                if ($5_1 >>> 0 > $0_1 >>> 0) {
                 break label$9
                }
               }
               $0_1 = $109($2_1 | 0) | 0;
               if (($0_1 | 0) != ($4_1 | 0)) {
                break label$52
               }
               break label$8;
              }
              $39(3184 | 0) | 0;
              $6_1 = 0;
              $1_1 = HEAP32[(0 + 2668 | 0) >> 2] | 0;
              $2_1 = (($11_1 - (HEAP32[(0 + 2696 | 0) >> 2] | 0) | 0) + $1_1 | 0) & (0 - $1_1 | 0) | 0;
              if ($2_1 >>> 0 > 2147483646 >>> 0) {
               break label$9
              }
              $4_1 = $109($2_1 | 0) | 0;
              if (($4_1 | 0) == ((HEAP32[$0_1 >> 2] | 0) + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0 | 0)) {
               break label$10
              }
              $0_1 = $4_1;
             }
             $6_1 = 0;
             label$61 : {
              if (($3_1 + 48 | 0) >>> 0 <= $2_1 >>> 0) {
               break label$61
              }
              if (($0_1 | 0) == (-1 | 0)) {
               break label$61
              }
              label$62 : {
               $1_1 = HEAP32[(0 + 2668 | 0) >> 2] | 0;
               $1_1 = (($11_1 - $2_1 | 0) + $1_1 | 0) & (0 - $1_1 | 0) | 0;
               if ($1_1 >>> 0 <= 2147483646 >>> 0) {
                break label$62
               }
               $4_1 = $0_1;
               break label$8;
              }
              label$63 : {
               if (($109($1_1 | 0) | 0 | 0) == (-1 | 0)) {
                break label$63
               }
               $2_1 = $1_1 + $2_1 | 0;
               $4_1 = $0_1;
               break label$8;
              }
              $109(0 - $2_1 | 0 | 0) | 0;
              $6_1 = 0;
              break label$9;
             }
             $4_1 = $0_1;
             if (($0_1 | 0) != (-1 | 0)) {
              break label$8
             }
             break label$9;
            }
            abort();
           }
           $7_1 = 0;
           break label$5;
          }
          $4_1 = 0;
          break label$6;
         }
         $6_1 = $2_1;
         if (($4_1 | 0) != (-1 | 0)) {
          break label$8
         }
        }
        HEAP32[(0 + 3128 | 0) >> 2] = HEAP32[(0 + 3128 | 0) >> 2] | 0 | 4 | 0;
        $4_1 = -1;
        $2_1 = $6_1;
       }
       $46(3184 | 0) | 0;
      }
      label$64 : {
       label$65 : {
        label$66 : {
         if ($7_1 >>> 0 > 2147483646 >>> 0) {
          break label$66
         }
         if (($4_1 | 0) != (-1 | 0)) {
          break label$66
         }
         $39(3184 | 0) | 0;
         $4_1 = $109($7_1 | 0) | 0;
         $0_1 = $109(0 | 0) | 0;
         $46(3184 | 0) | 0;
         if ($4_1 >>> 0 >= $0_1 >>> 0) {
          break label$64
         }
         if (($4_1 | 0) == (-1 | 0)) {
          break label$64
         }
         if (($0_1 | 0) == (-1 | 0)) {
          break label$64
         }
         $2_1 = $0_1 - $4_1 | 0;
         if ($2_1 >>> 0 > ($3_1 + 40 | 0) >>> 0) {
          break label$65
         }
         break label$64;
        }
        if (($4_1 | 0) == (-1 | 0)) {
         break label$64
        }
       }
       $0_1 = (HEAP32[(0 + 3116 | 0) >> 2] | 0) + $2_1 | 0;
       HEAP32[(0 + 3116 | 0) >> 2] = $0_1;
       label$67 : {
        if ($0_1 >>> 0 <= (HEAP32[(0 + 3120 | 0) >> 2] | 0) >>> 0) {
         break label$67
        }
        HEAP32[(0 + 3120 | 0) >> 2] = $0_1;
       }
       label$68 : {
        label$69 : {
         label$70 : {
          label$71 : {
           $1_1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
           if (!$1_1) {
            break label$71
           }
           $0_1 = 3160;
           label$72 : while (1) {
            $5_1 = HEAP32[$0_1 >> 2] | 0;
            $7_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
            if (($4_1 | 0) == ($5_1 + $7_1 | 0 | 0)) {
             break label$70
            }
            $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
            if ($0_1) {
             continue label$72
            }
            break label$69;
           };
          }
          label$73 : {
           label$74 : {
            $0_1 = HEAP32[(0 + 2700 | 0) >> 2] | 0;
            if (!$0_1) {
             break label$74
            }
            if ($4_1 >>> 0 >= $0_1 >>> 0) {
             break label$73
            }
           }
           HEAP32[(0 + 2700 | 0) >> 2] = $4_1;
          }
          $0_1 = 0;
          HEAP32[(0 + 3164 | 0) >> 2] = $2_1;
          HEAP32[(0 + 3160 | 0) >> 2] = $4_1;
          HEAP32[(0 + 2716 | 0) >> 2] = -1;
          HEAP32[(0 + 2720 | 0) >> 2] = HEAP32[(0 + 2660 | 0) >> 2] | 0;
          HEAP32[(0 + 3172 | 0) >> 2] = 0;
          label$75 : while (1) {
           $1_1 = $0_1 << 3 | 0;
           $5_1 = $1_1 + 2724 | 0;
           HEAP32[($1_1 + 2732 | 0) >> 2] = $5_1;
           HEAP32[($1_1 + 2736 | 0) >> 2] = $5_1;
           $0_1 = $0_1 + 1 | 0;
           if (($0_1 | 0) != (32 | 0)) {
            continue label$75
           }
           break label$75;
          };
          $0_1 = $2_1 + -40 | 0;
          $1_1 = ($4_1 + 8 | 0) & 7 | 0 ? (-8 - $4_1 | 0) & 7 | 0 : 0;
          $5_1 = $0_1 - $1_1 | 0;
          HEAP32[(0 + 2696 | 0) >> 2] = $5_1;
          $1_1 = $4_1 + $1_1 | 0;
          HEAP32[(0 + 2708 | 0) >> 2] = $1_1;
          HEAP32[($1_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
          HEAP32[(($4_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
          HEAP32[(0 + 2712 | 0) >> 2] = HEAP32[(0 + 2676 | 0) >> 2] | 0;
          break label$68;
         }
         if ((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0) {
          break label$69
         }
         if ($4_1 >>> 0 <= $1_1 >>> 0) {
          break label$69
         }
         if ($5_1 >>> 0 > $1_1 >>> 0) {
          break label$69
         }
         HEAP32[($0_1 + 4 | 0) >> 2] = $7_1 + $2_1 | 0;
         $0_1 = ($1_1 + 8 | 0) & 7 | 0 ? (-8 - $1_1 | 0) & 7 | 0 : 0;
         $5_1 = $1_1 + $0_1 | 0;
         HEAP32[(0 + 2708 | 0) >> 2] = $5_1;
         $4_1 = (HEAP32[(0 + 2696 | 0) >> 2] | 0) + $2_1 | 0;
         $0_1 = $4_1 - $0_1 | 0;
         HEAP32[(0 + 2696 | 0) >> 2] = $0_1;
         HEAP32[($5_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
         HEAP32[(($1_1 + $4_1 | 0) + 4 | 0) >> 2] = 40;
         HEAP32[(0 + 2712 | 0) >> 2] = HEAP32[(0 + 2676 | 0) >> 2] | 0;
         break label$68;
        }
        label$76 : {
         $7_1 = HEAP32[(0 + 2700 | 0) >> 2] | 0;
         if ($4_1 >>> 0 >= $7_1 >>> 0) {
          break label$76
         }
         HEAP32[(0 + 2700 | 0) >> 2] = $4_1;
         $7_1 = $4_1;
        }
        $5_1 = $4_1 + $2_1 | 0;
        $0_1 = 3160;
        label$77 : {
         label$78 : {
          label$79 : {
           label$80 : {
            label$81 : {
             label$82 : {
              label$83 : {
               label$84 : while (1) {
                if ((HEAP32[$0_1 >> 2] | 0 | 0) == ($5_1 | 0)) {
                 break label$83
                }
                $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
                if ($0_1) {
                 continue label$84
                }
                break label$82;
               };
              }
              if (!((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0)) {
               break label$81
              }
             }
             $0_1 = 3160;
             label$85 : while (1) {
              label$86 : {
               $5_1 = HEAP32[$0_1 >> 2] | 0;
               if ($5_1 >>> 0 > $1_1 >>> 0) {
                break label$86
               }
               $5_1 = $5_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0;
               if ($5_1 >>> 0 > $1_1 >>> 0) {
                break label$80
               }
              }
              $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
              continue label$85;
             };
            }
            HEAP32[$0_1 >> 2] = $4_1;
            HEAP32[($0_1 + 4 | 0) >> 2] = (HEAP32[($0_1 + 4 | 0) >> 2] | 0) + $2_1 | 0;
            $11_1 = $4_1 + (($4_1 + 8 | 0) & 7 | 0 ? (-8 - $4_1 | 0) & 7 | 0 : 0) | 0;
            HEAP32[($11_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
            $2_1 = $5_1 + (($5_1 + 8 | 0) & 7 | 0 ? (-8 - $5_1 | 0) & 7 | 0 : 0) | 0;
            $5_1 = ($2_1 - $11_1 | 0) - $3_1 | 0;
            $3_1 = $11_1 + $3_1 | 0;
            label$87 : {
             if (($1_1 | 0) != ($2_1 | 0)) {
              break label$87
             }
             HEAP32[(0 + 2708 | 0) >> 2] = $3_1;
             $0_1 = (HEAP32[(0 + 2696 | 0) >> 2] | 0) + $5_1 | 0;
             HEAP32[(0 + 2696 | 0) >> 2] = $0_1;
             HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
             break label$78;
            }
            label$88 : {
             if ((HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
              break label$88
             }
             HEAP32[(0 + 2704 | 0) >> 2] = $3_1;
             $0_1 = (HEAP32[(0 + 2692 | 0) >> 2] | 0) + $5_1 | 0;
             HEAP32[(0 + 2692 | 0) >> 2] = $0_1;
             HEAP32[($3_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
             HEAP32[($3_1 + $0_1 | 0) >> 2] = $0_1;
             break label$78;
            }
            label$89 : {
             $0_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
             if (($0_1 & 3 | 0 | 0) != (1 | 0)) {
              break label$89
             }
             $6_1 = $0_1 & -8 | 0;
             label$90 : {
              label$91 : {
               if ($0_1 >>> 0 > 255 >>> 0) {
                break label$91
               }
               $1_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
               label$92 : {
                $4_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
                $8_1 = $0_1 >>> 3 | 0;
                $0_1 = ($8_1 << 3 | 0) + 2724 | 0;
                if (($4_1 | 0) == ($0_1 | 0)) {
                 break label$92
                }
               }
               label$93 : {
                if (($1_1 | 0) != ($4_1 | 0)) {
                 break label$93
                }
                HEAP32[(0 + 2684 | 0) >> 2] = (HEAP32[(0 + 2684 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0;
                break label$90;
               }
               label$94 : {
                if (($1_1 | 0) == ($0_1 | 0)) {
                 break label$94
                }
               }
               HEAP32[($4_1 + 12 | 0) >> 2] = $1_1;
               HEAP32[($1_1 + 8 | 0) >> 2] = $4_1;
               break label$90;
              }
              $8_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
              label$95 : {
               label$96 : {
                $4_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
                if (($4_1 | 0) == ($2_1 | 0)) {
                 break label$96
                }
                label$97 : {
                 $0_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
                 if ($7_1 >>> 0 > $0_1 >>> 0) {
                  break label$97
                 }
                 HEAP32[($0_1 + 12 | 0) >> 2] | 0;
                }
                HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
                HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
                break label$95;
               }
               label$98 : {
                $0_1 = $2_1 + 20 | 0;
                $1_1 = HEAP32[$0_1 >> 2] | 0;
                if ($1_1) {
                 break label$98
                }
                $0_1 = $2_1 + 16 | 0;
                $1_1 = HEAP32[$0_1 >> 2] | 0;
                if ($1_1) {
                 break label$98
                }
                $4_1 = 0;
                break label$95;
               }
               label$99 : while (1) {
                $7_1 = $0_1;
                $4_1 = $1_1;
                $0_1 = $1_1 + 20 | 0;
                $1_1 = HEAP32[$0_1 >> 2] | 0;
                if ($1_1) {
                 continue label$99
                }
                $0_1 = $4_1 + 16 | 0;
                $1_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
                if ($1_1) {
                 continue label$99
                }
                break label$99;
               };
               HEAP32[$7_1 >> 2] = 0;
              }
              if (!$8_1) {
               break label$90
              }
              label$100 : {
               label$101 : {
                $1_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
                $0_1 = ($1_1 << 2 | 0) + 2988 | 0;
                if ((HEAP32[$0_1 >> 2] | 0 | 0) != ($2_1 | 0)) {
                 break label$101
                }
                HEAP32[$0_1 >> 2] = $4_1;
                if ($4_1) {
                 break label$100
                }
                HEAP32[(0 + 2688 | 0) >> 2] = (HEAP32[(0 + 2688 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $1_1 | 0) | 0) | 0;
                break label$90;
               }
               HEAP32[($8_1 + ((HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) == ($2_1 | 0) ? 16 : 20) | 0) >> 2] = $4_1;
               if (!$4_1) {
                break label$90
               }
              }
              HEAP32[($4_1 + 24 | 0) >> 2] = $8_1;
              label$102 : {
               $0_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
               if (!$0_1) {
                break label$102
               }
               HEAP32[($4_1 + 16 | 0) >> 2] = $0_1;
               HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
              }
              $0_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
              if (!$0_1) {
               break label$90
              }
              HEAP32[($4_1 + 20 | 0) >> 2] = $0_1;
              HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
             }
             $5_1 = $6_1 + $5_1 | 0;
             $2_1 = $2_1 + $6_1 | 0;
            }
            HEAP32[($2_1 + 4 | 0) >> 2] = (HEAP32[($2_1 + 4 | 0) >> 2] | 0) & -2 | 0;
            HEAP32[($3_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
            HEAP32[($3_1 + $5_1 | 0) >> 2] = $5_1;
            label$103 : {
             if ($5_1 >>> 0 > 255 >>> 0) {
              break label$103
             }
             $1_1 = $5_1 >>> 3 | 0;
             $0_1 = ($1_1 << 3 | 0) + 2724 | 0;
             label$104 : {
              label$105 : {
               $5_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
               $1_1 = 1 << $1_1 | 0;
               if ($5_1 & $1_1 | 0) {
                break label$105
               }
               HEAP32[(0 + 2684 | 0) >> 2] = $5_1 | $1_1 | 0;
               $1_1 = $0_1;
               break label$104;
              }
              $1_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
             }
             HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
             HEAP32[($1_1 + 12 | 0) >> 2] = $3_1;
             HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
             HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
             break label$78;
            }
            $0_1 = 31;
            label$106 : {
             if ($5_1 >>> 0 > 16777215 >>> 0) {
              break label$106
             }
             $0_1 = $5_1 >>> 8 | 0;
             $1203 = $0_1;
             $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
             $1_1 = $1203 << $0_1 | 0;
             $1210 = $1_1;
             $1_1 = (($1_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
             $4_1 = $1210 << $1_1 | 0;
             $1217 = $4_1;
             $4_1 = (($4_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
             $0_1 = (($1217 << $4_1 | 0) >>> 15 | 0) - ($0_1 | $1_1 | 0 | $4_1 | 0) | 0;
             $0_1 = ($0_1 << 1 | 0 | (($5_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
            }
            HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
            i64toi32_i32$1 = $3_1;
            i64toi32_i32$0 = 0;
            HEAP32[($3_1 + 16 | 0) >> 2] = 0;
            HEAP32[($3_1 + 20 | 0) >> 2] = i64toi32_i32$0;
            $1_1 = ($0_1 << 2 | 0) + 2988 | 0;
            label$107 : {
             label$108 : {
              $4_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
              $7_1 = 1 << $0_1 | 0;
              if ($4_1 & $7_1 | 0) {
               break label$108
              }
              HEAP32[(0 + 2688 | 0) >> 2] = $4_1 | $7_1 | 0;
              HEAP32[$1_1 >> 2] = $3_1;
              HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
              break label$107;
             }
             $0_1 = $5_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
             $4_1 = HEAP32[$1_1 >> 2] | 0;
             label$109 : while (1) {
              $1_1 = $4_1;
              if (((HEAP32[($1_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($5_1 | 0)) {
               break label$79
              }
              $4_1 = $0_1 >>> 29 | 0;
              $0_1 = $0_1 << 1 | 0;
              $7_1 = ($1_1 + ($4_1 & 4 | 0) | 0) + 16 | 0;
              $4_1 = HEAP32[$7_1 >> 2] | 0;
              if ($4_1) {
               continue label$109
              }
              break label$109;
             };
             HEAP32[$7_1 >> 2] = $3_1;
             HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
            }
            HEAP32[($3_1 + 12 | 0) >> 2] = $3_1;
            HEAP32[($3_1 + 8 | 0) >> 2] = $3_1;
            break label$78;
           }
           $0_1 = $2_1 + -40 | 0;
           $7_1 = ($4_1 + 8 | 0) & 7 | 0 ? (-8 - $4_1 | 0) & 7 | 0 : 0;
           $11_1 = $0_1 - $7_1 | 0;
           HEAP32[(0 + 2696 | 0) >> 2] = $11_1;
           $7_1 = $4_1 + $7_1 | 0;
           HEAP32[(0 + 2708 | 0) >> 2] = $7_1;
           HEAP32[($7_1 + 4 | 0) >> 2] = $11_1 | 1 | 0;
           HEAP32[(($4_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
           HEAP32[(0 + 2712 | 0) >> 2] = HEAP32[(0 + 2676 | 0) >> 2] | 0;
           $0_1 = ($5_1 + (($5_1 + -39 | 0) & 7 | 0 ? (39 - $5_1 | 0) & 7 | 0 : 0) | 0) + -47 | 0;
           $7_1 = $0_1 >>> 0 < ($1_1 + 16 | 0) >>> 0 ? $1_1 : $0_1;
           HEAP32[($7_1 + 4 | 0) >> 2] = 27;
           i64toi32_i32$2 = 0;
           i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 3168 | 0) >> 2] | 0;
           i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 3172 | 0) >> 2] | 0;
           $1339 = i64toi32_i32$0;
           i64toi32_i32$0 = $7_1 + 16 | 0;
           HEAP32[i64toi32_i32$0 >> 2] = $1339;
           HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$1;
           i64toi32_i32$2 = 0;
           i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 3160 | 0) >> 2] | 0;
           i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 3164 | 0) >> 2] | 0;
           $1341 = i64toi32_i32$1;
           i64toi32_i32$1 = $7_1;
           HEAP32[($7_1 + 8 | 0) >> 2] = $1341;
           HEAP32[($7_1 + 12 | 0) >> 2] = i64toi32_i32$0;
           HEAP32[(0 + 3168 | 0) >> 2] = $7_1 + 8 | 0;
           HEAP32[(0 + 3164 | 0) >> 2] = $2_1;
           HEAP32[(0 + 3160 | 0) >> 2] = $4_1;
           HEAP32[(0 + 3172 | 0) >> 2] = 0;
           $0_1 = $7_1 + 24 | 0;
           label$110 : while (1) {
            HEAP32[($0_1 + 4 | 0) >> 2] = 7;
            $4_1 = $0_1 + 8 | 0;
            $0_1 = $0_1 + 4 | 0;
            if ($5_1 >>> 0 > $4_1 >>> 0) {
             continue label$110
            }
            break label$110;
           };
           if (($7_1 | 0) == ($1_1 | 0)) {
            break label$68
           }
           HEAP32[($7_1 + 4 | 0) >> 2] = (HEAP32[($7_1 + 4 | 0) >> 2] | 0) & -2 | 0;
           $2_1 = $7_1 - $1_1 | 0;
           HEAP32[($1_1 + 4 | 0) >> 2] = $2_1 | 1 | 0;
           HEAP32[$7_1 >> 2] = $2_1;
           label$111 : {
            if ($2_1 >>> 0 > 255 >>> 0) {
             break label$111
            }
            $5_1 = $2_1 >>> 3 | 0;
            $0_1 = ($5_1 << 3 | 0) + 2724 | 0;
            label$112 : {
             label$113 : {
              $4_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
              $5_1 = 1 << $5_1 | 0;
              if ($4_1 & $5_1 | 0) {
               break label$113
              }
              HEAP32[(0 + 2684 | 0) >> 2] = $4_1 | $5_1 | 0;
              $5_1 = $0_1;
              break label$112;
             }
             $5_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
            }
            HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
            HEAP32[($5_1 + 12 | 0) >> 2] = $1_1;
            HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
            HEAP32[($1_1 + 8 | 0) >> 2] = $5_1;
            break label$68;
           }
           $0_1 = 31;
           label$114 : {
            if ($2_1 >>> 0 > 16777215 >>> 0) {
             break label$114
            }
            $0_1 = $2_1 >>> 8 | 0;
            $1402 = $0_1;
            $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
            $5_1 = $1402 << $0_1 | 0;
            $1409 = $5_1;
            $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
            $4_1 = $1409 << $5_1 | 0;
            $1416 = $4_1;
            $4_1 = (($4_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
            $0_1 = (($1416 << $4_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $4_1 | 0) | 0;
            $0_1 = ($0_1 << 1 | 0 | (($2_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
           }
           i64toi32_i32$1 = $1_1;
           i64toi32_i32$0 = 0;
           HEAP32[($1_1 + 16 | 0) >> 2] = 0;
           HEAP32[($1_1 + 20 | 0) >> 2] = i64toi32_i32$0;
           HEAP32[($1_1 + 28 | 0) >> 2] = $0_1;
           $5_1 = ($0_1 << 2 | 0) + 2988 | 0;
           label$115 : {
            label$116 : {
             $4_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
             $7_1 = 1 << $0_1 | 0;
             if ($4_1 & $7_1 | 0) {
              break label$116
             }
             HEAP32[(0 + 2688 | 0) >> 2] = $4_1 | $7_1 | 0;
             HEAP32[$5_1 >> 2] = $1_1;
             HEAP32[($1_1 + 24 | 0) >> 2] = $5_1;
             break label$115;
            }
            $0_1 = $2_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
            $4_1 = HEAP32[$5_1 >> 2] | 0;
            label$117 : while (1) {
             $5_1 = $4_1;
             if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($2_1 | 0)) {
              break label$77
             }
             $4_1 = $0_1 >>> 29 | 0;
             $0_1 = $0_1 << 1 | 0;
             $7_1 = ($5_1 + ($4_1 & 4 | 0) | 0) + 16 | 0;
             $4_1 = HEAP32[$7_1 >> 2] | 0;
             if ($4_1) {
              continue label$117
             }
             break label$117;
            };
            HEAP32[$7_1 >> 2] = $1_1;
            HEAP32[($1_1 + 24 | 0) >> 2] = $5_1;
           }
           HEAP32[($1_1 + 12 | 0) >> 2] = $1_1;
           HEAP32[($1_1 + 8 | 0) >> 2] = $1_1;
           break label$68;
          }
          $0_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
          HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
          HEAP32[($1_1 + 8 | 0) >> 2] = $3_1;
          HEAP32[($3_1 + 24 | 0) >> 2] = 0;
          HEAP32[($3_1 + 12 | 0) >> 2] = $1_1;
          HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
         }
         $1_1 = $11_1 + 8 | 0;
         break label$4;
        }
        $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
        HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
        HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
        HEAP32[($1_1 + 24 | 0) >> 2] = 0;
        HEAP32[($1_1 + 12 | 0) >> 2] = $5_1;
        HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
       }
       $0_1 = HEAP32[(0 + 2696 | 0) >> 2] | 0;
       if ($0_1 >>> 0 <= $3_1 >>> 0) {
        break label$64
       }
       $1_1 = $0_1 - $3_1 | 0;
       HEAP32[(0 + 2696 | 0) >> 2] = $1_1;
       $0_1 = HEAP32[(0 + 2708 | 0) >> 2] | 0;
       $5_1 = $0_1 + $3_1 | 0;
       HEAP32[(0 + 2708 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
       HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
       $1_1 = $0_1 + 8 | 0;
       break label$4;
      }
      HEAP32[($13() | 0) >> 2] = 48;
      $1_1 = 0;
      break label$4;
     }
     label$118 : {
      if (!$8_1) {
       break label$118
      }
      label$119 : {
       label$120 : {
        $5_1 = HEAP32[($7_1 + 28 | 0) >> 2] | 0;
        $0_1 = ($5_1 << 2 | 0) + 2988 | 0;
        if (($7_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
         break label$120
        }
        HEAP32[$0_1 >> 2] = $4_1;
        if ($4_1) {
         break label$119
        }
        $6_1 = $6_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
        HEAP32[(0 + 2688 | 0) >> 2] = $6_1;
        break label$118;
       }
       HEAP32[($8_1 + ((HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) == ($7_1 | 0) ? 16 : 20) | 0) >> 2] = $4_1;
       if (!$4_1) {
        break label$118
       }
      }
      HEAP32[($4_1 + 24 | 0) >> 2] = $8_1;
      label$121 : {
       $0_1 = HEAP32[($7_1 + 16 | 0) >> 2] | 0;
       if (!$0_1) {
        break label$121
       }
       HEAP32[($4_1 + 16 | 0) >> 2] = $0_1;
       HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
      }
      $0_1 = HEAP32[($7_1 + 20 | 0) >> 2] | 0;
      if (!$0_1) {
       break label$118
      }
      HEAP32[($4_1 + 20 | 0) >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $4_1;
     }
     label$122 : {
      label$123 : {
       if ($1_1 >>> 0 > 15 >>> 0) {
        break label$123
       }
       $0_1 = $1_1 + $3_1 | 0;
       HEAP32[($7_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
       $0_1 = $7_1 + $0_1 | 0;
       HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
       break label$122;
      }
      HEAP32[($7_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
      HEAP32[($11_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      HEAP32[($11_1 + $1_1 | 0) >> 2] = $1_1;
      label$124 : {
       if ($1_1 >>> 0 > 255 >>> 0) {
        break label$124
       }
       $1_1 = $1_1 >>> 3 | 0;
       $0_1 = ($1_1 << 3 | 0) + 2724 | 0;
       label$125 : {
        label$126 : {
         $5_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
         $1_1 = 1 << $1_1 | 0;
         if ($5_1 & $1_1 | 0) {
          break label$126
         }
         HEAP32[(0 + 2684 | 0) >> 2] = $5_1 | $1_1 | 0;
         $1_1 = $0_1;
         break label$125;
        }
        $1_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
       }
       HEAP32[($0_1 + 8 | 0) >> 2] = $11_1;
       HEAP32[($1_1 + 12 | 0) >> 2] = $11_1;
       HEAP32[($11_1 + 12 | 0) >> 2] = $0_1;
       HEAP32[($11_1 + 8 | 0) >> 2] = $1_1;
       break label$122;
      }
      $0_1 = 31;
      label$127 : {
       if ($1_1 >>> 0 > 16777215 >>> 0) {
        break label$127
       }
       $0_1 = $1_1 >>> 8 | 0;
       $1649 = $0_1;
       $0_1 = (($0_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
       $5_1 = $1649 << $0_1 | 0;
       $1656 = $5_1;
       $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
       $3_1 = $1656 << $5_1 | 0;
       $1663 = $3_1;
       $3_1 = (($3_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
       $0_1 = (($1663 << $3_1 | 0) >>> 15 | 0) - ($0_1 | $5_1 | 0 | $3_1 | 0) | 0;
       $0_1 = ($0_1 << 1 | 0 | (($1_1 >>> ($0_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
      }
      HEAP32[($11_1 + 28 | 0) >> 2] = $0_1;
      i64toi32_i32$1 = $11_1;
      i64toi32_i32$0 = 0;
      HEAP32[($11_1 + 16 | 0) >> 2] = 0;
      HEAP32[($11_1 + 20 | 0) >> 2] = i64toi32_i32$0;
      $5_1 = ($0_1 << 2 | 0) + 2988 | 0;
      label$128 : {
       label$129 : {
        label$130 : {
         $3_1 = 1 << $0_1 | 0;
         if ($6_1 & $3_1 | 0) {
          break label$130
         }
         HEAP32[(0 + 2688 | 0) >> 2] = $6_1 | $3_1 | 0;
         HEAP32[$5_1 >> 2] = $11_1;
         HEAP32[($11_1 + 24 | 0) >> 2] = $5_1;
         break label$129;
        }
        $0_1 = $1_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
        $3_1 = HEAP32[$5_1 >> 2] | 0;
        label$131 : while (1) {
         $5_1 = $3_1;
         if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($1_1 | 0)) {
          break label$128
         }
         $3_1 = $0_1 >>> 29 | 0;
         $0_1 = $0_1 << 1 | 0;
         $4_1 = ($5_1 + ($3_1 & 4 | 0) | 0) + 16 | 0;
         $3_1 = HEAP32[$4_1 >> 2] | 0;
         if ($3_1) {
          continue label$131
         }
         break label$131;
        };
        HEAP32[$4_1 >> 2] = $11_1;
        HEAP32[($11_1 + 24 | 0) >> 2] = $5_1;
       }
       HEAP32[($11_1 + 12 | 0) >> 2] = $11_1;
       HEAP32[($11_1 + 8 | 0) >> 2] = $11_1;
       break label$122;
      }
      $0_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
      HEAP32[($0_1 + 12 | 0) >> 2] = $11_1;
      HEAP32[($5_1 + 8 | 0) >> 2] = $11_1;
      HEAP32[($11_1 + 24 | 0) >> 2] = 0;
      HEAP32[($11_1 + 12 | 0) >> 2] = $5_1;
      HEAP32[($11_1 + 8 | 0) >> 2] = $0_1;
     }
     $1_1 = $7_1 + 8 | 0;
     break label$4;
    }
    label$132 : {
     if (!$10_1) {
      break label$132
     }
     label$133 : {
      label$134 : {
       $5_1 = HEAP32[($4_1 + 28 | 0) >> 2] | 0;
       $0_1 = ($5_1 << 2 | 0) + 2988 | 0;
       if (($4_1 | 0) != (HEAP32[$0_1 >> 2] | 0 | 0)) {
        break label$134
       }
       HEAP32[$0_1 >> 2] = $7_1;
       if ($7_1) {
        break label$133
       }
       HEAP32[(0 + 2688 | 0) >> 2] = $8_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
       break label$132;
      }
      HEAP32[($10_1 + ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) == ($4_1 | 0) ? 16 : 20) | 0) >> 2] = $7_1;
      if (!$7_1) {
       break label$132
      }
     }
     HEAP32[($7_1 + 24 | 0) >> 2] = $10_1;
     label$135 : {
      $0_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
      if (!$0_1) {
       break label$135
      }
      HEAP32[($7_1 + 16 | 0) >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $7_1;
     }
     $0_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
     if (!$0_1) {
      break label$132
     }
     HEAP32[($7_1 + 20 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $7_1;
    }
    label$136 : {
     label$137 : {
      if ($1_1 >>> 0 > 15 >>> 0) {
       break label$137
      }
      $0_1 = $1_1 + $3_1 | 0;
      HEAP32[($4_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
      $0_1 = $4_1 + $0_1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      break label$136;
     }
     HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
     HEAP32[($9_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[($9_1 + $1_1 | 0) >> 2] = $1_1;
     label$138 : {
      if (!$6_1) {
       break label$138
      }
      $3_1 = $6_1 >>> 3 | 0;
      $5_1 = ($3_1 << 3 | 0) + 2724 | 0;
      $0_1 = HEAP32[(0 + 2704 | 0) >> 2] | 0;
      label$139 : {
       label$140 : {
        $3_1 = 1 << $3_1 | 0;
        if ($3_1 & $2_1 | 0) {
         break label$140
        }
        HEAP32[(0 + 2684 | 0) >> 2] = $3_1 | $2_1 | 0;
        $3_1 = $5_1;
        break label$139;
       }
       $3_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
      }
      HEAP32[($5_1 + 8 | 0) >> 2] = $0_1;
      HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
      HEAP32[($0_1 + 12 | 0) >> 2] = $5_1;
      HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
     }
     HEAP32[(0 + 2704 | 0) >> 2] = $9_1;
     HEAP32[(0 + 2692 | 0) >> 2] = $1_1;
    }
    $1_1 = $4_1 + 8 | 0;
   }
   if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
    break label$2
   }
   $46(3132 | 0) | 0;
  }
  return $1_1 | 0;
 }
 
 function $104() {
  var $0_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0;
  $0_1 = global$0 - 16 | 0;
  global$0 = $0_1;
  $39(3184 | 0) | 0;
  label$1 : {
   if (HEAP32[(0 + 2660 | 0) >> 2] | 0) {
    break label$1
   }
   HEAP32[(0 + 2680 | 0) >> 2] = 2;
   i64toi32_i32$1 = 0;
   i64toi32_i32$0 = -1;
   HEAP32[(i64toi32_i32$1 + 2672 | 0) >> 2] = -1;
   HEAP32[(i64toi32_i32$1 + 2676 | 0) >> 2] = i64toi32_i32$0;
   i64toi32_i32$1 = 0;
   i64toi32_i32$0 = 4096;
   HEAP32[(i64toi32_i32$1 + 2664 | 0) >> 2] = 4096;
   HEAP32[(i64toi32_i32$1 + 2668 | 0) >> 2] = i64toi32_i32$0;
   HEAP32[(0 + 3128 | 0) >> 2] = 2;
   label$2 : {
    if ($100($0_1 + 8 | 0 | 0) | 0) {
     break label$2
    }
    if ($101(3132 | 0, $0_1 + 8 | 0 | 0) | 0) {
     break label$2
    }
    $102($0_1 + 8 | 0 | 0) | 0;
   }
   HEAP32[(0 + 2660 | 0) >> 2] = (($0_1 + 4 | 0) & -16 | 0) ^ 1431655768 | 0;
  }
  $46(3184 | 0) | 0;
  global$0 = $0_1 + 16 | 0;
 }
 
 function $105($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $5_1 = 0, $1_1 = 0, $4_1 = 0, $3_1 = 0, $7_1 = 0, $6_1 = 0, $403 = 0, $410 = 0, $417 = 0;
  label$1 : {
   if (!$0_1) {
    break label$1
   }
   label$2 : {
    if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
     break label$2
    }
    if ($39(3132 | 0) | 0) {
     break label$1
    }
   }
   $1_1 = $0_1 + -8 | 0;
   $2_1 = HEAP32[($0_1 + -4 | 0) >> 2] | 0;
   $0_1 = $2_1 & -8 | 0;
   $3_1 = $1_1 + $0_1 | 0;
   label$3 : {
    label$4 : {
     if ($2_1 & 1 | 0) {
      break label$4
     }
     if (!($2_1 & 3 | 0)) {
      break label$3
     }
     $2_1 = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 - $2_1 | 0;
     $4_1 = HEAP32[(0 + 2700 | 0) >> 2] | 0;
     if ($1_1 >>> 0 < $4_1 >>> 0) {
      break label$3
     }
     $0_1 = $2_1 + $0_1 | 0;
     label$5 : {
      if ((HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0) == ($1_1 | 0)) {
       break label$5
      }
      label$6 : {
       if ($2_1 >>> 0 > 255 >>> 0) {
        break label$6
       }
       $5_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
       label$7 : {
        $6_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
        $7_1 = $2_1 >>> 3 | 0;
        $2_1 = ($7_1 << 3 | 0) + 2724 | 0;
        if (($6_1 | 0) == ($2_1 | 0)) {
         break label$7
        }
       }
       label$8 : {
        if (($5_1 | 0) != ($6_1 | 0)) {
         break label$8
        }
        HEAP32[(0 + 2684 | 0) >> 2] = (HEAP32[(0 + 2684 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0;
        break label$4;
       }
       label$9 : {
        if (($5_1 | 0) == ($2_1 | 0)) {
         break label$9
        }
       }
       HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
       break label$4;
      }
      $7_1 = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      label$10 : {
       label$11 : {
        $5_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
        if (($5_1 | 0) == ($1_1 | 0)) {
         break label$11
        }
        label$12 : {
         $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
         if ($4_1 >>> 0 > $2_1 >>> 0) {
          break label$12
         }
         HEAP32[($2_1 + 12 | 0) >> 2] | 0;
        }
        HEAP32[($2_1 + 12 | 0) >> 2] = $5_1;
        HEAP32[($5_1 + 8 | 0) >> 2] = $2_1;
        break label$10;
       }
       label$13 : {
        $2_1 = $1_1 + 20 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         break label$13
        }
        $2_1 = $1_1 + 16 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         break label$13
        }
        $5_1 = 0;
        break label$10;
       }
       label$14 : while (1) {
        $6_1 = $2_1;
        $5_1 = $4_1;
        $2_1 = $5_1 + 20 | 0;
        $4_1 = HEAP32[$2_1 >> 2] | 0;
        if ($4_1) {
         continue label$14
        }
        $2_1 = $5_1 + 16 | 0;
        $4_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
        if ($4_1) {
         continue label$14
        }
        break label$14;
       };
       HEAP32[$6_1 >> 2] = 0;
      }
      if (!$7_1) {
       break label$4
      }
      label$15 : {
       label$16 : {
        $4_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
        $2_1 = ($4_1 << 2 | 0) + 2988 | 0;
        if ((HEAP32[$2_1 >> 2] | 0 | 0) != ($1_1 | 0)) {
         break label$16
        }
        HEAP32[$2_1 >> 2] = $5_1;
        if ($5_1) {
         break label$15
        }
        HEAP32[(0 + 2688 | 0) >> 2] = (HEAP32[(0 + 2688 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0;
        break label$4;
       }
       HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($1_1 | 0) ? 16 : 20) | 0) >> 2] = $5_1;
       if (!$5_1) {
        break label$4
       }
      }
      HEAP32[($5_1 + 24 | 0) >> 2] = $7_1;
      label$17 : {
       $2_1 = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
       if (!$2_1) {
        break label$17
       }
       HEAP32[($5_1 + 16 | 0) >> 2] = $2_1;
       HEAP32[($2_1 + 24 | 0) >> 2] = $5_1;
      }
      $2_1 = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      if (!$2_1) {
       break label$4
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
      HEAP32[($2_1 + 24 | 0) >> 2] = $5_1;
      break label$4;
     }
     $2_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
     if (($2_1 & 3 | 0 | 0) != (3 | 0)) {
      break label$4
     }
     HEAP32[(0 + 2692 | 0) >> 2] = $0_1;
     HEAP32[($3_1 + 4 | 0) >> 2] = $2_1 & -2 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
     HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
     break label$3;
    }
    if ($3_1 >>> 0 <= $1_1 >>> 0) {
     break label$3
    }
    $2_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
    if (!($2_1 & 1 | 0)) {
     break label$3
    }
    label$18 : {
     label$19 : {
      if ($2_1 & 2 | 0) {
       break label$19
      }
      label$20 : {
       if ((HEAP32[(0 + 2708 | 0) >> 2] | 0 | 0) != ($3_1 | 0)) {
        break label$20
       }
       HEAP32[(0 + 2708 | 0) >> 2] = $1_1;
       $0_1 = (HEAP32[(0 + 2696 | 0) >> 2] | 0) + $0_1 | 0;
       HEAP32[(0 + 2696 | 0) >> 2] = $0_1;
       HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
       if (($1_1 | 0) != (HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0)) {
        break label$3
       }
       HEAP32[(0 + 2692 | 0) >> 2] = 0;
       HEAP32[(0 + 2704 | 0) >> 2] = 0;
       break label$3;
      }
      label$21 : {
       if ((HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0) != ($3_1 | 0)) {
        break label$21
       }
       HEAP32[(0 + 2704 | 0) >> 2] = $1_1;
       $0_1 = (HEAP32[(0 + 2692 | 0) >> 2] | 0) + $0_1 | 0;
       HEAP32[(0 + 2692 | 0) >> 2] = $0_1;
       HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
       HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
       break label$3;
      }
      $0_1 = ($2_1 & -8 | 0) + $0_1 | 0;
      label$22 : {
       label$23 : {
        if ($2_1 >>> 0 > 255 >>> 0) {
         break label$23
        }
        $4_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
        label$24 : {
         $5_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
         $3_1 = $2_1 >>> 3 | 0;
         $2_1 = ($3_1 << 3 | 0) + 2724 | 0;
         if (($5_1 | 0) == ($2_1 | 0)) {
          break label$24
         }
         HEAP32[(0 + 2700 | 0) >> 2] | 0;
        }
        label$25 : {
         if (($4_1 | 0) != ($5_1 | 0)) {
          break label$25
         }
         HEAP32[(0 + 2684 | 0) >> 2] = (HEAP32[(0 + 2684 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $3_1 | 0) | 0) | 0;
         break label$22;
        }
        label$26 : {
         if (($4_1 | 0) == ($2_1 | 0)) {
          break label$26
         }
         HEAP32[(0 + 2700 | 0) >> 2] | 0;
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
        HEAP32[($4_1 + 8 | 0) >> 2] = $5_1;
        break label$22;
       }
       $7_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
       label$27 : {
        label$28 : {
         $5_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
         if (($5_1 | 0) == ($3_1 | 0)) {
          break label$28
         }
         label$29 : {
          $2_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
          if ((HEAP32[(0 + 2700 | 0) >> 2] | 0) >>> 0 > $2_1 >>> 0) {
           break label$29
          }
          HEAP32[($2_1 + 12 | 0) >> 2] | 0;
         }
         HEAP32[($2_1 + 12 | 0) >> 2] = $5_1;
         HEAP32[($5_1 + 8 | 0) >> 2] = $2_1;
         break label$27;
        }
        label$30 : {
         $4_1 = $3_1 + 20 | 0;
         $2_1 = HEAP32[$4_1 >> 2] | 0;
         if ($2_1) {
          break label$30
         }
         $4_1 = $3_1 + 16 | 0;
         $2_1 = HEAP32[$4_1 >> 2] | 0;
         if ($2_1) {
          break label$30
         }
         $5_1 = 0;
         break label$27;
        }
        label$31 : while (1) {
         $6_1 = $4_1;
         $5_1 = $2_1;
         $4_1 = $2_1 + 20 | 0;
         $2_1 = HEAP32[$4_1 >> 2] | 0;
         if ($2_1) {
          continue label$31
         }
         $4_1 = $5_1 + 16 | 0;
         $2_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
         if ($2_1) {
          continue label$31
         }
         break label$31;
        };
        HEAP32[$6_1 >> 2] = 0;
       }
       if (!$7_1) {
        break label$22
       }
       label$32 : {
        label$33 : {
         $4_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
         $2_1 = ($4_1 << 2 | 0) + 2988 | 0;
         if ((HEAP32[$2_1 >> 2] | 0 | 0) != ($3_1 | 0)) {
          break label$33
         }
         HEAP32[$2_1 >> 2] = $5_1;
         if ($5_1) {
          break label$32
         }
         HEAP32[(0 + 2688 | 0) >> 2] = (HEAP32[(0 + 2688 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0;
         break label$22;
        }
        HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($3_1 | 0) ? 16 : 20) | 0) >> 2] = $5_1;
        if (!$5_1) {
         break label$22
        }
       }
       HEAP32[($5_1 + 24 | 0) >> 2] = $7_1;
       label$34 : {
        $2_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
        if (!$2_1) {
         break label$34
        }
        HEAP32[($5_1 + 16 | 0) >> 2] = $2_1;
        HEAP32[($2_1 + 24 | 0) >> 2] = $5_1;
       }
       $2_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
       if (!$2_1) {
        break label$22
       }
       HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
       HEAP32[($2_1 + 24 | 0) >> 2] = $5_1;
      }
      HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
      HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
      if (($1_1 | 0) != (HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0)) {
       break label$18
      }
      HEAP32[(0 + 2692 | 0) >> 2] = $0_1;
      break label$3;
     }
     HEAP32[($3_1 + 4 | 0) >> 2] = $2_1 & -2 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
     HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
    }
    label$35 : {
     if ($0_1 >>> 0 > 255 >>> 0) {
      break label$35
     }
     $2_1 = $0_1 >>> 3 | 0;
     $0_1 = ($2_1 << 3 | 0) + 2724 | 0;
     label$36 : {
      label$37 : {
       $4_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
       $2_1 = 1 << $2_1 | 0;
       if ($4_1 & $2_1 | 0) {
        break label$37
       }
       HEAP32[(0 + 2684 | 0) >> 2] = $4_1 | $2_1 | 0;
       $2_1 = $0_1;
       break label$36;
      }
      $2_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
     }
     HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
     HEAP32[($2_1 + 12 | 0) >> 2] = $1_1;
     HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
     HEAP32[($1_1 + 8 | 0) >> 2] = $2_1;
     break label$3;
    }
    $2_1 = 31;
    label$38 : {
     if ($0_1 >>> 0 > 16777215 >>> 0) {
      break label$38
     }
     $2_1 = $0_1 >>> 8 | 0;
     $403 = $2_1;
     $2_1 = (($2_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
     $4_1 = $403 << $2_1 | 0;
     $410 = $4_1;
     $4_1 = (($4_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
     $5_1 = $410 << $4_1 | 0;
     $417 = $5_1;
     $5_1 = (($5_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
     $2_1 = (($417 << $5_1 | 0) >>> 15 | 0) - ($2_1 | $4_1 | 0 | $5_1 | 0) | 0;
     $2_1 = ($2_1 << 1 | 0 | (($0_1 >>> ($2_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
    }
    HEAP32[($1_1 + 16 | 0) >> 2] = 0;
    HEAP32[($1_1 + 20 | 0) >> 2] = 0;
    HEAP32[($1_1 + 28 | 0) >> 2] = $2_1;
    $4_1 = ($2_1 << 2 | 0) + 2988 | 0;
    label$39 : {
     label$40 : {
      label$41 : {
       label$42 : {
        $5_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
        $3_1 = 1 << $2_1 | 0;
        if ($5_1 & $3_1 | 0) {
         break label$42
        }
        HEAP32[(0 + 2688 | 0) >> 2] = $5_1 | $3_1 | 0;
        HEAP32[$4_1 >> 2] = $1_1;
        HEAP32[($1_1 + 24 | 0) >> 2] = $4_1;
        break label$41;
       }
       $2_1 = $0_1 << (($2_1 | 0) == (31 | 0) ? 0 : 25 - ($2_1 >>> 1 | 0) | 0) | 0;
       $5_1 = HEAP32[$4_1 >> 2] | 0;
       label$43 : while (1) {
        $4_1 = $5_1;
        if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
         break label$40
        }
        $5_1 = $2_1 >>> 29 | 0;
        $2_1 = $2_1 << 1 | 0;
        $3_1 = ($4_1 + ($5_1 & 4 | 0) | 0) + 16 | 0;
        $5_1 = HEAP32[$3_1 >> 2] | 0;
        if ($5_1) {
         continue label$43
        }
        break label$43;
       };
       HEAP32[$3_1 >> 2] = $1_1;
       HEAP32[($1_1 + 24 | 0) >> 2] = $4_1;
      }
      HEAP32[($1_1 + 12 | 0) >> 2] = $1_1;
      HEAP32[($1_1 + 8 | 0) >> 2] = $1_1;
      break label$39;
     }
     $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
     HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
     HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
     HEAP32[($1_1 + 24 | 0) >> 2] = 0;
     HEAP32[($1_1 + 12 | 0) >> 2] = $4_1;
     HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
    }
    $1_1 = (HEAP32[(0 + 2716 | 0) >> 2] | 0) + -1 | 0;
    HEAP32[(0 + 2716 | 0) >> 2] = $1_1 ? $1_1 : -1;
   }
   if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
    break label$1
   }
   $46(3132 | 0) | 0;
  }
 }
 
 function $106($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  label$1 : {
   if ($0_1 >>> 0 > 8 >>> 0) {
    break label$1
   }
   return $103($1_1 | 0) | 0 | 0;
  }
  return $107($0_1 | 0, $1_1 | 0) | 0 | 0;
 }
 
 function $107($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0, $6_1 = 0, $4_1 = 0, $5_1 = 0;
  $2_1 = 16;
  label$1 : {
   label$2 : {
    $3_1 = $0_1 >>> 0 > 16 >>> 0 ? $0_1 : 16;
    if ($3_1 & ($3_1 + -1 | 0) | 0) {
     break label$2
    }
    $0_1 = $3_1;
    break label$1;
   }
   label$3 : while (1) {
    $0_1 = $2_1;
    $2_1 = $0_1 << 1 | 0;
    if ($0_1 >>> 0 < $3_1 >>> 0) {
     continue label$3
    }
    break label$3;
   };
  }
  label$4 : {
   if ((-64 - $0_1 | 0) >>> 0 > $1_1 >>> 0) {
    break label$4
   }
   HEAP32[($13() | 0) >> 2] = 48;
   return 0 | 0;
  }
  label$5 : {
   $1_1 = $1_1 >>> 0 < 11 >>> 0 ? 16 : ($1_1 + 11 | 0) & -8 | 0;
   $3_1 = $103(($1_1 + $0_1 | 0) + 12 | 0 | 0) | 0;
   if ($3_1) {
    break label$5
   }
   return 0 | 0;
  }
  $2_1 = 0;
  label$6 : {
   label$7 : {
    if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
     break label$7
    }
    if ($39(3132 | 0) | 0) {
     break label$6
    }
   }
   $2_1 = $3_1 + -8 | 0;
   label$8 : {
    if (!(($0_1 + -1 | 0) & $3_1 | 0)) {
     break label$8
    }
    $4_1 = $3_1 + -4 | 0;
    $5_1 = HEAP32[$4_1 >> 2] | 0;
    $3_1 = ((($3_1 + $0_1 | 0) + -1 | 0) & (0 - $0_1 | 0) | 0) + -8 | 0;
    $0_1 = ($3_1 - $2_1 | 0) >>> 0 > 15 >>> 0 ? $3_1 : $3_1 + $0_1 | 0;
    $3_1 = $0_1 - $2_1 | 0;
    $6_1 = ($5_1 & -8 | 0) - $3_1 | 0;
    label$9 : {
     label$10 : {
      if ($5_1 & 3 | 0) {
       break label$10
      }
      $2_1 = HEAP32[$2_1 >> 2] | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $6_1;
      HEAP32[$0_1 >> 2] = $2_1 + $3_1 | 0;
      break label$9;
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $6_1 | ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
     $6_1 = $0_1 + $6_1 | 0;
     HEAP32[($6_1 + 4 | 0) >> 2] = HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     HEAP32[$4_1 >> 2] = $3_1 | ((HEAP32[$4_1 >> 2] | 0) & 1 | 0) | 0 | 2 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     $108($2_1 | 0, $3_1 | 0);
    }
    $2_1 = $0_1;
   }
   label$11 : {
    $0_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
    if (!($0_1 & 3 | 0)) {
     break label$11
    }
    $3_1 = $0_1 & -8 | 0;
    if ($3_1 >>> 0 <= ($1_1 + 16 | 0) >>> 0) {
     break label$11
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = $1_1 | ($0_1 & 1 | 0) | 0 | 2 | 0;
    $0_1 = $2_1 + $1_1 | 0;
    $1_1 = $3_1 - $1_1 | 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 3 | 0;
    $3_1 = $2_1 + $3_1 | 0;
    HEAP32[($3_1 + 4 | 0) >> 2] = HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 1 | 0;
    $108($0_1 | 0, $1_1 | 0);
   }
   $2_1 = $2_1 + 8 | 0;
   if (!((HEAPU8[(0 + 3128 | 0) >> 0] | 0) & 2 | 0)) {
    break label$6
   }
   $46(3132 | 0) | 0;
  }
  return $2_1 | 0;
 }
 
 function $108($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $6_1 = 0, $5_1 = 0, $2_1 = 0, $7_1 = 0, $4_1 = 0, $382 = 0, $389 = 0, $396 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  label$1 : {
   label$2 : {
    $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
    if ($3_1 & 1 | 0) {
     break label$2
    }
    if (!($3_1 & 3 | 0)) {
     break label$1
    }
    $3_1 = HEAP32[$0_1 >> 2] | 0;
    $1_1 = $3_1 + $1_1 | 0;
    label$3 : {
     $0_1 = $0_1 - $3_1 | 0;
     if ((HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0) == ($0_1 | 0)) {
      break label$3
     }
     $4_1 = HEAP32[(0 + 2700 | 0) >> 2] | 0;
     label$4 : {
      if ($3_1 >>> 0 > 255 >>> 0) {
       break label$4
      }
      $5_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
      label$5 : {
       $6_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
       $7_1 = $3_1 >>> 3 | 0;
       $3_1 = ($7_1 << 3 | 0) + 2724 | 0;
       if (($6_1 | 0) == ($3_1 | 0)) {
        break label$5
       }
      }
      label$6 : {
       if (($5_1 | 0) != ($6_1 | 0)) {
        break label$6
       }
       HEAP32[(0 + 2684 | 0) >> 2] = (HEAP32[(0 + 2684 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0;
       break label$2;
      }
      label$7 : {
       if (($5_1 | 0) == ($3_1 | 0)) {
        break label$7
       }
      }
      HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
      break label$2;
     }
     $7_1 = HEAP32[($0_1 + 24 | 0) >> 2] | 0;
     label$8 : {
      label$9 : {
       $6_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($0_1 | 0)) {
        break label$9
       }
       label$10 : {
        $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
        if ($4_1 >>> 0 > $3_1 >>> 0) {
         break label$10
        }
        HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       }
       HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
       HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
       break label$8;
      }
      label$11 : {
       $3_1 = $0_1 + 20 | 0;
       $5_1 = HEAP32[$3_1 >> 2] | 0;
       if ($5_1) {
        break label$11
       }
       $3_1 = $0_1 + 16 | 0;
       $5_1 = HEAP32[$3_1 >> 2] | 0;
       if ($5_1) {
        break label$11
       }
       $6_1 = 0;
       break label$8;
      }
      label$12 : while (1) {
       $4_1 = $3_1;
       $6_1 = $5_1;
       $3_1 = $6_1 + 20 | 0;
       $5_1 = HEAP32[$3_1 >> 2] | 0;
       if ($5_1) {
        continue label$12
       }
       $3_1 = $6_1 + 16 | 0;
       $5_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
       if ($5_1) {
        continue label$12
       }
       break label$12;
      };
      HEAP32[$4_1 >> 2] = 0;
     }
     if (!$7_1) {
      break label$2
     }
     label$13 : {
      label$14 : {
       $5_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
       $3_1 = ($5_1 << 2 | 0) + 2988 | 0;
       if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($0_1 | 0)) {
        break label$14
       }
       HEAP32[$3_1 >> 2] = $6_1;
       if ($6_1) {
        break label$13
       }
       HEAP32[(0 + 2688 | 0) >> 2] = (HEAP32[(0 + 2688 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
       break label$2;
      }
      HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($0_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
      if (!$6_1) {
       break label$2
      }
     }
     HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
     label$15 : {
      $3_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
      if (!$3_1) {
       break label$15
      }
      HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
      HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
     }
     $3_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
     if (!$3_1) {
      break label$2
     }
     HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
     HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
     break label$2;
    }
    $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
    if (($3_1 & 3 | 0 | 0) != (3 | 0)) {
     break label$2
    }
    HEAP32[(0 + 2692 | 0) >> 2] = $1_1;
    HEAP32[($2_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
    HEAP32[$2_1 >> 2] = $1_1;
    return;
   }
   label$16 : {
    label$17 : {
     $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     if ($3_1 & 2 | 0) {
      break label$17
     }
     label$18 : {
      if ((HEAP32[(0 + 2708 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
       break label$18
      }
      HEAP32[(0 + 2708 | 0) >> 2] = $0_1;
      $1_1 = (HEAP32[(0 + 2696 | 0) >> 2] | 0) + $1_1 | 0;
      HEAP32[(0 + 2696 | 0) >> 2] = $1_1;
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      if (($0_1 | 0) != (HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0)) {
       break label$1
      }
      HEAP32[(0 + 2692 | 0) >> 2] = 0;
      HEAP32[(0 + 2704 | 0) >> 2] = 0;
      return;
     }
     label$19 : {
      if ((HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
       break label$19
      }
      HEAP32[(0 + 2704 | 0) >> 2] = $0_1;
      $1_1 = (HEAP32[(0 + 2692 | 0) >> 2] | 0) + $1_1 | 0;
      HEAP32[(0 + 2692 | 0) >> 2] = $1_1;
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
      return;
     }
     $4_1 = HEAP32[(0 + 2700 | 0) >> 2] | 0;
     $1_1 = ($3_1 & -8 | 0) + $1_1 | 0;
     label$20 : {
      label$21 : {
       if ($3_1 >>> 0 > 255 >>> 0) {
        break label$21
       }
       $5_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
       label$22 : {
        $6_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
        $2_1 = $3_1 >>> 3 | 0;
        $3_1 = ($2_1 << 3 | 0) + 2724 | 0;
        if (($6_1 | 0) == ($3_1 | 0)) {
         break label$22
        }
       }
       label$23 : {
        if (($5_1 | 0) != ($6_1 | 0)) {
         break label$23
        }
        HEAP32[(0 + 2684 | 0) >> 2] = (HEAP32[(0 + 2684 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $2_1 | 0) | 0) | 0;
        break label$20;
       }
       label$24 : {
        if (($5_1 | 0) == ($3_1 | 0)) {
         break label$24
        }
       }
       HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
       break label$20;
      }
      $7_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
      label$25 : {
       label$26 : {
        $6_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
        if (($6_1 | 0) == ($2_1 | 0)) {
         break label$26
        }
        label$27 : {
         $3_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
         if ($4_1 >>> 0 > $3_1 >>> 0) {
          break label$27
         }
         HEAP32[($3_1 + 12 | 0) >> 2] | 0;
        }
        HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 8 | 0) >> 2] = $3_1;
        break label$25;
       }
       label$28 : {
        $5_1 = $2_1 + 20 | 0;
        $3_1 = HEAP32[$5_1 >> 2] | 0;
        if ($3_1) {
         break label$28
        }
        $5_1 = $2_1 + 16 | 0;
        $3_1 = HEAP32[$5_1 >> 2] | 0;
        if ($3_1) {
         break label$28
        }
        $6_1 = 0;
        break label$25;
       }
       label$29 : while (1) {
        $4_1 = $5_1;
        $6_1 = $3_1;
        $5_1 = $3_1 + 20 | 0;
        $3_1 = HEAP32[$5_1 >> 2] | 0;
        if ($3_1) {
         continue label$29
        }
        $5_1 = $6_1 + 16 | 0;
        $3_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
        if ($3_1) {
         continue label$29
        }
        break label$29;
       };
       HEAP32[$4_1 >> 2] = 0;
      }
      if (!$7_1) {
       break label$20
      }
      label$30 : {
       label$31 : {
        $5_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
        $3_1 = ($5_1 << 2 | 0) + 2988 | 0;
        if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($2_1 | 0)) {
         break label$31
        }
        HEAP32[$3_1 >> 2] = $6_1;
        if ($6_1) {
         break label$30
        }
        HEAP32[(0 + 2688 | 0) >> 2] = (HEAP32[(0 + 2688 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
        break label$20;
       }
       HEAP32[($7_1 + ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) == ($2_1 | 0) ? 16 : 20) | 0) >> 2] = $6_1;
       if (!$6_1) {
        break label$20
       }
      }
      HEAP32[($6_1 + 24 | 0) >> 2] = $7_1;
      label$32 : {
       $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
       if (!$3_1) {
        break label$32
       }
       HEAP32[($6_1 + 16 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
      }
      $3_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
      if (!$3_1) {
       break label$20
      }
      HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
      HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
     if (($0_1 | 0) != (HEAP32[(0 + 2704 | 0) >> 2] | 0 | 0)) {
      break label$16
     }
     HEAP32[(0 + 2692 | 0) >> 2] = $1_1;
     return;
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
    HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
    HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
   }
   label$33 : {
    if ($1_1 >>> 0 > 255 >>> 0) {
     break label$33
    }
    $3_1 = $1_1 >>> 3 | 0;
    $1_1 = ($3_1 << 3 | 0) + 2724 | 0;
    label$34 : {
     label$35 : {
      $5_1 = HEAP32[(0 + 2684 | 0) >> 2] | 0;
      $3_1 = 1 << $3_1 | 0;
      if ($5_1 & $3_1 | 0) {
       break label$35
      }
      HEAP32[(0 + 2684 | 0) >> 2] = $5_1 | $3_1 | 0;
      $3_1 = $1_1;
      break label$34;
     }
     $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    }
    HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
    HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 8 | 0) >> 2] = $3_1;
    return;
   }
   $3_1 = 31;
   label$36 : {
    if ($1_1 >>> 0 > 16777215 >>> 0) {
     break label$36
    }
    $3_1 = $1_1 >>> 8 | 0;
    $382 = $3_1;
    $3_1 = (($3_1 + 1048320 | 0) >>> 16 | 0) & 8 | 0;
    $5_1 = $382 << $3_1 | 0;
    $389 = $5_1;
    $5_1 = (($5_1 + 520192 | 0) >>> 16 | 0) & 4 | 0;
    $6_1 = $389 << $5_1 | 0;
    $396 = $6_1;
    $6_1 = (($6_1 + 245760 | 0) >>> 16 | 0) & 2 | 0;
    $3_1 = (($396 << $6_1 | 0) >>> 15 | 0) - ($3_1 | $5_1 | 0 | $6_1 | 0) | 0;
    $3_1 = ($3_1 << 1 | 0 | (($1_1 >>> ($3_1 + 21 | 0) | 0) & 1 | 0) | 0) + 28 | 0;
   }
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = $3_1;
   $5_1 = ($3_1 << 2 | 0) + 2988 | 0;
   label$37 : {
    label$38 : {
     label$39 : {
      $6_1 = HEAP32[(0 + 2688 | 0) >> 2] | 0;
      $2_1 = 1 << $3_1 | 0;
      if ($6_1 & $2_1 | 0) {
       break label$39
      }
      HEAP32[(0 + 2688 | 0) >> 2] = $6_1 | $2_1 | 0;
      HEAP32[$5_1 >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $5_1;
      break label$38;
     }
     $3_1 = $1_1 << (($3_1 | 0) == (31 | 0) ? 0 : 25 - ($3_1 >>> 1 | 0) | 0) | 0;
     $6_1 = HEAP32[$5_1 >> 2] | 0;
     label$40 : while (1) {
      $5_1 = $6_1;
      if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($1_1 | 0)) {
       break label$37
      }
      $6_1 = $3_1 >>> 29 | 0;
      $3_1 = $3_1 << 1 | 0;
      $2_1 = ($5_1 + ($6_1 & 4 | 0) | 0) + 16 | 0;
      $6_1 = HEAP32[$2_1 >> 2] | 0;
      if ($6_1) {
       continue label$40
      }
      break label$40;
     };
     HEAP32[$2_1 >> 2] = $0_1;
     HEAP32[($0_1 + 24 | 0) >> 2] = $5_1;
    }
    HEAP32[($0_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 8 | 0) >> 2] = $0_1;
    return;
   }
   $1_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
   HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
   HEAP32[($5_1 + 8 | 0) >> 2] = $0_1;
   HEAP32[($0_1 + 24 | 0) >> 2] = 0;
   HEAP32[($0_1 + 12 | 0) >> 2] = $5_1;
   HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
  }
 }
 
 function $109($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $1_1 = 0, $2_1 = 0;
  $1_1 = ($0_1 + 3 | 0) & -4 | 0;
  $2_1 = ($1_1 | 0) < (1 | 0);
  label$1 : {
   label$2 : while (1) {
    $3_1 = Atomics.load(HEAP32, (0 + 2216 | 0) >> 2) | 0;
    $0_1 = $3_1 + $1_1 | 0;
    label$3 : {
     if ($2_1) {
      break label$3
     }
     if ($0_1 >>> 0 <= $3_1 >>> 0) {
      break label$1
     }
    }
    label$4 : {
     if ($0_1 >>> 0 <= (__wasm_memory_size() << 16 | 0) >>> 0) {
      break label$4
     }
     if (!(fimport$16($0_1 | 0) | 0)) {
      break label$1
     }
    }
    if ((Atomics.compareExchange(HEAP32, (0 + 2216 | 0) >> 2, $3_1, $0_1) | 0 | 0) != ($3_1 | 0)) {
     continue label$2
    }
    break label$2;
   };
   return $3_1 | 0;
  }
  HEAP32[($13() | 0) >> 2] = 48;
  return -1 | 0;
 }
 
 function $110($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0;
  label$1 : {
   if ($2_1 >>> 0 < 512 >>> 0) {
    break label$1
   }
   fimport$17($0_1 | 0, $1_1 | 0, $2_1 | 0) | 0;
   return $0_1 | 0;
  }
  $3_1 = $0_1 + $2_1 | 0;
  label$2 : {
   label$3 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break label$3
    }
    label$4 : {
     label$5 : {
      if (($2_1 | 0) >= (1 | 0)) {
       break label$5
      }
      $2_1 = $0_1;
      break label$4;
     }
     label$6 : {
      if ($0_1 & 3 | 0) {
       break label$6
      }
      $2_1 = $0_1;
      break label$4;
     }
     $2_1 = $0_1;
     label$7 : while (1) {
      HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
      $1_1 = $1_1 + 1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if ($2_1 >>> 0 >= $3_1 >>> 0) {
       break label$4
      }
      if ($2_1 & 3 | 0) {
       continue label$7
      }
      break label$7;
     };
    }
    label$8 : {
     $4_1 = $3_1 & -4 | 0;
     if ($4_1 >>> 0 < 64 >>> 0) {
      break label$8
     }
     $5_1 = $4_1 + -64 | 0;
     if ($2_1 >>> 0 > $5_1 >>> 0) {
      break label$8
     }
     label$9 : while (1) {
      HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
      HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
      HEAP32[($2_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
      HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
      HEAP32[($2_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      HEAP32[($2_1 + 24 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
      HEAP32[($2_1 + 32 | 0) >> 2] = HEAP32[($1_1 + 32 | 0) >> 2] | 0;
      HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[($1_1 + 36 | 0) >> 2] | 0;
      HEAP32[($2_1 + 40 | 0) >> 2] = HEAP32[($1_1 + 40 | 0) >> 2] | 0;
      HEAP32[($2_1 + 44 | 0) >> 2] = HEAP32[($1_1 + 44 | 0) >> 2] | 0;
      HEAP32[($2_1 + 48 | 0) >> 2] = HEAP32[($1_1 + 48 | 0) >> 2] | 0;
      HEAP32[($2_1 + 52 | 0) >> 2] = HEAP32[($1_1 + 52 | 0) >> 2] | 0;
      HEAP32[($2_1 + 56 | 0) >> 2] = HEAP32[($1_1 + 56 | 0) >> 2] | 0;
      HEAP32[($2_1 + 60 | 0) >> 2] = HEAP32[($1_1 + 60 | 0) >> 2] | 0;
      $1_1 = $1_1 + 64 | 0;
      $2_1 = $2_1 + 64 | 0;
      if ($2_1 >>> 0 <= $5_1 >>> 0) {
       continue label$9
      }
      break label$9;
     };
    }
    if ($2_1 >>> 0 >= $4_1 >>> 0) {
     break label$2
    }
    label$10 : while (1) {
     HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 + 4 | 0;
     $2_1 = $2_1 + 4 | 0;
     if ($2_1 >>> 0 < $4_1 >>> 0) {
      continue label$10
     }
     break label$2;
    };
   }
   label$11 : {
    if ($3_1 >>> 0 >= 4 >>> 0) {
     break label$11
    }
    $2_1 = $0_1;
    break label$2;
   }
   label$12 : {
    $4_1 = $3_1 + -4 | 0;
    if ($4_1 >>> 0 >= $0_1 >>> 0) {
     break label$12
    }
    $2_1 = $0_1;
    break label$2;
   }
   $2_1 = $0_1;
   label$13 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    HEAP8[($2_1 + 1 | 0) >> 0] = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($2_1 + 2 | 0) >> 0] = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
    HEAP8[($2_1 + 3 | 0) >> 0] = HEAPU8[($1_1 + 3 | 0) >> 0] | 0;
    $1_1 = $1_1 + 4 | 0;
    $2_1 = $2_1 + 4 | 0;
    if ($2_1 >>> 0 <= $4_1 >>> 0) {
     continue label$13
    }
    break label$13;
   };
  }
  label$14 : {
   if ($2_1 >>> 0 >= $3_1 >>> 0) {
    break label$14
   }
   label$15 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + 1 | 0;
    if (($2_1 | 0) != ($3_1 | 0)) {
     continue label$15
    }
    break label$15;
   };
  }
  return $0_1 | 0;
 }
 
 function $111($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, $4_1 = 0, $6_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, $6$hi = 0, i64toi32_i32$3 = 0, $5_1 = 0, $14_1 = 0, $104$hi = 0;
  label$1 : {
   if (!$2_1) {
    break label$1
   }
   $3_1 = $2_1 + $0_1 | 0;
   HEAP8[($3_1 + -1 | 0) >> 0] = $1_1;
   HEAP8[$0_1 >> 0] = $1_1;
   if ($2_1 >>> 0 < 3 >>> 0) {
    break label$1
   }
   HEAP8[($3_1 + -2 | 0) >> 0] = $1_1;
   HEAP8[($0_1 + 1 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -3 | 0) >> 0] = $1_1;
   HEAP8[($0_1 + 2 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 7 >>> 0) {
    break label$1
   }
   HEAP8[($3_1 + -4 | 0) >> 0] = $1_1;
   HEAP8[($0_1 + 3 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 9 >>> 0) {
    break label$1
   }
   $4_1 = (0 - $0_1 | 0) & 3 | 0;
   $3_1 = $0_1 + $4_1 | 0;
   $1_1 = Math_imul($1_1 & 255 | 0, 16843009);
   HEAP32[$3_1 >> 2] = $1_1;
   $4_1 = ($2_1 - $4_1 | 0) & -4 | 0;
   $2_1 = $3_1 + $4_1 | 0;
   HEAP32[($2_1 + -4 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 9 >>> 0) {
    break label$1
   }
   HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 4 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -8 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -12 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 25 >>> 0) {
    break label$1
   }
   HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 16 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 12 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -16 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -20 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -24 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -28 | 0) >> 2] = $1_1;
   $5_1 = $3_1 & 4 | 0 | 24 | 0;
   $2_1 = $4_1 - $5_1 | 0;
   if ($2_1 >>> 0 < 32 >>> 0) {
    break label$1
   }
   i64toi32_i32$0 = 0;
   $6_1 = $1_1;
   $6$hi = i64toi32_i32$0;
   i64toi32_i32$2 = $1_1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    $14_1 = 0;
   } else {
    i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
    $14_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   }
   $104$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $6$hi;
   i64toi32_i32$1 = $104$hi;
   i64toi32_i32$0 = $14_1;
   i64toi32_i32$2 = $6$hi;
   i64toi32_i32$3 = $6_1;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $6_1 = i64toi32_i32$0 | $6_1 | 0;
   $6$hi = i64toi32_i32$2;
   $1_1 = $3_1 + $5_1 | 0;
   label$2 : while (1) {
    i64toi32_i32$2 = $6$hi;
    i64toi32_i32$0 = $1_1;
    HEAP32[($1_1 + 24 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 28 | 0) >> 2] = i64toi32_i32$2;
    i64toi32_i32$0 = $1_1;
    HEAP32[($1_1 + 16 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 20 | 0) >> 2] = i64toi32_i32$2;
    i64toi32_i32$0 = $1_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 12 | 0) >> 2] = i64toi32_i32$2;
    i64toi32_i32$0 = $1_1;
    HEAP32[$1_1 >> 2] = $6_1;
    HEAP32[($1_1 + 4 | 0) >> 2] = i64toi32_i32$2;
    $1_1 = $1_1 + 32 | 0;
    $2_1 = $2_1 + -32 | 0;
    if ($2_1 >>> 0 > 31 >>> 0) {
     continue label$2
    }
    break label$2;
   };
  }
  return $0_1 | 0;
 }
 
 function $112($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $113($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $114() {
  $112(3212 | 0);
  return 3220 | 0;
 }
 
 function $115() {
  $113(3212 | 0);
 }
 
 function $116($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = HEAPU8[($0_1 + 74 | 0) >> 0] | 0;
  HEAP8[($0_1 + 74 | 0) >> 0] = $1_1 + -1 | 0 | $1_1 | 0;
  label$1 : {
   $1_1 = HEAP32[$0_1 >> 2] | 0;
   if (!($1_1 & 8 | 0)) {
    break label$1
   }
   HEAP32[$0_1 >> 2] = $1_1 | 32 | 0;
   return -1 | 0;
  }
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = 0;
  $1_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
  HEAP32[($0_1 + 28 | 0) >> 2] = $1_1;
  HEAP32[($0_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($0_1 + 16 | 0) >> 2] = $1_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
  return 0 | 0;
 }
 
 function $117($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0;
  label$1 : {
   label$2 : {
    $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
    if ($3_1) {
     break label$2
    }
    $4_1 = 0;
    if ($116($2_1 | 0) | 0) {
     break label$1
    }
    $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
   }
   label$3 : {
    $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
    if (($3_1 - $5_1 | 0) >>> 0 >= $1_1 >>> 0) {
     break label$3
    }
    return FUNCTION_TABLE[HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0]($2_1, $0_1, $1_1) | 0 | 0;
   }
   label$4 : {
    label$5 : {
     if ((HEAP8[($2_1 + 75 | 0) >> 0] | 0 | 0) >= (0 | 0)) {
      break label$5
     }
     $3_1 = 0;
     break label$4;
    }
    $4_1 = $1_1;
    label$6 : while (1) {
     label$7 : {
      $3_1 = $4_1;
      if ($3_1) {
       break label$7
      }
      $3_1 = 0;
      break label$4;
     }
     $4_1 = $3_1 + -1 | 0;
     if ((HEAPU8[($0_1 + $4_1 | 0) >> 0] | 0 | 0) != (10 | 0)) {
      continue label$6
     }
     break label$6;
    };
    $4_1 = FUNCTION_TABLE[HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0]($2_1, $0_1, $3_1) | 0;
    if ($4_1 >>> 0 < $3_1 >>> 0) {
     break label$1
    }
    $0_1 = $0_1 + $3_1 | 0;
    $1_1 = $1_1 - $3_1 | 0;
    $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
   }
   $110($5_1 | 0, $0_1 | 0, $1_1 | 0) | 0;
   HEAP32[($2_1 + 20 | 0) >> 2] = (HEAP32[($2_1 + 20 | 0) >> 2] | 0) + $1_1 | 0;
   $4_1 = $3_1 + $1_1 | 0;
  }
  return $4_1 | 0;
 }
 
 function $118($0_1) {
  $0_1 = $0_1 | 0;
  label$1 : {
   if ($0_1) {
    break label$1
   }
   return 0 | 0;
  }
  HEAP32[($13() | 0) >> 2] = $0_1;
  return -1 | 0;
 }
 
 function $119($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0, $8_1 = 0, $9_1 = 0, $6_1 = 0, $7_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  $4_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = $4_1;
  $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  $1_1 = $5_1 - $4_1 | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  $6_1 = $1_1 + $2_1 | 0;
  $7_1 = 2;
  $1_1 = $3_1 + 16 | 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      if ($118(fimport$18(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $3_1 + 16 | 0 | 0, 2 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0) {
       break label$4
      }
      label$5 : while (1) {
       $4_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($4_1 | 0)) {
        break label$3
       }
       if (($4_1 | 0) <= (-1 | 0)) {
        break label$2
       }
       $8_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
       $5_1 = $4_1 >>> 0 > $8_1 >>> 0;
       $9_1 = $1_1 + ($5_1 << 3 | 0) | 0;
       $8_1 = $4_1 - ($5_1 ? $8_1 : 0) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) + $8_1 | 0;
       $9_1 = $1_1 + ($5_1 ? 12 : 4) | 0;
       HEAP32[$9_1 >> 2] = (HEAP32[$9_1 >> 2] | 0) - $8_1 | 0;
       $6_1 = $6_1 - $4_1 | 0;
       $1_1 = $5_1 ? $1_1 + 8 | 0 : $1_1;
       $7_1 = $7_1 - $5_1 | 0;
       if (!($118(fimport$18(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $1_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        continue label$5
       }
       break label$5;
      };
     }
     if (($6_1 | 0) != (-1 | 0)) {
      break label$2
     }
    }
    $1_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 20 | 0) >> 2] = $1_1;
    HEAP32[($0_1 + 16 | 0) >> 2] = $1_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
    $4_1 = $2_1;
    break label$1;
   }
   $4_1 = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = 0;
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | 32 | 0;
   if (($7_1 | 0) == (2 | 0)) {
    break label$1
   }
   $4_1 = $2_1 - (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $120($0_1) {
  $0_1 = $0_1 | 0;
  return 0 | 0;
 }
 
 function $121($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  i64toi32_i32$HIGH_BITS = 0;
  return 0 | 0;
 }
 
 function $122($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $1_1;
  $1_1 = $65(HEAP32[(0 + 2172 | 0) >> 2] | 0 | 0, $0_1 | 0, $1_1 | 0) | 0;
  global$0 = $2_1 + 16 | 0;
  return $1_1 | 0;
 }
 
 function $123($0_1) {
  $0_1 = $0_1 | 0;
  return 1 | 0;
 }
 
 function $124($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $125() {
  return global$0 | 0;
 }
 
 function $126($0_1) {
  $0_1 = $0_1 | 0;
  global$0 = $0_1;
 }
 
 function $127($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = (global$0 - $0_1 | 0) & -16 | 0;
  global$0 = $1_1;
  return $1_1 | 0;
 }
 
 function $128($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $1_1 = 0;
  label$1 : {
   label$2 : {
    if (!$0_1) {
     break label$2
    }
    label$3 : {
     if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) > (-1 | 0)) {
      break label$3
     }
     return $129($0_1 | 0) | 0 | 0;
    }
    $1_1 = $123($0_1 | 0) | 0;
    $2_1 = $129($0_1 | 0) | 0;
    if (!$1_1) {
     break label$1
    }
    $124($0_1 | 0);
    return $2_1 | 0;
   }
   $2_1 = 0;
   label$4 : {
    if (!(HEAP32[(0 + 2368 | 0) >> 2] | 0)) {
     break label$4
    }
    $2_1 = $128(HEAP32[(0 + 2368 | 0) >> 2] | 0 | 0) | 0;
   }
   label$5 : {
    $0_1 = HEAP32[($114() | 0) >> 2] | 0;
    if (!$0_1) {
     break label$5
    }
    label$6 : while (1) {
     $1_1 = 0;
     label$7 : {
      if ((HEAP32[($0_1 + 76 | 0) >> 2] | 0 | 0) < (0 | 0)) {
       break label$7
      }
      $1_1 = $123($0_1 | 0) | 0;
     }
     label$8 : {
      if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0) >>> 0 <= (HEAP32[($0_1 + 28 | 0) >> 2] | 0) >>> 0) {
       break label$8
      }
      $2_1 = $129($0_1 | 0) | 0 | $2_1 | 0;
     }
     label$9 : {
      if (!$1_1) {
       break label$9
      }
      $124($0_1 | 0);
     }
     $0_1 = HEAP32[($0_1 + 56 | 0) >> 2] | 0;
     if ($0_1) {
      continue label$6
     }
     break label$6;
    };
   }
   $115();
  }
  return $2_1 | 0;
 }
 
 function $129($0_1) {
  $0_1 = $0_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $1_1 = 0, $2_1 = 0;
  label$1 : {
   if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0) >>> 0 <= (HEAP32[($0_1 + 28 | 0) >> 2] | 0) >>> 0) {
    break label$1
   }
   FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
   if (HEAP32[($0_1 + 20 | 0) >> 2] | 0) {
    break label$1
   }
   return -1 | 0;
  }
  label$2 : {
   $1_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
   $2_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
   if ($1_1 >>> 0 >= $2_1 >>> 0) {
    break label$2
   }
   i64toi32_i32$1 = $1_1 - $2_1 | 0;
   i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
   i64toi32_i32$0 = FUNCTION_TABLE[HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0]($0_1, i64toi32_i32$1, i64toi32_i32$0, 1) | 0;
   i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  }
  HEAP32[($0_1 + 28 | 0) >> 2] = 0;
  i64toi32_i32$0 = $0_1;
  i64toi32_i32$1 = 0;
  HEAP32[($0_1 + 16 | 0) >> 2] = 0;
  HEAP32[($0_1 + 20 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$0 = $0_1;
  i64toi32_i32$1 = 0;
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = i64toi32_i32$1;
  return 0 | 0;
 }
 
 function $130() {
  return 4264 | 0;
 }
 
 function $131() {
  return 2176 | 0;
 }
 
 function $132() {
  fimport$19();
  HEAP32[(($28() | 0) + 172 | 0) >> 2] = 4264 + 40 | 0;
 }
 
 function $133() {
  var $4_1 = 0, $2_1 = 0, $1_1 = 0, $0_1 = 0, $3_1 = 0, $5_1 = 0, $6_1 = 0;
  label$1 : {
   $0_1 = $89() | 0;
   if (!(HEAP32[($0_1 + 44 | 0) >> 2] | 0)) {
    break label$1
   }
   $1_1 = 0;
   label$2 : while (1) {
    $2_1 = 0;
    $3_1 = 0;
    label$3 : while (1) {
     label$4 : {
      $4_1 = $2_1 << 2 | 0;
      $5_1 = (HEAP32[($0_1 + 100 | 0) >> 2] | 0) + $4_1 | 0;
      $6_1 = HEAP32[$5_1 >> 2] | 0;
      if (!$6_1) {
       break label$4
      }
      $4_1 = $4_1 + 4336 | 0;
      if (!(HEAP32[$4_1 >> 2] | 0)) {
       break label$4
      }
      HEAP32[$5_1 >> 2] = 0;
      FUNCTION_TABLE[HEAP32[$4_1 >> 2] | 0 | 0]($6_1);
      $3_1 = 1;
     }
     $2_1 = $2_1 + 1 | 0;
     if (($2_1 | 0) != (128 | 0)) {
      continue label$3
     }
     break label$3;
    };
    if ($1_1 >>> 0 > 2 >>> 0) {
     break label$1
    }
    $1_1 = $1_1 + 1 | 0;
    if ($3_1) {
     continue label$2
    }
    break label$2;
   };
  }
 }
 
 function $134() {
  var $0_1 = 0;
  label$1 : {
   $0_1 = global$1;
   if (!$0_1) {
    break label$1
   }
   $0_1 = $106(global$2 | 0, $0_1 | 0) | 0;
   $1($0_1 | 0);
   fimport$3(8 | 0, $0_1 | 0);
  }
 }
 
 function $135($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  $2_1 = ($0_1 >>> 0) / (1e6 >>> 0) | 0;
  HEAP32[($1_1 + 8 | 0) >> 2] = $2_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = Math_imul($0_1 - Math_imul($2_1, 1e6) | 0, 1e3);
  $0_1 = $14($1_1 + 8 | 0 | 0, $1_1 + 8 | 0 | 0) | 0;
  global$0 = $1_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $136($0_1, $1_1, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$0 = FUNCTION_TABLE[$0_1 | 0]($1_1, $2_1, i64toi32_i32$0, $3_1) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $137($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $17_1 = 0, $18_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $9$hi = 0, $12$hi = 0, $5_1 = 0, $5$hi = 0;
  $6_1 = $0_1;
  $7_1 = $1_1;
  i64toi32_i32$0 = 0;
  $9_1 = $2_1;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $17_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $17_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$0 = $9_1;
  i64toi32_i32$2 = $12$hi;
  i64toi32_i32$3 = $17_1;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  i64toi32_i32$2 = $136($6_1 | 0, $7_1 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0, i64toi32_i32$2 | 0, $4_1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $5_1 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  fimport$20($18_1 | 0);
  i64toi32_i32$2 = $5$hi;
  return $5_1 | 0;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21_1 = 0, $22_1 = 0, var$6 = 0, $24_1 = 0, $17_1 = 0, $18_1 = 0, $23_1 = 0, $29_1 = 0, $45_1 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17_1 = Math_imul(var$4, var$5);
  $18_1 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23_1 = $17_1 + Math_imul($18_1, $21_1) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29_1 = $23_1 + Math_imul($22_1, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45_1 = $29_1 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45_1 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24_1;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, var$2 = 0, var$3 = 0, var$4 = 0, var$5 = 0, var$5$hi = 0, var$6 = 0, var$6$hi = 0, i64toi32_i32$6 = 0, $37_1 = 0, $38_1 = 0, $39_1 = 0, $40_1 = 0, $41_1 = 0, $42_1 = 0, $43_1 = 0, $44_1 = 0, var$8$hi = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, var$7$hi = 0, $49_1 = 0, $63$hi = 0, $65_1 = 0, $65$hi = 0, $120$hi = 0, $129$hi = 0, $134$hi = 0, var$8 = 0, $140 = 0, $140$hi = 0, $142$hi = 0, $144 = 0, $144$hi = 0, $151 = 0, $151$hi = 0, $154$hi = 0, var$7 = 0, $165$hi = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             i64toi32_i32$0 = var$0$hi;
             i64toi32_i32$2 = var$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$3 = 32;
             i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
             if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
              i64toi32_i32$1 = 0;
              $37_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
             } else {
              i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
              $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
             }
             var$2 = $37_1;
             if (var$2) {
              block : {
               i64toi32_i32$1 = var$1$hi;
               var$3 = var$1;
               if (!var$3) {
                break label$11
               }
               i64toi32_i32$1 = var$1$hi;
               i64toi32_i32$0 = var$1;
               i64toi32_i32$2 = 0;
               i64toi32_i32$3 = 32;
               i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
               if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
                i64toi32_i32$2 = 0;
                $38_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
               } else {
                i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
                $38_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
               }
               var$4 = $38_1;
               if (!var$4) {
                break label$9
               }
               var$2 = Math_clz32(var$4) - Math_clz32(var$2) | 0;
               if (var$2 >>> 0 <= 31 >>> 0) {
                break label$8
               }
               break label$2;
              }
             }
             i64toi32_i32$2 = var$1$hi;
             i64toi32_i32$1 = var$1;
             i64toi32_i32$0 = 1;
             i64toi32_i32$3 = 0;
             if (i64toi32_i32$2 >>> 0 > i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
              break label$2
             }
             i64toi32_i32$1 = var$0$hi;
             var$2 = var$0;
             i64toi32_i32$1 = var$1$hi;
             var$3 = var$1;
             var$2 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
             i64toi32_i32$1 = 0;
             __wasm_intrinsics_temp_i64 = var$0 - Math_imul(var$2, var$3) | 0;
             __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
             i64toi32_i32$1 = 0;
             i64toi32_i32$2 = var$2;
             i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
             return i64toi32_i32$2 | 0;
            }
            i64toi32_i32$2 = var$1$hi;
            i64toi32_i32$3 = var$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$1 = 0;
             $39_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
            } else {
             i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
             $39_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
            }
            var$3 = $39_1;
            i64toi32_i32$1 = var$0$hi;
            if (!var$0) {
             break label$7
            }
            if (!var$3) {
             break label$6
            }
            var$4 = var$3 + -1 | 0;
            if (var$4 & var$3 | 0) {
             break label$6
            }
            i64toi32_i32$1 = 0;
            i64toi32_i32$2 = var$4 & var$2 | 0;
            i64toi32_i32$3 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$3 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
             $40_1 = 0;
            } else {
             i64toi32_i32$3 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
             $40_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
            }
            $63$hi = i64toi32_i32$3;
            i64toi32_i32$3 = var$0$hi;
            i64toi32_i32$1 = var$0;
            i64toi32_i32$2 = 0;
            i64toi32_i32$0 = -1;
            i64toi32_i32$2 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
            $65_1 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
            $65$hi = i64toi32_i32$2;
            i64toi32_i32$2 = $63$hi;
            i64toi32_i32$3 = $40_1;
            i64toi32_i32$1 = $65$hi;
            i64toi32_i32$0 = $65_1;
            i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
            __wasm_intrinsics_temp_i64 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
            __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$3 = var$2 >>> ((__wasm_ctz_i32(var$3 | 0) | 0) & 31 | 0) | 0;
            i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
            return i64toi32_i32$3 | 0;
           }
          }
          var$4 = var$3 + -1 | 0;
          if (!(var$4 & var$3 | 0)) {
           break label$5
          }
          var$2 = (Math_clz32(var$3) + 33 | 0) - Math_clz32(var$2) | 0;
          var$3 = 0 - var$2 | 0;
          break label$3;
         }
         var$3 = 63 - var$2 | 0;
         var$2 = var$2 + 1 | 0;
         break label$3;
        }
        var$4 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
        i64toi32_i32$3 = 0;
        i64toi32_i32$2 = var$2 - Math_imul(var$4, var$3) | 0;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 32;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
         $41_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $41_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
        }
        __wasm_intrinsics_temp_i64 = $41_1;
        __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 0;
        i64toi32_i32$2 = var$4;
        i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
        return i64toi32_i32$2 | 0;
       }
       var$2 = Math_clz32(var$3) - Math_clz32(var$2) | 0;
       if (var$2 >>> 0 < 31 >>> 0) {
        break label$4
       }
       break label$2;
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      __wasm_intrinsics_temp_i64 = var$4 & var$0 | 0;
      __wasm_intrinsics_temp_i64$hi = i64toi32_i32$2;
      if ((var$3 | 0) == (1 | 0)) {
       break label$1
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      $120$hi = i64toi32_i32$2;
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$3 = var$0;
      i64toi32_i32$1 = $120$hi;
      i64toi32_i32$0 = __wasm_ctz_i32(var$3 | 0) | 0;
      i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
       i64toi32_i32$1 = 0;
       $42_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
       $42_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
      }
      i64toi32_i32$3 = $42_1;
      i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
      return i64toi32_i32$3 | 0;
     }
     var$3 = 63 - var$2 | 0;
     var$2 = var$2 + 1 | 0;
    }
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$3 = 0;
    $129$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$2 = var$0;
    i64toi32_i32$1 = $129$hi;
    i64toi32_i32$0 = var$2 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $43_1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
     $43_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    var$5 = $43_1;
    var$5$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$1 = 0;
    $134$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$3 = var$0;
    i64toi32_i32$2 = $134$hi;
    i64toi32_i32$0 = var$3 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
     $44_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $44_1 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
    }
    var$0 = $44_1;
    var$0$hi = i64toi32_i32$2;
    label$13 : {
     if (var$2) {
      block3 : {
       i64toi32_i32$2 = var$1$hi;
       i64toi32_i32$1 = var$1;
       i64toi32_i32$3 = -1;
       i64toi32_i32$0 = -1;
       i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
       i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
       if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
        i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
       }
       var$8 = i64toi32_i32$4;
       var$8$hi = i64toi32_i32$5;
       label$15 : while (1) {
        i64toi32_i32$5 = var$5$hi;
        i64toi32_i32$2 = var$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
         $45_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
         $45_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
        }
        $140 = $45_1;
        $140$hi = i64toi32_i32$1;
        i64toi32_i32$1 = var$0$hi;
        i64toi32_i32$5 = var$0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 63;
        i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = 0;
         $46_1 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
        } else {
         i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
         $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$3 | 0) | 0;
        }
        $142$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $140$hi;
        i64toi32_i32$1 = $140;
        i64toi32_i32$5 = $142$hi;
        i64toi32_i32$0 = $46_1;
        i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
        var$5 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
        var$5$hi = i64toi32_i32$5;
        $144 = var$5;
        $144$hi = i64toi32_i32$5;
        i64toi32_i32$5 = var$8$hi;
        i64toi32_i32$5 = var$5$hi;
        i64toi32_i32$5 = var$8$hi;
        i64toi32_i32$2 = var$8;
        i64toi32_i32$1 = var$5$hi;
        i64toi32_i32$0 = var$5;
        i64toi32_i32$3 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
        i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
        i64toi32_i32$4 = i64toi32_i32$6 + i64toi32_i32$1 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
        i64toi32_i32$5 = i64toi32_i32$3;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 63;
        i64toi32_i32$1 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = i64toi32_i32$4 >> 31 | 0;
         $47_1 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
        } else {
         i64toi32_i32$2 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
         $47_1 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$1 | 0) | 0;
        }
        var$6 = $47_1;
        var$6$hi = i64toi32_i32$2;
        i64toi32_i32$2 = var$1$hi;
        i64toi32_i32$2 = var$6$hi;
        i64toi32_i32$4 = var$6;
        i64toi32_i32$5 = var$1$hi;
        i64toi32_i32$0 = var$1;
        i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
        $151 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
        $151$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $144$hi;
        i64toi32_i32$2 = $144;
        i64toi32_i32$4 = $151$hi;
        i64toi32_i32$0 = $151;
        i64toi32_i32$1 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
        i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
        i64toi32_i32$3 = i64toi32_i32$6 + i64toi32_i32$4 | 0;
        i64toi32_i32$3 = i64toi32_i32$5 - i64toi32_i32$3 | 0;
        var$5 = i64toi32_i32$1;
        var$5$hi = i64toi32_i32$3;
        i64toi32_i32$3 = var$0$hi;
        i64toi32_i32$5 = var$0;
        i64toi32_i32$2 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
         $48_1 = 0;
        } else {
         i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $48_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
        }
        $154$hi = i64toi32_i32$2;
        i64toi32_i32$2 = var$7$hi;
        i64toi32_i32$2 = $154$hi;
        i64toi32_i32$3 = $48_1;
        i64toi32_i32$5 = var$7$hi;
        i64toi32_i32$0 = var$7;
        i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
        var$0 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
        var$0$hi = i64toi32_i32$5;
        i64toi32_i32$5 = var$6$hi;
        i64toi32_i32$2 = var$6;
        i64toi32_i32$3 = 0;
        i64toi32_i32$0 = 1;
        i64toi32_i32$3 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
        var$6 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
        var$6$hi = i64toi32_i32$3;
        var$7 = var$6;
        var$7$hi = i64toi32_i32$3;
        var$2 = var$2 + -1 | 0;
        if (var$2) {
         continue label$15
        }
        break label$15;
       };
       break label$13;
      }
     }
    }
    i64toi32_i32$3 = var$5$hi;
    __wasm_intrinsics_temp_i64 = var$5;
    __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$5 = var$0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$0 = 1;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
     $49_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
     $49_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
    }
    $165$hi = i64toi32_i32$2;
    i64toi32_i32$2 = var$6$hi;
    i64toi32_i32$2 = $165$hi;
    i64toi32_i32$3 = $49_1;
    i64toi32_i32$5 = var$6$hi;
    i64toi32_i32$0 = var$6;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    i64toi32_i32$3 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
    i64toi32_i32$HIGH_BITS = i64toi32_i32$5;
    return i64toi32_i32$3 | 0;
   }
   i64toi32_i32$3 = var$0$hi;
   __wasm_intrinsics_temp_i64 = var$0;
   __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   var$0 = 0;
   var$0$hi = i64toi32_i32$3;
  }
  i64toi32_i32$3 = var$0$hi;
  i64toi32_i32$5 = var$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$3;
  return i64toi32_i32$5 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_i64_udiv(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 function __wasm_ctz_i32(var$0) {
  var$0 = var$0 | 0;
  if (var$0) {
   return 31 - Math_clz32((var$0 + -1 | 0) ^ var$0 | 0) | 0 | 0
  }
  return 32 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 var FUNCTION_TABLE = Table([null, $9, $25, $66, $67, $120, $119, $121, $105]);
 $2();
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
 }
 
 return {
  "__indirect_function_table": FUNCTION_TABLE, 
  "__wasm_call_ctors": $0, 
  "main": $11, 
  "emscripten_get_global_libc": $130, 
  "__em_js__initPthreadsJS": $131, 
  "__emscripten_pthread_data_constructor": $132, 
  "__errno_location": $13, 
  "usleep": $135, 
  "fflush": $128, 
  "pthread_self": $28, 
  "__pthread_tsd_run_dtors": $133, 
  "emscripten_main_thread_process_queued_calls": $85, 
  "emscripten_current_thread_process_queued_calls": $72, 
  "free": $105, 
  "emscripten_register_main_browser_thread_id": $77, 
  "emscripten_main_browser_thread_id": $78, 
  "_emscripten_do_dispatch_to_thread": $79, 
  "malloc": $103, 
  "emscripten_sync_run_in_main_thread_2": $83, 
  "emscripten_sync_run_in_main_thread_4": $84, 
  "emscripten_run_in_main_runtime_thread_js": $86, 
  "_emscripten_call_on_thread": $88, 
  "emscripten_stack_get_end": $99, 
  "_emscripten_main_thread_futex": global$8, 
  "emscripten_tls_init": $134, 
  "_emscripten_thread_init": $90, 
  "stackSave": $125, 
  "stackRestore": $126, 
  "stackAlloc": $127, 
  "emscripten_stack_init": $96, 
  "emscripten_stack_set_limits": $97, 
  "emscripten_stack_get_free": $98, 
  "memalign": $106, 
  "dynCall_jiji": $137
 };
}

  return asmFunc(asmLibraryArg);
}

)(asmLibraryArg);
  },

  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          'module': module,
          'instance': new WebAssembly.Instance(module)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return { catch: function() {} };
      }
    };
  },

  RuntimeError: Error
};

// We don't need to actually download a wasm binary, mark it as present but empty.
wasmBinary = [];

// end include: wasm2js.js
if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

// For sending to workers.
var wasmModule;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;
  assert(typeof allocator === 'number', 'allocate no longer takes a type argument')
  assert(typeof slab !== 'number', 'allocate no longer takes a number as arg0')

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = _malloc(slab.length);
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;

    var str = '';
    while (!(idx >= endIdx)) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      // If not building with TextDecoder enabled, we don't know the string length, so scan for \0 byte.
      // If building with TextDecoder, we know exactly at what byte index the string ends, so checking for nulls here would be redundant.
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr, maxBytesToRead) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}

var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;if (!Object.getOwnPropertyDescriptor(Module, 'INITIAL_MEMORY')) Object.defineProperty(Module, 'INITIAL_MEMORY', { configurable: true, get: function() { abort('Module.INITIAL_MEMORY has been replaced with plain INITIAL_MEMORY (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)') } });

assert(INITIAL_MEMORY >= TOTAL_STACK, 'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js


// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)

if (ENVIRONMENT_IS_PTHREAD) {
  wasmMemory = Module['wasmMemory'];
  buffer = Module['buffer'];
} else {

  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_MEMORY / 65536
      ,
      'maximum': INITIAL_MEMORY / 65536
      ,
      'shared': true
    });
    if (!(wasmMemory.buffer instanceof SharedArrayBuffer)) {
      err('requested a shared WebAssembly.Memory but the returned buffer is not a SharedArrayBuffer, indicating that while the browser has SharedArrayBuffer it does not have WebAssembly threads support - you may need to set a flag');
      if (ENVIRONMENT_IS_NODE) {
        console.log('(on node you may need: --experimental-wasm-threads --experimental-wasm-bulk-memory and also use a recent version)');
      }
      throw Error('bad memory');
    }
  }

}

if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['INITIAL_MEMORY'].
INITIAL_MEMORY = buffer.byteLength;
assert(INITIAL_MEMORY % 65536 === 0);
updateGlobalBufferAndViews(buffer);

// end include: runtime_init_memory.js

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // The stack grows downwards
  HEAPU32[(max >> 2)+1] = 0x2135467;
  HEAPU32[(max >> 2)+2] = 0x89BACDFE;
  // Also test the global address 0 for integrity.
  HEAP32[0] = 0x63736d65; /* 'emsc' */
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[(max >> 2)+1];
  var cookie2 = HEAPU32[(max >> 2)+2];
  if (cookie1 != 0x2135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

// end include: runtime_stack_check.js
// include: runtime_assertions.js


// Endianness check (note: assumes compiler arch was little-endian)
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';
})();

function abortFnPtrError(ptr, sig) {
	abort("Invalid function pointer " + ptr + " called with signature '" + sig + "'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this). Build with ASSERTIONS=2 for more info.");
}

// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;

if (!ENVIRONMENT_IS_PTHREAD)
__ATINIT__.push({ func: function() { ___wasm_call_ctors() } });

if (ENVIRONMENT_IS_PTHREAD) runtimeInitialized = true; // The runtime is hosted in the main thread, and bits shared to pthreads via SharedArrayBuffer. No need to init again in pthread.

function preRun() {
  if (ENVIRONMENT_IS_PTHREAD) return; // PThreads reuse the runtime from the main thread.

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  if (ENVIRONMENT_IS_PTHREAD) return; // PThreads reuse the runtime from the main thread.
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  if (ENVIRONMENT_IS_PTHREAD) return; // PThreads reuse the runtime from the main thread.
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  if (ENVIRONMENT_IS_PTHREAD) return; // PThreads reuse the runtime from the main thread.

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  // We should never get here in pthreads (could no-op this out if called in pthreads, but that might indicate a bug in caller side,
  // so good to be very explicit)
  assert(!ENVIRONMENT_IS_PTHREAD, "addRunDependency cannot be used in a pthread worker");
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (ENVIRONMENT_IS_PTHREAD) console.error('Pthread aborting at ' + new Error().stack);
  what += '';
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  var output = 'abort(' + what + ') at ' + stackTrace();
  what = output;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// include: URIUtils.js


function hasPrefix(str, prefix) {
  return String.prototype.startsWith ?
      str.startsWith(prefix) :
      str.indexOf(prefix) === 0;
}

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return hasPrefix(filename, dataURIPrefix);
}

var fileURIPrefix = "file://";

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return hasPrefix(filename, fileURIPrefix);
}

// end include: URIUtils.js
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(runtimeInitialized, 'native function `' + displayName + '` called before runtime initialization');
    assert(!runtimeExited, 'native function `' + displayName + '` called after runtime exit (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
    if (!asm[name]) {
      assert(asm[name], 'exported native function `' + displayName + '` not found');
    }
    return asm[name].apply(null, arguments);
  };
}

var wasmBinaryFile = 'dp.wasm';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    var binary = tryParseAsDataURI(file);
    if (binary) {
      return binary;
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }
    
  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    Module['asm'] = exports;

    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, "table not found in wasm exports");

    // We now have the Wasm module loaded up, keep a reference to the compiled module so we can post it to the workers.
    wasmModule = module;
    // Instantiation is synchronous in pthreads and we assert on run dependencies.
    if (!ENVIRONMENT_IS_PTHREAD) {
      var numWorkersToLoad = PThread.unusedWorkers.length;
      PThread.unusedWorkers.forEach(function(w) { PThread.loadWasmModuleToWorker(w, function() {
        // PTHREAD_POOL_DELAY_LOAD==0: we wanted to synchronously wait until the Worker pool
        // has loaded up. If all Workers have finished loading up the Wasm Module, proceed with main()
        if (!--numWorkersToLoad) removeRunDependency('wasm-instantiate');
      })});
    }
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  if (!ENVIRONMENT_IS_PTHREAD) { addRunDependency('wasm-instantiate'); }

  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiatedSource(output) {
    // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    receiveInstance(output['instance'], output['module']);
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);

      abort(reason);
    });
  }

  // Prefer streaming instantiation if available.
  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiatedSource, function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiatedSource);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource);
    }
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  1669: function() {throw 'Canceled!'},  
 1919: function($0, $1) {setTimeout(function() { __emscripten_do_dispatch_to_thread($0, $1); }, 0);}
};
function initPthreadsJS(){ PThread.initRuntime(); }





  function abortStackOverflow(allocSize) {
      abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (_emscripten_stack_get_free() + allocSize) + ' bytes available!');
    }

  function callRuntimeCallbacks(callbacks) {
      while(callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            wasmTable.get(func)();
          } else {
            wasmTable.get(func)(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  var ERRNO_CODES={EPERM:63,ENOENT:44,ESRCH:71,EINTR:27,EIO:29,ENXIO:60,E2BIG:1,ENOEXEC:45,EBADF:8,ECHILD:12,EAGAIN:6,EWOULDBLOCK:6,ENOMEM:48,EACCES:2,EFAULT:21,ENOTBLK:105,EBUSY:10,EEXIST:20,EXDEV:75,ENODEV:43,ENOTDIR:54,EISDIR:31,EINVAL:28,ENFILE:41,EMFILE:33,ENOTTY:59,ETXTBSY:74,EFBIG:22,ENOSPC:51,ESPIPE:70,EROFS:69,EMLINK:34,EPIPE:64,EDOM:18,ERANGE:68,ENOMSG:49,EIDRM:24,ECHRNG:106,EL2NSYNC:156,EL3HLT:107,EL3RST:108,ELNRNG:109,EUNATCH:110,ENOCSI:111,EL2HLT:112,EDEADLK:16,ENOLCK:46,EBADE:113,EBADR:114,EXFULL:115,ENOANO:104,EBADRQC:103,EBADSLT:102,EDEADLOCK:16,EBFONT:101,ENOSTR:100,ENODATA:116,ETIME:117,ENOSR:118,ENONET:119,ENOPKG:120,EREMOTE:121,ENOLINK:47,EADV:122,ESRMNT:123,ECOMM:124,EPROTO:65,EMULTIHOP:36,EDOTDOT:125,EBADMSG:9,ENOTUNIQ:126,EBADFD:127,EREMCHG:128,ELIBACC:129,ELIBBAD:130,ELIBSCN:131,ELIBMAX:132,ELIBEXEC:133,ENOSYS:52,ENOTEMPTY:55,ENAMETOOLONG:37,ELOOP:32,EOPNOTSUPP:138,EPFNOSUPPORT:139,ECONNRESET:15,ENOBUFS:42,EAFNOSUPPORT:5,EPROTOTYPE:67,ENOTSOCK:57,ENOPROTOOPT:50,ESHUTDOWN:140,ECONNREFUSED:14,EADDRINUSE:3,ECONNABORTED:13,ENETUNREACH:40,ENETDOWN:38,ETIMEDOUT:73,EHOSTDOWN:142,EHOSTUNREACH:23,EINPROGRESS:26,EALREADY:7,EDESTADDRREQ:17,EMSGSIZE:35,EPROTONOSUPPORT:66,ESOCKTNOSUPPORT:137,EADDRNOTAVAIL:4,ENETRESET:39,EISCONN:30,ENOTCONN:53,ETOOMANYREFS:141,EUSERS:136,EDQUOT:19,ESTALE:72,ENOTSUP:138,ENOMEDIUM:148,EILSEQ:25,EOVERFLOW:61,ECANCELED:11,ENOTRECOVERABLE:56,EOWNERDEAD:62,ESTRPIPE:135};
  
  function _emscripten_futex_wake(addr, count) {
      if (addr <= 0 || addr > HEAP8.length || addr&3 != 0 || count < 0) return -28;
      if (count == 0) return 0;
      // Waking (at least) INT_MAX waiters is defined to mean wake all callers.
      // For Atomics.notify() API Infinity is to be passed in that case.
      if (count >= 2147483647) count = Infinity;
  
      // See if main thread is waiting on this address? If so, wake it up by resetting its wake location to zero.
      // Note that this is not a fair procedure, since we always wake main thread first before any workers, so
      // this scheme does not adhere to real queue-based waiting.
      assert(__emscripten_main_thread_futex > 0);
      var mainThreadWaitAddress = Atomics.load(HEAP32, __emscripten_main_thread_futex >> 2);
      var mainThreadWoken = 0;
      if (mainThreadWaitAddress == addr) {
        // We only use __emscripten_main_thread_futex on the main browser thread, where we
        // cannot block while we wait. Therefore we should only see it set from
        // other threads, and not on the main thread itself. In other words, the
        // main thread must never try to wake itself up!
        assert(!ENVIRONMENT_IS_WEB);
        var loadedAddr = Atomics.compareExchange(HEAP32, __emscripten_main_thread_futex >> 2, mainThreadWaitAddress, 0);
        if (loadedAddr == mainThreadWaitAddress) {
          --count;
          mainThreadWoken = 1;
          if (count <= 0) return 1;
        }
      }
  
      // Wake any workers waiting on this address.
      var ret = Atomics.notify(HEAP32, addr >> 2, count);
      if (ret >= 0) return ret + mainThreadWoken;
      throw 'Atomics.notify returned an unexpected value ' + ret;
    }
  Module["_emscripten_futex_wake"] = _emscripten_futex_wake;
  
  function killThread(pthread_ptr) {
      if (ENVIRONMENT_IS_PTHREAD) throw 'Internal Error! killThread() can only ever be called from main application thread!';
      if (!pthread_ptr) throw 'Internal Error! Null pthread_ptr in killThread!';
      HEAP32[(((pthread_ptr)+(12))>>2)]=0;
      var pthread = PThread.pthreads[pthread_ptr];
      pthread.worker.terminate();
      PThread.freeThreadData(pthread);
      // The worker was completely nuked (not just the pthread execution it was hosting), so remove it from running workers
      // but don't put it back to the pool.
      PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(pthread.worker), 1); // Not a running Worker anymore.
      pthread.worker.pthread = undefined;
    }
  
  function cancelThread(pthread_ptr) {
      if (ENVIRONMENT_IS_PTHREAD) throw 'Internal Error! cancelThread() can only ever be called from main application thread!';
      if (!pthread_ptr) throw 'Internal Error! Null pthread_ptr in cancelThread!';
      var pthread = PThread.pthreads[pthread_ptr];
      pthread.worker.postMessage({ 'cmd': 'cancel' });
    }
  
  function cleanupThread(pthread_ptr) {
      if (ENVIRONMENT_IS_PTHREAD) throw 'Internal Error! cleanupThread() can only ever be called from main application thread!';
      if (!pthread_ptr) throw 'Internal Error! Null pthread_ptr in cleanupThread!';
      HEAP32[(((pthread_ptr)+(12))>>2)]=0;
      var pthread = PThread.pthreads[pthread_ptr];
      if (pthread) {
        var worker = pthread.worker;
        PThread.returnWorkerToPool(worker);
      }
    }
  var PThread={unusedWorkers:[],runningWorkers:[],initMainThreadBlock:function() {
        assert(!ENVIRONMENT_IS_PTHREAD);
  
        var pthreadPoolSize = 7;
        // Start loading up the Worker pool, if requested.
        for(var i = 0; i < pthreadPoolSize; ++i) {
          PThread.allocateUnusedWorker();
        }
      },initRuntime:function() {
  
        var tb = _malloc(228);
  
        for (var i = 0; i < 228/4; ++i) HEAPU32[tb/4+i] = 0;
  
        // The pthread struct has a field that points to itself - this is used as
          // a magic ID to detect whether the pthread_t structure is 'alive'.
        HEAP32[(((tb)+(12))>>2)]=tb;
  
        // pthread struct robust_list head should point to itself.
        var headPtr = tb + 152;
        HEAP32[((headPtr)>>2)]=headPtr;
  
        // Allocate memory for thread-local storage.
        var tlsMemory = _malloc(512);
        for (var i = 0; i < 128; ++i) HEAPU32[tlsMemory/4+i] = 0;
        Atomics.store(HEAPU32, (tb + 100 ) >> 2, tlsMemory); // Init thread-local-storage memory array.
        Atomics.store(HEAPU32, (tb + 40 ) >> 2, tb); // Main thread ID.
  
        // Pass the thread address to the native code where they stored in wasm
        // globals which act as a form of TLS. Global constructors trying
        // to access this value will read the wrong value, but that is UB anyway.
        __emscripten_thread_init(tb, /*isMainBrowserThread=*/!ENVIRONMENT_IS_WORKER, /*isMainRuntimeThread=*/1);
        _emscripten_register_main_browser_thread_id(tb);
  
      },initWorker:function() {
  
      },pthreads:{},threadExitHandlers:[],setThreadStatus:function() {},runExitHandlers:function() {
        while (PThread.threadExitHandlers.length > 0) {
          PThread.threadExitHandlers.pop()();
        }
  
        // Call into the musl function that runs destructors of all thread-specific data.
        if (ENVIRONMENT_IS_PTHREAD && _pthread_self()) ___pthread_tsd_run_dtors();
      },threadExit:function(exitCode) {
        var tb = _pthread_self();
        if (tb) { // If we haven't yet exited?
          err('Pthread 0x' + tb.toString(16) + ' exited.');
          Atomics.store(HEAPU32, (tb + 4 ) >> 2, exitCode);
          // When we publish this, the main thread is free to deallocate the thread object and we are done.
          // Therefore set _pthread_self = 0; above to 'release' the object in this worker thread.
          Atomics.store(HEAPU32, (tb + 0 ) >> 2, 1);
  
          // Disable all cancellation so that executing the cleanup handlers won't trigger another JS
          // canceled exception to be thrown.
          Atomics.store(HEAPU32, (tb + 56 ) >> 2, 1/*PTHREAD_CANCEL_DISABLE*/);
          Atomics.store(HEAPU32, (tb + 60 ) >> 2, 0/*PTHREAD_CANCEL_DEFERRED*/);
          PThread.runExitHandlers();
  
          _emscripten_futex_wake(tb + 0, 2147483647);
          __emscripten_thread_init(0, 0, 0); // Unregister the thread block also inside the asm.js scope.
          if (ENVIRONMENT_IS_PTHREAD) {
            // Note: in theory we would like to return any offscreen canvases back to the main thread,
            // but if we ever fetched a rendering context for them that would not be valid, so we don't try.
            postMessage({ 'cmd': 'exit' });
          }
        }
      },threadCancel:function() {
        PThread.runExitHandlers();
        var tb = _pthread_self();
        Atomics.store(HEAPU32, (tb + 4 ) >> 2, -1/*PTHREAD_CANCELED*/);
        Atomics.store(HEAPU32, (tb + 0 ) >> 2, 1); // Mark the thread as no longer running.
        _emscripten_futex_wake(tb + 0, 2147483647); // wake all threads
        // Not hosting a pthread anymore in this worker, reset the info structures to null.
        __emscripten_thread_init(0, 0, 0); // Unregister the thread block also inside the asm.js scope.
        postMessage({ 'cmd': 'cancelDone' });
      },terminateAllThreads:function() {
        for (var t in PThread.pthreads) {
          var pthread = PThread.pthreads[t];
          if (pthread && pthread.worker) {
            PThread.returnWorkerToPool(pthread.worker);
          }
        }
        PThread.pthreads = {};
  
        for (var i = 0; i < PThread.unusedWorkers.length; ++i) {
          var worker = PThread.unusedWorkers[i];
          assert(!worker.pthread); // This Worker should not be hosting a pthread at this time.
          worker.terminate();
        }
        PThread.unusedWorkers = [];
  
        for (var i = 0; i < PThread.runningWorkers.length; ++i) {
          var worker = PThread.runningWorkers[i];
          var pthread = worker.pthread;
          assert(pthread, 'This Worker should have a pthread it is executing');
          PThread.freeThreadData(pthread);
          worker.terminate();
        }
        PThread.runningWorkers = [];
      },freeThreadData:function(pthread) {
        if (!pthread) return;
        if (pthread.threadInfoStruct) {
          var tlsMemory = HEAP32[(((pthread.threadInfoStruct)+(100))>>2)];
          HEAP32[(((pthread.threadInfoStruct)+(100))>>2)]=0;
          _free(tlsMemory);
          _free(pthread.threadInfoStruct);
        }
        pthread.threadInfoStruct = 0;
        if (pthread.allocatedOwnStack && pthread.stackBase) _free(pthread.stackBase);
        pthread.stackBase = 0;
        if (pthread.worker) pthread.worker.pthread = null;
      },returnWorkerToPool:function(worker) {
        delete PThread.pthreads[worker.pthread.threadInfoStruct];
        //Note: worker is intentionally not terminated so the pool can dynamically grow.
        PThread.unusedWorkers.push(worker);
        PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1); // Not a running Worker anymore
        PThread.freeThreadData(worker.pthread);
        // Detach the worker from the pthread object, and return it to the worker pool as an unused worker.
        worker.pthread = undefined;
      },receiveObjectTransfer:function(data) {
      },loadWasmModuleToWorker:function(worker, onFinishedLoading) {
        worker.onmessage = function(e) {
          var d = e['data'];
          var cmd = d['cmd'];
          // Sometimes we need to backproxy events to the calling thread (e.g.
          // HTML5 DOM events handlers such as
          // emscripten_set_mousemove_callback()), so keep track in a globally
          // accessible variable about the thread that initiated the proxying.
          if (worker.pthread) PThread.currentProxiedOperationCallerThread = worker.pthread.threadInfoStruct;
  
          // If this message is intended to a recipient that is not the main thread, forward it to the target thread.
          if (d['targetThread'] && d['targetThread'] != _pthread_self()) {
            var thread = PThread.pthreads[d.targetThread];
            if (thread) {
              thread.worker.postMessage(e.data, d['transferList']);
            } else {
              console.error('Internal error! Worker sent a message "' + cmd + '" to target pthread ' + d['targetThread'] + ', but that thread no longer exists!');
            }
            PThread.currentProxiedOperationCallerThread = undefined;
            return;
          }
  
          if (cmd === 'processQueuedMainThreadWork') {
            // TODO: Must post message to main Emscripten thread in PROXY_TO_WORKER mode.
            _emscripten_main_thread_process_queued_calls();
          } else if (cmd === 'spawnThread') {
            spawnThread(e.data);
          } else if (cmd === 'cleanupThread') {
            cleanupThread(d['thread']);
          } else if (cmd === 'killThread') {
            killThread(d['thread']);
          } else if (cmd === 'cancelThread') {
            cancelThread(d['thread']);
          } else if (cmd === 'loaded') {
            worker.loaded = true;
            if (onFinishedLoading) onFinishedLoading(worker);
            // If this Worker is already pending to start running a thread, launch the thread now
            if (worker.runPthread) {
              worker.runPthread();
              delete worker.runPthread;
            }
          } else if (cmd === 'print') {
            out('Thread ' + d['threadId'] + ': ' + d['text']);
          } else if (cmd === 'printErr') {
            err('Thread ' + d['threadId'] + ': ' + d['text']);
          } else if (cmd === 'alert') {
            alert('Thread ' + d['threadId'] + ': ' + d['text']);
          } else if (cmd === 'exit') {
            var detached = worker.pthread && Atomics.load(HEAPU32, (worker.pthread.threadInfoStruct + 64) >> 2);
            if (detached) {
              PThread.returnWorkerToPool(worker);
            }
          } else if (cmd === 'exitProcess') {
            // A pthread has requested to exit the whole application process (runtime).
            err("exitProcess requested by worker");
            try {
              exit(d['returnCode']);
            } catch (e) {
              if (e instanceof ExitStatus) return;
              throw e;
            }
          } else if (cmd === 'cancelDone') {
            PThread.returnWorkerToPool(worker);
          } else if (cmd === 'objectTransfer') {
            PThread.receiveObjectTransfer(e.data);
          } else if (e.data.target === 'setimmediate') {
            worker.postMessage(e.data); // Worker wants to postMessage() to itself to implement setImmediate() emulation.
          } else {
            err("worker sent an unknown command " + cmd);
          }
          PThread.currentProxiedOperationCallerThread = undefined;
        };
  
        worker.onerror = function(e) {
          err('pthread sent an error! ' + e.filename + ':' + e.lineno + ': ' + e.message);
        };
  
        if (ENVIRONMENT_IS_NODE) {
          worker.on('message', function(data) {
            worker.onmessage({ data: data });
          });
          worker.on('error', function(data) {
            worker.onerror(data);
          });
          worker.on('exit', function(data) {
            // TODO: update the worker queue?
            // See: https://github.com/emscripten-core/emscripten/issues/9763
          });
        }
  
        assert(wasmMemory instanceof WebAssembly.Memory, 'WebAssembly memory should have been loaded by now!');
        assert(wasmModule instanceof WebAssembly.Module, 'WebAssembly Module should have been loaded by now!');
  
        // Ask the new worker to load up the Emscripten-compiled page. This is a heavy operation.
        worker.postMessage({
          'cmd': 'load',
          // If the application main .js file was loaded from a Blob, then it is not possible
          // to access the URL of the current script that could be passed to a Web Worker so that
          // it could load up the same file. In that case, developer must either deliver the Blob
          // object in Module['mainScriptUrlOrBlob'], or a URL to it, so that pthread Workers can
          // independently load up the same main application file.
          'urlOrBlob': Module['mainScriptUrlOrBlob'] || _scriptDir,
          // the polyfill WebAssembly.Memory instance has function properties,
          // which will fail in postMessage, so just send a custom object with the
          // property we need, the buffer
          'wasmMemory': { 'buffer': wasmMemory.buffer },
          'wasmModule': wasmModule,
        });
      },allocateUnusedWorker:function() {
        // Allow HTML module to configure the location where the 'worker.js' file will be loaded from,
        // via Module.locateFile() function. If not specified, then the default URL 'worker.js' relative
        // to the main html file is loaded.
        var pthreadMainJs = locateFile('dp.worker.js');
        PThread.unusedWorkers.push(new Worker(pthreadMainJs));
      },getNewWorker:function() {
        if (PThread.unusedWorkers.length == 0) {
          PThread.allocateUnusedWorker();
          PThread.loadWasmModuleToWorker(PThread.unusedWorkers[0]);
        }
        if (PThread.unusedWorkers.length > 0) return PThread.unusedWorkers.pop();
        else return null;
      },busySpinWait:function(msecs) {
        var t = performance.now() + msecs;
        while(performance.now() < t) {
          ;
        }
      }};
  function establishStackSpace(stackTop, stackMax) {
      _emscripten_stack_set_limits(stackTop, stackMax);
  
      // Call inside wasm module to set up the stack frame for this pthread in asm.js/wasm module scope
      stackRestore(stackTop);
  
      // Write the stack cookie last, after we have set up the proper bounds and
      // current position of the stack.
      writeStackCookie();
    }
  Module["establishStackSpace"] = establishStackSpace;

  function getNoExitRuntime() {
      return noExitRuntime;
    }
  Module["getNoExitRuntime"] = getNoExitRuntime;

  function invokeEntryPoint(ptr, arg) {
      return wasmTable.get(ptr)(arg);
    }
  Module["invokeEntryPoint"] = invokeEntryPoint;

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    }

  var _emscripten_get_now;if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (ENVIRONMENT_IS_PTHREAD) {
    _emscripten_get_now = function() { return performance.now() - Module['__performance_now_clock_drift']; };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else _emscripten_get_now = function() { return performance.now(); }
  ;
  
  var _emscripten_get_now_is_monotonic=true;;
  
  function setErrNo(value) {
      HEAP32[((___errno_location())>>2)]=value;
      return value;
    }
  function _clock_gettime(clk_id, tp) {
      // int clock_gettime(clockid_t clk_id, struct timespec *tp);
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[((tp)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((tp)+(4))>>2)]=((now % 1000)*1000*1000)|0; // nanoseconds
      return 0;
    }
  function ___clock_gettime(a0,a1
  ) {
  return _clock_gettime(a0,a1);
  }

  function __emscripten_notify_thread_queue(targetThreadId, mainThreadId) {
      if (targetThreadId == mainThreadId) {
        postMessage({'cmd' : 'processQueuedMainThreadWork'});
      } else if (ENVIRONMENT_IS_PTHREAD) {
        postMessage({'targetThread': targetThreadId, 'cmd': 'processThreadQueue'});
      } else {
        var pthread = PThread.pthreads[targetThreadId];
        var worker = pthread && pthread.worker;
        if (!worker) {
          err('Cannot send message to thread with ID ' + targetThreadId + ', unknown thread ID!');
          return /*0*/;
        }
        worker.postMessage({'cmd' : 'processThreadQueue'});
      }
      return 1;
    }

  function _emscripten_asm_const_int(code, sigPtr, argbuf) {
      var args = readAsmConstArgs(sigPtr, argbuf);
      return ASM_CONSTS[code].apply(null, args);
    }

  function _emscripten_conditional_set_current_thread_status_js(expectedStatus, newStatus) {
    }
  function _emscripten_conditional_set_current_thread_status(expectedStatus, newStatus) {
    }

  function _emscripten_futex_wait(addr, val, timeout) {
      if (addr <= 0 || addr > HEAP8.length || addr&3 != 0) return -28;
      // We can do a normal blocking wait anywhere but on the main browser thread.
      if (!ENVIRONMENT_IS_WEB) {
        var ret = Atomics.wait(HEAP32, addr >> 2, val, timeout);
        if (ret === 'timed-out') return -73;
        if (ret === 'not-equal') return -6;
        if (ret === 'ok') return 0;
        throw 'Atomics.wait returned an unexpected value ' + ret;
      } else {
        // First, check if the value is correct for us to wait on.
        if (Atomics.load(HEAP32, addr >> 2) != val) {
          return -6;
        }
  
        // Atomics.wait is not available in the main browser thread, so simulate it via busy spinning.
        var tNow = performance.now();
        var tEnd = tNow + timeout;
  
        // Register globally which address the main thread is simulating to be
        // waiting on. When zero, the main thread is not waiting on anything, and on
        // nonzero, the contents of the address pointed by __emscripten_main_thread_futex
        // tell which address the main thread is simulating its wait on.
        // We need to be careful of recursion here: If we wait on a futex, and
        // then call _emscripten_main_thread_process_queued_calls() below, that
        // will call code that takes the proxying mutex - which can once more
        // reach this code in a nested call. To avoid interference between the
        // two (there is just a single __emscripten_main_thread_futex at a time), unmark
        // ourselves before calling the potentially-recursive call. See below for
        // how we handle the case of our futex being notified during the time in
        // between when we are not set as the value of __emscripten_main_thread_futex.
        assert(__emscripten_main_thread_futex > 0);
        var lastAddr = Atomics.exchange(HEAP32, __emscripten_main_thread_futex >> 2, addr);
        // We must not have already been waiting.
        assert(lastAddr == 0);
  
        while (1) {
          // Check for a timeout.
          tNow = performance.now();
          if (tNow > tEnd) {
            // We timed out, so stop marking ourselves as waiting.
            lastAddr = Atomics.exchange(HEAP32, __emscripten_main_thread_futex >> 2, 0);
            // The current value must have been our address which we set, or
            // in a race it was set to 0 which means another thread just allowed
            // us to run, but (tragically) that happened just a bit too late.
            assert(lastAddr == addr || lastAddr == 0);
            return -73;
          }
          // We are performing a blocking loop here, so we must handle proxied
          // events from pthreads, to avoid deadlocks.
          // Note that we have to do so carefully, as we may take a lock while
          // doing so, which can recurse into this function; stop marking
          // ourselves as waiting while we do so.
          lastAddr = Atomics.exchange(HEAP32, __emscripten_main_thread_futex >> 2, 0);
          assert(lastAddr == addr || lastAddr == 0);
          if (lastAddr == 0) {
            // We were told to stop waiting, so stop.
            break;
          }
          _emscripten_main_thread_process_queued_calls();
  
          // Check the value, as if we were starting the futex all over again.
          // This handles the following case:
          //
          //  * wait on futex A
          //  * recurse into emscripten_main_thread_process_queued_calls(),
          //    which waits on futex B. that sets the __emscripten_main_thread_futex address to
          //    futex B, and there is no longer any mention of futex A.
          //  * a worker is done with futex A. it checks __emscripten_main_thread_futex but does
          //    not see A, so it does nothing special for the main thread.
          //  * a worker is done with futex B. it flips mainThreadMutex from B
          //    to 0, ending the wait on futex B.
          //  * we return to the wait on futex A. __emscripten_main_thread_futex is 0, but that
          //    is because of futex B being done - we can't tell from
          //    __emscripten_main_thread_futex whether A is done or not. therefore, check the
          //    memory value of the futex.
          //
          // That case motivates the design here. Given that, checking the memory
          // address is also necessary for other reasons: we unset and re-set our
          // address in __emscripten_main_thread_futex around calls to
          // emscripten_main_thread_process_queued_calls(), and a worker could
          // attempt to wake us up right before/after such times.
          //
          // Note that checking the memory value of the futex is valid to do: we
          // could easily have been delayed (relative to the worker holding on
          // to futex A), which means we could be starting all of our work at the
          // later time when there is no need to block. The only "odd" thing is
          // that we may have caused side effects in that "delay" time. But the
          // only side effects we can have are to call
          // emscripten_main_thread_process_queued_calls(). That is always ok to
          // do on the main thread (it's why it is ok for us to call it in the
          // middle of this function, and elsewhere). So if we check the value
          // here and return, it's the same is if what happened on the main thread
          // was the same as calling emscripten_main_thread_process_queued_calls()
          // a few times times before calling emscripten_futex_wait().
          if (Atomics.load(HEAP32, addr >> 2) != val) {
            return -6;
          }
  
          // Mark us as waiting once more, and continue the loop.
          lastAddr = Atomics.exchange(HEAP32, __emscripten_main_thread_futex >> 2, addr);
          assert(lastAddr == 0);
        }
        return 0;
      }
    }



  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  /** @type{function(number, (number|boolean), ...(number|boolean))} */
  function _emscripten_proxy_to_main_thread_js(index, sync) {
      // Additional arguments are passed after those two, which are the actual
      // function arguments.
      // The serialization buffer contains the number of call params, and then
      // all the args here.
      // We also pass 'sync' to C separately, since C needs to look at it.
      var numCallArgs = arguments.length - 2;
      if (numCallArgs > 20-1) throw 'emscripten_proxy_to_main_thread_js: Too many arguments ' + numCallArgs + ' to proxied function idx=' + index + ', maximum supported is ' + (20-1) + '!';
      // Allocate a buffer, which will be copied by the C code.
      var stack = stackSave();
      // First passed parameter specifies the number of arguments to the function.
      // When BigInt support is enabled, we must handle types in a more complex
      // way, detecting at runtime if a value is a BigInt or not (as we have no
      // type info here). To do that, add a "prefix" before each value that
      // indicates if it is a BigInt, which effectively doubles the number of
      // values we serialize for proxying. TODO: pack this?
      var serializedNumCallArgs = numCallArgs ;
      var args = stackAlloc(serializedNumCallArgs * 8);
      var b = args >> 3;
      for (var i = 0; i < numCallArgs; i++) {
        var arg = arguments[2 + i];
        HEAPF64[b + i] = arg;
      }
      var ret = _emscripten_run_in_main_runtime_thread_js(index, serializedNumCallArgs, args, sync);
      stackRestore(stack);
      return ret;
    }
  
  var _emscripten_receive_on_main_thread_js_callArgs=[];
  
  var readAsmConstArgsArray=[];
  function readAsmConstArgs(sigPtr, buf) {
      // Nobody should have mutated _readAsmConstArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readAsmConstArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readAsmConstArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      buf >>= 2;
      while (ch = HEAPU8[sigPtr++]) {
        assert(ch === 100/*'d'*/ || ch === 102/*'f'*/ || ch === 105 /*'i'*/);
        // A double takes two 32-bit slots, and must also be aligned - the backend
        // will emit padding to avoid that.
        var double = ch < 105;
        if (double && (buf & 1)) buf++;
        readAsmConstArgsArray.push(double ? HEAPF64[buf++ >> 1] : HEAP32[buf]);
        ++buf;
      }
      return readAsmConstArgsArray;
    }
  function _emscripten_receive_on_main_thread_js(index, numCallArgs, args) {
      _emscripten_receive_on_main_thread_js_callArgs.length = numCallArgs;
      var b = args >> 3;
      for (var i = 0; i < numCallArgs; i++) {
        _emscripten_receive_on_main_thread_js_callArgs[i] = HEAPF64[b + i];
      }
      // Proxied JS library funcs are encoded as positive values, and
      // EM_ASMs as negative values (see include_asm_consts)
      var isEmAsmConst = index < 0;
      var func = !isEmAsmConst ? proxiedFunctionTable[index] : ASM_CONSTS[-index - 1];
      assert(func.length == numCallArgs, 'Call args mismatch in emscripten_receive_on_main_thread_js');
      return func.apply(null, _emscripten_receive_on_main_thread_js_callArgs);
    }

  function _emscripten_get_heap_size() {
      return HEAPU8.length;
    }
  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s INITIAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  function _emscripten_resize_heap(requestedSize) {
      requestedSize = requestedSize >>> 0;
      abortOnCannotGrowMemory(requestedSize);
    }

  var JSEvents={inEventHandler:0,removeAllEventListeners:function() {
        for(var i = JSEvents.eventHandlers.length-1; i >= 0; --i) {
          JSEvents._removeHandler(i);
        }
        JSEvents.eventHandlers = [];
        JSEvents.deferredCalls = [];
      },registerRemoveEventListeners:function() {
        if (!JSEvents.removeEventListenersRegistered) {
          __ATEXIT__.push(JSEvents.removeAllEventListeners);
          JSEvents.removeEventListenersRegistered = true;
        }
      },deferredCalls:[],deferCall:function(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
          if (arrA.length != arrB.length) return false;
  
          for(var i in arrA) {
            if (arrA[i] != arrB[i]) return false;
          }
          return true;
        }
        // Test if the given call was already queued, and if so, don't add it again.
        for(var i in JSEvents.deferredCalls) {
          var call = JSEvents.deferredCalls[i];
          if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
            return;
          }
        }
        JSEvents.deferredCalls.push({
          targetFunction: targetFunction,
          precedence: precedence,
          argsList: argsList
        });
  
        JSEvents.deferredCalls.sort(function(x,y) { return x.precedence < y.precedence; });
      },removeDeferredCalls:function(targetFunction) {
        for(var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
            JSEvents.deferredCalls.splice(i, 1);
            --i;
          }
        }
      },canPerformEventHandlerRequests:function() {
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
      },runDeferredCalls:function() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
          return;
        }
        for(var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          var call = JSEvents.deferredCalls[i];
          JSEvents.deferredCalls.splice(i, 1);
          --i;
          call.targetFunction.apply(null, call.argsList);
        }
      },eventHandlers:[],removeAllHandlersOnTarget:function(target, eventTypeString) {
        for(var i = 0; i < JSEvents.eventHandlers.length; ++i) {
          if (JSEvents.eventHandlers[i].target == target && 
            (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
             JSEvents._removeHandler(i--);
           }
        }
      },_removeHandler:function(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
        JSEvents.eventHandlers.splice(i, 1);
      },registerOrRemoveHandler:function(eventHandler) {
        var jsEventHandler = function jsEventHandler(event) {
          // Increment nesting count for the event handler.
          ++JSEvents.inEventHandler;
          JSEvents.currentEventHandler = eventHandler;
          // Process any old deferred calls the user has placed.
          JSEvents.runDeferredCalls();
          // Process the actual event, calls back to user C code handler.
          eventHandler.handlerFunc(event);
          // Process any new deferred calls that were placed right now from this event handler.
          JSEvents.runDeferredCalls();
          // Out of event handler - restore nesting count.
          --JSEvents.inEventHandler;
        };
        
        if (eventHandler.callbackfunc) {
          eventHandler.eventListenerFunc = jsEventHandler;
          eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
          JSEvents.eventHandlers.push(eventHandler);
          JSEvents.registerRemoveEventListeners();
        } else {
          for(var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == eventHandler.target
             && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
               JSEvents._removeHandler(i--);
             }
          }
        }
      },queueEventHandlerOnThread_iiii:function(targetThread, eventHandlerFunc, eventTypeId, eventData, userData) {
        var stackTop = stackSave();
        var varargs = stackAlloc(12);
        HEAP32[((varargs)>>2)]=eventTypeId;
        HEAP32[(((varargs)+(4))>>2)]=eventData;
        HEAP32[(((varargs)+(8))>>2)]=userData;
        __emscripten_call_on_thread(0, targetThread, 637534208, eventHandlerFunc, eventData, varargs);
        stackRestore(stackTop);
      },getTargetThreadForEventCallback:function(targetThread) {
        switch(targetThread) {
          case 1: return 0; // The event callback for the current event should be called on the main browser thread. (0 == don't proxy)
          case 2: return PThread.currentProxiedOperationCallerThread; // The event callback for the current event should be backproxied to the thread that is registering the event.
          default: return targetThread; // The event callback for the current event should be proxied to the given specific thread.
        }
      },getNodeNameForTarget:function(target) {
        if (!target) return '';
        if (target == window) return '#window';
        if (target == screen) return '#screen';
        return (target && target.nodeName) ? target.nodeName : '';
      },fullscreenEnabled:function() {
        return document.fullscreenEnabled
        // Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitFullscreenEnabled.
        // TODO: If Safari at some point ships with unprefixed version, update the version check above.
        || document.webkitFullscreenEnabled
         ;
      }};
  
  function stringToNewUTF8(jsString) {
      var length = lengthBytesUTF8(jsString)+1;
      var cString = _malloc(length);
      stringToUTF8(jsString, cString, length);
      return cString;
    }
  function _emscripten_set_offscreencanvas_size_on_target_thread_js(targetThread, targetCanvas, width, height) {
      var stackTop = stackSave();
      var varargs = stackAlloc(12);
      var targetCanvasPtr = 0;
      if (targetCanvas) {
        targetCanvasPtr = stringToNewUTF8(targetCanvas);
      }
      HEAP32[((varargs)>>2)]=targetCanvasPtr;
      HEAP32[(((varargs)+(4))>>2)]=width;
      HEAP32[(((varargs)+(8))>>2)]=height;
      // Note: If we are also a pthread, the call below could theoretically be done synchronously. However if the target pthread is waiting for a mutex from us, then
      // these two threads will deadlock. At the moment, we'd like to consider that this kind of deadlock would be an Emscripten runtime bug, although if
      // emscripten_set_canvas_element_size() was documented to require running an event in the queue of thread that owns the OffscreenCanvas, then that might be ok.
      // (safer this way however)
      __emscripten_call_on_thread(0, targetThread, 657457152, 0, targetCanvasPtr /* satellite data */, varargs);
      stackRestore(stackTop);
    }
  function _emscripten_set_offscreencanvas_size_on_target_thread(targetThread, targetCanvas, width, height) {
      targetCanvas = targetCanvas ? UTF8ToString(targetCanvas) : '';
      _emscripten_set_offscreencanvas_size_on_target_thread_js(targetThread, targetCanvas, width, height);
    }
  
  function maybeCStringToJsString(cString) {
      // "cString > 2" checks if the input is a number, and isn't of the special
      // values we accept here, EMSCRIPTEN_EVENT_TARGET_* (which map to 0, 1, 2).
      // In other words, if cString > 2 then it's a pointer to a valid place in
      // memory, and points to a C string.
      return cString > 2 ? UTF8ToString(cString) : cString;
    }
  
  var specialHTMLTargets=[0, typeof document !== 'undefined' ? document : 0, typeof window !== 'undefined' ? window : 0];
  function findEventTarget(target) {
      target = maybeCStringToJsString(target);
      var domElement = specialHTMLTargets[target] || (typeof document !== 'undefined' ? document.querySelector(target) : undefined);
      return domElement;
    }
  function findCanvasEventTarget(target) { return findEventTarget(target); }
  function _emscripten_set_canvas_element_size_calling_thread(target, width, height) {
      var canvas = findCanvasEventTarget(target);
      if (!canvas) return -4;
  
      if (canvas.canvasSharedPtr) {
        // N.B. We hold the canvasSharedPtr info structure as the authoritative source for specifying the size of a canvas
        // since the actual canvas size changes are asynchronous if the canvas is owned by an OffscreenCanvas on another thread.
        // Therefore when setting the size, eagerly set the size of the canvas on the calling thread here, though this thread
        // might not be the one that actually ends up specifying the size, but the actual size change may be dispatched
        // as an asynchronous event below.
        HEAP32[((canvas.canvasSharedPtr)>>2)]=width;
        HEAP32[(((canvas.canvasSharedPtr)+(4))>>2)]=height;
      }
  
      if (canvas.offscreenCanvas || !canvas.controlTransferredOffscreen) {
        if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
        var autoResizeViewport = false;
        if (canvas.GLctxObject && canvas.GLctxObject.GLctx) {
          var prevViewport = canvas.GLctxObject.GLctx.getParameter(0xBA2 /* GL_VIEWPORT */);
          // TODO: Perhaps autoResizeViewport should only be true if FBO 0 is currently active?
          autoResizeViewport = (prevViewport[0] === 0 && prevViewport[1] === 0 && prevViewport[2] === canvas.width && prevViewport[3] === canvas.height);
        }
        canvas.width = width;
        canvas.height = height;
        if (autoResizeViewport) {
          // TODO: Add -s CANVAS_RESIZE_SETS_GL_VIEWPORT=0/1 option (default=1). This is commonly done and several graphics engines depend on this,
          // but this can be quite disruptive.
          canvas.GLctxObject.GLctx.viewport(0, 0, width, height);
        }
      } else if (canvas.canvasSharedPtr) {
        var targetThread = HEAP32[(((canvas.canvasSharedPtr)+(8))>>2)];
        _emscripten_set_offscreencanvas_size_on_target_thread(targetThread, target, width, height);
        return 1; // This will have to be done asynchronously
      } else {
        return -4;
      }
      return 0;
    }
  
  function _emscripten_set_canvas_element_size_main_thread(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return _emscripten_proxy_to_main_thread_js(1, 1, target, width, height);
   return _emscripten_set_canvas_element_size_calling_thread(target, width, height); }
  
  function _emscripten_set_canvas_element_size(target, width, height) {
      var canvas = findCanvasEventTarget(target);
      if (canvas) {
        return _emscripten_set_canvas_element_size_calling_thread(target, width, height);
      } else {
        return _emscripten_set_canvas_element_size_main_thread(target, width, height);
      }
    }

  function _emscripten_set_current_thread_status_js(newStatus) {
    }
  function _emscripten_set_current_thread_status(newStatus) {
    }

  function __webgl_enable_ANGLE_instanced_arrays(ctx) {
      // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('ANGLE_instanced_arrays');
      if (ext) {
        ctx['vertexAttribDivisor'] = function(index, divisor) { ext['vertexAttribDivisorANGLE'](index, divisor); };
        ctx['drawArraysInstanced'] = function(mode, first, count, primcount) { ext['drawArraysInstancedANGLE'](mode, first, count, primcount); };
        ctx['drawElementsInstanced'] = function(mode, count, type, indices, primcount) { ext['drawElementsInstancedANGLE'](mode, count, type, indices, primcount); };
        return 1;
      }
    }
  
  function __webgl_enable_OES_vertex_array_object(ctx) {
      // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('OES_vertex_array_object');
      if (ext) {
        ctx['createVertexArray'] = function() { return ext['createVertexArrayOES'](); };
        ctx['deleteVertexArray'] = function(vao) { ext['deleteVertexArrayOES'](vao); };
        ctx['bindVertexArray'] = function(vao) { ext['bindVertexArrayOES'](vao); };
        ctx['isVertexArray'] = function(vao) { return ext['isVertexArrayOES'](vao); };
        return 1;
      }
    }
  
  function __webgl_enable_WEBGL_draw_buffers(ctx) {
      // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('WEBGL_draw_buffers');
      if (ext) {
        ctx['drawBuffers'] = function(n, bufs) { ext['drawBuffersWEBGL'](n, bufs); };
        return 1;
      }
    }
  
  function __webgl_enable_WEBGL_multi_draw(ctx) {
      // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
      return !!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'));
    }
  var GL={counter:1,buffers:[],programs:[],framebuffers:[],renderbuffers:[],textures:[],uniforms:[],shaders:[],vaos:[],contexts:{},offscreenCanvases:{},timerQueriesEXT:[],programInfos:{},stringCache:{},unpackAlignment:4,recordError:function recordError(errorCode) {
        if (!GL.lastError) {
          GL.lastError = errorCode;
        }
      },getNewId:function(table) {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
          table[i] = null;
        }
        return ret;
      },getSource:function(shader, count, string, length) {
        var source = '';
        for (var i = 0; i < count; ++i) {
          var len = length ? HEAP32[(((length)+(i*4))>>2)] : -1;
          source += UTF8ToString(HEAP32[(((string)+(i*4))>>2)], len < 0 ? undefined : len);
        }
        return source;
      },createContext:function(canvas, webGLContextAttributes) {
  
        var ctx = 
          (canvas.getContext("webgl", webGLContextAttributes)
            // https://caniuse.com/#feat=webgl
            );
  
        if (!ctx) return 0;
  
        var handle = GL.registerContext(ctx, webGLContextAttributes);
  
        return handle;
      },registerContext:function(ctx, webGLContextAttributes) {
        // with pthreads a context is a location in memory with some synchronized data between threads
        var handle = _malloc(8);
        HEAP32[(((handle)+(4))>>2)]=_pthread_self(); // the thread pointer of the thread that owns the control of the context
  
        var context = {
          handle: handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes.majorVersion,
          GLctx: ctx
        };
  
        // Store the created context object so that we can access the context given a canvas without having to pass the parameters again.
        if (ctx.canvas) ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault === 'undefined' || webGLContextAttributes.enableExtensionsByDefault) {
          GL.initExtensions(context);
        }
  
        return handle;
      },makeContextCurrent:function(contextHandle) {
  
        GL.currentContext = GL.contexts[contextHandle]; // Active Emscripten GL layer context object.
        Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx; // Active WebGL context object.
        return !(contextHandle && !GLctx);
      },getContext:function(contextHandle) {
        return GL.contexts[contextHandle];
      },deleteContext:function(contextHandle) {
        if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
        if (typeof JSEvents === 'object') JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas); // Release all JS event handlers on the DOM element that the GL context is associated with since the context is now deleted.
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined; // Make sure the canvas object no longer refers to the context object so there are no GC surprises.
        _free(GL.contexts[contextHandle].handle);
        GL.contexts[contextHandle] = null;
      },initExtensions:function(context) {
        // If this function is called without a specific context object, init the extensions of the currently active context.
        if (!context) context = GL.currentContext;
  
        if (context.initExtensionsDone) return;
        context.initExtensionsDone = true;
  
        var GLctx = context.GLctx;
  
        // Detect the presence of a few extensions manually, this GL interop layer itself will need to know if they exist.
  
        // Extensions that are only available in WebGL 1 (the calls will be no-ops if called on a WebGL 2 context active)
        __webgl_enable_ANGLE_instanced_arrays(GLctx);
        __webgl_enable_OES_vertex_array_object(GLctx);
        __webgl_enable_WEBGL_draw_buffers(GLctx);
  
        GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
        __webgl_enable_WEBGL_multi_draw(GLctx);
  
        // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
        var exts = GLctx.getSupportedExtensions() || [];
        exts.forEach(function(ext) {
          // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders are not enabled by default.
          if (ext.indexOf('lose_context') < 0 && ext.indexOf('debug') < 0) {
            // Call .getExtension() to enable that extension permanently.
            GLctx.getExtension(ext);
          }
        });
      },populateUniformTable:function(program) {
        var p = GL.programs[program];
        var ptable = GL.programInfos[program] = {
          uniforms: {},
          maxUniformLength: 0, // This is eagerly computed below, since we already enumerate all uniforms anyway.
          maxAttributeLength: -1, // This is lazily computed and cached, computed when/if first asked, "-1" meaning not computed yet.
          maxUniformBlockNameLength: -1 // Lazily computed as well
        };
  
        var utable = ptable.uniforms;
        // A program's uniform table maps the string name of an uniform to an integer location of that uniform.
        // The global GL.uniforms map maps integer locations to WebGLUniformLocations.
        var numUniforms = GLctx.getProgramParameter(p, 0x8B86/*GL_ACTIVE_UNIFORMS*/);
        for (var i = 0; i < numUniforms; ++i) {
          var u = GLctx.getActiveUniform(p, i);
  
          var name = u.name;
          ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length+1);
  
          // If we are dealing with an array, e.g. vec4 foo[3], strip off the array index part to canonicalize that "foo", "foo[]",
          // and "foo[0]" will mean the same. Loop below will populate foo[1] and foo[2].
          if (name.slice(-1) == ']') {
            name = name.slice(0, name.lastIndexOf('['));
          }
  
          // Optimize memory usage slightly: If we have an array of uniforms, e.g. 'vec3 colors[3];', then
          // only store the string 'colors' in utable, and 'colors[0]', 'colors[1]' and 'colors[2]' will be parsed as 'colors'+i.
          // Note that for the GL.uniforms table, we still need to fetch the all WebGLUniformLocations for all the indices.
          var loc = GLctx.getUniformLocation(p, name);
          if (loc) {
            var id = GL.getNewId(GL.uniforms);
            utable[name] = [u.size, id];
            GL.uniforms[id] = loc;
  
            for (var j = 1; j < u.size; ++j) {
              var n = name + '['+j+']';
              loc = GLctx.getUniformLocation(p, n);
              id = GL.getNewId(GL.uniforms);
  
              GL.uniforms[id] = loc;
            }
          }
        }
      }};
  
  var __emscripten_webgl_power_preferences=['default', 'low-power', 'high-performance'];
  function _emscripten_webgl_do_create_context(target, attributes) {
      assert(attributes);
      var a = attributes >> 2;
      var powerPreference = HEAP32[a + (24>>2)];
      var contextAttributes = {
        'alpha': !!HEAP32[a + (0>>2)],
        'depth': !!HEAP32[a + (4>>2)],
        'stencil': !!HEAP32[a + (8>>2)],
        'antialias': !!HEAP32[a + (12>>2)],
        'premultipliedAlpha': !!HEAP32[a + (16>>2)],
        'preserveDrawingBuffer': !!HEAP32[a + (20>>2)],
        'powerPreference': __emscripten_webgl_power_preferences[powerPreference],
        'failIfMajorPerformanceCaveat': !!HEAP32[a + (28>>2)],
        // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
        majorVersion: HEAP32[a + (32>>2)],
        minorVersion: HEAP32[a + (36>>2)],
        enableExtensionsByDefault: HEAP32[a + (40>>2)],
        explicitSwapControl: HEAP32[a + (44>>2)],
        proxyContextToMainThread: HEAP32[a + (48>>2)],
        renderViaOffscreenBackBuffer: HEAP32[a + (52>>2)]
      };
  
      var canvas = findCanvasEventTarget(target);
  
      if (!canvas) {
        return 0;
      }
  
      if (contextAttributes.explicitSwapControl) {
        return 0;
      }
  
      var contextHandle = GL.createContext(canvas, contextAttributes);
      return contextHandle;
    }
  function _emscripten_webgl_create_context(a0,a1
  ) {
  return _emscripten_webgl_do_create_context(a0,a1);
  }

  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      if (typeof _fflush !== 'undefined') _fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  
  var SYSCALLS={mappings:{},buffers:[null,[],[]],printChar:function(stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:undefined,get:function() {
        assert(SYSCALLS.varargs != undefined);
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },get64:function(low, high) {
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      }};
  function _fd_write(fd, iov, iovcnt, pnum) {
  if (ENVIRONMENT_IS_PTHREAD) return _emscripten_proxy_to_main_thread_js(2, 1, fd, iov, iovcnt, pnum);
  
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
      }
      HEAP32[((pnum)>>2)]=num
      return 0;
    }
  

  function _pthread_cleanup_pop(execute) {
      var routine = PThread.threadExitHandlers.pop();
      if (execute) routine();
    }

  function _pthread_cleanup_push(routine, arg) {
      PThread.threadExitHandlers.push(function() { wasmTable.get(routine)(arg) });
    }

  function spawnThread(threadParams) {
      if (ENVIRONMENT_IS_PTHREAD) throw 'Internal Error! spawnThread() can only ever be called from main application thread!';
  
      var worker = PThread.getNewWorker();
  
      if (worker.pthread !== undefined) throw 'Internal error!';
      if (!threadParams.pthread_ptr) throw 'Internal error, no pthread ptr!';
      PThread.runningWorkers.push(worker);
  
      // Allocate memory for thread-local storage and initialize it to zero.
      var tlsMemory = _malloc(128 * 4);
      for (var i = 0; i < 128; ++i) {
        HEAP32[(((tlsMemory)+(i*4))>>2)]=0;
      }
  
      var stackHigh = threadParams.stackBase + threadParams.stackSize;
  
      // Create a pthread info object to represent this thread.
      var pthread = PThread.pthreads[threadParams.pthread_ptr] = {
        worker: worker,
        stackBase: threadParams.stackBase,
        stackSize: threadParams.stackSize,
        allocatedOwnStack: threadParams.allocatedOwnStack,
        // Info area for this thread in Emscripten HEAP (shared)
        threadInfoStruct: threadParams.pthread_ptr
      };
      var tis = pthread.threadInfoStruct >> 2;
      Atomics.store(HEAPU32, tis + (0 >> 2), 0); // threadStatus <- 0, meaning not yet exited.
      Atomics.store(HEAPU32, tis + (4 >> 2), 0); // threadExitCode <- 0.
      Atomics.store(HEAPU32, tis + (8 >> 2), 0); // profilerBlock <- 0.
      Atomics.store(HEAPU32, tis + (64 >> 2), threadParams.detached);
      Atomics.store(HEAPU32, tis + (100 >> 2), tlsMemory); // Init thread-local-storage memory array.
      Atomics.store(HEAPU32, tis + (44 >> 2), 0); // Mark initial status to unused.
      Atomics.store(HEAPU32, tis + (40 >> 2), pthread.threadInfoStruct); // Main thread ID.
      Atomics.store(HEAPU32, tis + (80 >> 2), threadParams.stackSize);
      Atomics.store(HEAPU32, tis + (76 >> 2), stackHigh);
      Atomics.store(HEAPU32, tis + (104 >> 2), threadParams.stackSize);
      Atomics.store(HEAPU32, tis + (104 + 8 >> 2), stackHigh);
      Atomics.store(HEAPU32, tis + (104 + 12 >> 2), threadParams.detached);
  
      var global_libc = _emscripten_get_global_libc();
      var global_locale = global_libc + 40;
      Atomics.store(HEAPU32, tis + (172 >> 2), global_locale);
  
      worker.pthread = pthread;
      var msg = {
          'cmd': 'run',
          'start_routine': threadParams.startRoutine,
          'arg': threadParams.arg,
          'threadInfoStruct': threadParams.pthread_ptr,
          'stackBase': threadParams.stackBase,
          'stackSize': threadParams.stackSize
      };
      worker.runPthread = function() {
        // Ask the worker to start executing its pthread entry point function.
        msg.time = performance.now();
        worker.postMessage(msg, threadParams.transferList);
      };
      if (worker.loaded) {
        worker.runPthread();
        delete worker.runPthread;
      }
    }
  function _pthread_create(pthread_ptr, attr, start_routine, arg) {
      if (typeof SharedArrayBuffer === 'undefined') {
        err('Current environment does not support SharedArrayBuffer, pthreads are not available!');
        return 6;
      }
      if (!pthread_ptr) {
        err('pthread_create called with a null thread pointer!');
        return 28;
      }
  
      // List of JS objects that will transfer ownership to the Worker hosting the thread
      var transferList = [];
      var error = 0;
  
      // Synchronously proxy the thread creation to main thread if possible. If we
      // need to transfer ownership of objects, then proxy asynchronously via
      // postMessage.
      if (ENVIRONMENT_IS_PTHREAD && (transferList.length === 0 || error)) {
        return _emscripten_sync_run_in_main_thread_4(687865856, pthread_ptr, attr, start_routine, arg);
      }
  
      // If on the main thread, and accessing Canvas/OffscreenCanvas failed, abort
      // with the detected error.
      if (error) return error;
  
      var stackSize = 0;
      var stackBase = 0;
      // Default thread attr is PTHREAD_CREATE_JOINABLE, i.e. start as not detached.
      var detached = 0;
      // When musl creates C11 threads it passes __ATTRP_C11_THREAD (-1) which
      // treat as if it was NULL.
      if (attr && attr != -1) {
        stackSize = HEAP32[((attr)>>2)];
        // Musl has a convention that the stack size that is stored to the pthread
        // attribute structure is always musl's #define DEFAULT_STACK_SIZE
        // smaller than the actual created stack size. That is, stored stack size
        // of 0 would mean a stack of DEFAULT_STACK_SIZE in size. All musl
        // functions hide this impl detail, and offset the size transparently, so
        // pthread_*() API user does not see this offset when operating with
        // the pthread API. When reading the structure directly on JS side
        // however, we need to offset the size manually here.
        stackSize += 81920 /*DEFAULT_STACK_SIZE*/;
        stackBase = HEAP32[(((attr)+(8))>>2)];
        detached = HEAP32[(((attr)+(12))>>2)] !== 0/*PTHREAD_CREATE_JOINABLE*/;
      } else {
        // According to
        // http://man7.org/linux/man-pages/man3/pthread_create.3.html, default
        // stack size if not specified is 2 MB, so follow that convention.
        stackSize = 2097152;
      }
      // If allocatedOwnStack == true, then the pthread impl maintains the stack allocation.
      var allocatedOwnStack = stackBase == 0;
      if (allocatedOwnStack) {
        // Allocate a stack if the user doesn't want to place the stack in a
        // custom memory area.
        stackBase = _memalign(16, stackSize);
      } else {
        // Musl stores the stack base address assuming stack grows downwards, so
        // adjust it to Emscripten convention that the
        // stack grows upwards instead.
        stackBase -= stackSize;
        assert(stackBase > 0);
      }
  
      // Allocate thread block (pthread_t structure).
      var threadInfoStruct = _malloc(228);
      // zero-initialize thread structure.
      for (var i = 0; i < 228 >> 2; ++i) HEAPU32[(threadInfoStruct>>2) + i] = 0;
      HEAP32[((pthread_ptr)>>2)]=threadInfoStruct;
  
      // The pthread struct has a field that points to itself - this is used as a
      // magic ID to detect whether the pthread_t structure is 'alive'.
      HEAP32[(((threadInfoStruct)+(12))>>2)]=threadInfoStruct;
  
      // pthread struct robust_list head should point to itself.
      var headPtr = threadInfoStruct + 152;
      HEAP32[((headPtr)>>2)]=headPtr;
  
      var threadParams = {
        stackBase: stackBase,
        stackSize: stackSize,
        allocatedOwnStack: allocatedOwnStack,
        detached: detached,
        startRoutine: start_routine,
        pthread_ptr: threadInfoStruct,
        arg: arg,
        transferList: transferList
      };
  
      if (ENVIRONMENT_IS_PTHREAD) {
        // The prepopulated pool of web workers that can host pthreads is stored
        // in the main JS thread. Therefore if a pthread is attempting to spawn a
        // new thread, the thread creation must be deferred to the main JS thread.
        threadParams.cmd = 'spawnThread';
        postMessage(threadParams, transferList);
      } else {
        // We are the main thread, so we have the pthread warmup pool in this
        // thread and can fire off JS thread creation directly ourselves.
        spawnThread(threadParams);
      }
  
      return 0;
    }

  function __pthread_testcancel_js() {
      if (!ENVIRONMENT_IS_PTHREAD) return;
      var tb = _pthread_self();
      if (!tb) return;
      var cancelDisabled = Atomics.load(HEAPU32, (tb + 56 ) >> 2);
      if (cancelDisabled) return;
      var canceled = Atomics.load(HEAPU32, (tb + 0 ) >> 2);
      if (canceled == 2) throw 'Canceled!';
    }
  
  function _emscripten_check_blocking_allowed() {
      if (ENVIRONMENT_IS_NODE) return;
  
      if (ENVIRONMENT_IS_WORKER) return; // Blocking in a worker/pthread is fine.
  
      warnOnce('Blocking on the main thread is very dangerous, see https://emscripten.org/docs/porting/pthreads.html#blocking-on-the-main-browser-thread');
  
    }
  function __emscripten_do_pthread_join(thread, status, block) {
      if (!thread) {
        err('pthread_join attempted on a null thread pointer!');
        return ERRNO_CODES.ESRCH;
      }
      if (ENVIRONMENT_IS_PTHREAD && _pthread_self() == thread) {
        err('PThread ' + thread + ' is attempting to join to itself!');
        return ERRNO_CODES.EDEADLK;
      }
      else if (!ENVIRONMENT_IS_PTHREAD && _emscripten_main_browser_thread_id() == thread) {
        err('Main thread ' + thread + ' is attempting to join to itself!');
        return ERRNO_CODES.EDEADLK;
      }
      var self = HEAP32[(((thread)+(12))>>2)];
      if (self !== thread) {
        err('pthread_join attempted on thread ' + thread + ', which does not point to a valid thread, or does not exist anymore!');
        return ERRNO_CODES.ESRCH;
      }
  
      var detached = Atomics.load(HEAPU32, (thread + 64 ) >> 2);
      if (detached) {
        err('Attempted to join thread ' + thread + ', which was already detached!');
        return ERRNO_CODES.EINVAL; // The thread is already detached, can no longer join it!
      }
  
      if (block) {
        _emscripten_check_blocking_allowed();
      }
  
      for (;;) {
        var threadStatus = Atomics.load(HEAPU32, (thread + 0 ) >> 2);
        if (threadStatus == 1) { // Exited?
          var threadExitCode = Atomics.load(HEAPU32, (thread + 4 ) >> 2);
          if (status) HEAP32[((status)>>2)]=threadExitCode;
          Atomics.store(HEAPU32, (thread + 64 ) >> 2, 1); // Mark the thread as detached.
  
          if (!ENVIRONMENT_IS_PTHREAD) cleanupThread(thread);
          else postMessage({ 'cmd': 'cleanupThread', 'thread': thread });
          return 0;
        }
        if (!block) {
          return ERRNO_CODES.EBUSY;
        }
        // TODO HACK! Replace the _js variant with just _pthread_testcancel:
        //_pthread_testcancel();
        __pthread_testcancel_js();
        // In main runtime thread (the thread that initialized the Emscripten C
        // runtime and launched main()), assist pthreads in performing operations
        // that they need to access the Emscripten main runtime for.
        if (!ENVIRONMENT_IS_PTHREAD) _emscripten_main_thread_process_queued_calls();
        _emscripten_futex_wait(thread + 0, threadStatus, ENVIRONMENT_IS_PTHREAD ? 100 : 1);
      }
    }
  function _pthread_join(thread, status) {
      return __emscripten_do_pthread_join(thread, status, true);
    }

  function _setTempRet0($i) {
      setTempRet0(($i) | 0);
    }

if (!ENVIRONMENT_IS_PTHREAD) PThread.initMainThreadBlock();;
var GLctx;;

 // proxiedFunctionTable specifies the list of functions that can be called either synchronously or asynchronously from other threads in postMessage()d or internally queued events. This way a pthread in a Worker can synchronously access e.g. the DOM on the main thread.

var proxiedFunctionTable = [null,_emscripten_set_canvas_element_size_main_thread,_fd_write];

var ASSERTIONS = true;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {string} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      // TODO: Update Node.js externs, Closure does not recognize the following Buffer.from()
      /**@suppress{checkTypes}*/
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf['buffer'], buf['byteOffset'], buf['byteLength']);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}


var asmLibraryArg = {
  "__assert_fail": ___assert_fail,
  "__clock_gettime": ___clock_gettime,
  "_emscripten_notify_thread_queue": __emscripten_notify_thread_queue,
  "emscripten_asm_const_int": _emscripten_asm_const_int,
  "emscripten_conditional_set_current_thread_status": _emscripten_conditional_set_current_thread_status,
  "emscripten_futex_wait": _emscripten_futex_wait,
  "emscripten_futex_wake": _emscripten_futex_wake,
  "emscripten_get_now": _emscripten_get_now,
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_receive_on_main_thread_js": _emscripten_receive_on_main_thread_js,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "emscripten_set_canvas_element_size": _emscripten_set_canvas_element_size,
  "emscripten_set_current_thread_status": _emscripten_set_current_thread_status,
  "emscripten_webgl_create_context": _emscripten_webgl_create_context,
  "fd_write": _fd_write,
  "getTempRet0": getTempRet0,
  "initPthreadsJS": initPthreadsJS,
  "memory": wasmMemory,
  "pthread_cleanup_pop": _pthread_cleanup_pop,
  "pthread_cleanup_push": _pthread_cleanup_push,
  "pthread_create": _pthread_create,
  "pthread_join": _pthread_join,
  "setTempRet0": setTempRet0
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");

/** @type {function(...*):?} */
var _main = Module["_main"] = createExportWrapper("main");

/** @type {function(...*):?} */
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = createExportWrapper("emscripten_get_global_libc");

/** @type {function(...*):?} */
var ___em_js__initPthreadsJS = Module["___em_js__initPthreadsJS"] = createExportWrapper("__em_js__initPthreadsJS");

/** @type {function(...*):?} */
var ___emscripten_pthread_data_constructor = Module["___emscripten_pthread_data_constructor"] = createExportWrapper("__emscripten_pthread_data_constructor");

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");

/** @type {function(...*):?} */
var _usleep = Module["_usleep"] = createExportWrapper("usleep");

/** @type {function(...*):?} */
var _fflush = Module["_fflush"] = createExportWrapper("fflush");

/** @type {function(...*):?} */
var _pthread_self = Module["_pthread_self"] = createExportWrapper("pthread_self");

/** @type {function(...*):?} */
var ___pthread_tsd_run_dtors = Module["___pthread_tsd_run_dtors"] = createExportWrapper("__pthread_tsd_run_dtors");

/** @type {function(...*):?} */
var _emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = createExportWrapper("emscripten_main_thread_process_queued_calls");

/** @type {function(...*):?} */
var _emscripten_current_thread_process_queued_calls = Module["_emscripten_current_thread_process_queued_calls"] = createExportWrapper("emscripten_current_thread_process_queued_calls");

/** @type {function(...*):?} */
var _free = Module["_free"] = createExportWrapper("free");

/** @type {function(...*):?} */
var _emscripten_register_main_browser_thread_id = Module["_emscripten_register_main_browser_thread_id"] = createExportWrapper("emscripten_register_main_browser_thread_id");

/** @type {function(...*):?} */
var _emscripten_main_browser_thread_id = Module["_emscripten_main_browser_thread_id"] = createExportWrapper("emscripten_main_browser_thread_id");

/** @type {function(...*):?} */
var __emscripten_do_dispatch_to_thread = Module["__emscripten_do_dispatch_to_thread"] = createExportWrapper("_emscripten_do_dispatch_to_thread");

/** @type {function(...*):?} */
var _malloc = Module["_malloc"] = createExportWrapper("malloc");

/** @type {function(...*):?} */
var _emscripten_sync_run_in_main_thread_2 = Module["_emscripten_sync_run_in_main_thread_2"] = createExportWrapper("emscripten_sync_run_in_main_thread_2");

/** @type {function(...*):?} */
var _emscripten_sync_run_in_main_thread_4 = Module["_emscripten_sync_run_in_main_thread_4"] = createExportWrapper("emscripten_sync_run_in_main_thread_4");

/** @type {function(...*):?} */
var _emscripten_run_in_main_runtime_thread_js = Module["_emscripten_run_in_main_runtime_thread_js"] = createExportWrapper("emscripten_run_in_main_runtime_thread_js");

/** @type {function(...*):?} */
var __emscripten_call_on_thread = Module["__emscripten_call_on_thread"] = createExportWrapper("_emscripten_call_on_thread");

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_tls_init = Module["_emscripten_tls_init"] = createExportWrapper("emscripten_tls_init");

/** @type {function(...*):?} */
var __emscripten_thread_init = Module["__emscripten_thread_init"] = createExportWrapper("_emscripten_thread_init");

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = createExportWrapper("stackSave");

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");

/** @type {function(...*):?} */
var _emscripten_stack_init = Module["_emscripten_stack_init"] = function() {
  return (_emscripten_stack_init = Module["_emscripten_stack_init"] = Module["asm"]["emscripten_stack_init"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = function() {
  return (_emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = Module["asm"]["emscripten_stack_set_limits"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
  return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _memalign = Module["_memalign"] = createExportWrapper("memalign");

/** @type {function(...*):?} */
var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji");

var __emscripten_main_thread_futex = Module['__emscripten_main_thread_futex'] = 2652;



// === Auto-generated postamble setup entry stuff ===

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ccall")) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cwrap")) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getValue")) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addFunction")) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "removeFunction")) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "makeBigInt")) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abort")) Module["abort"] = function() { abort("'abort' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToNewUTF8")) Module["stringToNewUTF8"] = function() { abort("'stringToNewUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setFileTime")) Module["setFileTime"] = function() { abort("'setFileTime' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abortOnCannotGrowMemory")) Module["abortOnCannotGrowMemory"] = function() { abort("'abortOnCannotGrowMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscripten_realloc_buffer")) Module["emscripten_realloc_buffer"] = function() { abort("'emscripten_realloc_buffer' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_CODES")) Module["ERRNO_CODES"] = function() { abort("'ERRNO_CODES' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ERRNO_MESSAGES")) Module["ERRNO_MESSAGES"] = function() { abort("'ERRNO_MESSAGES' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setErrNo")) Module["setErrNo"] = function() { abort("'setErrNo' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "DNS")) Module["DNS"] = function() { abort("'DNS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getHostByName")) Module["getHostByName"] = function() { abort("'getHostByName' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GAI_ERRNO_MESSAGES")) Module["GAI_ERRNO_MESSAGES"] = function() { abort("'GAI_ERRNO_MESSAGES' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Protocols")) Module["Protocols"] = function() { abort("'Protocols' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Sockets")) Module["Sockets"] = function() { abort("'Sockets' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getRandomDevice")) Module["getRandomDevice"] = function() { abort("'getRandomDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "traverseStack")) Module["traverseStack"] = function() { abort("'traverseStack' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UNWIND_CACHE")) Module["UNWIND_CACHE"] = function() { abort("'UNWIND_CACHE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "withBuiltinMalloc")) Module["withBuiltinMalloc"] = function() { abort("'withBuiltinMalloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgsArray")) Module["readAsmConstArgsArray"] = function() { abort("'readAsmConstArgsArray' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readAsmConstArgs")) Module["readAsmConstArgs"] = function() { abort("'readAsmConstArgs' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mainThreadEM_ASM")) Module["mainThreadEM_ASM"] = function() { abort("'mainThreadEM_ASM' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_q")) Module["jstoi_q"] = function() { abort("'jstoi_q' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jstoi_s")) Module["jstoi_s"] = function() { abort("'jstoi_s' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getExecutableName")) Module["getExecutableName"] = function() { abort("'getExecutableName' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "listenOnce")) Module["listenOnce"] = function() { abort("'listenOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "autoResumeAudioContext")) Module["autoResumeAudioContext"] = function() { abort("'autoResumeAudioContext' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCallLegacy")) Module["dynCallLegacy"] = function() { abort("'dynCallLegacy' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getDynCaller")) Module["getDynCaller"] = function() { abort("'getDynCaller' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callRuntimeCallbacks")) Module["callRuntimeCallbacks"] = function() { abort("'callRuntimeCallbacks' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "abortStackOverflow")) Module["abortStackOverflow"] = function() { abort("'abortStackOverflow' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reallyNegative")) Module["reallyNegative"] = function() { abort("'reallyNegative' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "unSign")) Module["unSign"] = function() { abort("'unSign' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "reSign")) Module["reSign"] = function() { abort("'reSign' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "formatString")) Module["formatString"] = function() { abort("'formatString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH")) Module["PATH"] = function() { abort("'PATH' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PATH_FS")) Module["PATH_FS"] = function() { abort("'PATH_FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SYSCALLS")) Module["SYSCALLS"] = function() { abort("'SYSCALLS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMmap2")) Module["syscallMmap2"] = function() { abort("'syscallMmap2' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "syscallMunmap")) Module["syscallMunmap"] = function() { abort("'syscallMunmap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "JSEvents")) Module["JSEvents"] = function() { abort("'JSEvents' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerKeyEventCallback")) Module["registerKeyEventCallback"] = function() { abort("'registerKeyEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "specialHTMLTargets")) Module["specialHTMLTargets"] = function() { abort("'specialHTMLTargets' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "maybeCStringToJsString")) Module["maybeCStringToJsString"] = function() { abort("'maybeCStringToJsString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findEventTarget")) Module["findEventTarget"] = function() { abort("'findEventTarget' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "findCanvasEventTarget")) Module["findCanvasEventTarget"] = function() { abort("'findCanvasEventTarget' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getBoundingClientRect")) Module["getBoundingClientRect"] = function() { abort("'getBoundingClientRect' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillMouseEventData")) Module["fillMouseEventData"] = function() { abort("'fillMouseEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerMouseEventCallback")) Module["registerMouseEventCallback"] = function() { abort("'registerMouseEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerWheelEventCallback")) Module["registerWheelEventCallback"] = function() { abort("'registerWheelEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerUiEventCallback")) Module["registerUiEventCallback"] = function() { abort("'registerUiEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFocusEventCallback")) Module["registerFocusEventCallback"] = function() { abort("'registerFocusEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceOrientationEventData")) Module["fillDeviceOrientationEventData"] = function() { abort("'fillDeviceOrientationEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceOrientationEventCallback")) Module["registerDeviceOrientationEventCallback"] = function() { abort("'registerDeviceOrientationEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillDeviceMotionEventData")) Module["fillDeviceMotionEventData"] = function() { abort("'fillDeviceMotionEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerDeviceMotionEventCallback")) Module["registerDeviceMotionEventCallback"] = function() { abort("'registerDeviceMotionEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "screenOrientation")) Module["screenOrientation"] = function() { abort("'screenOrientation' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillOrientationChangeEventData")) Module["fillOrientationChangeEventData"] = function() { abort("'fillOrientationChangeEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerOrientationChangeEventCallback")) Module["registerOrientationChangeEventCallback"] = function() { abort("'registerOrientationChangeEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillFullscreenChangeEventData")) Module["fillFullscreenChangeEventData"] = function() { abort("'fillFullscreenChangeEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFullscreenChangeEventCallback")) Module["registerFullscreenChangeEventCallback"] = function() { abort("'registerFullscreenChangeEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerRestoreOldStyle")) Module["registerRestoreOldStyle"] = function() { abort("'registerRestoreOldStyle' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "hideEverythingExceptGivenElement")) Module["hideEverythingExceptGivenElement"] = function() { abort("'hideEverythingExceptGivenElement' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreHiddenElements")) Module["restoreHiddenElements"] = function() { abort("'restoreHiddenElements' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setLetterbox")) Module["setLetterbox"] = function() { abort("'setLetterbox' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "currentFullscreenStrategy")) Module["currentFullscreenStrategy"] = function() { abort("'currentFullscreenStrategy' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "restoreOldWindowedStyle")) Module["restoreOldWindowedStyle"] = function() { abort("'restoreOldWindowedStyle' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "softFullscreenResizeWebGLRenderTarget")) Module["softFullscreenResizeWebGLRenderTarget"] = function() { abort("'softFullscreenResizeWebGLRenderTarget' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "doRequestFullscreen")) Module["doRequestFullscreen"] = function() { abort("'doRequestFullscreen' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillPointerlockChangeEventData")) Module["fillPointerlockChangeEventData"] = function() { abort("'fillPointerlockChangeEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockChangeEventCallback")) Module["registerPointerlockChangeEventCallback"] = function() { abort("'registerPointerlockChangeEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerPointerlockErrorEventCallback")) Module["registerPointerlockErrorEventCallback"] = function() { abort("'registerPointerlockErrorEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "requestPointerLock")) Module["requestPointerLock"] = function() { abort("'requestPointerLock' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillVisibilityChangeEventData")) Module["fillVisibilityChangeEventData"] = function() { abort("'fillVisibilityChangeEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerVisibilityChangeEventCallback")) Module["registerVisibilityChangeEventCallback"] = function() { abort("'registerVisibilityChangeEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerTouchEventCallback")) Module["registerTouchEventCallback"] = function() { abort("'registerTouchEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillGamepadEventData")) Module["fillGamepadEventData"] = function() { abort("'fillGamepadEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerGamepadEventCallback")) Module["registerGamepadEventCallback"] = function() { abort("'registerGamepadEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBeforeUnloadEventCallback")) Module["registerBeforeUnloadEventCallback"] = function() { abort("'registerBeforeUnloadEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "fillBatteryEventData")) Module["fillBatteryEventData"] = function() { abort("'fillBatteryEventData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "battery")) Module["battery"] = function() { abort("'battery' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerBatteryEventCallback")) Module["registerBatteryEventCallback"] = function() { abort("'registerBatteryEventCallback' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setCanvasElementSize")) Module["setCanvasElementSize"] = function() { abort("'setCanvasElementSize' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCanvasElementSize")) Module["getCanvasElementSize"] = function() { abort("'getCanvasElementSize' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "polyfillSetImmediate")) Module["polyfillSetImmediate"] = function() { abort("'polyfillSetImmediate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangle")) Module["demangle"] = function() { abort("'demangle' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "demangleAll")) Module["demangleAll"] = function() { abort("'demangleAll' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "jsStackTrace")) Module["jsStackTrace"] = function() { abort("'jsStackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getEnvStrings")) Module["getEnvStrings"] = function() { abort("'getEnvStrings' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "checkWasiClock")) Module["checkWasiClock"] = function() { abort("'checkWasiClock' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "flush_NO_FILESYSTEM")) Module["flush_NO_FILESYSTEM"] = function() { abort("'flush_NO_FILESYSTEM' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64")) Module["writeI53ToI64"] = function() { abort("'writeI53ToI64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Clamped")) Module["writeI53ToI64Clamped"] = function() { abort("'writeI53ToI64Clamped' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToI64Signaling")) Module["writeI53ToI64Signaling"] = function() { abort("'writeI53ToI64Signaling' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Clamped")) Module["writeI53ToU64Clamped"] = function() { abort("'writeI53ToU64Clamped' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeI53ToU64Signaling")) Module["writeI53ToU64Signaling"] = function() { abort("'writeI53ToU64Signaling' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromI64")) Module["readI53FromI64"] = function() { abort("'readI53FromI64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "readI53FromU64")) Module["readI53FromU64"] = function() { abort("'readI53FromU64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertI32PairToI53")) Module["convertI32PairToI53"] = function() { abort("'convertI32PairToI53' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "convertU32PairToI53")) Module["convertU32PairToI53"] = function() { abort("'convertU32PairToI53' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "uncaughtExceptionCount")) Module["uncaughtExceptionCount"] = function() { abort("'uncaughtExceptionCount' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionLast")) Module["exceptionLast"] = function() { abort("'exceptionLast' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exceptionCaught")) Module["exceptionCaught"] = function() { abort("'exceptionCaught' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfoAttrs")) Module["ExceptionInfoAttrs"] = function() { abort("'ExceptionInfoAttrs' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ExceptionInfo")) Module["ExceptionInfo"] = function() { abort("'ExceptionInfo' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "CatchInfo")) Module["CatchInfo"] = function() { abort("'CatchInfo' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_addRef")) Module["exception_addRef"] = function() { abort("'exception_addRef' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "exception_decRef")) Module["exception_decRef"] = function() { abort("'exception_decRef' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Browser")) Module["Browser"] = function() { abort("'Browser' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "funcWrappers")) Module["funcWrappers"] = function() { abort("'funcWrappers' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setMainLoop")) Module["setMainLoop"] = function() { abort("'setMainLoop' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tempFixedLengthArray")) Module["tempFixedLengthArray"] = function() { abort("'tempFixedLengthArray' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "miniTempWebGLFloatBuffers")) Module["miniTempWebGLFloatBuffers"] = function() { abort("'miniTempWebGLFloatBuffers' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapObjectForWebGLType")) Module["heapObjectForWebGLType"] = function() { abort("'heapObjectForWebGLType' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "heapAccessShiftForWebGLHeap")) Module["heapAccessShiftForWebGLHeap"] = function() { abort("'heapAccessShiftForWebGLHeap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGet")) Module["emscriptenWebGLGet"] = function() { abort("'emscriptenWebGLGet' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "computeUnpackAlignedImageSize")) Module["computeUnpackAlignedImageSize"] = function() { abort("'computeUnpackAlignedImageSize' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetTexPixelData")) Module["emscriptenWebGLGetTexPixelData"] = function() { abort("'emscriptenWebGLGetTexPixelData' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetUniform")) Module["emscriptenWebGLGetUniform"] = function() { abort("'emscriptenWebGLGetUniform' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "emscriptenWebGLGetVertexAttrib")) Module["emscriptenWebGLGetVertexAttrib"] = function() { abort("'emscriptenWebGLGetVertexAttrib' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeGLArray")) Module["writeGLArray"] = function() { abort("'writeGLArray' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "mmapAlloc")) Module["mmapAlloc"] = function() { abort("'mmapAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "MEMFS")) Module["MEMFS"] = function() { abort("'MEMFS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "TTY")) Module["TTY"] = function() { abort("'TTY' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "PIPEFS")) Module["PIPEFS"] = function() { abort("'PIPEFS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SOCKFS")) Module["SOCKFS"] = function() { abort("'SOCKFS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AL")) Module["AL"] = function() { abort("'AL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_unicode")) Module["SDL_unicode"] = function() { abort("'SDL_unicode' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_ttfContext")) Module["SDL_ttfContext"] = function() { abort("'SDL_ttfContext' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_audio")) Module["SDL_audio"] = function() { abort("'SDL_audio' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL")) Module["SDL"] = function() { abort("'SDL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "SDL_gfx")) Module["SDL_gfx"] = function() { abort("'SDL_gfx' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLUT")) Module["GLUT"] = function() { abort("'GLUT' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "EGL")) Module["EGL"] = function() { abort("'EGL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW_Window")) Module["GLFW_Window"] = function() { abort("'GLFW_Window' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLFW")) Module["GLFW"] = function() { abort("'GLFW' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "GLEW")) Module["GLEW"] = function() { abort("'GLEW' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "IDBStore")) Module["IDBStore"] = function() { abort("'IDBStore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "runAndAbortIfError")) Module["runAndAbortIfError"] = function() { abort("'runAndAbortIfError' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["PThread"] = PThread;
if (!Object.getOwnPropertyDescriptor(Module, "killThread")) Module["killThread"] = function() { abort("'killThread' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cleanupThread")) Module["cleanupThread"] = function() { abort("'cleanupThread' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "cancelThread")) Module["cancelThread"] = function() { abort("'cancelThread' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "spawnThread")) Module["spawnThread"] = function() { abort("'spawnThread' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "establishStackSpace")) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getNoExitRuntime")) Module["getNoExitRuntime"] = function() { abort("'getNoExitRuntime' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "invokeEntryPoint")) Module["invokeEntryPoint"] = function() { abort("'invokeEntryPoint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8OnStack")) Module["allocateUTF8OnStack"] = function() { abort("'allocateUTF8OnStack' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["writeStackCookie"] = writeStackCookie;
Module["checkStackCookie"] = checkStackCookie;
Module["PThread"] = PThread;
Module["wasmMemory"] = wasmMemory;
Module["ExitStatus"] = ExitStatus;
if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromBase64")) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "tryParseAsDataURI")) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { configurable: true, get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { configurable: true, get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  var entryFunction = Module['_main'];

  args = args || [];

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;

  try {

    var ret = entryFunction(argc, argv);

    // In PROXY_TO_PTHREAD builds, we should never exit the runtime below, as
    // execution is asynchronously handed off to a pthread.
      // if we're not running an evented main loop, it's time to exit
      exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'unwind') {
      // running an evented main loop, don't immediately exit
      noExitRuntime = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      quit_(1, e);
    }
  } finally {
    calledMain = true;

  }
}

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  _emscripten_stack_init();
  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (shouldRunNow) callMain(args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush();
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && noExitRuntime && status === 0) {
    return;
  }

  if (!implicit) {
    if (ENVIRONMENT_IS_PTHREAD) {
      err('Pthread 0x' + _pthread_self().toString(16) + ' called exit(), posting exitProcess.');
      // When running in a pthread we propagate the exit back to the main thread
      // where it can decide if the whole process should be shut down or not.
      // The pthread may have decided not to exit its own runtime, for example
      // because it runs a main loop, but that doesn't affect the main thread.
      postMessage({ 'cmd': 'exitProcess', 'returnCode': status });
      throw new ExitStatus(status);
    } else {
      err('main thead called exit: noExitRuntime=' + noExitRuntime);
    }
  }

  if (noExitRuntime) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      var msg = 'program exited (with status: ' + status + '), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)';
      err(msg);
    }
  } else {
    PThread.terminateAllThreads();

    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);

    ABORT = true;
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module['noInitialRun']) shouldRunNow = false;

// EXIT_RUNTIME=0 only applies to the default behavior of the main browser
// thread.
// The default behaviour for pthreads is always to exit once they return
// from their entry point (or call pthread_exit).  If we set noExitRuntime
// to true here on pthreads they would never complete and attempt to
// pthread_join to them would block forever.
// pthreads can still choose to set `noExitRuntime` explicitly, or
// call emscripten_unwind_to_js_event_loop to extend their lifetime beyond
// their main function.  See comment in src/worker.js for more.
noExitRuntime = !ENVIRONMENT_IS_PTHREAD;

if (!ENVIRONMENT_IS_PTHREAD) {
  run();
} else {
  PThread.initWorker();
}






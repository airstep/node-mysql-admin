(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.__esModule = true;
/**
 * Indicates that navigation was caused by a call to history.push.
 */
var PUSH = exports.PUSH = 'PUSH';

/**
 * Indicates that navigation was caused by a call to history.replace.
 */
var REPLACE = exports.REPLACE = 'REPLACE';

/**
 * Indicates that navigation was caused by some other action such
 * as using a browser's back/forward buttons and/or manually manipulating
 * the URL in a browser's location bar. This is the default.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onpopstate
 * for more information.
 */
var POP = exports.POP = 'POP';
},{}],2:[function(require,module,exports){
"use strict";

exports.__esModule = true;
var loopAsync = exports.loopAsync = function loopAsync(turns, work, callback) {
  var currentTurn = 0,
      isDone = false;
  var isSync = false,
      hasNext = false,
      doneArgs = void 0;

  var done = function done() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    isDone = true;

    if (isSync) {
      // Iterate instead of recursing if possible.
      doneArgs = args;
      return;
    }

    callback.apply(undefined, args);
  };

  var next = function next() {
    if (isDone) return;

    hasNext = true;

    if (isSync) return; // Iterate instead of recursing if possible.

    isSync = true;

    while (!isDone && currentTurn < turns && hasNext) {
      hasNext = false;
      work(currentTurn++, next, done);
    }

    isSync = false;

    if (isDone) {
      // This means the loop finished synchronously.
      callback.apply(undefined, doneArgs);
      return;
    }

    if (currentTurn >= turns && hasNext) {
      isDone = true;
      callback();
    }
  };

  next();
};
},{}],3:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.go = exports.replaceLocation = exports.pushLocation = exports.startListener = exports.getUserConfirmation = exports.getCurrentLocation = undefined;

var _LocationUtils = require('./LocationUtils');

var _DOMUtils = require('./DOMUtils');

var _DOMStateStorage = require('./DOMStateStorage');

var _PathUtils = require('./PathUtils');

var _ExecutionEnvironment = require('./ExecutionEnvironment');

var PopStateEvent = 'popstate';
var HashChangeEvent = 'hashchange';

var needsHashchangeListener = _ExecutionEnvironment.canUseDOM && !(0, _DOMUtils.supportsPopstateOnHashchange)();

var _createLocation = function _createLocation(historyState) {
  var key = historyState && historyState.key;

  return (0, _LocationUtils.createLocation)({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: key ? (0, _DOMStateStorage.readState)(key) : undefined
  }, undefined, key);
};

var getCurrentLocation = exports.getCurrentLocation = function getCurrentLocation() {
  var historyState = void 0;
  try {
    historyState = window.history.state || {};
  } catch (error) {
    // IE 11 sometimes throws when accessing window.history.state
    // See https://github.com/ReactTraining/history/pull/289
    historyState = {};
  }

  return _createLocation(historyState);
};

var getUserConfirmation = exports.getUserConfirmation = function getUserConfirmation(message, callback) {
  return callback(window.confirm(message));
}; // eslint-disable-line no-alert

var startListener = exports.startListener = function startListener(listener) {
  var handlePopState = function handlePopState(event) {
    if (event.state !== undefined) // Ignore extraneous popstate events in WebKit
      listener(_createLocation(event.state));
  };

  (0, _DOMUtils.addEventListener)(window, PopStateEvent, handlePopState);

  var handleUnpoppedHashChange = function handleUnpoppedHashChange() {
    return listener(getCurrentLocation());
  };

  if (needsHashchangeListener) {
    (0, _DOMUtils.addEventListener)(window, HashChangeEvent, handleUnpoppedHashChange);
  }

  return function () {
    (0, _DOMUtils.removeEventListener)(window, PopStateEvent, handlePopState);

    if (needsHashchangeListener) {
      (0, _DOMUtils.removeEventListener)(window, HashChangeEvent, handleUnpoppedHashChange);
    }
  };
};

var updateLocation = function updateLocation(location, updateState) {
  var state = location.state;
  var key = location.key;


  if (state !== undefined) (0, _DOMStateStorage.saveState)(key, state);

  updateState({ key: key }, (0, _PathUtils.createPath)(location));
};

var pushLocation = exports.pushLocation = function pushLocation(location) {
  return updateLocation(location, function (state, path) {
    return window.history.pushState(state, null, path);
  });
};

var replaceLocation = exports.replaceLocation = function replaceLocation(location) {
  return updateLocation(location, function (state, path) {
    return window.history.replaceState(state, null, path);
  });
};

var go = exports.go = function go(n) {
  if (n) window.history.go(n);
};
},{"./DOMStateStorage":4,"./DOMUtils":5,"./ExecutionEnvironment":6,"./LocationUtils":7,"./PathUtils":8}],4:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports.readState = exports.saveState = undefined;

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var QuotaExceededErrors = {
  QuotaExceededError: true,
  QUOTA_EXCEEDED_ERR: true
};

var SecurityErrors = {
  SecurityError: true
};

var KeyPrefix = '@@History/';

var createKey = function createKey(key) {
  return KeyPrefix + key;
};

var saveState = exports.saveState = function saveState(key, state) {
  if (!window.sessionStorage) {
    // Session storage is not available or hidden.
    // sessionStorage is undefined in Internet Explorer when served via file protocol.
    process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(false, '[history] Unable to save state; sessionStorage is not available') : void 0;

    return;
  }

  try {
    if (state == null) {
      window.sessionStorage.removeItem(createKey(key));
    } else {
      window.sessionStorage.setItem(createKey(key), JSON.stringify(state));
    }
  } catch (error) {
    if (SecurityErrors[error.name]) {
      // Blocking cookies in Chrome/Firefox/Safari throws SecurityError on any
      // attempt to access window.sessionStorage.
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(false, '[history] Unable to save state; sessionStorage is not available due to security settings') : void 0;

      return;
    }

    if (QuotaExceededErrors[error.name] && window.sessionStorage.length === 0) {
      // Safari "private mode" throws QuotaExceededError.
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(false, '[history] Unable to save state; sessionStorage is not available in Safari private mode') : void 0;

      return;
    }

    throw error;
  }
};

var readState = exports.readState = function readState(key) {
  var json = void 0;
  try {
    json = window.sessionStorage.getItem(createKey(key));
  } catch (error) {
    if (SecurityErrors[error.name]) {
      // Blocking cookies in Chrome/Firefox/Safari throws SecurityError on any
      // attempt to access window.sessionStorage.
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(false, '[history] Unable to read state; sessionStorage is not available due to security settings') : void 0;

      return undefined;
    }
  }

  if (json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      // Ignore invalid JSON.
    }
  }

  return undefined;
};
}).call(this,require('_process'))

},{"_process":14,"warning":15}],5:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var addEventListener = exports.addEventListener = function addEventListener(node, event, listener) {
  return node.addEventListener ? node.addEventListener(event, listener, false) : node.attachEvent('on' + event, listener);
};

var removeEventListener = exports.removeEventListener = function removeEventListener(node, event, listener) {
  return node.removeEventListener ? node.removeEventListener(event, listener, false) : node.detachEvent('on' + event, listener);
};

/**
 * Returns true if the HTML5 history API is supported. Taken from Modernizr.
 *
 * https://github.com/Modernizr/Modernizr/blob/master/LICENSE
 * https://github.com/Modernizr/Modernizr/blob/master/feature-detects/history.js
 * changed to avoid false negatives for Windows Phones: https://github.com/reactjs/react-router/issues/586
 */
var supportsHistory = exports.supportsHistory = function supportsHistory() {
  var ua = window.navigator.userAgent;

  if ((ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) && ua.indexOf('Mobile Safari') !== -1 && ua.indexOf('Chrome') === -1 && ua.indexOf('Windows Phone') === -1) return false;

  return window.history && 'pushState' in window.history;
};

/**
 * Returns false if using go(n) with hash history causes a full page reload.
 */
var supportsGoWithoutReloadUsingHash = exports.supportsGoWithoutReloadUsingHash = function supportsGoWithoutReloadUsingHash() {
  return window.navigator.userAgent.indexOf('Firefox') === -1;
};

/**
 * Returns true if browser fires popstate on hash change.
 * IE10 and IE11 do not.
 */
var supportsPopstateOnHashchange = exports.supportsPopstateOnHashchange = function supportsPopstateOnHashchange() {
  return window.navigator.userAgent.indexOf('Trident') === -1;
};
},{}],6:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var canUseDOM = exports.canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
},{}],7:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports.locationsAreEqual = exports.statesAreEqual = exports.createLocation = exports.createQuery = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _PathUtils = require('./PathUtils');

var _Actions = require('./Actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createQuery = exports.createQuery = function createQuery(props) {
  return _extends(Object.create(null), props);
};

var createLocation = exports.createLocation = function createLocation() {
  var input = arguments.length <= 0 || arguments[0] === undefined ? '/' : arguments[0];
  var action = arguments.length <= 1 || arguments[1] === undefined ? _Actions.POP : arguments[1];
  var key = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  var object = typeof input === 'string' ? (0, _PathUtils.parsePath)(input) : input;

  process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(!object.path, 'Location descriptor objects should have a `pathname`, not a `path`.') : void 0;

  var pathname = object.pathname || '/';
  var search = object.search || '';
  var hash = object.hash || '';
  var state = object.state;

  return {
    pathname: pathname,
    search: search,
    hash: hash,
    state: state,
    action: action,
    key: key
  };
};

var isDate = function isDate(object) {
  return Object.prototype.toString.call(object) === '[object Date]';
};

var statesAreEqual = exports.statesAreEqual = function statesAreEqual(a, b) {
  if (a === b) return true;

  var typeofA = typeof a === 'undefined' ? 'undefined' : _typeof(a);
  var typeofB = typeof b === 'undefined' ? 'undefined' : _typeof(b);

  if (typeofA !== typeofB) return false;

  !(typeofA !== 'function') ? process.env.NODE_ENV !== 'production' ? (0, _invariant2.default)(false, 'You must not store functions in location state') : (0, _invariant2.default)(false) : void 0;

  // Not the same object, but same type.
  if (typeofA === 'object') {
    !!(isDate(a) && isDate(b)) ? process.env.NODE_ENV !== 'production' ? (0, _invariant2.default)(false, 'You must not store Date objects in location state') : (0, _invariant2.default)(false) : void 0;

    if (!Array.isArray(a)) {
      var keysofA = Object.keys(a);
      var keysofB = Object.keys(b);
      return keysofA.length === keysofB.length && keysofA.every(function (key) {
        return statesAreEqual(a[key], b[key]);
      });
    }

    return Array.isArray(b) && a.length === b.length && a.every(function (item, index) {
      return statesAreEqual(item, b[index]);
    });
  }

  // All other serializable types (string, number, boolean)
  // should be strict equal.
  return false;
};

var locationsAreEqual = exports.locationsAreEqual = function locationsAreEqual(a, b) {
  return a.key === b.key &&
  // a.action === b.action && // Different action !== location change.
  a.pathname === b.pathname && a.search === b.search && a.hash === b.hash && statesAreEqual(a.state, b.state);
};
}).call(this,require('_process'))

},{"./Actions":1,"./PathUtils":8,"_process":14,"invariant":13,"warning":15}],8:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;
exports.createPath = exports.parsePath = exports.getQueryStringValueFromPath = exports.stripQueryStringValueFromPath = exports.addQueryStringValueToPath = undefined;

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var addQueryStringValueToPath = exports.addQueryStringValueToPath = function addQueryStringValueToPath(path, key, value) {
  var _parsePath = parsePath(path);

  var pathname = _parsePath.pathname;
  var search = _parsePath.search;
  var hash = _parsePath.hash;


  return createPath({
    pathname: pathname,
    search: search + (search.indexOf('?') === -1 ? '?' : '&') + key + '=' + value,
    hash: hash
  });
};

var stripQueryStringValueFromPath = exports.stripQueryStringValueFromPath = function stripQueryStringValueFromPath(path, key) {
  var _parsePath2 = parsePath(path);

  var pathname = _parsePath2.pathname;
  var search = _parsePath2.search;
  var hash = _parsePath2.hash;


  return createPath({
    pathname: pathname,
    search: search.replace(new RegExp('([?&])' + key + '=[a-zA-Z0-9]+(&?)'), function (match, prefix, suffix) {
      return prefix === '?' ? prefix : suffix;
    }),
    hash: hash
  });
};

var getQueryStringValueFromPath = exports.getQueryStringValueFromPath = function getQueryStringValueFromPath(path, key) {
  var _parsePath3 = parsePath(path);

  var search = _parsePath3.search;

  var match = search.match(new RegExp('[?&]' + key + '=([a-zA-Z0-9]+)'));
  return match && match[1];
};

var extractPath = function extractPath(string) {
  var match = string.match(/^(https?:)?\/\/[^\/]*/);
  return match == null ? string : string.substring(match[0].length);
};

var parsePath = exports.parsePath = function parsePath(path) {
  var pathname = extractPath(path);
  var search = '';
  var hash = '';

  process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(path === pathname, 'A path must be pathname + search + hash only, not a full URL like "%s"', path) : void 0;

  var hashIndex = pathname.indexOf('#');
  if (hashIndex !== -1) {
    hash = pathname.substring(hashIndex);
    pathname = pathname.substring(0, hashIndex);
  }

  var searchIndex = pathname.indexOf('?');
  if (searchIndex !== -1) {
    search = pathname.substring(searchIndex);
    pathname = pathname.substring(0, searchIndex);
  }

  if (pathname === '') pathname = '/';

  return {
    pathname: pathname,
    search: search,
    hash: hash
  };
};

var createPath = exports.createPath = function createPath(location) {
  if (location == null || typeof location === 'string') return location;

  var basename = location.basename;
  var pathname = location.pathname;
  var search = location.search;
  var hash = location.hash;

  var path = (basename || '') + pathname;

  if (search && search !== '?') path += search;

  if (hash) path += hash;

  return path;
};
}).call(this,require('_process'))

},{"_process":14,"warning":15}],9:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.replaceLocation = exports.pushLocation = exports.getCurrentLocation = exports.go = exports.getUserConfirmation = undefined;

var _BrowserProtocol = require('./BrowserProtocol');

Object.defineProperty(exports, 'getUserConfirmation', {
  enumerable: true,
  get: function get() {
    return _BrowserProtocol.getUserConfirmation;
  }
});
Object.defineProperty(exports, 'go', {
  enumerable: true,
  get: function get() {
    return _BrowserProtocol.go;
  }
});

var _LocationUtils = require('./LocationUtils');

var _PathUtils = require('./PathUtils');

var getCurrentLocation = exports.getCurrentLocation = function getCurrentLocation() {
  return (0, _LocationUtils.createLocation)(window.location);
};

var pushLocation = exports.pushLocation = function pushLocation(location) {
  window.location.href = (0, _PathUtils.createPath)(location);
  return false; // Don't update location
};

var replaceLocation = exports.replaceLocation = function replaceLocation(location) {
  window.location.replace((0, _PathUtils.createPath)(location));
  return false; // Don't update location
};
},{"./BrowserProtocol":3,"./LocationUtils":7,"./PathUtils":8}],10:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _ExecutionEnvironment = require('./ExecutionEnvironment');

var _BrowserProtocol = require('./BrowserProtocol');

var BrowserProtocol = _interopRequireWildcard(_BrowserProtocol);

var _RefreshProtocol = require('./RefreshProtocol');

var RefreshProtocol = _interopRequireWildcard(_RefreshProtocol);

var _DOMUtils = require('./DOMUtils');

var _createHistory = require('./createHistory');

var _createHistory2 = _interopRequireDefault(_createHistory);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Creates and returns a history object that uses HTML5's history API
 * (pushState, replaceState, and the popstate event) to manage history.
 * This is the recommended method of managing history in browsers because
 * it provides the cleanest URLs.
 *
 * Note: In browsers that do not support the HTML5 history API full
 * page reloads will be used to preserve clean URLs. You can force this
 * behavior using { forceRefresh: true } in options.
 */
var createBrowserHistory = function createBrowserHistory() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  !_ExecutionEnvironment.canUseDOM ? process.env.NODE_ENV !== 'production' ? (0, _invariant2.default)(false, 'Browser history needs a DOM') : (0, _invariant2.default)(false) : void 0;

  var useRefresh = options.forceRefresh || !(0, _DOMUtils.supportsHistory)();
  var Protocol = useRefresh ? RefreshProtocol : BrowserProtocol;

  var getUserConfirmation = Protocol.getUserConfirmation;
  var getCurrentLocation = Protocol.getCurrentLocation;
  var pushLocation = Protocol.pushLocation;
  var replaceLocation = Protocol.replaceLocation;
  var go = Protocol.go;


  var history = (0, _createHistory2.default)(_extends({
    getUserConfirmation: getUserConfirmation }, options, {
    getCurrentLocation: getCurrentLocation,
    pushLocation: pushLocation,
    replaceLocation: replaceLocation,
    go: go
  }));

  var listenerCount = 0,
      stopListener = void 0;

  var startListener = function startListener(listener, before) {
    if (++listenerCount === 1) stopListener = BrowserProtocol.startListener(history.transitionTo);

    var unlisten = before ? history.listenBefore(listener) : history.listen(listener);

    return function () {
      unlisten();

      if (--listenerCount === 0) stopListener();
    };
  };

  var listenBefore = function listenBefore(listener) {
    return startListener(listener, true);
  };

  var listen = function listen(listener) {
    return startListener(listener, false);
  };

  return _extends({}, history, {
    listenBefore: listenBefore,
    listen: listen
  });
};

exports.default = createBrowserHistory;
}).call(this,require('_process'))

},{"./BrowserProtocol":3,"./DOMUtils":5,"./ExecutionEnvironment":6,"./RefreshProtocol":9,"./createHistory":11,"_process":14,"invariant":13}],11:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _AsyncUtils = require('./AsyncUtils');

var _PathUtils = require('./PathUtils');

var _runTransitionHook = require('./runTransitionHook');

var _runTransitionHook2 = _interopRequireDefault(_runTransitionHook);

var _Actions = require('./Actions');

var _LocationUtils = require('./LocationUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createHistory = function createHistory() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var getCurrentLocation = options.getCurrentLocation;
  var getUserConfirmation = options.getUserConfirmation;
  var pushLocation = options.pushLocation;
  var replaceLocation = options.replaceLocation;
  var go = options.go;
  var keyLength = options.keyLength;


  var currentLocation = void 0;
  var pendingLocation = void 0;
  var beforeListeners = [];
  var listeners = [];
  var allKeys = [];

  var getCurrentIndex = function getCurrentIndex() {
    if (pendingLocation && pendingLocation.action === _Actions.POP) return allKeys.indexOf(pendingLocation.key);

    if (currentLocation) return allKeys.indexOf(currentLocation.key);

    return -1;
  };

  var updateLocation = function updateLocation(nextLocation) {
    var currentIndex = getCurrentIndex();

    currentLocation = nextLocation;

    if (currentLocation.action === _Actions.PUSH) {
      allKeys = [].concat(allKeys.slice(0, currentIndex + 1), [currentLocation.key]);
    } else if (currentLocation.action === _Actions.REPLACE) {
      allKeys[currentIndex] = currentLocation.key;
    }

    listeners.forEach(function (listener) {
      return listener(currentLocation);
    });
  };

  var listenBefore = function listenBefore(listener) {
    beforeListeners.push(listener);

    return function () {
      return beforeListeners = beforeListeners.filter(function (item) {
        return item !== listener;
      });
    };
  };

  var listen = function listen(listener) {
    listeners.push(listener);

    return function () {
      return listeners = listeners.filter(function (item) {
        return item !== listener;
      });
    };
  };

  var confirmTransitionTo = function confirmTransitionTo(location, callback) {
    (0, _AsyncUtils.loopAsync)(beforeListeners.length, function (index, next, done) {
      (0, _runTransitionHook2.default)(beforeListeners[index], location, function (result) {
        return result != null ? done(result) : next();
      });
    }, function (message) {
      if (getUserConfirmation && typeof message === 'string') {
        getUserConfirmation(message, function (ok) {
          return callback(ok !== false);
        });
      } else {
        callback(message !== false);
      }
    });
  };

  var transitionTo = function transitionTo(nextLocation) {
    if (currentLocation && (0, _LocationUtils.locationsAreEqual)(currentLocation, nextLocation) || pendingLocation && (0, _LocationUtils.locationsAreEqual)(pendingLocation, nextLocation)) return; // Nothing to do

    pendingLocation = nextLocation;

    confirmTransitionTo(nextLocation, function (ok) {
      if (pendingLocation !== nextLocation) return; // Transition was interrupted during confirmation

      pendingLocation = null;

      if (ok) {
        // Treat PUSH to same path like REPLACE to be consistent with browsers
        if (nextLocation.action === _Actions.PUSH) {
          var prevPath = (0, _PathUtils.createPath)(currentLocation);
          var nextPath = (0, _PathUtils.createPath)(nextLocation);

          if (nextPath === prevPath && (0, _LocationUtils.statesAreEqual)(currentLocation.state, nextLocation.state)) nextLocation.action = _Actions.REPLACE;
        }

        if (nextLocation.action === _Actions.POP) {
          updateLocation(nextLocation);
        } else if (nextLocation.action === _Actions.PUSH) {
          if (pushLocation(nextLocation) !== false) updateLocation(nextLocation);
        } else if (nextLocation.action === _Actions.REPLACE) {
          if (replaceLocation(nextLocation) !== false) updateLocation(nextLocation);
        }
      } else if (currentLocation && nextLocation.action === _Actions.POP) {
        var prevIndex = allKeys.indexOf(currentLocation.key);
        var nextIndex = allKeys.indexOf(nextLocation.key);

        if (prevIndex !== -1 && nextIndex !== -1) go(prevIndex - nextIndex); // Restore the URL
      }
    });
  };

  var push = function push(input) {
    return transitionTo(createLocation(input, _Actions.PUSH));
  };

  var replace = function replace(input) {
    return transitionTo(createLocation(input, _Actions.REPLACE));
  };

  var goBack = function goBack() {
    return go(-1);
  };

  var goForward = function goForward() {
    return go(1);
  };

  var createKey = function createKey() {
    return Math.random().toString(36).substr(2, keyLength || 6);
  };

  var createHref = function createHref(location) {
    return (0, _PathUtils.createPath)(location);
  };

  var createLocation = function createLocation(location, action) {
    var key = arguments.length <= 2 || arguments[2] === undefined ? createKey() : arguments[2];
    return (0, _LocationUtils.createLocation)(location, action, key);
  };

  return {
    getCurrentLocation: getCurrentLocation,
    listenBefore: listenBefore,
    listen: listen,
    transitionTo: transitionTo,
    push: push,
    replace: replace,
    go: go,
    goBack: goBack,
    goForward: goForward,
    createKey: createKey,
    createPath: _PathUtils.createPath,
    createHref: createHref,
    createLocation: createLocation
  };
};

exports.default = createHistory;
},{"./Actions":1,"./AsyncUtils":2,"./LocationUtils":7,"./PathUtils":8,"./runTransitionHook":12}],12:[function(require,module,exports){
(function (process){
'use strict';

exports.__esModule = true;

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var runTransitionHook = function runTransitionHook(hook, location, callback) {
  var result = hook(location, callback);

  if (hook.length < 2) {
    // Assume the hook runs synchronously and automatically
    // call the callback with the return value.
    callback(result);
  } else {
    process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(result === undefined, 'You should not "return" in a transition hook with a callback argument; ' + 'call the callback instead') : void 0;
  }
};

exports.default = runTransitionHook;
}).call(this,require('_process'))

},{"_process":14,"warning":15}],13:[function(require,module,exports){
(function (process){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function(condition, format, a, b, c, d, e, f) {
  if (process.env.NODE_ENV !== 'production') {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        'Minified exception occurred; use the non-minified dev environment ' +
        'for the full error message and additional helpful warnings.'
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;

}).call(this,require('_process'))

},{"_process":14}],14:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],15:[function(require,module,exports){
(function (process){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var warning = function() {};

if (process.env.NODE_ENV !== 'production') {
  warning = function(condition, format, args) {
    var len = arguments.length;
    args = new Array(len > 2 ? len - 2 : 0);
    for (var key = 2; key < len; key++) {
      args[key - 2] = arguments[key];
    }
    if (format === undefined) {
      throw new Error(
        '`warning(condition, format, ...args)` requires a warning ' +
        'message argument'
      );
    }

    if (format.length < 10 || (/^[s\W]*$/).test(format)) {
      throw new Error(
        'The warning format should be able to uniquely identify this ' +
        'warning. Please, use a more descriptive format than: ' + format
      );
    }

    if (!condition) {
      var argIndex = 0;
      var message = 'Warning: ' +
        format.replace(/%s/g, function() {
          return args[argIndex++];
        });
      if (typeof console !== 'undefined') {
        console.error(message);
      }
      try {
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw new Error(message);
      } catch(x) {}
    }
  };
}

module.exports = warning;

}).call(this,require('_process'))

},{"_process":14}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Sidebar = require('./components/Sidebar');

var _Sidebar2 = _interopRequireDefault(_Sidebar);

var _DatabaseBreadCrumb = require('./pages/DatabaseBreadCrumb');

var _DatabaseBreadCrumb2 = _interopRequireDefault(_DatabaseBreadCrumb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var App = function (_React$Component) {
    _inherits(App, _React$Component);

    function App(props) {
        _classCallCheck(this, App);

        return _possibleConstructorReturn(this, (App.__proto__ || Object.getPrototypeOf(App)).call(this, props));
    }

    _createClass(App, [{
        key: 'render',
        value: function render() {

            return _react2.default.createElement(
                'div',
                { className: 'container-fluid' },
                _react2.default.createElement(
                    'div',
                    { className: 'row' },
                    _react2.default.createElement(_Sidebar2.default, this.props.params),
                    _react2.default.createElement(
                        'main',
                        { className: 'col-md-10 offset-md-2', style: { marginTop: 10 } },
                        _react2.default.createElement(_DatabaseBreadCrumb2.default, this.props),
                        this.props.children
                    )
                )
            );
        }
    }]);

    return App;
}(_react2.default.Component);

exports.default = App;

},{"./components/Sidebar":18,"./pages/DatabaseBreadCrumb":21,"react":undefined}],17:[function(require,module,exports){
'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _reactRouter = require('react-router');

var _createBrowserHistory = require('history/lib/createBrowserHistory');

var _createBrowserHistory2 = _interopRequireDefault(_createBrowserHistory);

var _App = require('./App');

var _App2 = _interopRequireDefault(_App);

var _HomePage = require('./pages/HomePage');

var _HomePage2 = _interopRequireDefault(_HomePage);

var _DatabasePage = require('./pages/database/DatabasePage');

var _DatabasePage2 = _interopRequireDefault(_DatabasePage);

var _TablePage = require('./pages/database/table/TablePage');

var _TablePage2 = _interopRequireDefault(_TablePage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var routes = _react2.default.createElement(
    _reactRouter.Router,
    { history: (0, _createBrowserHistory2.default)() },
    _react2.default.createElement(
        _reactRouter.Route,
        { path: '/', component: _App2.default },
        _react2.default.createElement(_reactRouter.IndexRoute, { component: _HomePage2.default }),
        _react2.default.createElement(_reactRouter.Route, { path: '/', component: _HomePage2.default }),
        _react2.default.createElement(_reactRouter.Route, { path: '/database/:dbname', component: _DatabasePage2.default }),
        _react2.default.createElement(_reactRouter.Route, { path: '/database/:dbname/:tablename', component: _TablePage2.default })
    )
);

_reactDom2.default.render(routes, document.getElementById('app'));

},{"./App":16,"./pages/HomePage":22,"./pages/database/DatabasePage":23,"./pages/database/table/TablePage":24,"history/lib/createBrowserHistory":10,"react":undefined,"react-dom":undefined,"react-router":undefined}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Http = require('../services/Http');

var _Http2 = _interopRequireDefault(_Http);

var _reactRouter = require('react-router');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Sidebar = function (_React$Component) {
    _inherits(Sidebar, _React$Component);

    function Sidebar(props) {
        _classCallCheck(this, Sidebar);

        var _this = _possibleConstructorReturn(this, (Sidebar.__proto__ || Object.getPrototypeOf(Sidebar)).call(this, props));

        _this.state = {
            databases: [],
            selectedDbname: null
        };
        return _this;
    }

    _createClass(Sidebar, [{
        key: 'componentDidMount',
        value: function componentDidMount() {

            this.setState({
                selectedDbname: this.props.dbname,
                selectedTablename: this.props.tablename
            });

            this.listDatabases();
        }
    }, {
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(nextProps) {

            this.setState({
                selectedDbname: nextProps.dbname,
                selectedTablename: nextProps.tablename
            });
        }
    }, {
        key: 'listDatabases',
        value: function listDatabases() {

            var self = this;

            _Http2.default.post("/database/list").then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    databases: r.data.payload
                });
            });
        }
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var databases = self.state.databases;
            var tables = self.state.tables;

            return _react2.default.createElement(
                'nav',
                { className: 'col-md-2 hidden-xs-down bg-faded sidebar' },
                _react2.default.createElement(
                    'ul',
                    { className: 'nav nav-pills flex-column' },
                    databases.map(function (item, idx) {
                        return _react2.default.createElement(
                            'li',
                            {
                                key: idx,
                                className: 'nav-item' },
                            _react2.default.createElement(
                                _reactRouter.Link,
                                {
                                    to: "/database/" + item.Database,
                                    className: "nav-link " + (item.Database == self.state.selectedDbname ? "active" : null) },
                                item.Database
                            )
                        );
                    })
                )
            );
        }
    }]);

    return Sidebar;
}(_react2.default.Component);

exports.default = Sidebar;

},{"../services/Http":29,"react":undefined,"react-router":undefined}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Tab = function (_React$Component) {
    _inherits(Tab, _React$Component);

    function Tab(props) {
        _classCallCheck(this, Tab);

        return _possibleConstructorReturn(this, (Tab.__proto__ || Object.getPrototypeOf(Tab)).call(this, props));
    }

    _createClass(Tab, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                this.props,
                this.props.children
            );
        }
    }]);

    return Tab;
}(_react2.default.Component);

exports.default = Tab;

},{"react":undefined}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AboutPage = function (_React$Component) {
    _inherits(AboutPage, _React$Component);

    function AboutPage(props) {
        _classCallCheck(this, AboutPage);

        var _this = _possibleConstructorReturn(this, (AboutPage.__proto__ || Object.getPrototypeOf(AboutPage)).call(this, props));

        _this.state = {
            selected: -1
        };

        _this.isTabActive = _this.isTabActive.bind(_this);
        _this.setTab = _this.setTab.bind(_this);
        return _this;
    }

    _createClass(AboutPage, [{
        key: "isTabActive",
        value: function isTabActive(idx) {
            return this.state.selected == idx ? "nav-link active" : "nav-link";
        }
    }, {
        key: "setTab",
        value: function setTab(idx) {
            this.setState({
                selected: idx
            });
        }
    }, {
        key: "componentDidMount",
        value: function componentDidMount() {
            this.setState({
                selected: this.props.selected
            });
        }
    }, {
        key: "render",
        value: function render() {

            var self = this;

            return _react2.default.createElement(
                "div",
                null,
                _react2.default.createElement(
                    "ul",
                    { className: "nav nav-tabs" },
                    self.props.children.map(function (tab, idx) {
                        return _react2.default.createElement(
                            "li",
                            { className: "nav-item pointer", key: idx },
                            _react2.default.createElement(
                                "a",
                                { className: self.isTabActive(idx), onClick: function onClick() {
                                        return self.setTab(idx);
                                    } },
                                tab.props.label
                            )
                        );
                    })
                ),
                _react2.default.createElement(
                    "div",
                    { style: { marginTop: 5 } },
                    self.props.children[self.state.selected]
                )
            );
        }
    }]);

    return AboutPage;
}(_react2.default.Component);

exports.default = AboutPage;

},{"react":undefined}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRouter = require('react-router');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
* this component lives in App
* top of content
* */

var DatabaseBreadCrumb = function (_React$Component) {
    _inherits(DatabaseBreadCrumb, _React$Component);

    function DatabaseBreadCrumb(props) {
        _classCallCheck(this, DatabaseBreadCrumb);

        return _possibleConstructorReturn(this, (DatabaseBreadCrumb.__proto__ || Object.getPrototypeOf(DatabaseBreadCrumb)).call(this, props));
    }

    _createClass(DatabaseBreadCrumb, [{
        key: 'render',
        value: function render() {

            var self = this;
            var props = self.props;
            var dbname = props.params.dbname;
            var tablename = props.params.tablename;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'nav',
                    { className: 'breadcrumb' },
                    _react2.default.createElement(
                        _reactRouter.Link,
                        { className: 'breadcrumb-item', to: '/' },
                        'Home'
                    ),
                    dbname ? _react2.default.createElement(
                        _reactRouter.Link,
                        { className: "breadcrumb-item " + (tablename ? "" : "active"), to: "/database/" + dbname },
                        dbname
                    ) : null,
                    tablename ? _react2.default.createElement(
                        _reactRouter.Link,
                        { className: "breadcrumb-item active", to: "/database/" + dbname + "/" + tablename },
                        tablename
                    ) : null
                )
            );
        }
    }]);

    return DatabaseBreadCrumb;
}(_react2.default.Component);

exports.default = DatabaseBreadCrumb;

},{"react":undefined,"react-router":undefined}],22:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var HomePage = function (_React$Component) {
    _inherits(HomePage, _React$Component);

    function HomePage(props) {
        _classCallCheck(this, HomePage);

        return _possibleConstructorReturn(this, (HomePage.__proto__ || Object.getPrototypeOf(HomePage)).call(this, props));
    }

    _createClass(HomePage, [{
        key: 'render',
        value: function render() {
            return _react2.default.createElement(
                'div',
                null,
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'homepage ',
                _react2.default.createElement('br', null),
                'home'
            );
        }
    }]);

    return HomePage;
}(_react2.default.Component);

exports.default = HomePage;

},{"react":undefined}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Http = require('../../services/Http');

var _Http2 = _interopRequireDefault(_Http);

var _Util = require('../../services/Util');

var _Util2 = _interopRequireDefault(_Util);

var _reactRouter = require('react-router');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
* List tables in this page for a selected dbname
*/

var DatabasePage = function (_React$Component) {
    _inherits(DatabasePage, _React$Component);

    function DatabasePage(props) {
        _classCallCheck(this, DatabasePage);

        var _this = _possibleConstructorReturn(this, (DatabasePage.__proto__ || Object.getPrototypeOf(DatabasePage)).call(this, props));

        _this.state = {
            tables: []
        };
        return _this;
    }

    _createClass(DatabasePage, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            this.listTables(this.props.params.dbname);
        }
    }, {
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(nextProps) {
            this.listTables(nextProps.params.dbname);
        }
    }, {
        key: 'listTables',
        value: function listTables(dbname) {

            var self = this;

            _Http2.default.post("/table/list", { dbname: dbname }).then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    tables: r.data.payload
                });
            });
        }
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var props = self.props;
            var dbname = props.params.dbname; /* from params because this component is a page */
            var tables = self.state.tables;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'table',
                    { className: 'table table-sm table-hover' },
                    _react2.default.createElement(
                        'thead',
                        null,
                        _react2.default.createElement(
                            'tr',
                            null,
                            _react2.default.createElement(
                                'th',
                                null,
                                'Table'
                            ),
                            _react2.default.createElement(
                                'th',
                                null,
                                'Operations'
                            )
                        )
                    ),
                    _react2.default.createElement(
                        'tbody',
                        null,
                        tables.map(function (table, idx) {
                            return _react2.default.createElement(
                                'tr',
                                { key: idx },
                                _react2.default.createElement(
                                    'td',
                                    { className: 'pointer' },
                                    _react2.default.createElement(
                                        _reactRouter.Link,
                                        { to: "/database/" + dbname + "/" + table },
                                        table
                                    )
                                ),
                                _react2.default.createElement(
                                    'td',
                                    null,
                                    '##'
                                )
                            );
                        })
                    )
                )
            );
        }
    }]);

    return DatabasePage;
}(_react2.default.Component);

exports.default = DatabasePage;

},{"../../services/Http":29,"../../services/Util":30,"react":undefined,"react-router":undefined}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRouter = require('react-router');

var _Tab = require('../../../components/Tab');

var _Tab2 = _interopRequireDefault(_Tab);

var _Tabs = require('../../../components/Tabs');

var _Tabs2 = _interopRequireDefault(_Tabs);

var _TableStructure = require('./tabs/structure/TableStructure');

var _TableStructure2 = _interopRequireDefault(_TableStructure);

var _TableRows = require('./tabs/rows/TableRows');

var _TableRows2 = _interopRequireDefault(_TableRows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * In this component, there are two components showing:
 * DatabaseTablePageColumns and DatabaseTablePageRows
 */

var DatabaseTablePage = function (_React$Component) {
    _inherits(DatabaseTablePage, _React$Component);

    function DatabaseTablePage(props) {
        _classCallCheck(this, DatabaseTablePage);

        var _this = _possibleConstructorReturn(this, (DatabaseTablePage.__proto__ || Object.getPrototypeOf(DatabaseTablePage)).call(this, props));

        _this.state = {};
        return _this;
    }

    _createClass(DatabaseTablePage, [{
        key: 'render',
        value: function render() {

            var self = this;
            var props = self.props;
            var dbname = props.params.dbname;
            var tablename = props.params.tablename;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    _Tabs2.default,
                    { selected: 0 },
                    _react2.default.createElement(
                        _Tab2.default,
                        { label: 'Rows' },
                        _react2.default.createElement(_TableRows2.default, self.props.params)
                    ),
                    _react2.default.createElement(
                        _Tab2.default,
                        { label: 'Structure' },
                        _react2.default.createElement(_TableStructure2.default, self.props.params)
                    )
                )
            );
        }
    }]);

    return DatabaseTablePage;
}(_react2.default.Component);

exports.default = DatabaseTablePage;

},{"../../../components/Tab":19,"../../../components/Tabs":20,"./tabs/rows/TableRows":25,"./tabs/structure/TableStructure":28,"react":undefined,"react-router":undefined}],25:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Http = require('../../../../../services/Http');

var _Http2 = _interopRequireDefault(_Http);

var _reactRouter = require('react-router');

var _Row = require('./component/Row');

var _Row2 = _interopRequireDefault(_Row);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * List structure in this component for a selected tablename
 */

var TableRows = function (_React$Component) {
    _inherits(TableRows, _React$Component);

    function TableRows(props) {
        _classCallCheck(this, TableRows);

        var _this = _possibleConstructorReturn(this, (TableRows.__proto__ || Object.getPrototypeOf(TableRows)).call(this, props));

        _this.state = {
            columns: [],
            rows: [],
            page: 0
        };

        _this.setPageByInput = _this.setPageByInput.bind(_this);
        return _this;
    }

    _createClass(TableRows, [{
        key: 'componentDidMount',
        value: function componentDidMount() {

            /* first list structure, because we need them to show in table <thead/> */
            this.listColumns();
        }
    }, {
        key: 'listColumns',
        value: function listColumns() {

            var self = this;
            var dbname = self.props.dbname;
            var tablename = self.props.tablename;

            _Http2.default.post("/table/column/list", { dbname: dbname, tablename: tablename }).then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    columns: r.data.payload
                });

                self.listRows(self.state.page);
            });
        }
    }, {
        key: 'listRows',
        value: function listRows(page) {

            var self = this;
            var dbname = self.props.dbname;
            var tablename = self.props.tablename;

            self.setState({
                page: page
            });

            _Http2.default.post("/table/rows", { dbname: dbname, tablename: tablename, page: page }).then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    rows: r.data.payload
                });
            });
        }
    }, {
        key: 'setPageByInput',
        value: function setPageByInput(e) {
            this.setState({
                page: e.target.value
            });
        }
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var columns = self.state.columns;
            var rows = self.state.rows;
            var page = self.state.page;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'table',
                    { className: 'table table-sm table-hover table-striped' },
                    _react2.default.createElement(
                        'thead',
                        null,
                        _react2.default.createElement(
                            'tr',
                            null,
                            columns.map(function (col, idx) {
                                return _react2.default.createElement(
                                    'th',
                                    { key: idx },
                                    col.Field
                                );
                            })
                        )
                    ),
                    _react2.default.createElement(
                        'tbody',
                        null,
                        rows.map(function (row, idx) {
                            return _react2.default.createElement(_Row2.default, {
                                key: idx,
                                dbname: self.props.dbname,
                                tablename: self.props.tablename,
                                columns: columns,
                                row: row
                            });
                        })
                    )
                ),
                _react2.default.createElement(
                    'ul',
                    { className: 'pagination' },
                    _react2.default.createElement(
                        'li',
                        { className: 'page-item', onClick: function onClick() {
                                self.listRows(--page);
                            } },
                        _react2.default.createElement(
                            'a',
                            { className: 'page-link', href: '#', 'aria-label': 'Next' },
                            _react2.default.createElement(
                                'span',
                                { 'aria-hidden': 'true' },
                                '\xAB'
                            ),
                            _react2.default.createElement(
                                'span',
                                { className: 'sr-only' },
                                'Next'
                            )
                        )
                    ),
                    _react2.default.createElement(
                        'li',
                        { className: 'page-item' },
                        _react2.default.createElement(
                            'a',
                            { className: 'page-link', href: '#' },
                            page
                        )
                    ),
                    _react2.default.createElement(
                        'li',
                        { className: 'page-item', onClick: function onClick() {
                                self.listRows(++page);
                            } },
                        _react2.default.createElement(
                            'a',
                            { className: 'page-link', href: '#', 'aria-label': 'Next' },
                            _react2.default.createElement(
                                'span',
                                { 'aria-hidden': 'true' },
                                '\xBB'
                            ),
                            _react2.default.createElement(
                                'span',
                                { className: 'sr-only' },
                                'Next'
                            )
                        )
                    )
                ),
                _react2.default.createElement(
                    'div',
                    { className: 'input-group', style: { width: 250 } },
                    _react2.default.createElement('input', { type: 'text', className: 'form-control', placeholder: 'Go to page', onChange: self.setPageByInput }),
                    _react2.default.createElement(
                        'span',
                        { className: 'input-group-btn' },
                        _react2.default.createElement(
                            'button',
                            {
                                className: 'btn btn-secondary',
                                type: 'button',
                                onClick: function onClick() {
                                    self.listRows(page);
                                } },
                            'Go'
                        )
                    )
                )
            );
        }
    }]);

    return TableRows;
}(_react2.default.Component);

exports.default = TableRows;

},{"../../../../../services/Http":29,"./component/Row":27,"react":undefined,"react-router":undefined}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Column = function (_React$Component) {
    _inherits(Column, _React$Component);

    function Column(props) {
        _classCallCheck(this, Column);

        return _possibleConstructorReturn(this, (Column.__proto__ || Object.getPrototypeOf(Column)).call(this, props));
    }

    _createClass(Column, [{
        key: 'componentDidMount',
        value: function componentDidMount() {}
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var props = this.props;
            var field = props.field;
            var row = props.row;

            return _react2.default.createElement(
                'td',
                null,
                row[field]
            );
        }
    }]);

    return Column;
}(_react2.default.Component);

Column.propTypes = {
    field: _react2.default.PropTypes.string.isRequired,
    row: _react2.default.PropTypes.object.isRequired,
    dbname: _react2.default.PropTypes.string.isRequired,
    tablename: _react2.default.PropTypes.string.isRequired
};

exports.default = Column;

},{"react":undefined}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Column = require('./Column');

var _Column2 = _interopRequireDefault(_Column);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Row = function (_React$Component) {
    _inherits(Row, _React$Component);

    function Row(props) {
        _classCallCheck(this, Row);

        return _possibleConstructorReturn(this, (Row.__proto__ || Object.getPrototypeOf(Row)).call(this, props));
    }

    _createClass(Row, [{
        key: 'componentDidMount',
        value: function componentDidMount() {}
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var props = this.props;
            var columns = props.columns;
            var row = props.row;

            return _react2.default.createElement(
                'tr',
                null,
                columns.map(function (col, idx) {
                    return _react2.default.createElement(_Column2.default, {
                        key: idx,
                        row: row,
                        field: col.Field,
                        dbname: props.dbname,
                        tablename: props.tablename
                    });
                })
            );
        }
    }]);

    return Row;
}(_react2.default.Component);

Row.propTypes = {
    columns: _react2.default.PropTypes.array.isRequired,
    row: _react2.default.PropTypes.object.isRequired,
    dbname: _react2.default.PropTypes.string.isRequired,
    tablename: _react2.default.PropTypes.string.isRequired
};

exports.default = Row;

},{"./Column":26,"react":undefined}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Http = require('../../../../../services/Http');

var _Http2 = _interopRequireDefault(_Http);

var _reactRouter = require('react-router');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/*
 * List structure in this component for a selected tablename
 */

var TableStructure = function (_React$Component) {
    _inherits(TableStructure, _React$Component);

    function TableStructure(props) {
        _classCallCheck(this, TableStructure);

        var _this = _possibleConstructorReturn(this, (TableStructure.__proto__ || Object.getPrototypeOf(TableStructure)).call(this, props));

        _this.state = {
            columns: []
        };
        return _this;
    }

    _createClass(TableStructure, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            this.listColumns();
        }
    }, {
        key: 'listColumns',
        value: function listColumns() {

            var self = this;
            var dbname = self.props.dbname;
            var tablename = self.props.tablename;

            _Http2.default.post("/table/column/list", { dbname: dbname, tablename: tablename }).then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    columns: r.data.payload
                });
            });
        }
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var columns = self.state.columns;

            return _react2.default.createElement(
                'div',
                null,
                _react2.default.createElement(
                    'table',
                    { className: 'table table-sm table-hover table-striped' },
                    _react2.default.createElement(
                        'thead',
                        null,
                        _react2.default.createElement(
                            'tr',
                            null,
                            _react2.default.createElement(
                                'th',
                                null,
                                'Column'
                            ),
                            _react2.default.createElement(
                                'th',
                                null,
                                'Type'
                            ),
                            _react2.default.createElement(
                                'th',
                                null,
                                'Null?'
                            ),
                            _react2.default.createElement(
                                'th',
                                null,
                                'Default'
                            ),
                            _react2.default.createElement(
                                'th',
                                null,
                                'Operations'
                            )
                        )
                    ),
                    _react2.default.createElement(
                        'tbody',
                        null,
                        columns.map(function (col, idx) {
                            return _react2.default.createElement(
                                'tr',
                                { key: idx },
                                _react2.default.createElement(
                                    'td',
                                    { className: 'pointer' },
                                    col.Key == "PRI" ? _react2.default.createElement(
                                        'span',
                                        null,
                                        _react2.default.createElement('i', { className: 'fa fa-key' }),
                                        '\xA0'
                                    ) : null,
                                    col.Field
                                ),
                                _react2.default.createElement(
                                    'td',
                                    { className: 'pointer' },
                                    col.Type
                                ),
                                _react2.default.createElement(
                                    'td',
                                    { className: 'pointer' },
                                    col.Null
                                ),
                                _react2.default.createElement(
                                    'td',
                                    { className: 'pointer' },
                                    col.Default
                                ),
                                _react2.default.createElement(
                                    'td',
                                    null,
                                    '##'
                                )
                            );
                        })
                    )
                )
            );
        }
    }]);

    return TableStructure;
}(_react2.default.Component);

exports.default = TableStructure;

},{"../../../../../services/Http":29,"react":undefined,"react-router":undefined}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Http = {
    post: function post(url, data) {

        if (!data) {
            data = {};
        }

        return _axios2.default.post(url, data);
    },
    get: function get(url) {
        return _axios2.default.get(url);
    }
};

exports.default = Http;

},{"axios":undefined}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _reactRouter = require('react-router');

var Util = {
    redirect: function redirect(url) {
        _reactRouter.browserHistory.push(url);
    }
};

exports.default = Util;

},{"react-router":undefined}]},{},[17])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvQWN0aW9ucy5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9Bc3luY1V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL0Jyb3dzZXJQcm90b2NvbC5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9ET01TdGF0ZVN0b3JhZ2UuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvRE9NVXRpbHMuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvRXhlY3V0aW9uRW52aXJvbm1lbnQuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvTG9jYXRpb25VdGlscy5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9QYXRoVXRpbHMuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvUmVmcmVzaFByb3RvY29sLmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL2NyZWF0ZUJyb3dzZXJIaXN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL2NyZWF0ZUhpc3RvcnkuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvcnVuVHJhbnNpdGlvbkhvb2suanMiLCJub2RlX21vZHVsZXMvaW52YXJpYW50L2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3dhcm5pbmcvYnJvd3Nlci5qcyIsInB1YmxpYy9BcHAuanMiLCJwdWJsaWMvUm91dGVzLmpzIiwicHVibGljL2NvbXBvbmVudHMvU2lkZWJhci5qcyIsInB1YmxpYy9jb21wb25lbnRzL1RhYi5qcyIsInB1YmxpYy9jb21wb25lbnRzL1RhYnMuanMiLCJwdWJsaWMvcGFnZXMvRGF0YWJhc2VCcmVhZENydW1iLmpzIiwicHVibGljL3BhZ2VzL0hvbWVQYWdlLmpzIiwicHVibGljL3BhZ2VzL2RhdGFiYXNlL0RhdGFiYXNlUGFnZS5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS9UYWJsZVBhZ2UuanMiLCJwdWJsaWMvcGFnZXMvZGF0YWJhc2UvdGFibGUvdGFicy9yb3dzL1RhYmxlUm93cy5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3Jvd3MvY29tcG9uZW50L0NvbHVtbi5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3Jvd3MvY29tcG9uZW50L1Jvdy5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3N0cnVjdHVyZS9UYWJsZVN0cnVjdHVyZS5qcyIsInB1YmxpYy9zZXJ2aWNlcy9IdHRwLmpzIiwicHVibGljL3NlcnZpY2VzL1V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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TSxPQUFPO0FBRVQsUUFGUyxnQkFFSixHQUZJLEVBRUMsSUFGRCxFQUVPOztBQUVaLFlBQUcsQ0FBQyxJQUFKLEVBQVU7QUFDTixtQkFBTyxFQUFQO0FBQ0g7O0FBRUQsZUFBTyxnQkFBTSxJQUFOLENBQVcsR0FBWCxFQUFnQixJQUFoQixDQUFQO0FBQ0gsS0FUUTtBQVdULE9BWFMsZUFXTCxHQVhLLEVBV0E7QUFDTCxlQUFPLGdCQUFNLEdBQU4sQ0FBVSxHQUFWLENBQVA7QUFDSDtBQWJRLENBQWI7O2tCQWlCZSxJOzs7Ozs7Ozs7QUNwQmY7O0FBRUEsSUFBTSxPQUFPO0FBRVQsWUFGUyxvQkFFQSxHQUZBLEVBRUs7QUFDVixvQ0FBZSxJQUFmLENBQW9CLEdBQXBCO0FBQ0g7QUFKUSxDQUFiOztrQkFRZSxJIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbi8qKlxuICogSW5kaWNhdGVzIHRoYXQgbmF2aWdhdGlvbiB3YXMgY2F1c2VkIGJ5IGEgY2FsbCB0byBoaXN0b3J5LnB1c2guXG4gKi9cbnZhciBQVVNIID0gZXhwb3J0cy5QVVNIID0gJ1BVU0gnO1xuXG4vKipcbiAqIEluZGljYXRlcyB0aGF0IG5hdmlnYXRpb24gd2FzIGNhdXNlZCBieSBhIGNhbGwgdG8gaGlzdG9yeS5yZXBsYWNlLlxuICovXG52YXIgUkVQTEFDRSA9IGV4cG9ydHMuUkVQTEFDRSA9ICdSRVBMQUNFJztcblxuLyoqXG4gKiBJbmRpY2F0ZXMgdGhhdCBuYXZpZ2F0aW9uIHdhcyBjYXVzZWQgYnkgc29tZSBvdGhlciBhY3Rpb24gc3VjaFxuICogYXMgdXNpbmcgYSBicm93c2VyJ3MgYmFjay9mb3J3YXJkIGJ1dHRvbnMgYW5kL29yIG1hbnVhbGx5IG1hbmlwdWxhdGluZ1xuICogdGhlIFVSTCBpbiBhIGJyb3dzZXIncyBsb2NhdGlvbiBiYXIuIFRoaXMgaXMgdGhlIGRlZmF1bHQuXG4gKlxuICogU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XaW5kb3dFdmVudEhhbmRsZXJzL29ucG9wc3RhdGVcbiAqIGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICovXG52YXIgUE9QID0gZXhwb3J0cy5QT1AgPSAnUE9QJzsiLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbnZhciBsb29wQXN5bmMgPSBleHBvcnRzLmxvb3BBc3luYyA9IGZ1bmN0aW9uIGxvb3BBc3luYyh0dXJucywgd29yaywgY2FsbGJhY2spIHtcbiAgdmFyIGN1cnJlbnRUdXJuID0gMCxcbiAgICAgIGlzRG9uZSA9IGZhbHNlO1xuICB2YXIgaXNTeW5jID0gZmFsc2UsXG4gICAgICBoYXNOZXh0ID0gZmFsc2UsXG4gICAgICBkb25lQXJncyA9IHZvaWQgMDtcblxuICB2YXIgZG9uZSA9IGZ1bmN0aW9uIGRvbmUoKSB7XG4gICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgIGFyZ3NbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgfVxuXG4gICAgaXNEb25lID0gdHJ1ZTtcblxuICAgIGlmIChpc1N5bmMpIHtcbiAgICAgIC8vIEl0ZXJhdGUgaW5zdGVhZCBvZiByZWN1cnNpbmcgaWYgcG9zc2libGUuXG4gICAgICBkb25lQXJncyA9IGFyZ3M7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FsbGJhY2suYXBwbHkodW5kZWZpbmVkLCBhcmdzKTtcbiAgfTtcblxuICB2YXIgbmV4dCA9IGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgaWYgKGlzRG9uZSkgcmV0dXJuO1xuXG4gICAgaGFzTmV4dCA9IHRydWU7XG5cbiAgICBpZiAoaXNTeW5jKSByZXR1cm47IC8vIEl0ZXJhdGUgaW5zdGVhZCBvZiByZWN1cnNpbmcgaWYgcG9zc2libGUuXG5cbiAgICBpc1N5bmMgPSB0cnVlO1xuXG4gICAgd2hpbGUgKCFpc0RvbmUgJiYgY3VycmVudFR1cm4gPCB0dXJucyAmJiBoYXNOZXh0KSB7XG4gICAgICBoYXNOZXh0ID0gZmFsc2U7XG4gICAgICB3b3JrKGN1cnJlbnRUdXJuKyssIG5leHQsIGRvbmUpO1xuICAgIH1cblxuICAgIGlzU3luYyA9IGZhbHNlO1xuXG4gICAgaWYgKGlzRG9uZSkge1xuICAgICAgLy8gVGhpcyBtZWFucyB0aGUgbG9vcCBmaW5pc2hlZCBzeW5jaHJvbm91c2x5LlxuICAgICAgY2FsbGJhY2suYXBwbHkodW5kZWZpbmVkLCBkb25lQXJncyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnRUdXJuID49IHR1cm5zICYmIGhhc05leHQpIHtcbiAgICAgIGlzRG9uZSA9IHRydWU7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH1cbiAgfTtcblxuICBuZXh0KCk7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMuZ28gPSBleHBvcnRzLnJlcGxhY2VMb2NhdGlvbiA9IGV4cG9ydHMucHVzaExvY2F0aW9uID0gZXhwb3J0cy5zdGFydExpc3RlbmVyID0gZXhwb3J0cy5nZXRVc2VyQ29uZmlybWF0aW9uID0gZXhwb3J0cy5nZXRDdXJyZW50TG9jYXRpb24gPSB1bmRlZmluZWQ7XG5cbnZhciBfTG9jYXRpb25VdGlscyA9IHJlcXVpcmUoJy4vTG9jYXRpb25VdGlscycpO1xuXG52YXIgX0RPTVV0aWxzID0gcmVxdWlyZSgnLi9ET01VdGlscycpO1xuXG52YXIgX0RPTVN0YXRlU3RvcmFnZSA9IHJlcXVpcmUoJy4vRE9NU3RhdGVTdG9yYWdlJyk7XG5cbnZhciBfUGF0aFV0aWxzID0gcmVxdWlyZSgnLi9QYXRoVXRpbHMnKTtcblxudmFyIF9FeGVjdXRpb25FbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4vRXhlY3V0aW9uRW52aXJvbm1lbnQnKTtcblxudmFyIFBvcFN0YXRlRXZlbnQgPSAncG9wc3RhdGUnO1xudmFyIEhhc2hDaGFuZ2VFdmVudCA9ICdoYXNoY2hhbmdlJztcblxudmFyIG5lZWRzSGFzaGNoYW5nZUxpc3RlbmVyID0gX0V4ZWN1dGlvbkVudmlyb25tZW50LmNhblVzZURPTSAmJiAhKDAsIF9ET01VdGlscy5zdXBwb3J0c1BvcHN0YXRlT25IYXNoY2hhbmdlKSgpO1xuXG52YXIgX2NyZWF0ZUxvY2F0aW9uID0gZnVuY3Rpb24gX2NyZWF0ZUxvY2F0aW9uKGhpc3RvcnlTdGF0ZSkge1xuICB2YXIga2V5ID0gaGlzdG9yeVN0YXRlICYmIGhpc3RvcnlTdGF0ZS5rZXk7XG5cbiAgcmV0dXJuICgwLCBfTG9jYXRpb25VdGlscy5jcmVhdGVMb2NhdGlvbikoe1xuICAgIHBhdGhuYW1lOiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUsXG4gICAgc2VhcmNoOiB3aW5kb3cubG9jYXRpb24uc2VhcmNoLFxuICAgIGhhc2g6IHdpbmRvdy5sb2NhdGlvbi5oYXNoLFxuICAgIHN0YXRlOiBrZXkgPyAoMCwgX0RPTVN0YXRlU3RvcmFnZS5yZWFkU3RhdGUpKGtleSkgOiB1bmRlZmluZWRcbiAgfSwgdW5kZWZpbmVkLCBrZXkpO1xufTtcblxudmFyIGdldEN1cnJlbnRMb2NhdGlvbiA9IGV4cG9ydHMuZ2V0Q3VycmVudExvY2F0aW9uID0gZnVuY3Rpb24gZ2V0Q3VycmVudExvY2F0aW9uKCkge1xuICB2YXIgaGlzdG9yeVN0YXRlID0gdm9pZCAwO1xuICB0cnkge1xuICAgIGhpc3RvcnlTdGF0ZSA9IHdpbmRvdy5oaXN0b3J5LnN0YXRlIHx8IHt9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElFIDExIHNvbWV0aW1lcyB0aHJvd3Mgd2hlbiBhY2Nlc3Npbmcgd2luZG93Lmhpc3Rvcnkuc3RhdGVcbiAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0VHJhaW5pbmcvaGlzdG9yeS9wdWxsLzI4OVxuICAgIGhpc3RvcnlTdGF0ZSA9IHt9O1xuICB9XG5cbiAgcmV0dXJuIF9jcmVhdGVMb2NhdGlvbihoaXN0b3J5U3RhdGUpO1xufTtcblxudmFyIGdldFVzZXJDb25maXJtYXRpb24gPSBleHBvcnRzLmdldFVzZXJDb25maXJtYXRpb24gPSBmdW5jdGlvbiBnZXRVc2VyQ29uZmlybWF0aW9uKG1lc3NhZ2UsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBjYWxsYmFjayh3aW5kb3cuY29uZmlybShtZXNzYWdlKSk7XG59OyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWFsZXJ0XG5cbnZhciBzdGFydExpc3RlbmVyID0gZXhwb3J0cy5zdGFydExpc3RlbmVyID0gZnVuY3Rpb24gc3RhcnRMaXN0ZW5lcihsaXN0ZW5lcikge1xuICB2YXIgaGFuZGxlUG9wU3RhdGUgPSBmdW5jdGlvbiBoYW5kbGVQb3BTdGF0ZShldmVudCkge1xuICAgIGlmIChldmVudC5zdGF0ZSAhPT0gdW5kZWZpbmVkKSAvLyBJZ25vcmUgZXh0cmFuZW91cyBwb3BzdGF0ZSBldmVudHMgaW4gV2ViS2l0XG4gICAgICBsaXN0ZW5lcihfY3JlYXRlTG9jYXRpb24oZXZlbnQuc3RhdGUpKTtcbiAgfTtcblxuICAoMCwgX0RPTVV0aWxzLmFkZEV2ZW50TGlzdGVuZXIpKHdpbmRvdywgUG9wU3RhdGVFdmVudCwgaGFuZGxlUG9wU3RhdGUpO1xuXG4gIHZhciBoYW5kbGVVbnBvcHBlZEhhc2hDaGFuZ2UgPSBmdW5jdGlvbiBoYW5kbGVVbnBvcHBlZEhhc2hDaGFuZ2UoKSB7XG4gICAgcmV0dXJuIGxpc3RlbmVyKGdldEN1cnJlbnRMb2NhdGlvbigpKTtcbiAgfTtcblxuICBpZiAobmVlZHNIYXNoY2hhbmdlTGlzdGVuZXIpIHtcbiAgICAoMCwgX0RPTVV0aWxzLmFkZEV2ZW50TGlzdGVuZXIpKHdpbmRvdywgSGFzaENoYW5nZUV2ZW50LCBoYW5kbGVVbnBvcHBlZEhhc2hDaGFuZ2UpO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAoMCwgX0RPTVV0aWxzLnJlbW92ZUV2ZW50TGlzdGVuZXIpKHdpbmRvdywgUG9wU3RhdGVFdmVudCwgaGFuZGxlUG9wU3RhdGUpO1xuXG4gICAgaWYgKG5lZWRzSGFzaGNoYW5nZUxpc3RlbmVyKSB7XG4gICAgICAoMCwgX0RPTVV0aWxzLnJlbW92ZUV2ZW50TGlzdGVuZXIpKHdpbmRvdywgSGFzaENoYW5nZUV2ZW50LCBoYW5kbGVVbnBvcHBlZEhhc2hDaGFuZ2UpO1xuICAgIH1cbiAgfTtcbn07XG5cbnZhciB1cGRhdGVMb2NhdGlvbiA9IGZ1bmN0aW9uIHVwZGF0ZUxvY2F0aW9uKGxvY2F0aW9uLCB1cGRhdGVTdGF0ZSkge1xuICB2YXIgc3RhdGUgPSBsb2NhdGlvbi5zdGF0ZTtcbiAgdmFyIGtleSA9IGxvY2F0aW9uLmtleTtcblxuXG4gIGlmIChzdGF0ZSAhPT0gdW5kZWZpbmVkKSAoMCwgX0RPTVN0YXRlU3RvcmFnZS5zYXZlU3RhdGUpKGtleSwgc3RhdGUpO1xuXG4gIHVwZGF0ZVN0YXRlKHsga2V5OiBrZXkgfSwgKDAsIF9QYXRoVXRpbHMuY3JlYXRlUGF0aCkobG9jYXRpb24pKTtcbn07XG5cbnZhciBwdXNoTG9jYXRpb24gPSBleHBvcnRzLnB1c2hMb2NhdGlvbiA9IGZ1bmN0aW9uIHB1c2hMb2NhdGlvbihsb2NhdGlvbikge1xuICByZXR1cm4gdXBkYXRlTG9jYXRpb24obG9jYXRpb24sIGZ1bmN0aW9uIChzdGF0ZSwgcGF0aCkge1xuICAgIHJldHVybiB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUoc3RhdGUsIG51bGwsIHBhdGgpO1xuICB9KTtcbn07XG5cbnZhciByZXBsYWNlTG9jYXRpb24gPSBleHBvcnRzLnJlcGxhY2VMb2NhdGlvbiA9IGZ1bmN0aW9uIHJlcGxhY2VMb2NhdGlvbihsb2NhdGlvbikge1xuICByZXR1cm4gdXBkYXRlTG9jYXRpb24obG9jYXRpb24sIGZ1bmN0aW9uIChzdGF0ZSwgcGF0aCkge1xuICAgIHJldHVybiB3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoc3RhdGUsIG51bGwsIHBhdGgpO1xuICB9KTtcbn07XG5cbnZhciBnbyA9IGV4cG9ydHMuZ28gPSBmdW5jdGlvbiBnbyhuKSB7XG4gIGlmIChuKSB3aW5kb3cuaGlzdG9yeS5nbyhuKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5yZWFkU3RhdGUgPSBleHBvcnRzLnNhdmVTdGF0ZSA9IHVuZGVmaW5lZDtcblxudmFyIF93YXJuaW5nID0gcmVxdWlyZSgnd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBRdW90YUV4Y2VlZGVkRXJyb3JzID0ge1xuICBRdW90YUV4Y2VlZGVkRXJyb3I6IHRydWUsXG4gIFFVT1RBX0VYQ0VFREVEX0VSUjogdHJ1ZVxufTtcblxudmFyIFNlY3VyaXR5RXJyb3JzID0ge1xuICBTZWN1cml0eUVycm9yOiB0cnVlXG59O1xuXG52YXIgS2V5UHJlZml4ID0gJ0BASGlzdG9yeS8nO1xuXG52YXIgY3JlYXRlS2V5ID0gZnVuY3Rpb24gY3JlYXRlS2V5KGtleSkge1xuICByZXR1cm4gS2V5UHJlZml4ICsga2V5O1xufTtcblxudmFyIHNhdmVTdGF0ZSA9IGV4cG9ydHMuc2F2ZVN0YXRlID0gZnVuY3Rpb24gc2F2ZVN0YXRlKGtleSwgc3RhdGUpIHtcbiAgaWYgKCF3aW5kb3cuc2Vzc2lvblN0b3JhZ2UpIHtcbiAgICAvLyBTZXNzaW9uIHN0b3JhZ2UgaXMgbm90IGF2YWlsYWJsZSBvciBoaWRkZW4uXG4gICAgLy8gc2Vzc2lvblN0b3JhZ2UgaXMgdW5kZWZpbmVkIGluIEludGVybmV0IEV4cGxvcmVyIHdoZW4gc2VydmVkIHZpYSBmaWxlIHByb3RvY29sLlxuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKGZhbHNlLCAnW2hpc3RvcnldIFVuYWJsZSB0byBzYXZlIHN0YXRlOyBzZXNzaW9uU3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlJykgOiB2b2lkIDA7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChzdGF0ZSA9PSBudWxsKSB7XG4gICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShjcmVhdGVLZXkoa2V5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKGNyZWF0ZUtleShrZXkpLCBKU09OLnN0cmluZ2lmeShzdGF0ZSkpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoU2VjdXJpdHlFcnJvcnNbZXJyb3IubmFtZV0pIHtcbiAgICAgIC8vIEJsb2NraW5nIGNvb2tpZXMgaW4gQ2hyb21lL0ZpcmVmb3gvU2FmYXJpIHRocm93cyBTZWN1cml0eUVycm9yIG9uIGFueVxuICAgICAgLy8gYXR0ZW1wdCB0byBhY2Nlc3Mgd2luZG93LnNlc3Npb25TdG9yYWdlLlxuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfd2FybmluZzIuZGVmYXVsdCkoZmFsc2UsICdbaGlzdG9yeV0gVW5hYmxlIHRvIHNhdmUgc3RhdGU7IHNlc3Npb25TdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgZHVlIHRvIHNlY3VyaXR5IHNldHRpbmdzJykgOiB2b2lkIDA7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoUXVvdGFFeGNlZWRlZEVycm9yc1tlcnJvci5uYW1lXSAmJiB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBTYWZhcmkgXCJwcml2YXRlIG1vZGVcIiB0aHJvd3MgUXVvdGFFeGNlZWRlZEVycm9yLlxuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfd2FybmluZzIuZGVmYXVsdCkoZmFsc2UsICdbaGlzdG9yeV0gVW5hYmxlIHRvIHNhdmUgc3RhdGU7IHNlc3Npb25TdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgaW4gU2FmYXJpIHByaXZhdGUgbW9kZScpIDogdm9pZCAwO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG5cbnZhciByZWFkU3RhdGUgPSBleHBvcnRzLnJlYWRTdGF0ZSA9IGZ1bmN0aW9uIHJlYWRTdGF0ZShrZXkpIHtcbiAgdmFyIGpzb24gPSB2b2lkIDA7XG4gIHRyeSB7XG4gICAganNvbiA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5nZXRJdGVtKGNyZWF0ZUtleShrZXkpKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoU2VjdXJpdHlFcnJvcnNbZXJyb3IubmFtZV0pIHtcbiAgICAgIC8vIEJsb2NraW5nIGNvb2tpZXMgaW4gQ2hyb21lL0ZpcmVmb3gvU2FmYXJpIHRocm93cyBTZWN1cml0eUVycm9yIG9uIGFueVxuICAgICAgLy8gYXR0ZW1wdCB0byBhY2Nlc3Mgd2luZG93LnNlc3Npb25TdG9yYWdlLlxuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfd2FybmluZzIuZGVmYXVsdCkoZmFsc2UsICdbaGlzdG9yeV0gVW5hYmxlIHRvIHJlYWQgc3RhdGU7IHNlc3Npb25TdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgZHVlIHRvIHNlY3VyaXR5IHNldHRpbmdzJykgOiB2b2lkIDA7XG5cbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgaWYgKGpzb24pIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoanNvbik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIElnbm9yZSBpbnZhbGlkIEpTT04uXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xudmFyIGFkZEV2ZW50TGlzdGVuZXIgPSBleHBvcnRzLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG5vZGUsIGV2ZW50LCBsaXN0ZW5lcikge1xuICByZXR1cm4gbm9kZS5hZGRFdmVudExpc3RlbmVyID8gbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lciwgZmFsc2UpIDogbm9kZS5hdHRhY2hFdmVudCgnb24nICsgZXZlbnQsIGxpc3RlbmVyKTtcbn07XG5cbnZhciByZW1vdmVFdmVudExpc3RlbmVyID0gZXhwb3J0cy5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gcmVtb3ZlRXZlbnRMaXN0ZW5lcihub2RlLCBldmVudCwgbGlzdGVuZXIpIHtcbiAgcmV0dXJuIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA/IG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIsIGZhbHNlKSA6IG5vZGUuZGV0YWNoRXZlbnQoJ29uJyArIGV2ZW50LCBsaXN0ZW5lcik7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgSFRNTDUgaGlzdG9yeSBBUEkgaXMgc3VwcG9ydGVkLiBUYWtlbiBmcm9tIE1vZGVybml6ci5cbiAqXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTW9kZXJuaXpyL01vZGVybml6ci9ibG9iL21hc3Rlci9MSUNFTlNFXG4gKiBodHRwczovL2dpdGh1Yi5jb20vTW9kZXJuaXpyL01vZGVybml6ci9ibG9iL21hc3Rlci9mZWF0dXJlLWRldGVjdHMvaGlzdG9yeS5qc1xuICogY2hhbmdlZCB0byBhdm9pZCBmYWxzZSBuZWdhdGl2ZXMgZm9yIFdpbmRvd3MgUGhvbmVzOiBodHRwczovL2dpdGh1Yi5jb20vcmVhY3Rqcy9yZWFjdC1yb3V0ZXIvaXNzdWVzLzU4NlxuICovXG52YXIgc3VwcG9ydHNIaXN0b3J5ID0gZXhwb3J0cy5zdXBwb3J0c0hpc3RvcnkgPSBmdW5jdGlvbiBzdXBwb3J0c0hpc3RvcnkoKSB7XG4gIHZhciB1YSA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50O1xuXG4gIGlmICgodWEuaW5kZXhPZignQW5kcm9pZCAyLicpICE9PSAtMSB8fCB1YS5pbmRleE9mKCdBbmRyb2lkIDQuMCcpICE9PSAtMSkgJiYgdWEuaW5kZXhPZignTW9iaWxlIFNhZmFyaScpICE9PSAtMSAmJiB1YS5pbmRleE9mKCdDaHJvbWUnKSA9PT0gLTEgJiYgdWEuaW5kZXhPZignV2luZG93cyBQaG9uZScpID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuXG4gIHJldHVybiB3aW5kb3cuaGlzdG9yeSAmJiAncHVzaFN0YXRlJyBpbiB3aW5kb3cuaGlzdG9yeTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBmYWxzZSBpZiB1c2luZyBnbyhuKSB3aXRoIGhhc2ggaGlzdG9yeSBjYXVzZXMgYSBmdWxsIHBhZ2UgcmVsb2FkLlxuICovXG52YXIgc3VwcG9ydHNHb1dpdGhvdXRSZWxvYWRVc2luZ0hhc2ggPSBleHBvcnRzLnN1cHBvcnRzR29XaXRob3V0UmVsb2FkVXNpbmdIYXNoID0gZnVuY3Rpb24gc3VwcG9ydHNHb1dpdGhvdXRSZWxvYWRVc2luZ0hhc2goKSB7XG4gIHJldHVybiB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdGaXJlZm94JykgPT09IC0xO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgYnJvd3NlciBmaXJlcyBwb3BzdGF0ZSBvbiBoYXNoIGNoYW5nZS5cbiAqIElFMTAgYW5kIElFMTEgZG8gbm90LlxuICovXG52YXIgc3VwcG9ydHNQb3BzdGF0ZU9uSGFzaGNoYW5nZSA9IGV4cG9ydHMuc3VwcG9ydHNQb3BzdGF0ZU9uSGFzaGNoYW5nZSA9IGZ1bmN0aW9uIHN1cHBvcnRzUG9wc3RhdGVPbkhhc2hjaGFuZ2UoKSB7XG4gIHJldHVybiB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdUcmlkZW50JykgPT09IC0xO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG52YXIgY2FuVXNlRE9NID0gZXhwb3J0cy5jYW5Vc2VET00gPSAhISh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZG9jdW1lbnQgJiYgd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQpOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMubG9jYXRpb25zQXJlRXF1YWwgPSBleHBvcnRzLnN0YXRlc0FyZUVxdWFsID0gZXhwb3J0cy5jcmVhdGVMb2NhdGlvbiA9IGV4cG9ydHMuY3JlYXRlUXVlcnkgPSB1bmRlZmluZWQ7XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG52YXIgX2V4dGVuZHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQpIHsgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTsgZm9yICh2YXIga2V5IGluIHNvdXJjZSkgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldOyB9IH0gfSByZXR1cm4gdGFyZ2V0OyB9O1xuXG52YXIgX2ludmFyaWFudCA9IHJlcXVpcmUoJ2ludmFyaWFudCcpO1xuXG52YXIgX2ludmFyaWFudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pbnZhcmlhbnQpO1xuXG52YXIgX3dhcm5pbmcgPSByZXF1aXJlKCd3YXJuaW5nJyk7XG5cbnZhciBfd2FybmluZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF93YXJuaW5nKTtcblxudmFyIF9QYXRoVXRpbHMgPSByZXF1aXJlKCcuL1BhdGhVdGlscycpO1xuXG52YXIgX0FjdGlvbnMgPSByZXF1aXJlKCcuL0FjdGlvbnMnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIGNyZWF0ZVF1ZXJ5ID0gZXhwb3J0cy5jcmVhdGVRdWVyeSA9IGZ1bmN0aW9uIGNyZWF0ZVF1ZXJ5KHByb3BzKSB7XG4gIHJldHVybiBfZXh0ZW5kcyhPYmplY3QuY3JlYXRlKG51bGwpLCBwcm9wcyk7XG59O1xuXG52YXIgY3JlYXRlTG9jYXRpb24gPSBleHBvcnRzLmNyZWF0ZUxvY2F0aW9uID0gZnVuY3Rpb24gY3JlYXRlTG9jYXRpb24oKSB7XG4gIHZhciBpbnB1dCA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/ICcvJyA6IGFyZ3VtZW50c1swXTtcbiAgdmFyIGFjdGlvbiA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMSB8fCBhcmd1bWVudHNbMV0gPT09IHVuZGVmaW5lZCA/IF9BY3Rpb25zLlBPUCA6IGFyZ3VtZW50c1sxXTtcbiAgdmFyIGtleSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IG51bGwgOiBhcmd1bWVudHNbMl07XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyAoMCwgX1BhdGhVdGlscy5wYXJzZVBhdGgpKGlucHV0KSA6IGlucHV0O1xuXG4gIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKCFvYmplY3QucGF0aCwgJ0xvY2F0aW9uIGRlc2NyaXB0b3Igb2JqZWN0cyBzaG91bGQgaGF2ZSBhIGBwYXRobmFtZWAsIG5vdCBhIGBwYXRoYC4nKSA6IHZvaWQgMDtcblxuICB2YXIgcGF0aG5hbWUgPSBvYmplY3QucGF0aG5hbWUgfHwgJy8nO1xuICB2YXIgc2VhcmNoID0gb2JqZWN0LnNlYXJjaCB8fCAnJztcbiAgdmFyIGhhc2ggPSBvYmplY3QuaGFzaCB8fCAnJztcbiAgdmFyIHN0YXRlID0gb2JqZWN0LnN0YXRlO1xuXG4gIHJldHVybiB7XG4gICAgcGF0aG5hbWU6IHBhdGhuYW1lLFxuICAgIHNlYXJjaDogc2VhcmNoLFxuICAgIGhhc2g6IGhhc2gsXG4gICAgc3RhdGU6IHN0YXRlLFxuICAgIGFjdGlvbjogYWN0aW9uLFxuICAgIGtleToga2V5XG4gIH07XG59O1xuXG52YXIgaXNEYXRlID0gZnVuY3Rpb24gaXNEYXRlKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn07XG5cbnZhciBzdGF0ZXNBcmVFcXVhbCA9IGV4cG9ydHMuc3RhdGVzQXJlRXF1YWwgPSBmdW5jdGlvbiBzdGF0ZXNBcmVFcXVhbChhLCBiKSB7XG4gIGlmIChhID09PSBiKSByZXR1cm4gdHJ1ZTtcblxuICB2YXIgdHlwZW9mQSA9IHR5cGVvZiBhID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihhKTtcbiAgdmFyIHR5cGVvZkIgPSB0eXBlb2YgYiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoYik7XG5cbiAgaWYgKHR5cGVvZkEgIT09IHR5cGVvZkIpIHJldHVybiBmYWxzZTtcblxuICAhKHR5cGVvZkEgIT09ICdmdW5jdGlvbicpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KShmYWxzZSwgJ1lvdSBtdXN0IG5vdCBzdG9yZSBmdW5jdGlvbnMgaW4gbG9jYXRpb24gc3RhdGUnKSA6ICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KShmYWxzZSkgOiB2b2lkIDA7XG5cbiAgLy8gTm90IHRoZSBzYW1lIG9iamVjdCwgYnV0IHNhbWUgdHlwZS5cbiAgaWYgKHR5cGVvZkEgPT09ICdvYmplY3QnKSB7XG4gICAgISEoaXNEYXRlKGEpICYmIGlzRGF0ZShiKSkgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF9pbnZhcmlhbnQyLmRlZmF1bHQpKGZhbHNlLCAnWW91IG11c3Qgbm90IHN0b3JlIERhdGUgb2JqZWN0cyBpbiBsb2NhdGlvbiBzdGF0ZScpIDogKDAsIF9pbnZhcmlhbnQyLmRlZmF1bHQpKGZhbHNlKSA6IHZvaWQgMDtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShhKSkge1xuICAgICAgdmFyIGtleXNvZkEgPSBPYmplY3Qua2V5cyhhKTtcbiAgICAgIHZhciBrZXlzb2ZCID0gT2JqZWN0LmtleXMoYik7XG4gICAgICByZXR1cm4ga2V5c29mQS5sZW5ndGggPT09IGtleXNvZkIubGVuZ3RoICYmIGtleXNvZkEuZXZlcnkoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4gc3RhdGVzQXJlRXF1YWwoYVtrZXldLCBiW2tleV0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoYikgJiYgYS5sZW5ndGggPT09IGIubGVuZ3RoICYmIGEuZXZlcnkoZnVuY3Rpb24gKGl0ZW0sIGluZGV4KSB7XG4gICAgICByZXR1cm4gc3RhdGVzQXJlRXF1YWwoaXRlbSwgYltpbmRleF0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gQWxsIG90aGVyIHNlcmlhbGl6YWJsZSB0eXBlcyAoc3RyaW5nLCBudW1iZXIsIGJvb2xlYW4pXG4gIC8vIHNob3VsZCBiZSBzdHJpY3QgZXF1YWwuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbnZhciBsb2NhdGlvbnNBcmVFcXVhbCA9IGV4cG9ydHMubG9jYXRpb25zQXJlRXF1YWwgPSBmdW5jdGlvbiBsb2NhdGlvbnNBcmVFcXVhbChhLCBiKSB7XG4gIHJldHVybiBhLmtleSA9PT0gYi5rZXkgJiZcbiAgLy8gYS5hY3Rpb24gPT09IGIuYWN0aW9uICYmIC8vIERpZmZlcmVudCBhY3Rpb24gIT09IGxvY2F0aW9uIGNoYW5nZS5cbiAgYS5wYXRobmFtZSA9PT0gYi5wYXRobmFtZSAmJiBhLnNlYXJjaCA9PT0gYi5zZWFyY2ggJiYgYS5oYXNoID09PSBiLmhhc2ggJiYgc3RhdGVzQXJlRXF1YWwoYS5zdGF0ZSwgYi5zdGF0ZSk7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMuY3JlYXRlUGF0aCA9IGV4cG9ydHMucGFyc2VQYXRoID0gZXhwb3J0cy5nZXRRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGggPSBleHBvcnRzLnN0cmlwUXVlcnlTdHJpbmdWYWx1ZUZyb21QYXRoID0gZXhwb3J0cy5hZGRRdWVyeVN0cmluZ1ZhbHVlVG9QYXRoID0gdW5kZWZpbmVkO1xuXG52YXIgX3dhcm5pbmcgPSByZXF1aXJlKCd3YXJuaW5nJyk7XG5cbnZhciBfd2FybmluZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF93YXJuaW5nKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIGFkZFF1ZXJ5U3RyaW5nVmFsdWVUb1BhdGggPSBleHBvcnRzLmFkZFF1ZXJ5U3RyaW5nVmFsdWVUb1BhdGggPSBmdW5jdGlvbiBhZGRRdWVyeVN0cmluZ1ZhbHVlVG9QYXRoKHBhdGgsIGtleSwgdmFsdWUpIHtcbiAgdmFyIF9wYXJzZVBhdGggPSBwYXJzZVBhdGgocGF0aCk7XG5cbiAgdmFyIHBhdGhuYW1lID0gX3BhcnNlUGF0aC5wYXRobmFtZTtcbiAgdmFyIHNlYXJjaCA9IF9wYXJzZVBhdGguc2VhcmNoO1xuICB2YXIgaGFzaCA9IF9wYXJzZVBhdGguaGFzaDtcblxuXG4gIHJldHVybiBjcmVhdGVQYXRoKHtcbiAgICBwYXRobmFtZTogcGF0aG5hbWUsXG4gICAgc2VhcmNoOiBzZWFyY2ggKyAoc2VhcmNoLmluZGV4T2YoJz8nKSA9PT0gLTEgPyAnPycgOiAnJicpICsga2V5ICsgJz0nICsgdmFsdWUsXG4gICAgaGFzaDogaGFzaFxuICB9KTtcbn07XG5cbnZhciBzdHJpcFF1ZXJ5U3RyaW5nVmFsdWVGcm9tUGF0aCA9IGV4cG9ydHMuc3RyaXBRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGggPSBmdW5jdGlvbiBzdHJpcFF1ZXJ5U3RyaW5nVmFsdWVGcm9tUGF0aChwYXRoLCBrZXkpIHtcbiAgdmFyIF9wYXJzZVBhdGgyID0gcGFyc2VQYXRoKHBhdGgpO1xuXG4gIHZhciBwYXRobmFtZSA9IF9wYXJzZVBhdGgyLnBhdGhuYW1lO1xuICB2YXIgc2VhcmNoID0gX3BhcnNlUGF0aDIuc2VhcmNoO1xuICB2YXIgaGFzaCA9IF9wYXJzZVBhdGgyLmhhc2g7XG5cblxuICByZXR1cm4gY3JlYXRlUGF0aCh7XG4gICAgcGF0aG5hbWU6IHBhdGhuYW1lLFxuICAgIHNlYXJjaDogc2VhcmNoLnJlcGxhY2UobmV3IFJlZ0V4cCgnKFs/Jl0pJyArIGtleSArICc9W2EtekEtWjAtOV0rKCY/KScpLCBmdW5jdGlvbiAobWF0Y2gsIHByZWZpeCwgc3VmZml4KSB7XG4gICAgICByZXR1cm4gcHJlZml4ID09PSAnPycgPyBwcmVmaXggOiBzdWZmaXg7XG4gICAgfSksXG4gICAgaGFzaDogaGFzaFxuICB9KTtcbn07XG5cbnZhciBnZXRRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGggPSBleHBvcnRzLmdldFF1ZXJ5U3RyaW5nVmFsdWVGcm9tUGF0aCA9IGZ1bmN0aW9uIGdldFF1ZXJ5U3RyaW5nVmFsdWVGcm9tUGF0aChwYXRoLCBrZXkpIHtcbiAgdmFyIF9wYXJzZVBhdGgzID0gcGFyc2VQYXRoKHBhdGgpO1xuXG4gIHZhciBzZWFyY2ggPSBfcGFyc2VQYXRoMy5zZWFyY2g7XG5cbiAgdmFyIG1hdGNoID0gc2VhcmNoLm1hdGNoKG5ldyBSZWdFeHAoJ1s/Jl0nICsga2V5ICsgJz0oW2EtekEtWjAtOV0rKScpKTtcbiAgcmV0dXJuIG1hdGNoICYmIG1hdGNoWzFdO1xufTtcblxudmFyIGV4dHJhY3RQYXRoID0gZnVuY3Rpb24gZXh0cmFjdFBhdGgoc3RyaW5nKSB7XG4gIHZhciBtYXRjaCA9IHN0cmluZy5tYXRjaCgvXihodHRwcz86KT9cXC9cXC9bXlxcL10qLyk7XG4gIHJldHVybiBtYXRjaCA9PSBudWxsID8gc3RyaW5nIDogc3RyaW5nLnN1YnN0cmluZyhtYXRjaFswXS5sZW5ndGgpO1xufTtcblxudmFyIHBhcnNlUGF0aCA9IGV4cG9ydHMucGFyc2VQYXRoID0gZnVuY3Rpb24gcGFyc2VQYXRoKHBhdGgpIHtcbiAgdmFyIHBhdGhuYW1lID0gZXh0cmFjdFBhdGgocGF0aCk7XG4gIHZhciBzZWFyY2ggPSAnJztcbiAgdmFyIGhhc2ggPSAnJztcblxuICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF93YXJuaW5nMi5kZWZhdWx0KShwYXRoID09PSBwYXRobmFtZSwgJ0EgcGF0aCBtdXN0IGJlIHBhdGhuYW1lICsgc2VhcmNoICsgaGFzaCBvbmx5LCBub3QgYSBmdWxsIFVSTCBsaWtlIFwiJXNcIicsIHBhdGgpIDogdm9pZCAwO1xuXG4gIHZhciBoYXNoSW5kZXggPSBwYXRobmFtZS5pbmRleE9mKCcjJyk7XG4gIGlmIChoYXNoSW5kZXggIT09IC0xKSB7XG4gICAgaGFzaCA9IHBhdGhuYW1lLnN1YnN0cmluZyhoYXNoSW5kZXgpO1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc3Vic3RyaW5nKDAsIGhhc2hJbmRleCk7XG4gIH1cblxuICB2YXIgc2VhcmNoSW5kZXggPSBwYXRobmFtZS5pbmRleE9mKCc/Jyk7XG4gIGlmIChzZWFyY2hJbmRleCAhPT0gLTEpIHtcbiAgICBzZWFyY2ggPSBwYXRobmFtZS5zdWJzdHJpbmcoc2VhcmNoSW5kZXgpO1xuICAgIHBhdGhuYW1lID0gcGF0aG5hbWUuc3Vic3RyaW5nKDAsIHNlYXJjaEluZGV4KTtcbiAgfVxuXG4gIGlmIChwYXRobmFtZSA9PT0gJycpIHBhdGhuYW1lID0gJy8nO1xuXG4gIHJldHVybiB7XG4gICAgcGF0aG5hbWU6IHBhdGhuYW1lLFxuICAgIHNlYXJjaDogc2VhcmNoLFxuICAgIGhhc2g6IGhhc2hcbiAgfTtcbn07XG5cbnZhciBjcmVhdGVQYXRoID0gZXhwb3J0cy5jcmVhdGVQYXRoID0gZnVuY3Rpb24gY3JlYXRlUGF0aChsb2NhdGlvbikge1xuICBpZiAobG9jYXRpb24gPT0gbnVsbCB8fCB0eXBlb2YgbG9jYXRpb24gPT09ICdzdHJpbmcnKSByZXR1cm4gbG9jYXRpb247XG5cbiAgdmFyIGJhc2VuYW1lID0gbG9jYXRpb24uYmFzZW5hbWU7XG4gIHZhciBwYXRobmFtZSA9IGxvY2F0aW9uLnBhdGhuYW1lO1xuICB2YXIgc2VhcmNoID0gbG9jYXRpb24uc2VhcmNoO1xuICB2YXIgaGFzaCA9IGxvY2F0aW9uLmhhc2g7XG5cbiAgdmFyIHBhdGggPSAoYmFzZW5hbWUgfHwgJycpICsgcGF0aG5hbWU7XG5cbiAgaWYgKHNlYXJjaCAmJiBzZWFyY2ggIT09ICc/JykgcGF0aCArPSBzZWFyY2g7XG5cbiAgaWYgKGhhc2gpIHBhdGggKz0gaGFzaDtcblxuICByZXR1cm4gcGF0aDtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuZXhwb3J0cy5yZXBsYWNlTG9jYXRpb24gPSBleHBvcnRzLnB1c2hMb2NhdGlvbiA9IGV4cG9ydHMuZ2V0Q3VycmVudExvY2F0aW9uID0gZXhwb3J0cy5nbyA9IGV4cG9ydHMuZ2V0VXNlckNvbmZpcm1hdGlvbiA9IHVuZGVmaW5lZDtcblxudmFyIF9Ccm93c2VyUHJvdG9jb2wgPSByZXF1aXJlKCcuL0Jyb3dzZXJQcm90b2NvbCcpO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ2dldFVzZXJDb25maXJtYXRpb24nLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiBfQnJvd3NlclByb3RvY29sLmdldFVzZXJDb25maXJtYXRpb247XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdnbycsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgcmV0dXJuIF9Ccm93c2VyUHJvdG9jb2wuZ287XG4gIH1cbn0pO1xuXG52YXIgX0xvY2F0aW9uVXRpbHMgPSByZXF1aXJlKCcuL0xvY2F0aW9uVXRpbHMnKTtcblxudmFyIF9QYXRoVXRpbHMgPSByZXF1aXJlKCcuL1BhdGhVdGlscycpO1xuXG52YXIgZ2V0Q3VycmVudExvY2F0aW9uID0gZXhwb3J0cy5nZXRDdXJyZW50TG9jYXRpb24gPSBmdW5jdGlvbiBnZXRDdXJyZW50TG9jYXRpb24oKSB7XG4gIHJldHVybiAoMCwgX0xvY2F0aW9uVXRpbHMuY3JlYXRlTG9jYXRpb24pKHdpbmRvdy5sb2NhdGlvbik7XG59O1xuXG52YXIgcHVzaExvY2F0aW9uID0gZXhwb3J0cy5wdXNoTG9jYXRpb24gPSBmdW5jdGlvbiBwdXNoTG9jYXRpb24obG9jYXRpb24pIHtcbiAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSAoMCwgX1BhdGhVdGlscy5jcmVhdGVQYXRoKShsb2NhdGlvbik7XG4gIHJldHVybiBmYWxzZTsgLy8gRG9uJ3QgdXBkYXRlIGxvY2F0aW9uXG59O1xuXG52YXIgcmVwbGFjZUxvY2F0aW9uID0gZXhwb3J0cy5yZXBsYWNlTG9jYXRpb24gPSBmdW5jdGlvbiByZXBsYWNlTG9jYXRpb24obG9jYXRpb24pIHtcbiAgd2luZG93LmxvY2F0aW9uLnJlcGxhY2UoKDAsIF9QYXRoVXRpbHMuY3JlYXRlUGF0aCkobG9jYXRpb24pKTtcbiAgcmV0dXJuIGZhbHNlOyAvLyBEb24ndCB1cGRhdGUgbG9jYXRpb25cbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG52YXIgX2V4dGVuZHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQpIHsgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTsgZm9yICh2YXIga2V5IGluIHNvdXJjZSkgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldOyB9IH0gfSByZXR1cm4gdGFyZ2V0OyB9O1xuXG52YXIgX2ludmFyaWFudCA9IHJlcXVpcmUoJ2ludmFyaWFudCcpO1xuXG52YXIgX2ludmFyaWFudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pbnZhcmlhbnQpO1xuXG52YXIgX0V4ZWN1dGlvbkVudmlyb25tZW50ID0gcmVxdWlyZSgnLi9FeGVjdXRpb25FbnZpcm9ubWVudCcpO1xuXG52YXIgX0Jyb3dzZXJQcm90b2NvbCA9IHJlcXVpcmUoJy4vQnJvd3NlclByb3RvY29sJyk7XG5cbnZhciBCcm93c2VyUHJvdG9jb2wgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfQnJvd3NlclByb3RvY29sKTtcblxudmFyIF9SZWZyZXNoUHJvdG9jb2wgPSByZXF1aXJlKCcuL1JlZnJlc2hQcm90b2NvbCcpO1xuXG52YXIgUmVmcmVzaFByb3RvY29sID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX1JlZnJlc2hQcm90b2NvbCk7XG5cbnZhciBfRE9NVXRpbHMgPSByZXF1aXJlKCcuL0RPTVV0aWxzJyk7XG5cbnZhciBfY3JlYXRlSGlzdG9yeSA9IHJlcXVpcmUoJy4vY3JlYXRlSGlzdG9yeScpO1xuXG52YXIgX2NyZWF0ZUhpc3RvcnkyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlSGlzdG9yeSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKG9iaikgeyBpZiAob2JqICYmIG9iai5fX2VzTW9kdWxlKSB7IHJldHVybiBvYmo7IH0gZWxzZSB7IHZhciBuZXdPYmogPSB7fTsgaWYgKG9iaiAhPSBudWxsKSB7IGZvciAodmFyIGtleSBpbiBvYmopIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIG5ld09ialtrZXldID0gb2JqW2tleV07IH0gfSBuZXdPYmouZGVmYXVsdCA9IG9iajsgcmV0dXJuIG5ld09iajsgfSB9XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbi8qKlxuICogQ3JlYXRlcyBhbmQgcmV0dXJucyBhIGhpc3Rvcnkgb2JqZWN0IHRoYXQgdXNlcyBIVE1MNSdzIGhpc3RvcnkgQVBJXG4gKiAocHVzaFN0YXRlLCByZXBsYWNlU3RhdGUsIGFuZCB0aGUgcG9wc3RhdGUgZXZlbnQpIHRvIG1hbmFnZSBoaXN0b3J5LlxuICogVGhpcyBpcyB0aGUgcmVjb21tZW5kZWQgbWV0aG9kIG9mIG1hbmFnaW5nIGhpc3RvcnkgaW4gYnJvd3NlcnMgYmVjYXVzZVxuICogaXQgcHJvdmlkZXMgdGhlIGNsZWFuZXN0IFVSTHMuXG4gKlxuICogTm90ZTogSW4gYnJvd3NlcnMgdGhhdCBkbyBub3Qgc3VwcG9ydCB0aGUgSFRNTDUgaGlzdG9yeSBBUEkgZnVsbFxuICogcGFnZSByZWxvYWRzIHdpbGwgYmUgdXNlZCB0byBwcmVzZXJ2ZSBjbGVhbiBVUkxzLiBZb3UgY2FuIGZvcmNlIHRoaXNcbiAqIGJlaGF2aW9yIHVzaW5nIHsgZm9yY2VSZWZyZXNoOiB0cnVlIH0gaW4gb3B0aW9ucy5cbiAqL1xudmFyIGNyZWF0ZUJyb3dzZXJIaXN0b3J5ID0gZnVuY3Rpb24gY3JlYXRlQnJvd3Nlckhpc3RvcnkoKSB7XG4gIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cbiAgIV9FeGVjdXRpb25FbnZpcm9ubWVudC5jYW5Vc2VET00gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF9pbnZhcmlhbnQyLmRlZmF1bHQpKGZhbHNlLCAnQnJvd3NlciBoaXN0b3J5IG5lZWRzIGEgRE9NJykgOiAoMCwgX2ludmFyaWFudDIuZGVmYXVsdCkoZmFsc2UpIDogdm9pZCAwO1xuXG4gIHZhciB1c2VSZWZyZXNoID0gb3B0aW9ucy5mb3JjZVJlZnJlc2ggfHwgISgwLCBfRE9NVXRpbHMuc3VwcG9ydHNIaXN0b3J5KSgpO1xuICB2YXIgUHJvdG9jb2wgPSB1c2VSZWZyZXNoID8gUmVmcmVzaFByb3RvY29sIDogQnJvd3NlclByb3RvY29sO1xuXG4gIHZhciBnZXRVc2VyQ29uZmlybWF0aW9uID0gUHJvdG9jb2wuZ2V0VXNlckNvbmZpcm1hdGlvbjtcbiAgdmFyIGdldEN1cnJlbnRMb2NhdGlvbiA9IFByb3RvY29sLmdldEN1cnJlbnRMb2NhdGlvbjtcbiAgdmFyIHB1c2hMb2NhdGlvbiA9IFByb3RvY29sLnB1c2hMb2NhdGlvbjtcbiAgdmFyIHJlcGxhY2VMb2NhdGlvbiA9IFByb3RvY29sLnJlcGxhY2VMb2NhdGlvbjtcbiAgdmFyIGdvID0gUHJvdG9jb2wuZ287XG5cblxuICB2YXIgaGlzdG9yeSA9ICgwLCBfY3JlYXRlSGlzdG9yeTIuZGVmYXVsdCkoX2V4dGVuZHMoe1xuICAgIGdldFVzZXJDb25maXJtYXRpb246IGdldFVzZXJDb25maXJtYXRpb24gfSwgb3B0aW9ucywge1xuICAgIGdldEN1cnJlbnRMb2NhdGlvbjogZ2V0Q3VycmVudExvY2F0aW9uLFxuICAgIHB1c2hMb2NhdGlvbjogcHVzaExvY2F0aW9uLFxuICAgIHJlcGxhY2VMb2NhdGlvbjogcmVwbGFjZUxvY2F0aW9uLFxuICAgIGdvOiBnb1xuICB9KSk7XG5cbiAgdmFyIGxpc3RlbmVyQ291bnQgPSAwLFxuICAgICAgc3RvcExpc3RlbmVyID0gdm9pZCAwO1xuXG4gIHZhciBzdGFydExpc3RlbmVyID0gZnVuY3Rpb24gc3RhcnRMaXN0ZW5lcihsaXN0ZW5lciwgYmVmb3JlKSB7XG4gICAgaWYgKCsrbGlzdGVuZXJDb3VudCA9PT0gMSkgc3RvcExpc3RlbmVyID0gQnJvd3NlclByb3RvY29sLnN0YXJ0TGlzdGVuZXIoaGlzdG9yeS50cmFuc2l0aW9uVG8pO1xuXG4gICAgdmFyIHVubGlzdGVuID0gYmVmb3JlID8gaGlzdG9yeS5saXN0ZW5CZWZvcmUobGlzdGVuZXIpIDogaGlzdG9yeS5saXN0ZW4obGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHVubGlzdGVuKCk7XG5cbiAgICAgIGlmICgtLWxpc3RlbmVyQ291bnQgPT09IDApIHN0b3BMaXN0ZW5lcigpO1xuICAgIH07XG4gIH07XG5cbiAgdmFyIGxpc3RlbkJlZm9yZSA9IGZ1bmN0aW9uIGxpc3RlbkJlZm9yZShsaXN0ZW5lcikge1xuICAgIHJldHVybiBzdGFydExpc3RlbmVyKGxpc3RlbmVyLCB0cnVlKTtcbiAgfTtcblxuICB2YXIgbGlzdGVuID0gZnVuY3Rpb24gbGlzdGVuKGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIHN0YXJ0TGlzdGVuZXIobGlzdGVuZXIsIGZhbHNlKTtcbiAgfTtcblxuICByZXR1cm4gX2V4dGVuZHMoe30sIGhpc3RvcnksIHtcbiAgICBsaXN0ZW5CZWZvcmU6IGxpc3RlbkJlZm9yZSxcbiAgICBsaXN0ZW46IGxpc3RlblxuICB9KTtcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUJyb3dzZXJIaXN0b3J5OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9Bc3luY1V0aWxzID0gcmVxdWlyZSgnLi9Bc3luY1V0aWxzJyk7XG5cbnZhciBfUGF0aFV0aWxzID0gcmVxdWlyZSgnLi9QYXRoVXRpbHMnKTtcblxudmFyIF9ydW5UcmFuc2l0aW9uSG9vayA9IHJlcXVpcmUoJy4vcnVuVHJhbnNpdGlvbkhvb2snKTtcblxudmFyIF9ydW5UcmFuc2l0aW9uSG9vazIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9ydW5UcmFuc2l0aW9uSG9vayk7XG5cbnZhciBfQWN0aW9ucyA9IHJlcXVpcmUoJy4vQWN0aW9ucycpO1xuXG52YXIgX0xvY2F0aW9uVXRpbHMgPSByZXF1aXJlKCcuL0xvY2F0aW9uVXRpbHMnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIGNyZWF0ZUhpc3RvcnkgPSBmdW5jdGlvbiBjcmVhdGVIaXN0b3J5KCkge1xuICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuICB2YXIgZ2V0Q3VycmVudExvY2F0aW9uID0gb3B0aW9ucy5nZXRDdXJyZW50TG9jYXRpb247XG4gIHZhciBnZXRVc2VyQ29uZmlybWF0aW9uID0gb3B0aW9ucy5nZXRVc2VyQ29uZmlybWF0aW9uO1xuICB2YXIgcHVzaExvY2F0aW9uID0gb3B0aW9ucy5wdXNoTG9jYXRpb247XG4gIHZhciByZXBsYWNlTG9jYXRpb24gPSBvcHRpb25zLnJlcGxhY2VMb2NhdGlvbjtcbiAgdmFyIGdvID0gb3B0aW9ucy5nbztcbiAgdmFyIGtleUxlbmd0aCA9IG9wdGlvbnMua2V5TGVuZ3RoO1xuXG5cbiAgdmFyIGN1cnJlbnRMb2NhdGlvbiA9IHZvaWQgMDtcbiAgdmFyIHBlbmRpbmdMb2NhdGlvbiA9IHZvaWQgMDtcbiAgdmFyIGJlZm9yZUxpc3RlbmVycyA9IFtdO1xuICB2YXIgbGlzdGVuZXJzID0gW107XG4gIHZhciBhbGxLZXlzID0gW107XG5cbiAgdmFyIGdldEN1cnJlbnRJbmRleCA9IGZ1bmN0aW9uIGdldEN1cnJlbnRJbmRleCgpIHtcbiAgICBpZiAocGVuZGluZ0xvY2F0aW9uICYmIHBlbmRpbmdMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBPUCkgcmV0dXJuIGFsbEtleXMuaW5kZXhPZihwZW5kaW5nTG9jYXRpb24ua2V5KTtcblxuICAgIGlmIChjdXJyZW50TG9jYXRpb24pIHJldHVybiBhbGxLZXlzLmluZGV4T2YoY3VycmVudExvY2F0aW9uLmtleSk7XG5cbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgdmFyIHVwZGF0ZUxvY2F0aW9uID0gZnVuY3Rpb24gdXBkYXRlTG9jYXRpb24obmV4dExvY2F0aW9uKSB7XG4gICAgdmFyIGN1cnJlbnRJbmRleCA9IGdldEN1cnJlbnRJbmRleCgpO1xuXG4gICAgY3VycmVudExvY2F0aW9uID0gbmV4dExvY2F0aW9uO1xuXG4gICAgaWYgKGN1cnJlbnRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBVU0gpIHtcbiAgICAgIGFsbEtleXMgPSBbXS5jb25jYXQoYWxsS2V5cy5zbGljZSgwLCBjdXJyZW50SW5kZXggKyAxKSwgW2N1cnJlbnRMb2NhdGlvbi5rZXldKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlJFUExBQ0UpIHtcbiAgICAgIGFsbEtleXNbY3VycmVudEluZGV4XSA9IGN1cnJlbnRMb2NhdGlvbi5rZXk7XG4gICAgfVxuXG4gICAgbGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgICByZXR1cm4gbGlzdGVuZXIoY3VycmVudExvY2F0aW9uKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgbGlzdGVuQmVmb3JlID0gZnVuY3Rpb24gbGlzdGVuQmVmb3JlKGxpc3RlbmVyKSB7XG4gICAgYmVmb3JlTGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBiZWZvcmVMaXN0ZW5lcnMgPSBiZWZvcmVMaXN0ZW5lcnMuZmlsdGVyKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtICE9PSBsaXN0ZW5lcjtcbiAgICAgIH0pO1xuICAgIH07XG4gIH07XG5cbiAgdmFyIGxpc3RlbiA9IGZ1bmN0aW9uIGxpc3RlbihsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gbGlzdGVuZXJzID0gbGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbGlzdGVuZXI7XG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xuXG4gIHZhciBjb25maXJtVHJhbnNpdGlvblRvID0gZnVuY3Rpb24gY29uZmlybVRyYW5zaXRpb25Ubyhsb2NhdGlvbiwgY2FsbGJhY2spIHtcbiAgICAoMCwgX0FzeW5jVXRpbHMubG9vcEFzeW5jKShiZWZvcmVMaXN0ZW5lcnMubGVuZ3RoLCBmdW5jdGlvbiAoaW5kZXgsIG5leHQsIGRvbmUpIHtcbiAgICAgICgwLCBfcnVuVHJhbnNpdGlvbkhvb2syLmRlZmF1bHQpKGJlZm9yZUxpc3RlbmVyc1tpbmRleF0sIGxvY2F0aW9uLCBmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiByZXN1bHQgIT0gbnVsbCA/IGRvbmUocmVzdWx0KSA6IG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH0sIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICBpZiAoZ2V0VXNlckNvbmZpcm1hdGlvbiAmJiB0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZ2V0VXNlckNvbmZpcm1hdGlvbihtZXNzYWdlLCBmdW5jdGlvbiAob2spIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2sob2sgIT09IGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhtZXNzYWdlICE9PSBmYWxzZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIHRyYW5zaXRpb25UbyA9IGZ1bmN0aW9uIHRyYW5zaXRpb25UbyhuZXh0TG9jYXRpb24pIHtcbiAgICBpZiAoY3VycmVudExvY2F0aW9uICYmICgwLCBfTG9jYXRpb25VdGlscy5sb2NhdGlvbnNBcmVFcXVhbCkoY3VycmVudExvY2F0aW9uLCBuZXh0TG9jYXRpb24pIHx8IHBlbmRpbmdMb2NhdGlvbiAmJiAoMCwgX0xvY2F0aW9uVXRpbHMubG9jYXRpb25zQXJlRXF1YWwpKHBlbmRpbmdMb2NhdGlvbiwgbmV4dExvY2F0aW9uKSkgcmV0dXJuOyAvLyBOb3RoaW5nIHRvIGRvXG5cbiAgICBwZW5kaW5nTG9jYXRpb24gPSBuZXh0TG9jYXRpb247XG5cbiAgICBjb25maXJtVHJhbnNpdGlvblRvKG5leHRMb2NhdGlvbiwgZnVuY3Rpb24gKG9rKSB7XG4gICAgICBpZiAocGVuZGluZ0xvY2F0aW9uICE9PSBuZXh0TG9jYXRpb24pIHJldHVybjsgLy8gVHJhbnNpdGlvbiB3YXMgaW50ZXJydXB0ZWQgZHVyaW5nIGNvbmZpcm1hdGlvblxuXG4gICAgICBwZW5kaW5nTG9jYXRpb24gPSBudWxsO1xuXG4gICAgICBpZiAob2spIHtcbiAgICAgICAgLy8gVHJlYXQgUFVTSCB0byBzYW1lIHBhdGggbGlrZSBSRVBMQUNFIHRvIGJlIGNvbnNpc3RlbnQgd2l0aCBicm93c2Vyc1xuICAgICAgICBpZiAobmV4dExvY2F0aW9uLmFjdGlvbiA9PT0gX0FjdGlvbnMuUFVTSCkge1xuICAgICAgICAgIHZhciBwcmV2UGF0aCA9ICgwLCBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgpKGN1cnJlbnRMb2NhdGlvbik7XG4gICAgICAgICAgdmFyIG5leHRQYXRoID0gKDAsIF9QYXRoVXRpbHMuY3JlYXRlUGF0aCkobmV4dExvY2F0aW9uKTtcblxuICAgICAgICAgIGlmIChuZXh0UGF0aCA9PT0gcHJldlBhdGggJiYgKDAsIF9Mb2NhdGlvblV0aWxzLnN0YXRlc0FyZUVxdWFsKShjdXJyZW50TG9jYXRpb24uc3RhdGUsIG5leHRMb2NhdGlvbi5zdGF0ZSkpIG5leHRMb2NhdGlvbi5hY3Rpb24gPSBfQWN0aW9ucy5SRVBMQUNFO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBPUCkge1xuICAgICAgICAgIHVwZGF0ZUxvY2F0aW9uKG5leHRMb2NhdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAobmV4dExvY2F0aW9uLmFjdGlvbiA9PT0gX0FjdGlvbnMuUFVTSCkge1xuICAgICAgICAgIGlmIChwdXNoTG9jYXRpb24obmV4dExvY2F0aW9uKSAhPT0gZmFsc2UpIHVwZGF0ZUxvY2F0aW9uKG5leHRMb2NhdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAobmV4dExvY2F0aW9uLmFjdGlvbiA9PT0gX0FjdGlvbnMuUkVQTEFDRSkge1xuICAgICAgICAgIGlmIChyZXBsYWNlTG9jYXRpb24obmV4dExvY2F0aW9uKSAhPT0gZmFsc2UpIHVwZGF0ZUxvY2F0aW9uKG5leHRMb2NhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudExvY2F0aW9uICYmIG5leHRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBPUCkge1xuICAgICAgICB2YXIgcHJldkluZGV4ID0gYWxsS2V5cy5pbmRleE9mKGN1cnJlbnRMb2NhdGlvbi5rZXkpO1xuICAgICAgICB2YXIgbmV4dEluZGV4ID0gYWxsS2V5cy5pbmRleE9mKG5leHRMb2NhdGlvbi5rZXkpO1xuXG4gICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xICYmIG5leHRJbmRleCAhPT0gLTEpIGdvKHByZXZJbmRleCAtIG5leHRJbmRleCk7IC8vIFJlc3RvcmUgdGhlIFVSTFxuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIHZhciBwdXNoID0gZnVuY3Rpb24gcHVzaChpbnB1dCkge1xuICAgIHJldHVybiB0cmFuc2l0aW9uVG8oY3JlYXRlTG9jYXRpb24oaW5wdXQsIF9BY3Rpb25zLlBVU0gpKTtcbiAgfTtcblxuICB2YXIgcmVwbGFjZSA9IGZ1bmN0aW9uIHJlcGxhY2UoaW5wdXQpIHtcbiAgICByZXR1cm4gdHJhbnNpdGlvblRvKGNyZWF0ZUxvY2F0aW9uKGlucHV0LCBfQWN0aW9ucy5SRVBMQUNFKSk7XG4gIH07XG5cbiAgdmFyIGdvQmFjayA9IGZ1bmN0aW9uIGdvQmFjaygpIHtcbiAgICByZXR1cm4gZ28oLTEpO1xuICB9O1xuXG4gIHZhciBnb0ZvcndhcmQgPSBmdW5jdGlvbiBnb0ZvcndhcmQoKSB7XG4gICAgcmV0dXJuIGdvKDEpO1xuICB9O1xuXG4gIHZhciBjcmVhdGVLZXkgPSBmdW5jdGlvbiBjcmVhdGVLZXkoKSB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCBrZXlMZW5ndGggfHwgNik7XG4gIH07XG5cbiAgdmFyIGNyZWF0ZUhyZWYgPSBmdW5jdGlvbiBjcmVhdGVIcmVmKGxvY2F0aW9uKSB7XG4gICAgcmV0dXJuICgwLCBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgpKGxvY2F0aW9uKTtcbiAgfTtcblxuICB2YXIgY3JlYXRlTG9jYXRpb24gPSBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbihsb2NhdGlvbiwgYWN0aW9uKSB7XG4gICAgdmFyIGtleSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IGNyZWF0ZUtleSgpIDogYXJndW1lbnRzWzJdO1xuICAgIHJldHVybiAoMCwgX0xvY2F0aW9uVXRpbHMuY3JlYXRlTG9jYXRpb24pKGxvY2F0aW9uLCBhY3Rpb24sIGtleSk7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBnZXRDdXJyZW50TG9jYXRpb246IGdldEN1cnJlbnRMb2NhdGlvbixcbiAgICBsaXN0ZW5CZWZvcmU6IGxpc3RlbkJlZm9yZSxcbiAgICBsaXN0ZW46IGxpc3RlbixcbiAgICB0cmFuc2l0aW9uVG86IHRyYW5zaXRpb25UbyxcbiAgICBwdXNoOiBwdXNoLFxuICAgIHJlcGxhY2U6IHJlcGxhY2UsXG4gICAgZ286IGdvLFxuICAgIGdvQmFjazogZ29CYWNrLFxuICAgIGdvRm9yd2FyZDogZ29Gb3J3YXJkLFxuICAgIGNyZWF0ZUtleTogY3JlYXRlS2V5LFxuICAgIGNyZWF0ZVBhdGg6IF9QYXRoVXRpbHMuY3JlYXRlUGF0aCxcbiAgICBjcmVhdGVIcmVmOiBjcmVhdGVIcmVmLFxuICAgIGNyZWF0ZUxvY2F0aW9uOiBjcmVhdGVMb2NhdGlvblxuICB9O1xufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlSGlzdG9yeTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfd2FybmluZyA9IHJlcXVpcmUoJ3dhcm5pbmcnKTtcblxudmFyIF93YXJuaW5nMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3dhcm5pbmcpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgcnVuVHJhbnNpdGlvbkhvb2sgPSBmdW5jdGlvbiBydW5UcmFuc2l0aW9uSG9vayhob29rLCBsb2NhdGlvbiwgY2FsbGJhY2spIHtcbiAgdmFyIHJlc3VsdCA9IGhvb2sobG9jYXRpb24sIGNhbGxiYWNrKTtcblxuICBpZiAoaG9vay5sZW5ndGggPCAyKSB7XG4gICAgLy8gQXNzdW1lIHRoZSBob29rIHJ1bnMgc3luY2hyb25vdXNseSBhbmQgYXV0b21hdGljYWxseVxuICAgIC8vIGNhbGwgdGhlIGNhbGxiYWNrIHdpdGggdGhlIHJldHVybiB2YWx1ZS5cbiAgICBjYWxsYmFjayhyZXN1bHQpO1xuICB9IGVsc2Uge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKHJlc3VsdCA9PT0gdW5kZWZpbmVkLCAnWW91IHNob3VsZCBub3QgXCJyZXR1cm5cIiBpbiBhIHRyYW5zaXRpb24gaG9vayB3aXRoIGEgY2FsbGJhY2sgYXJndW1lbnQ7ICcgKyAnY2FsbCB0aGUgY2FsbGJhY2sgaW5zdGVhZCcpIDogdm9pZCAwO1xuICB9XG59O1xuXG5leHBvcnRzLmRlZmF1bHQgPSBydW5UcmFuc2l0aW9uSG9vazsiLCIvKipcbiAqIENvcHlyaWdodCAyMDEzLTIwMTUsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXNlIGludmFyaWFudCgpIHRvIGFzc2VydCBzdGF0ZSB3aGljaCB5b3VyIHByb2dyYW0gYXNzdW1lcyB0byBiZSB0cnVlLlxuICpcbiAqIFByb3ZpZGUgc3ByaW50Zi1zdHlsZSBmb3JtYXQgKG9ubHkgJXMgaXMgc3VwcG9ydGVkKSBhbmQgYXJndW1lbnRzXG4gKiB0byBwcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IHdoYXQgYnJva2UgYW5kIHdoYXQgeW91IHdlcmVcbiAqIGV4cGVjdGluZy5cbiAqXG4gKiBUaGUgaW52YXJpYW50IG1lc3NhZ2Ugd2lsbCBiZSBzdHJpcHBlZCBpbiBwcm9kdWN0aW9uLCBidXQgdGhlIGludmFyaWFudFxuICogd2lsbCByZW1haW4gdG8gZW5zdXJlIGxvZ2ljIGRvZXMgbm90IGRpZmZlciBpbiBwcm9kdWN0aW9uLlxuICovXG5cbnZhciBpbnZhcmlhbnQgPSBmdW5jdGlvbihjb25kaXRpb24sIGZvcm1hdCwgYSwgYiwgYywgZCwgZSwgZikge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhcmlhbnQgcmVxdWlyZXMgYW4gZXJyb3IgbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdmFyIGVycm9yO1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICAgICdNaW5pZmllZCBleGNlcHRpb24gb2NjdXJyZWQ7IHVzZSB0aGUgbm9uLW1pbmlmaWVkIGRldiBlbnZpcm9ubWVudCAnICtcbiAgICAgICAgJ2ZvciB0aGUgZnVsbCBlcnJvciBtZXNzYWdlIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJ1xuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGFyZ3MgPSBbYSwgYiwgYywgZCwgZSwgZl07XG4gICAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICAgIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3NbYXJnSW5kZXgrK107IH0pXG4gICAgICApO1xuICAgICAgZXJyb3IubmFtZSA9ICdJbnZhcmlhbnQgVmlvbGF0aW9uJztcbiAgICB9XG5cbiAgICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgaW52YXJpYW50J3Mgb3duIGZyYW1lXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW52YXJpYW50O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQ29weXJpZ2h0IDIwMTQtMjAxNSwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTaW1pbGFyIHRvIGludmFyaWFudCBidXQgb25seSBsb2dzIGEgd2FybmluZyBpZiB0aGUgY29uZGl0aW9uIGlzIG5vdCBtZXQuXG4gKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGxvZyBpc3N1ZXMgaW4gZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnRzIGluIGNyaXRpY2FsXG4gKiBwYXRocy4gUmVtb3ZpbmcgdGhlIGxvZ2dpbmcgY29kZSBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudHMgd2lsbCBrZWVwIHRoZVxuICogc2FtZSBsb2dpYyBhbmQgZm9sbG93IHRoZSBzYW1lIGNvZGUgcGF0aHMuXG4gKi9cblxudmFyIHdhcm5pbmcgPSBmdW5jdGlvbigpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB3YXJuaW5nID0gZnVuY3Rpb24oY29uZGl0aW9uLCBmb3JtYXQsIGFyZ3MpIHtcbiAgICB2YXIgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiA+IDIgPyBsZW4gLSAyIDogMCk7XG4gICAgZm9yICh2YXIga2V5ID0gMjsga2V5IDwgbGVuOyBrZXkrKykge1xuICAgICAgYXJnc1trZXkgLSAyXSA9IGFyZ3VtZW50c1trZXldO1xuICAgIH1cbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ2B3YXJuaW5nKGNvbmRpdGlvbiwgZm9ybWF0LCAuLi5hcmdzKWAgcmVxdWlyZXMgYSB3YXJuaW5nICcgK1xuICAgICAgICAnbWVzc2FnZSBhcmd1bWVudCdcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGZvcm1hdC5sZW5ndGggPCAxMCB8fCAoL15bc1xcV10qJC8pLnRlc3QoZm9ybWF0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVGhlIHdhcm5pbmcgZm9ybWF0IHNob3VsZCBiZSBhYmxlIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IHRoaXMgJyArXG4gICAgICAgICd3YXJuaW5nLiBQbGVhc2UsIHVzZSBhIG1vcmUgZGVzY3JpcHRpdmUgZm9ybWF0IHRoYW46ICcgKyBmb3JtYXRcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICB2YXIgbWVzc2FnZSA9ICdXYXJuaW5nOiAnICtcbiAgICAgICAgZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgICAgICB9KTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFRoaXMgZXJyb3Igd2FzIHRocm93biBhcyBhIGNvbnZlbmllbmNlIHNvIHRoYXQgeW91IGNhbiB1c2UgdGhpcyBzdGFja1xuICAgICAgICAvLyB0byBmaW5kIHRoZSBjYWxsc2l0ZSB0aGF0IGNhdXNlZCB0aGlzIHdhcm5pbmcgdG8gZmlyZS5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICAgICAgfSBjYXRjaCh4KSB7fVxuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3YXJuaW5nO1xuIiwiXG5pbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgU2lkZWJhciBmcm9tICcuL2NvbXBvbmVudHMvU2lkZWJhcidcbmltcG9ydCBEYXRhYmFzZUJyZWFkQ3J1bWIgZnJvbSAnLi9wYWdlcy9EYXRhYmFzZUJyZWFkQ3J1bWInXG5cbmNsYXNzIEFwcCBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyLWZsdWlkXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cblxuICAgICAgICAgICAgICAgICAgICA8U2lkZWJhciB7Li4udGhpcy5wcm9wcy5wYXJhbXN9Lz5cblxuICAgICAgICAgICAgICAgICAgICA8bWFpbiBjbGFzc05hbWU9XCJjb2wtbWQtMTAgb2Zmc2V0LW1kLTJcIiBzdHlsZT17e21hcmdpblRvcDogMTB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxEYXRhYmFzZUJyZWFkQ3J1bWIgey4uLnRoaXMucHJvcHN9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICB7dGhpcy5wcm9wcy5jaGlsZHJlbn1cbiAgICAgICAgICAgICAgICAgICAgPC9tYWluPlxuXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBcHAiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgUmVhY3RET00gZnJvbSAncmVhY3QtZG9tJ1xuXG5pbXBvcnQge1JvdXRlciwgUm91dGUsIEluZGV4Um91dGV9IGZyb20gJ3JlYWN0LXJvdXRlcidcbmltcG9ydCBDcmVhdGVCcm93c2VySGlzdG9yeSBmcm9tICdoaXN0b3J5L2xpYi9jcmVhdGVCcm93c2VySGlzdG9yeSdcblxuaW1wb3J0IEFwcCBmcm9tICcuL0FwcCdcbmltcG9ydCBIb21lUGFnZSBmcm9tICcuL3BhZ2VzL0hvbWVQYWdlJ1xuaW1wb3J0IERhdGFiYXNlUGFnZSBmcm9tICcuL3BhZ2VzL2RhdGFiYXNlL0RhdGFiYXNlUGFnZSdcbmltcG9ydCBUYWJsZVBhZ2UgZnJvbSAnLi9wYWdlcy9kYXRhYmFzZS90YWJsZS9UYWJsZVBhZ2UnXG5cbmNvbnN0IHJvdXRlcyA9ICAoXG4gICAgPFJvdXRlciBoaXN0b3J5PXtDcmVhdGVCcm93c2VySGlzdG9yeSgpfT5cbiAgICAgICAgPFJvdXRlIHBhdGg9XCIvXCIgY29tcG9uZW50PXtBcHB9PlxuICAgICAgICAgICAgPEluZGV4Um91dGUgY29tcG9uZW50PXtIb21lUGFnZX0gLz5cbiAgICAgICAgICAgIDxSb3V0ZSBwYXRoPVwiL1wiIGNvbXBvbmVudD17SG9tZVBhZ2V9IC8+XG4gICAgICAgICAgICA8Um91dGUgcGF0aD1cIi9kYXRhYmFzZS86ZGJuYW1lXCIgY29tcG9uZW50PXtEYXRhYmFzZVBhZ2V9IC8+XG4gICAgICAgICAgICA8Um91dGUgcGF0aD1cIi9kYXRhYmFzZS86ZGJuYW1lLzp0YWJsZW5hbWVcIiBjb21wb25lbnQ9e1RhYmxlUGFnZX0gLz5cbiAgICAgICAgPC9Sb3V0ZT5cbiAgICA8L1JvdXRlcj5cbik7XG5cblJlYWN0RE9NLnJlbmRlcihyb3V0ZXMsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhcHAnKSk7IiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IEh0dHAgZnJvbSAnLi4vc2VydmljZXMvSHR0cCdcbmltcG9ydCB7TGlua30gZnJvbSAncmVhY3Qtcm91dGVyJ1xuXG5jbGFzcyBTaWRlYmFyIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgICAgIHN1cGVyKHByb3BzKVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgICAgICBkYXRhYmFzZXM6IFtdLFxuICAgICAgICAgICAgc2VsZWN0ZWREYm5hbWU6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbXBvbmVudERpZE1vdW50KCkge1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgc2VsZWN0ZWREYm5hbWU6IHRoaXMucHJvcHMuZGJuYW1lLFxuICAgICAgICAgICAgc2VsZWN0ZWRUYWJsZW5hbWU6IHRoaXMucHJvcHMudGFibGVuYW1lLFxuICAgICAgICB9KVxuXG4gICAgICAgIHRoaXMubGlzdERhdGFiYXNlcygpXG4gICAgfVxuXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcyhuZXh0UHJvcHMpIHtcblxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHNlbGVjdGVkRGJuYW1lOiBuZXh0UHJvcHMuZGJuYW1lLFxuICAgICAgICAgICAgc2VsZWN0ZWRUYWJsZW5hbWU6IG5leHRQcm9wcy50YWJsZW5hbWVcbiAgICAgICAgfSlcblxuICAgIH1cblxuICAgIGxpc3REYXRhYmFzZXMoKSB7XG5cbiAgICAgICAgbGV0IHNlbGYgPSB0aGlzXG5cbiAgICAgICAgSHR0cC5wb3N0KFwiL2RhdGFiYXNlL2xpc3RcIilcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgICAgICBpZihyLmRhdGEuY29kZSA9PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VsZi5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFiYXNlczogci5kYXRhLnBheWxvYWRcbiAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBkYXRhYmFzZXMgPSBzZWxmLnN0YXRlLmRhdGFiYXNlc1xuICAgICAgICBjb25zdCB0YWJsZXMgPSBzZWxmLnN0YXRlLnRhYmxlc1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8bmF2IGNsYXNzTmFtZT1cImNvbC1tZC0yIGhpZGRlbi14cy1kb3duIGJnLWZhZGVkIHNpZGViYXJcIj5cbiAgICAgICAgICAgICAgICA8dWwgY2xhc3NOYW1lPVwibmF2IG5hdi1waWxscyBmbGV4LWNvbHVtblwiPlxuXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFiYXNlcy5tYXAoZnVuY3Rpb24gKGl0ZW0sIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJuYXYtaXRlbVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPExpbmtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0bz17XCIvZGF0YWJhc2UvXCIgKyBpdGVtLkRhdGFiYXNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17XCJuYXYtbGluayBcIiArIChpdGVtLkRhdGFiYXNlID09IHNlbGYuc3RhdGUuc2VsZWN0ZWREYm5hbWUgPyBcImFjdGl2ZVwiIDogbnVsbCl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpdGVtLkRhdGFiYXNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9MaW5rPlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICAgIDwvbmF2PlxuICAgICAgICApXG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFNpZGViYXIiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5cbmNsYXNzIFRhYiBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IHsuLi50aGlzLnByb3BzfT57dGhpcy5wcm9wcy5jaGlsZHJlbn08L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBUYWIiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5cbmNsYXNzIEFib3V0UGFnZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICAgICAgc2VsZWN0ZWQ6IC0xXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmlzVGFiQWN0aXZlID0gdGhpcy5pc1RhYkFjdGl2ZS5iaW5kKHRoaXMpXG4gICAgICAgIHRoaXMuc2V0VGFiID0gdGhpcy5zZXRUYWIuYmluZCh0aGlzKVxuICAgIH1cblxuICAgIGlzVGFiQWN0aXZlKGlkeCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuc3RhdGUuc2VsZWN0ZWQgPT0gaWR4KSA/IFwibmF2LWxpbmsgYWN0aXZlXCIgOiBcIm5hdi1saW5rXCJcbiAgICB9XG5cbiAgICBzZXRUYWIoaWR4KSB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgc2VsZWN0ZWQ6IGlkeFxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGNvbXBvbmVudERpZE1vdW50KCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHNlbGVjdGVkOiB0aGlzLnByb3BzLnNlbGVjdGVkXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGxldCBzZWxmID0gdGhpc1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJuYXYgbmF2LXRhYnNcIj5cblxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnByb3BzLmNoaWxkcmVuLm1hcChmdW5jdGlvbiAodGFiLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwibmF2LWl0ZW0gcG9pbnRlclwiIGtleT17aWR4fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhIGNsYXNzTmFtZT17c2VsZi5pc1RhYkFjdGl2ZShpZHgpfSBvbkNsaWNrPXsoKSA9PiBzZWxmLnNldFRhYihpZHgpfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dGFiLnByb3BzLmxhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIDwvdWw+XG5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7bWFyZ2luVG9wOiA1fX0+XG4gICAgICAgICAgICAgICAgICAgIHtzZWxmLnByb3BzLmNoaWxkcmVuW3NlbGYuc3RhdGUuc2VsZWN0ZWRdfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBYm91dFBhZ2UiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQge0xpbmt9IGZyb20gJ3JlYWN0LXJvdXRlcidcblxuLypcbiogdGhpcyBjb21wb25lbnQgbGl2ZXMgaW4gQXBwXG4qIHRvcCBvZiBjb250ZW50XG4qICovXG5cbmNsYXNzIERhdGFiYXNlQnJlYWRDcnVtYiBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgcHJvcHMgPSBzZWxmLnByb3BzXG4gICAgICAgIGNvbnN0IGRibmFtZSA9IHByb3BzLnBhcmFtcy5kYm5hbWVcbiAgICAgICAgY29uc3QgdGFibGVuYW1lID0gcHJvcHMucGFyYW1zLnRhYmxlbmFtZVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxuYXYgY2xhc3NOYW1lPVwiYnJlYWRjcnVtYlwiPlxuICAgICAgICAgICAgICAgICAgICA8TGluayBjbGFzc05hbWU9XCJicmVhZGNydW1iLWl0ZW1cInRvPVwiL1wiPkhvbWU8L0xpbms+XG5cbiAgICAgICAgICAgICAgICAgICAge2RibmFtZSA/IDxMaW5rIGNsYXNzTmFtZT17XCJicmVhZGNydW1iLWl0ZW0gXCIgKyAodGFibGVuYW1lID8gXCJcIiA6IFwiYWN0aXZlXCIpfSB0bz17XCIvZGF0YWJhc2UvXCIgKyBkYm5hbWV9PntkYm5hbWV9PC9MaW5rPiA6IG51bGwgfVxuICAgICAgICAgICAgICAgICAgICB7dGFibGVuYW1lID8gPExpbmsgIGNsYXNzTmFtZT17XCJicmVhZGNydW1iLWl0ZW0gYWN0aXZlXCJ9IHRvPXtcIi9kYXRhYmFzZS9cIiArIGRibmFtZSArIFwiL1wiICsgdGFibGVuYW1lfT57dGFibGVuYW1lfTwvTGluaz4gOiBudWxsIH1cblxuICAgICAgICAgICAgICAgIDwvbmF2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGF0YWJhc2VCcmVhZENydW1iIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuXG5jbGFzcyBIb21lUGFnZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBIb21lUGFnZSIsImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCBIdHRwIGZyb20gJy4uLy4uL3NlcnZpY2VzL0h0dHAnXG5pbXBvcnQgVXRpbCBmcm9tICcuLi8uLi9zZXJ2aWNlcy9VdGlsJ1xuaW1wb3J0IHtMaW5rfSBmcm9tICdyZWFjdC1yb3V0ZXInXG5cblxuLypcbiogTGlzdCB0YWJsZXMgaW4gdGhpcyBwYWdlIGZvciBhIHNlbGVjdGVkIGRibmFtZVxuKi9cblxuY2xhc3MgRGF0YWJhc2VQYWdlIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgICAgIHN1cGVyKHByb3BzKVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgICAgICB0YWJsZXM6IFtdXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb21wb25lbnREaWRNb3VudCgpIHtcbiAgICAgICAgdGhpcy5saXN0VGFibGVzKHRoaXMucHJvcHMucGFyYW1zLmRibmFtZSlcbiAgICB9XG5cblxuICAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMobmV4dFByb3BzKSB7XG4gICAgICAgIHRoaXMubGlzdFRhYmxlcyhuZXh0UHJvcHMucGFyYW1zLmRibmFtZSlcbiAgICB9XG5cblxuICAgIGxpc3RUYWJsZXMoZGJuYW1lKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcblxuICAgICAgICBIdHRwLnBvc3QoXCIvdGFibGUvbGlzdFwiLCB7ZGJuYW1lOiBkYm5hbWV9KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHIpIHtcblxuICAgICAgICAgICAgICAgIGlmKHIuZGF0YS5jb2RlID09IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWxmLnNldFN0YXRlKHtcbiAgICAgICAgICAgICAgICAgICAgdGFibGVzOiByLmRhdGEucGF5bG9hZFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBwcm9wcyA9IHNlbGYucHJvcHNcbiAgICAgICAgY29uc3QgZGJuYW1lID0gcHJvcHMucGFyYW1zLmRibmFtZSAvKiBmcm9tIHBhcmFtcyBiZWNhdXNlIHRoaXMgY29tcG9uZW50IGlzIGEgcGFnZSAqL1xuICAgICAgICBjb25zdCB0YWJsZXMgPSBzZWxmLnN0YXRlLnRhYmxlc1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuXG4gICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cInRhYmxlIHRhYmxlLXNtIHRhYmxlLWhvdmVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGg+VGFibGU8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5PcGVyYXRpb25zPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFibGVzLm1hcChmdW5jdGlvbiAodGFibGUsIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBrZXk9e2lkeH0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicG9pbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxMaW5rIHRvPXtcIi9kYXRhYmFzZS9cIiArIGRibmFtZSArIFwiL1wiICsgdGFibGV9Pnt0YWJsZX08L0xpbms+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkPiMjPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApXG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERhdGFiYXNlUGFnZSIsImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7TGlua30gZnJvbSAncmVhY3Qtcm91dGVyJ1xuaW1wb3J0IFRhYiBmcm9tICcuLi8uLi8uLi9jb21wb25lbnRzL1RhYidcbmltcG9ydCBUYWJzIGZyb20gJy4uLy4uLy4uL2NvbXBvbmVudHMvVGFicydcbmltcG9ydCBUYWJsZVN0cnVjdHVyZSBmcm9tICcuL3RhYnMvc3RydWN0dXJlL1RhYmxlU3RydWN0dXJlJ1xuaW1wb3J0IFRhYmxlUm93cyBmcm9tICcuL3RhYnMvcm93cy9UYWJsZVJvd3MnXG5cbi8qXG4gKiBJbiB0aGlzIGNvbXBvbmVudCwgdGhlcmUgYXJlIHR3byBjb21wb25lbnRzIHNob3dpbmc6XG4gKiBEYXRhYmFzZVRhYmxlUGFnZUNvbHVtbnMgYW5kIERhdGFiYXNlVGFibGVQYWdlUm93c1xuICovXG5cbmNsYXNzIERhdGFiYXNlVGFibGVQYWdlIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgICAgIHN1cGVyKHByb3BzKVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSB7fVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBwcm9wcyA9IHNlbGYucHJvcHNcbiAgICAgICAgY29uc3QgZGJuYW1lID0gcHJvcHMucGFyYW1zLmRibmFtZVxuICAgICAgICBjb25zdCB0YWJsZW5hbWUgPSBwcm9wcy5wYXJhbXMudGFibGVuYW1lXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXY+XG5cbiAgICAgICAgICAgICAgICA8VGFicyBzZWxlY3RlZD17MH0+XG4gICAgICAgICAgICAgICAgICAgIDxUYWIgbGFiZWw9XCJSb3dzXCI+PFRhYmxlUm93cyB7Li4uc2VsZi5wcm9wcy5wYXJhbXN9Lz48L1RhYj5cbiAgICAgICAgICAgICAgICAgICAgPFRhYiBsYWJlbD1cIlN0cnVjdHVyZVwiPjxUYWJsZVN0cnVjdHVyZSB7Li4uc2VsZi5wcm9wcy5wYXJhbXN9Lz48L1RhYj5cbiAgICAgICAgICAgICAgICA8L1RhYnM+XG5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApXG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERhdGFiYXNlVGFibGVQYWdlIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IEh0dHAgZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvSHR0cCdcbmltcG9ydCB7TGlua30gZnJvbSAncmVhY3Qtcm91dGVyJ1xuaW1wb3J0IFJvdyBmcm9tICcuL2NvbXBvbmVudC9Sb3cnXG5cbi8qXG4gKiBMaXN0IHN0cnVjdHVyZSBpbiB0aGlzIGNvbXBvbmVudCBmb3IgYSBzZWxlY3RlZCB0YWJsZW5hbWVcbiAqL1xuXG5jbGFzcyBUYWJsZVJvd3MgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgICAgICAgIGNvbHVtbnM6IFtdLFxuICAgICAgICAgICAgcm93czogW10sXG4gICAgICAgICAgICBwYWdlOiAwXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFBhZ2VCeUlucHV0ID0gdGhpcy5zZXRQYWdlQnlJbnB1dC5iaW5kKHRoaXMpXG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7XG5cbiAgICAgICAgLyogZmlyc3QgbGlzdCBzdHJ1Y3R1cmUsIGJlY2F1c2Ugd2UgbmVlZCB0aGVtIHRvIHNob3cgaW4gdGFibGUgPHRoZWFkLz4gKi9cbiAgICAgICAgdGhpcy5saXN0Q29sdW1ucygpXG4gICAgfVxuXG4gICAgbGlzdENvbHVtbnMoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgZGJuYW1lID0gc2VsZi5wcm9wcy5kYm5hbWVcbiAgICAgICAgY29uc3QgdGFibGVuYW1lID0gc2VsZi5wcm9wcy50YWJsZW5hbWVcblxuICAgICAgICBIdHRwLnBvc3QoXCIvdGFibGUvY29sdW1uL2xpc3RcIiwge2RibmFtZTogZGJuYW1lLCB0YWJsZW5hbWU6IHRhYmxlbmFtZX0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICAgICAgaWYoci5kYXRhLmNvZGUgPT0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYuc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgICAgICBjb2x1bW5zOiByLmRhdGEucGF5bG9hZFxuICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICBzZWxmLmxpc3RSb3dzKHNlbGYuc3RhdGUucGFnZSlcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgbGlzdFJvd3MocGFnZSkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IGRibmFtZSA9IHNlbGYucHJvcHMuZGJuYW1lXG4gICAgICAgIGNvbnN0IHRhYmxlbmFtZSA9IHNlbGYucHJvcHMudGFibGVuYW1lXG5cbiAgICAgICAgc2VsZi5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBwYWdlOiBwYWdlXG4gICAgICAgIH0pXG5cbiAgICAgICAgSHR0cC5wb3N0KFwiL3RhYmxlL3Jvd3NcIiwge2RibmFtZTogZGJuYW1lLCB0YWJsZW5hbWU6IHRhYmxlbmFtZSwgcGFnZTogcGFnZX0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICAgICAgaWYoci5kYXRhLmNvZGUgPT0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYuc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgICAgICByb3dzOiByLmRhdGEucGF5bG9hZFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHNldFBhZ2VCeUlucHV0KGUpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBwYWdlOiBlLnRhcmdldC52YWx1ZVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBjb2x1bW5zID0gc2VsZi5zdGF0ZS5jb2x1bW5zXG4gICAgICAgIGNvbnN0IHJvd3MgPSBzZWxmLnN0YXRlLnJvd3NcbiAgICAgICAgbGV0IHBhZ2UgPSBzZWxmLnN0YXRlLnBhZ2VcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwidGFibGUgdGFibGUtc20gdGFibGUtaG92ZXIgdGFibGUtc3RyaXBlZFwiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5zLm1hcChmdW5jdGlvbiAoY29sLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiA8dGgga2V5PXtpZHh9Pntjb2wuRmllbGR9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MubWFwKGZ1bmN0aW9uIChyb3csIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiA8Um93XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17aWR4fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYm5hbWU9e3NlbGYucHJvcHMuZGJuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YWJsZW5hbWU9e3NlbGYucHJvcHMudGFibGVuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5zPXtjb2x1bW5zfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3c9e3Jvd31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG5cbiAgICAgICAgICAgICAgICB7LyogcGFnaW5hdGlvbiAqL31cbiAgICAgICAgICAgICAgICA8dWwgY2xhc3NOYW1lPVwicGFnaW5hdGlvblwiPlxuICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwicGFnZS1pdGVtXCIgb25DbGljaz17KCkgPT4ge3NlbGYubGlzdFJvd3MoLS1wYWdlKX19PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgY2xhc3NOYW1lPVwicGFnZS1saW5rXCIgaHJlZj1cIiNcIiBhcmlhLWxhYmVsPVwiTmV4dFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiZsYXF1bzs8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPk5leHQ8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgICAgIDxsaSBjbGFzc05hbWU9XCJwYWdlLWl0ZW1cIj48YSBjbGFzc05hbWU9XCJwYWdlLWxpbmtcIiBocmVmPVwiI1wiPntwYWdlfTwvYT48L2xpPlxuICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPVwicGFnZS1pdGVtXCIgb25DbGljaz17KCkgPT4ge3NlbGYubGlzdFJvd3MoKytwYWdlKX19PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGEgY2xhc3NOYW1lPVwicGFnZS1saW5rXCIgaHJlZj1cIiNcIiBhcmlhLWxhYmVsPVwiTmV4dFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiZyYXF1bzs8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic3Itb25seVwiPk5leHQ8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgPC91bD5cblxuICAgICAgICAgICAgICAgIHsvKiBnbyB0byBwYWdlIGFyZWEgKi99XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJpbnB1dC1ncm91cFwiIHN0eWxlPXt7d2lkdGg6IDI1MH19PlxuXG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzTmFtZT1cImZvcm0tY29udHJvbFwiIHBsYWNlaG9sZGVyPVwiR28gdG8gcGFnZVwiIG9uQ2hhbmdlPXtzZWxmLnNldFBhZ2VCeUlucHV0fS8+XG5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiaW5wdXQtZ3JvdXAtYnRuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYnRuIGJ0bi1zZWNvbmRhcnlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtzZWxmLmxpc3RSb3dzKHBhZ2UpfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgR29cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGFibGVSb3dzIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuXG5jbGFzcyBDb2x1bW4gZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7fVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IHByb3BzID0gdGhpcy5wcm9wc1xuICAgICAgICBsZXQgZmllbGQgID0gcHJvcHMuZmllbGRcbiAgICAgICAgbGV0IHJvdyAgPSBwcm9wcy5yb3dcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgIHtyb3dbZmllbGRdfVxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5Db2x1bW4ucHJvcFR5cGVzID0ge1xuICAgIGZpZWxkOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgcm93OiBSZWFjdC5Qcm9wVHlwZXMub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgZGJuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgdGFibGVuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBDb2x1bW4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgQ29sdW1uIGZyb20gJy4vQ29sdW1uJ1xuXG5jbGFzcyBSb3cgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7fVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IHByb3BzID0gdGhpcy5wcm9wc1xuICAgICAgICBsZXQgY29sdW1ucyAgPSBwcm9wcy5jb2x1bW5zXG4gICAgICAgIGxldCByb3cgID0gcHJvcHMucm93XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnMubWFwKGZ1bmN0aW9uIChjb2wsIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDxDb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2lkeH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3c9e3Jvd31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZD17Y29sLkZpZWxkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRibmFtZT17cHJvcHMuZGJuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlbmFtZT17cHJvcHMudGFibGVuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICApXG4gICAgfVxuXG59XG5cblJvdy5wcm9wVHlwZXMgPSB7XG4gICAgY29sdW1uczogUmVhY3QuUHJvcFR5cGVzLmFycmF5LmlzUmVxdWlyZWQsXG4gICAgcm93OiBSZWFjdC5Qcm9wVHlwZXMub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgZGJuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgdGFibGVuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBSb3ciLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgSHR0cCBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9IdHRwJ1xuaW1wb3J0IHtMaW5rfSBmcm9tICdyZWFjdC1yb3V0ZXInXG5cbi8qXG4gKiBMaXN0IHN0cnVjdHVyZSBpbiB0aGlzIGNvbXBvbmVudCBmb3IgYSBzZWxlY3RlZCB0YWJsZW5hbWVcbiAqL1xuXG5jbGFzcyBUYWJsZVN0cnVjdHVyZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICAgICAgY29sdW1uczogW11cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbXBvbmVudERpZE1vdW50KCkge1xuICAgICAgICB0aGlzLmxpc3RDb2x1bW5zKClcbiAgICB9XG5cbiAgICBsaXN0Q29sdW1ucygpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBkYm5hbWUgPSBzZWxmLnByb3BzLmRibmFtZVxuICAgICAgICBjb25zdCB0YWJsZW5hbWUgPSBzZWxmLnByb3BzLnRhYmxlbmFtZVxuXG4gICAgICAgIEh0dHAucG9zdChcIi90YWJsZS9jb2x1bW4vbGlzdFwiLCB7ZGJuYW1lOiBkYm5hbWUsIHRhYmxlbmFtZTogdGFibGVuYW1lfSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgICAgICBpZihyLmRhdGEuY29kZSA9PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VsZi5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnM6IHIuZGF0YS5wYXlsb2FkXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBzZWxmLnN0YXRlLmNvbHVtbnNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwidGFibGUgdGFibGUtc20gdGFibGUtaG92ZXIgdGFibGUtc3RyaXBlZFwiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5Db2x1bW48L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlR5cGU8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPk51bGw/PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5EZWZhdWx0PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5PcGVyYXRpb25zPC90aD5cbiAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5zLm1hcChmdW5jdGlvbiAoY29sLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpZHh9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KGNvbC5LZXkgPT0gXCJQUklcIikgPyA8c3Bhbj48aSBjbGFzc05hbWU9XCJmYSBmYS1rZXlcIj48L2k+Jm5ic3A7PC9zcGFuPiA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NvbC5GaWVsZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicG9pbnRlclwiPntjb2wuVHlwZX08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInBvaW50ZXJcIj57Y29sLk51bGx9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJwb2ludGVyXCI+e2NvbC5EZWZhdWx0fTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+IyM8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGFibGVTdHJ1Y3R1cmUiLCJpbXBvcnQgYXhpb3MgZnJvbSAnYXhpb3MnXG5cblxuY29uc3QgSHR0cCA9IHtcblxuICAgIHBvc3QodXJsLCBkYXRhKSB7XG5cbiAgICAgICAgaWYoIWRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEgPSB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGF4aW9zLnBvc3QodXJsLCBkYXRhKVxuICAgIH0sXG5cbiAgICBnZXQodXJsKSB7XG4gICAgICAgIHJldHVybiBheGlvcy5nZXQodXJsKVxuICAgIH0sXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSHR0cCIsImltcG9ydCB7YnJvd3Nlckhpc3Rvcnl9IGZyb20gJ3JlYWN0LXJvdXRlcidcblxuY29uc3QgVXRpbCA9IHtcblxuICAgIHJlZGlyZWN0KHVybCkge1xuICAgICAgICBicm93c2VySGlzdG9yeS5wdXNoKHVybClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVXRpbCJdfQ==

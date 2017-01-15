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

                self.listRows();
            });
        }
    }, {
        key: 'listRows',
        value: function listRows() {

            var self = this;
            var dbname = self.props.dbname;
            var tablename = self.props.tablename;

            _Http2.default.post("/table/rows", { dbname: dbname, tablename: tablename, page: self.state.page }).then(function (r) {

                if (r.data.code == 400) {
                    return;
                }

                self.setState({
                    rows: r.data.payload
                });
            });
        }
    }, {
        key: 'render',
        value: function render() {

            var self = this;
            var columns = self.state.columns;
            var rows = self.state.rows;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvQWN0aW9ucy5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9Bc3luY1V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL0Jyb3dzZXJQcm90b2NvbC5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9ET01TdGF0ZVN0b3JhZ2UuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvRE9NVXRpbHMuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvRXhlY3V0aW9uRW52aXJvbm1lbnQuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvTG9jYXRpb25VdGlscy5qcyIsIm5vZGVfbW9kdWxlcy9oaXN0b3J5L2xpYi9QYXRoVXRpbHMuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvUmVmcmVzaFByb3RvY29sLmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL2NyZWF0ZUJyb3dzZXJIaXN0b3J5LmpzIiwibm9kZV9tb2R1bGVzL2hpc3RvcnkvbGliL2NyZWF0ZUhpc3RvcnkuanMiLCJub2RlX21vZHVsZXMvaGlzdG9yeS9saWIvcnVuVHJhbnNpdGlvbkhvb2suanMiLCJub2RlX21vZHVsZXMvaW52YXJpYW50L2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3dhcm5pbmcvYnJvd3Nlci5qcyIsInB1YmxpYy9BcHAuanMiLCJwdWJsaWMvUm91dGVzLmpzIiwicHVibGljL2NvbXBvbmVudHMvU2lkZWJhci5qcyIsInB1YmxpYy9jb21wb25lbnRzL1RhYi5qcyIsInB1YmxpYy9jb21wb25lbnRzL1RhYnMuanMiLCJwdWJsaWMvcGFnZXMvRGF0YWJhc2VCcmVhZENydW1iLmpzIiwicHVibGljL3BhZ2VzL0hvbWVQYWdlLmpzIiwicHVibGljL3BhZ2VzL2RhdGFiYXNlL0RhdGFiYXNlUGFnZS5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS9UYWJsZVBhZ2UuanMiLCJwdWJsaWMvcGFnZXMvZGF0YWJhc2UvdGFibGUvdGFicy9yb3dzL1RhYmxlUm93cy5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3Jvd3MvY29tcG9uZW50L0NvbHVtbi5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3Jvd3MvY29tcG9uZW50L1Jvdy5qcyIsInB1YmxpYy9wYWdlcy9kYXRhYmFzZS90YWJsZS90YWJzL3N0cnVjdHVyZS9UYWJsZVN0cnVjdHVyZS5qcyIsInB1YmxpYy9zZXJ2aWNlcy9IdHRwLmpzIiwicHVibGljL3NlcnZpY2VzL1V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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ZixDQUFvQixHQUFwQjtBQUNIO0FBSlEsQ0FBYjs7a0JBUWUsSSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG4vKipcbiAqIEluZGljYXRlcyB0aGF0IG5hdmlnYXRpb24gd2FzIGNhdXNlZCBieSBhIGNhbGwgdG8gaGlzdG9yeS5wdXNoLlxuICovXG52YXIgUFVTSCA9IGV4cG9ydHMuUFVTSCA9ICdQVVNIJztcblxuLyoqXG4gKiBJbmRpY2F0ZXMgdGhhdCBuYXZpZ2F0aW9uIHdhcyBjYXVzZWQgYnkgYSBjYWxsIHRvIGhpc3RvcnkucmVwbGFjZS5cbiAqL1xudmFyIFJFUExBQ0UgPSBleHBvcnRzLlJFUExBQ0UgPSAnUkVQTEFDRSc7XG5cbi8qKlxuICogSW5kaWNhdGVzIHRoYXQgbmF2aWdhdGlvbiB3YXMgY2F1c2VkIGJ5IHNvbWUgb3RoZXIgYWN0aW9uIHN1Y2hcbiAqIGFzIHVzaW5nIGEgYnJvd3NlcidzIGJhY2svZm9yd2FyZCBidXR0b25zIGFuZC9vciBtYW51YWxseSBtYW5pcHVsYXRpbmdcbiAqIHRoZSBVUkwgaW4gYSBicm93c2VyJ3MgbG9jYXRpb24gYmFyLiBUaGlzIGlzIHRoZSBkZWZhdWx0LlxuICpcbiAqIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93RXZlbnRIYW5kbGVycy9vbnBvcHN0YXRlXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqL1xudmFyIFBPUCA9IGV4cG9ydHMuUE9QID0gJ1BPUCc7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG52YXIgbG9vcEFzeW5jID0gZXhwb3J0cy5sb29wQXN5bmMgPSBmdW5jdGlvbiBsb29wQXN5bmModHVybnMsIHdvcmssIGNhbGxiYWNrKSB7XG4gIHZhciBjdXJyZW50VHVybiA9IDAsXG4gICAgICBpc0RvbmUgPSBmYWxzZTtcbiAgdmFyIGlzU3luYyA9IGZhbHNlLFxuICAgICAgaGFzTmV4dCA9IGZhbHNlLFxuICAgICAgZG9uZUFyZ3MgPSB2b2lkIDA7XG5cbiAgdmFyIGRvbmUgPSBmdW5jdGlvbiBkb25lKCkge1xuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgICBhcmdzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICAgIH1cblxuICAgIGlzRG9uZSA9IHRydWU7XG5cbiAgICBpZiAoaXNTeW5jKSB7XG4gICAgICAvLyBJdGVyYXRlIGluc3RlYWQgb2YgcmVjdXJzaW5nIGlmIHBvc3NpYmxlLlxuICAgICAgZG9uZUFyZ3MgPSBhcmdzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNhbGxiYWNrLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7XG4gIH07XG5cbiAgdmFyIG5leHQgPSBmdW5jdGlvbiBuZXh0KCkge1xuICAgIGlmIChpc0RvbmUpIHJldHVybjtcblxuICAgIGhhc05leHQgPSB0cnVlO1xuXG4gICAgaWYgKGlzU3luYykgcmV0dXJuOyAvLyBJdGVyYXRlIGluc3RlYWQgb2YgcmVjdXJzaW5nIGlmIHBvc3NpYmxlLlxuXG4gICAgaXNTeW5jID0gdHJ1ZTtcblxuICAgIHdoaWxlICghaXNEb25lICYmIGN1cnJlbnRUdXJuIDwgdHVybnMgJiYgaGFzTmV4dCkge1xuICAgICAgaGFzTmV4dCA9IGZhbHNlO1xuICAgICAgd29yayhjdXJyZW50VHVybisrLCBuZXh0LCBkb25lKTtcbiAgICB9XG5cbiAgICBpc1N5bmMgPSBmYWxzZTtcblxuICAgIGlmIChpc0RvbmUpIHtcbiAgICAgIC8vIFRoaXMgbWVhbnMgdGhlIGxvb3AgZmluaXNoZWQgc3luY2hyb25vdXNseS5cbiAgICAgIGNhbGxiYWNrLmFwcGx5KHVuZGVmaW5lZCwgZG9uZUFyZ3MpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50VHVybiA+PSB0dXJucyAmJiBoYXNOZXh0KSB7XG4gICAgICBpc0RvbmUgPSB0cnVlO1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH07XG5cbiAgbmV4dCgpO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzLmdvID0gZXhwb3J0cy5yZXBsYWNlTG9jYXRpb24gPSBleHBvcnRzLnB1c2hMb2NhdGlvbiA9IGV4cG9ydHMuc3RhcnRMaXN0ZW5lciA9IGV4cG9ydHMuZ2V0VXNlckNvbmZpcm1hdGlvbiA9IGV4cG9ydHMuZ2V0Q3VycmVudExvY2F0aW9uID0gdW5kZWZpbmVkO1xuXG52YXIgX0xvY2F0aW9uVXRpbHMgPSByZXF1aXJlKCcuL0xvY2F0aW9uVXRpbHMnKTtcblxudmFyIF9ET01VdGlscyA9IHJlcXVpcmUoJy4vRE9NVXRpbHMnKTtcblxudmFyIF9ET01TdGF0ZVN0b3JhZ2UgPSByZXF1aXJlKCcuL0RPTVN0YXRlU3RvcmFnZScpO1xuXG52YXIgX1BhdGhVdGlscyA9IHJlcXVpcmUoJy4vUGF0aFV0aWxzJyk7XG5cbnZhciBfRXhlY3V0aW9uRW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL0V4ZWN1dGlvbkVudmlyb25tZW50Jyk7XG5cbnZhciBQb3BTdGF0ZUV2ZW50ID0gJ3BvcHN0YXRlJztcbnZhciBIYXNoQ2hhbmdlRXZlbnQgPSAnaGFzaGNoYW5nZSc7XG5cbnZhciBuZWVkc0hhc2hjaGFuZ2VMaXN0ZW5lciA9IF9FeGVjdXRpb25FbnZpcm9ubWVudC5jYW5Vc2VET00gJiYgISgwLCBfRE9NVXRpbHMuc3VwcG9ydHNQb3BzdGF0ZU9uSGFzaGNoYW5nZSkoKTtcblxudmFyIF9jcmVhdGVMb2NhdGlvbiA9IGZ1bmN0aW9uIF9jcmVhdGVMb2NhdGlvbihoaXN0b3J5U3RhdGUpIHtcbiAgdmFyIGtleSA9IGhpc3RvcnlTdGF0ZSAmJiBoaXN0b3J5U3RhdGUua2V5O1xuXG4gIHJldHVybiAoMCwgX0xvY2F0aW9uVXRpbHMuY3JlYXRlTG9jYXRpb24pKHtcbiAgICBwYXRobmFtZTogd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLFxuICAgIHNlYXJjaDogd2luZG93LmxvY2F0aW9uLnNlYXJjaCxcbiAgICBoYXNoOiB3aW5kb3cubG9jYXRpb24uaGFzaCxcbiAgICBzdGF0ZToga2V5ID8gKDAsIF9ET01TdGF0ZVN0b3JhZ2UucmVhZFN0YXRlKShrZXkpIDogdW5kZWZpbmVkXG4gIH0sIHVuZGVmaW5lZCwga2V5KTtcbn07XG5cbnZhciBnZXRDdXJyZW50TG9jYXRpb24gPSBleHBvcnRzLmdldEN1cnJlbnRMb2NhdGlvbiA9IGZ1bmN0aW9uIGdldEN1cnJlbnRMb2NhdGlvbigpIHtcbiAgdmFyIGhpc3RvcnlTdGF0ZSA9IHZvaWQgMDtcbiAgdHJ5IHtcbiAgICBoaXN0b3J5U3RhdGUgPSB3aW5kb3cuaGlzdG9yeS5zdGF0ZSB8fCB7fTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBJRSAxMSBzb21ldGltZXMgdGhyb3dzIHdoZW4gYWNjZXNzaW5nIHdpbmRvdy5oaXN0b3J5LnN0YXRlXG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdFRyYWluaW5nL2hpc3RvcnkvcHVsbC8yODlcbiAgICBoaXN0b3J5U3RhdGUgPSB7fTtcbiAgfVxuXG4gIHJldHVybiBfY3JlYXRlTG9jYXRpb24oaGlzdG9yeVN0YXRlKTtcbn07XG5cbnZhciBnZXRVc2VyQ29uZmlybWF0aW9uID0gZXhwb3J0cy5nZXRVc2VyQ29uZmlybWF0aW9uID0gZnVuY3Rpb24gZ2V0VXNlckNvbmZpcm1hdGlvbihtZXNzYWdlLCBjYWxsYmFjaykge1xuICByZXR1cm4gY2FsbGJhY2sod2luZG93LmNvbmZpcm0obWVzc2FnZSkpO1xufTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuXG52YXIgc3RhcnRMaXN0ZW5lciA9IGV4cG9ydHMuc3RhcnRMaXN0ZW5lciA9IGZ1bmN0aW9uIHN0YXJ0TGlzdGVuZXIobGlzdGVuZXIpIHtcbiAgdmFyIGhhbmRsZVBvcFN0YXRlID0gZnVuY3Rpb24gaGFuZGxlUG9wU3RhdGUoZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuc3RhdGUgIT09IHVuZGVmaW5lZCkgLy8gSWdub3JlIGV4dHJhbmVvdXMgcG9wc3RhdGUgZXZlbnRzIGluIFdlYktpdFxuICAgICAgbGlzdGVuZXIoX2NyZWF0ZUxvY2F0aW9uKGV2ZW50LnN0YXRlKSk7XG4gIH07XG5cbiAgKDAsIF9ET01VdGlscy5hZGRFdmVudExpc3RlbmVyKSh3aW5kb3csIFBvcFN0YXRlRXZlbnQsIGhhbmRsZVBvcFN0YXRlKTtcblxuICB2YXIgaGFuZGxlVW5wb3BwZWRIYXNoQ2hhbmdlID0gZnVuY3Rpb24gaGFuZGxlVW5wb3BwZWRIYXNoQ2hhbmdlKCkge1xuICAgIHJldHVybiBsaXN0ZW5lcihnZXRDdXJyZW50TG9jYXRpb24oKSk7XG4gIH07XG5cbiAgaWYgKG5lZWRzSGFzaGNoYW5nZUxpc3RlbmVyKSB7XG4gICAgKDAsIF9ET01VdGlscy5hZGRFdmVudExpc3RlbmVyKSh3aW5kb3csIEhhc2hDaGFuZ2VFdmVudCwgaGFuZGxlVW5wb3BwZWRIYXNoQ2hhbmdlKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgKDAsIF9ET01VdGlscy5yZW1vdmVFdmVudExpc3RlbmVyKSh3aW5kb3csIFBvcFN0YXRlRXZlbnQsIGhhbmRsZVBvcFN0YXRlKTtcblxuICAgIGlmIChuZWVkc0hhc2hjaGFuZ2VMaXN0ZW5lcikge1xuICAgICAgKDAsIF9ET01VdGlscy5yZW1vdmVFdmVudExpc3RlbmVyKSh3aW5kb3csIEhhc2hDaGFuZ2VFdmVudCwgaGFuZGxlVW5wb3BwZWRIYXNoQ2hhbmdlKTtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgdXBkYXRlTG9jYXRpb24gPSBmdW5jdGlvbiB1cGRhdGVMb2NhdGlvbihsb2NhdGlvbiwgdXBkYXRlU3RhdGUpIHtcbiAgdmFyIHN0YXRlID0gbG9jYXRpb24uc3RhdGU7XG4gIHZhciBrZXkgPSBsb2NhdGlvbi5rZXk7XG5cblxuICBpZiAoc3RhdGUgIT09IHVuZGVmaW5lZCkgKDAsIF9ET01TdGF0ZVN0b3JhZ2Uuc2F2ZVN0YXRlKShrZXksIHN0YXRlKTtcblxuICB1cGRhdGVTdGF0ZSh7IGtleToga2V5IH0sICgwLCBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgpKGxvY2F0aW9uKSk7XG59O1xuXG52YXIgcHVzaExvY2F0aW9uID0gZXhwb3J0cy5wdXNoTG9jYXRpb24gPSBmdW5jdGlvbiBwdXNoTG9jYXRpb24obG9jYXRpb24pIHtcbiAgcmV0dXJuIHVwZGF0ZUxvY2F0aW9uKGxvY2F0aW9uLCBmdW5jdGlvbiAoc3RhdGUsIHBhdGgpIHtcbiAgICByZXR1cm4gd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHN0YXRlLCBudWxsLCBwYXRoKTtcbiAgfSk7XG59O1xuXG52YXIgcmVwbGFjZUxvY2F0aW9uID0gZXhwb3J0cy5yZXBsYWNlTG9jYXRpb24gPSBmdW5jdGlvbiByZXBsYWNlTG9jYXRpb24obG9jYXRpb24pIHtcbiAgcmV0dXJuIHVwZGF0ZUxvY2F0aW9uKGxvY2F0aW9uLCBmdW5jdGlvbiAoc3RhdGUsIHBhdGgpIHtcbiAgICByZXR1cm4gd2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKHN0YXRlLCBudWxsLCBwYXRoKTtcbiAgfSk7XG59O1xuXG52YXIgZ28gPSBleHBvcnRzLmdvID0gZnVuY3Rpb24gZ28obikge1xuICBpZiAobikgd2luZG93Lmhpc3RvcnkuZ28obik7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMucmVhZFN0YXRlID0gZXhwb3J0cy5zYXZlU3RhdGUgPSB1bmRlZmluZWQ7XG5cbnZhciBfd2FybmluZyA9IHJlcXVpcmUoJ3dhcm5pbmcnKTtcblxudmFyIF93YXJuaW5nMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3dhcm5pbmcpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgUXVvdGFFeGNlZWRlZEVycm9ycyA9IHtcbiAgUXVvdGFFeGNlZWRlZEVycm9yOiB0cnVlLFxuICBRVU9UQV9FWENFRURFRF9FUlI6IHRydWVcbn07XG5cbnZhciBTZWN1cml0eUVycm9ycyA9IHtcbiAgU2VjdXJpdHlFcnJvcjogdHJ1ZVxufTtcblxudmFyIEtleVByZWZpeCA9ICdAQEhpc3RvcnkvJztcblxudmFyIGNyZWF0ZUtleSA9IGZ1bmN0aW9uIGNyZWF0ZUtleShrZXkpIHtcbiAgcmV0dXJuIEtleVByZWZpeCArIGtleTtcbn07XG5cbnZhciBzYXZlU3RhdGUgPSBleHBvcnRzLnNhdmVTdGF0ZSA9IGZ1bmN0aW9uIHNhdmVTdGF0ZShrZXksIHN0YXRlKSB7XG4gIGlmICghd2luZG93LnNlc3Npb25TdG9yYWdlKSB7XG4gICAgLy8gU2Vzc2lvbiBzdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgb3IgaGlkZGVuLlxuICAgIC8vIHNlc3Npb25TdG9yYWdlIGlzIHVuZGVmaW5lZCBpbiBJbnRlcm5ldCBFeHBsb3JlciB3aGVuIHNlcnZlZCB2aWEgZmlsZSBwcm90b2NvbC5cbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF93YXJuaW5nMi5kZWZhdWx0KShmYWxzZSwgJ1toaXN0b3J5XSBVbmFibGUgdG8gc2F2ZSBzdGF0ZTsgc2Vzc2lvblN0b3JhZ2UgaXMgbm90IGF2YWlsYWJsZScpIDogdm9pZCAwO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBpZiAoc3RhdGUgPT0gbnVsbCkge1xuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oY3JlYXRlS2V5KGtleSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShjcmVhdGVLZXkoa2V5KSwgSlNPTi5zdHJpbmdpZnkoc3RhdGUpKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKFNlY3VyaXR5RXJyb3JzW2Vycm9yLm5hbWVdKSB7XG4gICAgICAvLyBCbG9ja2luZyBjb29raWVzIGluIENocm9tZS9GaXJlZm94L1NhZmFyaSB0aHJvd3MgU2VjdXJpdHlFcnJvciBvbiBhbnlcbiAgICAgIC8vIGF0dGVtcHQgdG8gYWNjZXNzIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5cbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKGZhbHNlLCAnW2hpc3RvcnldIFVuYWJsZSB0byBzYXZlIHN0YXRlOyBzZXNzaW9uU3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGR1ZSB0byBzZWN1cml0eSBzZXR0aW5ncycpIDogdm9pZCAwO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKFF1b3RhRXhjZWVkZWRFcnJvcnNbZXJyb3IubmFtZV0gJiYgd2luZG93LnNlc3Npb25TdG9yYWdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gU2FmYXJpIFwicHJpdmF0ZSBtb2RlXCIgdGhyb3dzIFF1b3RhRXhjZWVkZWRFcnJvci5cbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKGZhbHNlLCAnW2hpc3RvcnldIFVuYWJsZSB0byBzYXZlIHN0YXRlOyBzZXNzaW9uU3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGluIFNhZmFyaSBwcml2YXRlIG1vZGUnKSA6IHZvaWQgMDtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG52YXIgcmVhZFN0YXRlID0gZXhwb3J0cy5yZWFkU3RhdGUgPSBmdW5jdGlvbiByZWFkU3RhdGUoa2V5KSB7XG4gIHZhciBqc29uID0gdm9pZCAwO1xuICB0cnkge1xuICAgIGpzb24gPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbShjcmVhdGVLZXkoa2V5KSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKFNlY3VyaXR5RXJyb3JzW2Vycm9yLm5hbWVdKSB7XG4gICAgICAvLyBCbG9ja2luZyBjb29raWVzIGluIENocm9tZS9GaXJlZm94L1NhZmFyaSB0aHJvd3MgU2VjdXJpdHlFcnJvciBvbiBhbnlcbiAgICAgIC8vIGF0dGVtcHQgdG8gYWNjZXNzIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5cbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX3dhcm5pbmcyLmRlZmF1bHQpKGZhbHNlLCAnW2hpc3RvcnldIFVuYWJsZSB0byByZWFkIHN0YXRlOyBzZXNzaW9uU3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGR1ZSB0byBzZWN1cml0eSBzZXR0aW5ncycpIDogdm9pZCAwO1xuXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIGlmIChqc29uKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKGpzb24pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAvLyBJZ25vcmUgaW52YWxpZCBKU09OLlxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbnZhciBhZGRFdmVudExpc3RlbmVyID0gZXhwb3J0cy5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihub2RlLCBldmVudCwgbGlzdGVuZXIpIHtcbiAgcmV0dXJuIG5vZGUuYWRkRXZlbnRMaXN0ZW5lciA/IG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIsIGZhbHNlKSA6IG5vZGUuYXR0YWNoRXZlbnQoJ29uJyArIGV2ZW50LCBsaXN0ZW5lcik7XG59O1xuXG52YXIgcmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGV4cG9ydHMucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIHJlbW92ZUV2ZW50TGlzdGVuZXIobm9kZSwgZXZlbnQsIGxpc3RlbmVyKSB7XG4gIHJldHVybiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPyBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBmYWxzZSkgOiBub2RlLmRldGFjaEV2ZW50KCdvbicgKyBldmVudCwgbGlzdGVuZXIpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIEhUTUw1IGhpc3RvcnkgQVBJIGlzIHN1cHBvcnRlZC4gVGFrZW4gZnJvbSBNb2Rlcm5penIuXG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL01vZGVybml6ci9Nb2Rlcm5penIvYmxvYi9tYXN0ZXIvTElDRU5TRVxuICogaHR0cHM6Ly9naXRodWIuY29tL01vZGVybml6ci9Nb2Rlcm5penIvYmxvYi9tYXN0ZXIvZmVhdHVyZS1kZXRlY3RzL2hpc3RvcnkuanNcbiAqIGNoYW5nZWQgdG8gYXZvaWQgZmFsc2UgbmVnYXRpdmVzIGZvciBXaW5kb3dzIFBob25lczogaHR0cHM6Ly9naXRodWIuY29tL3JlYWN0anMvcmVhY3Qtcm91dGVyL2lzc3Vlcy81ODZcbiAqL1xudmFyIHN1cHBvcnRzSGlzdG9yeSA9IGV4cG9ydHMuc3VwcG9ydHNIaXN0b3J5ID0gZnVuY3Rpb24gc3VwcG9ydHNIaXN0b3J5KCkge1xuICB2YXIgdWEgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudDtcblxuICBpZiAoKHVhLmluZGV4T2YoJ0FuZHJvaWQgMi4nKSAhPT0gLTEgfHwgdWEuaW5kZXhPZignQW5kcm9pZCA0LjAnKSAhPT0gLTEpICYmIHVhLmluZGV4T2YoJ01vYmlsZSBTYWZhcmknKSAhPT0gLTEgJiYgdWEuaW5kZXhPZignQ2hyb21lJykgPT09IC0xICYmIHVhLmluZGV4T2YoJ1dpbmRvd3MgUGhvbmUnKSA9PT0gLTEpIHJldHVybiBmYWxzZTtcblxuICByZXR1cm4gd2luZG93Lmhpc3RvcnkgJiYgJ3B1c2hTdGF0ZScgaW4gd2luZG93Lmhpc3Rvcnk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgZmFsc2UgaWYgdXNpbmcgZ28obikgd2l0aCBoYXNoIGhpc3RvcnkgY2F1c2VzIGEgZnVsbCBwYWdlIHJlbG9hZC5cbiAqL1xudmFyIHN1cHBvcnRzR29XaXRob3V0UmVsb2FkVXNpbmdIYXNoID0gZXhwb3J0cy5zdXBwb3J0c0dvV2l0aG91dFJlbG9hZFVzaW5nSGFzaCA9IGZ1bmN0aW9uIHN1cHBvcnRzR29XaXRob3V0UmVsb2FkVXNpbmdIYXNoKCkge1xuICByZXR1cm4gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignRmlyZWZveCcpID09PSAtMTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIGJyb3dzZXIgZmlyZXMgcG9wc3RhdGUgb24gaGFzaCBjaGFuZ2UuXG4gKiBJRTEwIGFuZCBJRTExIGRvIG5vdC5cbiAqL1xudmFyIHN1cHBvcnRzUG9wc3RhdGVPbkhhc2hjaGFuZ2UgPSBleHBvcnRzLnN1cHBvcnRzUG9wc3RhdGVPbkhhc2hjaGFuZ2UgPSBmdW5jdGlvbiBzdXBwb3J0c1BvcHN0YXRlT25IYXNoY2hhbmdlKCkge1xuICByZXR1cm4gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignVHJpZGVudCcpID09PSAtMTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xudmFyIGNhblVzZURPTSA9IGV4cG9ydHMuY2FuVXNlRE9NID0gISEodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmRvY3VtZW50ICYmIHdpbmRvdy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzLmxvY2F0aW9uc0FyZUVxdWFsID0gZXhwb3J0cy5zdGF0ZXNBcmVFcXVhbCA9IGV4cG9ydHMuY3JlYXRlTG9jYXRpb24gPSBleHBvcnRzLmNyZWF0ZVF1ZXJ5ID0gdW5kZWZpbmVkO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxudmFyIF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTtcblxudmFyIF9pbnZhcmlhbnQgPSByZXF1aXJlKCdpbnZhcmlhbnQnKTtcblxudmFyIF9pbnZhcmlhbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaW52YXJpYW50KTtcblxudmFyIF93YXJuaW5nID0gcmVxdWlyZSgnd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbnZhciBfUGF0aFV0aWxzID0gcmVxdWlyZSgnLi9QYXRoVXRpbHMnKTtcblxudmFyIF9BY3Rpb25zID0gcmVxdWlyZSgnLi9BY3Rpb25zJyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBjcmVhdGVRdWVyeSA9IGV4cG9ydHMuY3JlYXRlUXVlcnkgPSBmdW5jdGlvbiBjcmVhdGVRdWVyeShwcm9wcykge1xuICByZXR1cm4gX2V4dGVuZHMoT2JqZWN0LmNyZWF0ZShudWxsKSwgcHJvcHMpO1xufTtcblxudmFyIGNyZWF0ZUxvY2F0aW9uID0gZXhwb3J0cy5jcmVhdGVMb2NhdGlvbiA9IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uKCkge1xuICB2YXIgaW5wdXQgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyAnLycgOiBhcmd1bWVudHNbMF07XG4gIHZhciBhY3Rpb24gPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyBfQWN0aW9ucy5QT1AgOiBhcmd1bWVudHNbMV07XG4gIHZhciBrZXkgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDIgfHwgYXJndW1lbnRzWzJdID09PSB1bmRlZmluZWQgPyBudWxsIDogYXJndW1lbnRzWzJdO1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnID8gKDAsIF9QYXRoVXRpbHMucGFyc2VQYXRoKShpbnB1dCkgOiBpbnB1dDtcblxuICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF93YXJuaW5nMi5kZWZhdWx0KSghb2JqZWN0LnBhdGgsICdMb2NhdGlvbiBkZXNjcmlwdG9yIG9iamVjdHMgc2hvdWxkIGhhdmUgYSBgcGF0aG5hbWVgLCBub3QgYSBgcGF0aGAuJykgOiB2b2lkIDA7XG5cbiAgdmFyIHBhdGhuYW1lID0gb2JqZWN0LnBhdGhuYW1lIHx8ICcvJztcbiAgdmFyIHNlYXJjaCA9IG9iamVjdC5zZWFyY2ggfHwgJyc7XG4gIHZhciBoYXNoID0gb2JqZWN0Lmhhc2ggfHwgJyc7XG4gIHZhciBzdGF0ZSA9IG9iamVjdC5zdGF0ZTtcblxuICByZXR1cm4ge1xuICAgIHBhdGhuYW1lOiBwYXRobmFtZSxcbiAgICBzZWFyY2g6IHNlYXJjaCxcbiAgICBoYXNoOiBoYXNoLFxuICAgIHN0YXRlOiBzdGF0ZSxcbiAgICBhY3Rpb246IGFjdGlvbixcbiAgICBrZXk6IGtleVxuICB9O1xufTtcblxudmFyIGlzRGF0ZSA9IGZ1bmN0aW9uIGlzRGF0ZShvYmplY3QpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09PSAnW29iamVjdCBEYXRlXSc7XG59O1xuXG52YXIgc3RhdGVzQXJlRXF1YWwgPSBleHBvcnRzLnN0YXRlc0FyZUVxdWFsID0gZnVuY3Rpb24gc3RhdGVzQXJlRXF1YWwoYSwgYikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG5cbiAgdmFyIHR5cGVvZkEgPSB0eXBlb2YgYSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoYSk7XG4gIHZhciB0eXBlb2ZCID0gdHlwZW9mIGIgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGIpO1xuXG4gIGlmICh0eXBlb2ZBICE9PSB0eXBlb2ZCKSByZXR1cm4gZmFsc2U7XG5cbiAgISh0eXBlb2ZBICE9PSAnZnVuY3Rpb24nKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyAoMCwgX2ludmFyaWFudDIuZGVmYXVsdCkoZmFsc2UsICdZb3UgbXVzdCBub3Qgc3RvcmUgZnVuY3Rpb25zIGluIGxvY2F0aW9uIHN0YXRlJykgOiAoMCwgX2ludmFyaWFudDIuZGVmYXVsdCkoZmFsc2UpIDogdm9pZCAwO1xuXG4gIC8vIE5vdCB0aGUgc2FtZSBvYmplY3QsIGJ1dCBzYW1lIHR5cGUuXG4gIGlmICh0eXBlb2ZBID09PSAnb2JqZWN0Jykge1xuICAgICEhKGlzRGF0ZShhKSAmJiBpc0RhdGUoYikpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KShmYWxzZSwgJ1lvdSBtdXN0IG5vdCBzdG9yZSBEYXRlIG9iamVjdHMgaW4gbG9jYXRpb24gc3RhdGUnKSA6ICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KShmYWxzZSkgOiB2b2lkIDA7XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYSkpIHtcbiAgICAgIHZhciBrZXlzb2ZBID0gT2JqZWN0LmtleXMoYSk7XG4gICAgICB2YXIga2V5c29mQiA9IE9iamVjdC5rZXlzKGIpO1xuICAgICAgcmV0dXJuIGtleXNvZkEubGVuZ3RoID09PSBrZXlzb2ZCLmxlbmd0aCAmJiBrZXlzb2ZBLmV2ZXJ5KGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlc0FyZUVxdWFsKGFba2V5XSwgYltrZXldKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGIpICYmIGEubGVuZ3RoID09PSBiLmxlbmd0aCAmJiBhLmV2ZXJ5KGZ1bmN0aW9uIChpdGVtLCBpbmRleCkge1xuICAgICAgcmV0dXJuIHN0YXRlc0FyZUVxdWFsKGl0ZW0sIGJbaW5kZXhdKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEFsbCBvdGhlciBzZXJpYWxpemFibGUgdHlwZXMgKHN0cmluZywgbnVtYmVyLCBib29sZWFuKVxuICAvLyBzaG91bGQgYmUgc3RyaWN0IGVxdWFsLlxuICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgbG9jYXRpb25zQXJlRXF1YWwgPSBleHBvcnRzLmxvY2F0aW9uc0FyZUVxdWFsID0gZnVuY3Rpb24gbG9jYXRpb25zQXJlRXF1YWwoYSwgYikge1xuICByZXR1cm4gYS5rZXkgPT09IGIua2V5ICYmXG4gIC8vIGEuYWN0aW9uID09PSBiLmFjdGlvbiAmJiAvLyBEaWZmZXJlbnQgYWN0aW9uICE9PSBsb2NhdGlvbiBjaGFuZ2UuXG4gIGEucGF0aG5hbWUgPT09IGIucGF0aG5hbWUgJiYgYS5zZWFyY2ggPT09IGIuc2VhcmNoICYmIGEuaGFzaCA9PT0gYi5oYXNoICYmIHN0YXRlc0FyZUVxdWFsKGEuc3RhdGUsIGIuc3RhdGUpO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5leHBvcnRzLmNyZWF0ZVBhdGggPSBleHBvcnRzLnBhcnNlUGF0aCA9IGV4cG9ydHMuZ2V0UXVlcnlTdHJpbmdWYWx1ZUZyb21QYXRoID0gZXhwb3J0cy5zdHJpcFF1ZXJ5U3RyaW5nVmFsdWVGcm9tUGF0aCA9IGV4cG9ydHMuYWRkUXVlcnlTdHJpbmdWYWx1ZVRvUGF0aCA9IHVuZGVmaW5lZDtcblxudmFyIF93YXJuaW5nID0gcmVxdWlyZSgnd2FybmluZycpO1xuXG52YXIgX3dhcm5pbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2FybmluZyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBhZGRRdWVyeVN0cmluZ1ZhbHVlVG9QYXRoID0gZXhwb3J0cy5hZGRRdWVyeVN0cmluZ1ZhbHVlVG9QYXRoID0gZnVuY3Rpb24gYWRkUXVlcnlTdHJpbmdWYWx1ZVRvUGF0aChwYXRoLCBrZXksIHZhbHVlKSB7XG4gIHZhciBfcGFyc2VQYXRoID0gcGFyc2VQYXRoKHBhdGgpO1xuXG4gIHZhciBwYXRobmFtZSA9IF9wYXJzZVBhdGgucGF0aG5hbWU7XG4gIHZhciBzZWFyY2ggPSBfcGFyc2VQYXRoLnNlYXJjaDtcbiAgdmFyIGhhc2ggPSBfcGFyc2VQYXRoLmhhc2g7XG5cblxuICByZXR1cm4gY3JlYXRlUGF0aCh7XG4gICAgcGF0aG5hbWU6IHBhdGhuYW1lLFxuICAgIHNlYXJjaDogc2VhcmNoICsgKHNlYXJjaC5pbmRleE9mKCc/JykgPT09IC0xID8gJz8nIDogJyYnKSArIGtleSArICc9JyArIHZhbHVlLFxuICAgIGhhc2g6IGhhc2hcbiAgfSk7XG59O1xuXG52YXIgc3RyaXBRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGggPSBleHBvcnRzLnN0cmlwUXVlcnlTdHJpbmdWYWx1ZUZyb21QYXRoID0gZnVuY3Rpb24gc3RyaXBRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGgocGF0aCwga2V5KSB7XG4gIHZhciBfcGFyc2VQYXRoMiA9IHBhcnNlUGF0aChwYXRoKTtcblxuICB2YXIgcGF0aG5hbWUgPSBfcGFyc2VQYXRoMi5wYXRobmFtZTtcbiAgdmFyIHNlYXJjaCA9IF9wYXJzZVBhdGgyLnNlYXJjaDtcbiAgdmFyIGhhc2ggPSBfcGFyc2VQYXRoMi5oYXNoO1xuXG5cbiAgcmV0dXJuIGNyZWF0ZVBhdGgoe1xuICAgIHBhdGhuYW1lOiBwYXRobmFtZSxcbiAgICBzZWFyY2g6IHNlYXJjaC5yZXBsYWNlKG5ldyBSZWdFeHAoJyhbPyZdKScgKyBrZXkgKyAnPVthLXpBLVowLTldKygmPyknKSwgZnVuY3Rpb24gKG1hdGNoLCBwcmVmaXgsIHN1ZmZpeCkge1xuICAgICAgcmV0dXJuIHByZWZpeCA9PT0gJz8nID8gcHJlZml4IDogc3VmZml4O1xuICAgIH0pLFxuICAgIGhhc2g6IGhhc2hcbiAgfSk7XG59O1xuXG52YXIgZ2V0UXVlcnlTdHJpbmdWYWx1ZUZyb21QYXRoID0gZXhwb3J0cy5nZXRRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGggPSBmdW5jdGlvbiBnZXRRdWVyeVN0cmluZ1ZhbHVlRnJvbVBhdGgocGF0aCwga2V5KSB7XG4gIHZhciBfcGFyc2VQYXRoMyA9IHBhcnNlUGF0aChwYXRoKTtcblxuICB2YXIgc2VhcmNoID0gX3BhcnNlUGF0aDMuc2VhcmNoO1xuXG4gIHZhciBtYXRjaCA9IHNlYXJjaC5tYXRjaChuZXcgUmVnRXhwKCdbPyZdJyArIGtleSArICc9KFthLXpBLVowLTldKyknKSk7XG4gIHJldHVybiBtYXRjaCAmJiBtYXRjaFsxXTtcbn07XG5cbnZhciBleHRyYWN0UGF0aCA9IGZ1bmN0aW9uIGV4dHJhY3RQYXRoKHN0cmluZykge1xuICB2YXIgbWF0Y2ggPSBzdHJpbmcubWF0Y2goL14oaHR0cHM/Oik/XFwvXFwvW15cXC9dKi8pO1xuICByZXR1cm4gbWF0Y2ggPT0gbnVsbCA/IHN0cmluZyA6IHN0cmluZy5zdWJzdHJpbmcobWF0Y2hbMF0ubGVuZ3RoKTtcbn07XG5cbnZhciBwYXJzZVBhdGggPSBleHBvcnRzLnBhcnNlUGF0aCA9IGZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoKSB7XG4gIHZhciBwYXRobmFtZSA9IGV4dHJhY3RQYXRoKHBhdGgpO1xuICB2YXIgc2VhcmNoID0gJyc7XG4gIHZhciBoYXNoID0gJyc7XG5cbiAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfd2FybmluZzIuZGVmYXVsdCkocGF0aCA9PT0gcGF0aG5hbWUsICdBIHBhdGggbXVzdCBiZSBwYXRobmFtZSArIHNlYXJjaCArIGhhc2ggb25seSwgbm90IGEgZnVsbCBVUkwgbGlrZSBcIiVzXCInLCBwYXRoKSA6IHZvaWQgMDtcblxuICB2YXIgaGFzaEluZGV4ID0gcGF0aG5hbWUuaW5kZXhPZignIycpO1xuICBpZiAoaGFzaEluZGV4ICE9PSAtMSkge1xuICAgIGhhc2ggPSBwYXRobmFtZS5zdWJzdHJpbmcoaGFzaEluZGV4KTtcbiAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnN1YnN0cmluZygwLCBoYXNoSW5kZXgpO1xuICB9XG5cbiAgdmFyIHNlYXJjaEluZGV4ID0gcGF0aG5hbWUuaW5kZXhPZignPycpO1xuICBpZiAoc2VhcmNoSW5kZXggIT09IC0xKSB7XG4gICAgc2VhcmNoID0gcGF0aG5hbWUuc3Vic3RyaW5nKHNlYXJjaEluZGV4KTtcbiAgICBwYXRobmFtZSA9IHBhdGhuYW1lLnN1YnN0cmluZygwLCBzZWFyY2hJbmRleCk7XG4gIH1cblxuICBpZiAocGF0aG5hbWUgPT09ICcnKSBwYXRobmFtZSA9ICcvJztcblxuICByZXR1cm4ge1xuICAgIHBhdGhuYW1lOiBwYXRobmFtZSxcbiAgICBzZWFyY2g6IHNlYXJjaCxcbiAgICBoYXNoOiBoYXNoXG4gIH07XG59O1xuXG52YXIgY3JlYXRlUGF0aCA9IGV4cG9ydHMuY3JlYXRlUGF0aCA9IGZ1bmN0aW9uIGNyZWF0ZVBhdGgobG9jYXRpb24pIHtcbiAgaWYgKGxvY2F0aW9uID09IG51bGwgfHwgdHlwZW9mIGxvY2F0aW9uID09PSAnc3RyaW5nJykgcmV0dXJuIGxvY2F0aW9uO1xuXG4gIHZhciBiYXNlbmFtZSA9IGxvY2F0aW9uLmJhc2VuYW1lO1xuICB2YXIgcGF0aG5hbWUgPSBsb2NhdGlvbi5wYXRobmFtZTtcbiAgdmFyIHNlYXJjaCA9IGxvY2F0aW9uLnNlYXJjaDtcbiAgdmFyIGhhc2ggPSBsb2NhdGlvbi5oYXNoO1xuXG4gIHZhciBwYXRoID0gKGJhc2VuYW1lIHx8ICcnKSArIHBhdGhuYW1lO1xuXG4gIGlmIChzZWFyY2ggJiYgc2VhcmNoICE9PSAnPycpIHBhdGggKz0gc2VhcmNoO1xuXG4gIGlmIChoYXNoKSBwYXRoICs9IGhhc2g7XG5cbiAgcmV0dXJuIHBhdGg7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcbmV4cG9ydHMucmVwbGFjZUxvY2F0aW9uID0gZXhwb3J0cy5wdXNoTG9jYXRpb24gPSBleHBvcnRzLmdldEN1cnJlbnRMb2NhdGlvbiA9IGV4cG9ydHMuZ28gPSBleHBvcnRzLmdldFVzZXJDb25maXJtYXRpb24gPSB1bmRlZmluZWQ7XG5cbnZhciBfQnJvd3NlclByb3RvY29sID0gcmVxdWlyZSgnLi9Ccm93c2VyUHJvdG9jb2wnKTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdnZXRVc2VyQ29uZmlybWF0aW9uJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICByZXR1cm4gX0Jyb3dzZXJQcm90b2NvbC5nZXRVc2VyQ29uZmlybWF0aW9uO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnZ28nLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiBfQnJvd3NlclByb3RvY29sLmdvO1xuICB9XG59KTtcblxudmFyIF9Mb2NhdGlvblV0aWxzID0gcmVxdWlyZSgnLi9Mb2NhdGlvblV0aWxzJyk7XG5cbnZhciBfUGF0aFV0aWxzID0gcmVxdWlyZSgnLi9QYXRoVXRpbHMnKTtcblxudmFyIGdldEN1cnJlbnRMb2NhdGlvbiA9IGV4cG9ydHMuZ2V0Q3VycmVudExvY2F0aW9uID0gZnVuY3Rpb24gZ2V0Q3VycmVudExvY2F0aW9uKCkge1xuICByZXR1cm4gKDAsIF9Mb2NhdGlvblV0aWxzLmNyZWF0ZUxvY2F0aW9uKSh3aW5kb3cubG9jYXRpb24pO1xufTtcblxudmFyIHB1c2hMb2NhdGlvbiA9IGV4cG9ydHMucHVzaExvY2F0aW9uID0gZnVuY3Rpb24gcHVzaExvY2F0aW9uKGxvY2F0aW9uKSB7XG4gIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gKDAsIF9QYXRoVXRpbHMuY3JlYXRlUGF0aCkobG9jYXRpb24pO1xuICByZXR1cm4gZmFsc2U7IC8vIERvbid0IHVwZGF0ZSBsb2NhdGlvblxufTtcblxudmFyIHJlcGxhY2VMb2NhdGlvbiA9IGV4cG9ydHMucmVwbGFjZUxvY2F0aW9uID0gZnVuY3Rpb24gcmVwbGFjZUxvY2F0aW9uKGxvY2F0aW9uKSB7XG4gIHdpbmRvdy5sb2NhdGlvbi5yZXBsYWNlKCgwLCBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgpKGxvY2F0aW9uKSk7XG4gIHJldHVybiBmYWxzZTsgLy8gRG9uJ3QgdXBkYXRlIGxvY2F0aW9uXG59OyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTtcblxudmFyIF9pbnZhcmlhbnQgPSByZXF1aXJlKCdpbnZhcmlhbnQnKTtcblxudmFyIF9pbnZhcmlhbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaW52YXJpYW50KTtcblxudmFyIF9FeGVjdXRpb25FbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4vRXhlY3V0aW9uRW52aXJvbm1lbnQnKTtcblxudmFyIF9Ccm93c2VyUHJvdG9jb2wgPSByZXF1aXJlKCcuL0Jyb3dzZXJQcm90b2NvbCcpO1xuXG52YXIgQnJvd3NlclByb3RvY29sID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX0Jyb3dzZXJQcm90b2NvbCk7XG5cbnZhciBfUmVmcmVzaFByb3RvY29sID0gcmVxdWlyZSgnLi9SZWZyZXNoUHJvdG9jb2wnKTtcblxudmFyIFJlZnJlc2hQcm90b2NvbCA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9SZWZyZXNoUHJvdG9jb2wpO1xuXG52YXIgX0RPTVV0aWxzID0gcmVxdWlyZSgnLi9ET01VdGlscycpO1xuXG52YXIgX2NyZWF0ZUhpc3RvcnkgPSByZXF1aXJlKCcuL2NyZWF0ZUhpc3RvcnknKTtcblxudmFyIF9jcmVhdGVIaXN0b3J5MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUhpc3RvcnkpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChvYmopIHsgaWYgKG9iaiAmJiBvYmouX19lc01vZHVsZSkgeyByZXR1cm4gb2JqOyB9IGVsc2UgeyB2YXIgbmV3T2JqID0ge307IGlmIChvYmogIT0gbnVsbCkgeyBmb3IgKHZhciBrZXkgaW4gb2JqKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSBuZXdPYmpba2V5XSA9IG9ialtrZXldOyB9IH0gbmV3T2JqLmRlZmF1bHQgPSBvYmo7IHJldHVybiBuZXdPYmo7IH0gfVxuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG4vKipcbiAqIENyZWF0ZXMgYW5kIHJldHVybnMgYSBoaXN0b3J5IG9iamVjdCB0aGF0IHVzZXMgSFRNTDUncyBoaXN0b3J5IEFQSVxuICogKHB1c2hTdGF0ZSwgcmVwbGFjZVN0YXRlLCBhbmQgdGhlIHBvcHN0YXRlIGV2ZW50KSB0byBtYW5hZ2UgaGlzdG9yeS5cbiAqIFRoaXMgaXMgdGhlIHJlY29tbWVuZGVkIG1ldGhvZCBvZiBtYW5hZ2luZyBoaXN0b3J5IGluIGJyb3dzZXJzIGJlY2F1c2VcbiAqIGl0IHByb3ZpZGVzIHRoZSBjbGVhbmVzdCBVUkxzLlxuICpcbiAqIE5vdGU6IEluIGJyb3dzZXJzIHRoYXQgZG8gbm90IHN1cHBvcnQgdGhlIEhUTUw1IGhpc3RvcnkgQVBJIGZ1bGxcbiAqIHBhZ2UgcmVsb2FkcyB3aWxsIGJlIHVzZWQgdG8gcHJlc2VydmUgY2xlYW4gVVJMcy4gWW91IGNhbiBmb3JjZSB0aGlzXG4gKiBiZWhhdmlvciB1c2luZyB7IGZvcmNlUmVmcmVzaDogdHJ1ZSB9IGluIG9wdGlvbnMuXG4gKi9cbnZhciBjcmVhdGVCcm93c2VySGlzdG9yeSA9IGZ1bmN0aW9uIGNyZWF0ZUJyb3dzZXJIaXN0b3J5KCkge1xuICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gICFfRXhlY3V0aW9uRW52aXJvbm1lbnQuY2FuVXNlRE9NID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/ICgwLCBfaW52YXJpYW50Mi5kZWZhdWx0KShmYWxzZSwgJ0Jyb3dzZXIgaGlzdG9yeSBuZWVkcyBhIERPTScpIDogKDAsIF9pbnZhcmlhbnQyLmRlZmF1bHQpKGZhbHNlKSA6IHZvaWQgMDtcblxuICB2YXIgdXNlUmVmcmVzaCA9IG9wdGlvbnMuZm9yY2VSZWZyZXNoIHx8ICEoMCwgX0RPTVV0aWxzLnN1cHBvcnRzSGlzdG9yeSkoKTtcbiAgdmFyIFByb3RvY29sID0gdXNlUmVmcmVzaCA/IFJlZnJlc2hQcm90b2NvbCA6IEJyb3dzZXJQcm90b2NvbDtcblxuICB2YXIgZ2V0VXNlckNvbmZpcm1hdGlvbiA9IFByb3RvY29sLmdldFVzZXJDb25maXJtYXRpb247XG4gIHZhciBnZXRDdXJyZW50TG9jYXRpb24gPSBQcm90b2NvbC5nZXRDdXJyZW50TG9jYXRpb247XG4gIHZhciBwdXNoTG9jYXRpb24gPSBQcm90b2NvbC5wdXNoTG9jYXRpb247XG4gIHZhciByZXBsYWNlTG9jYXRpb24gPSBQcm90b2NvbC5yZXBsYWNlTG9jYXRpb247XG4gIHZhciBnbyA9IFByb3RvY29sLmdvO1xuXG5cbiAgdmFyIGhpc3RvcnkgPSAoMCwgX2NyZWF0ZUhpc3RvcnkyLmRlZmF1bHQpKF9leHRlbmRzKHtcbiAgICBnZXRVc2VyQ29uZmlybWF0aW9uOiBnZXRVc2VyQ29uZmlybWF0aW9uIH0sIG9wdGlvbnMsIHtcbiAgICBnZXRDdXJyZW50TG9jYXRpb246IGdldEN1cnJlbnRMb2NhdGlvbixcbiAgICBwdXNoTG9jYXRpb246IHB1c2hMb2NhdGlvbixcbiAgICByZXBsYWNlTG9jYXRpb246IHJlcGxhY2VMb2NhdGlvbixcbiAgICBnbzogZ29cbiAgfSkpO1xuXG4gIHZhciBsaXN0ZW5lckNvdW50ID0gMCxcbiAgICAgIHN0b3BMaXN0ZW5lciA9IHZvaWQgMDtcblxuICB2YXIgc3RhcnRMaXN0ZW5lciA9IGZ1bmN0aW9uIHN0YXJ0TGlzdGVuZXIobGlzdGVuZXIsIGJlZm9yZSkge1xuICAgIGlmICgrK2xpc3RlbmVyQ291bnQgPT09IDEpIHN0b3BMaXN0ZW5lciA9IEJyb3dzZXJQcm90b2NvbC5zdGFydExpc3RlbmVyKGhpc3RvcnkudHJhbnNpdGlvblRvKTtcblxuICAgIHZhciB1bmxpc3RlbiA9IGJlZm9yZSA/IGhpc3RvcnkubGlzdGVuQmVmb3JlKGxpc3RlbmVyKSA6IGhpc3RvcnkubGlzdGVuKGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB1bmxpc3RlbigpO1xuXG4gICAgICBpZiAoLS1saXN0ZW5lckNvdW50ID09PSAwKSBzdG9wTGlzdGVuZXIoKTtcbiAgICB9O1xuICB9O1xuXG4gIHZhciBsaXN0ZW5CZWZvcmUgPSBmdW5jdGlvbiBsaXN0ZW5CZWZvcmUobGlzdGVuZXIpIHtcbiAgICByZXR1cm4gc3RhcnRMaXN0ZW5lcihsaXN0ZW5lciwgdHJ1ZSk7XG4gIH07XG5cbiAgdmFyIGxpc3RlbiA9IGZ1bmN0aW9uIGxpc3RlbihsaXN0ZW5lcikge1xuICAgIHJldHVybiBzdGFydExpc3RlbmVyKGxpc3RlbmVyLCBmYWxzZSk7XG4gIH07XG5cbiAgcmV0dXJuIF9leHRlbmRzKHt9LCBoaXN0b3J5LCB7XG4gICAgbGlzdGVuQmVmb3JlOiBsaXN0ZW5CZWZvcmUsXG4gICAgbGlzdGVuOiBsaXN0ZW5cbiAgfSk7XG59O1xuXG5leHBvcnRzLmRlZmF1bHQgPSBjcmVhdGVCcm93c2VySGlzdG9yeTsiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfQXN5bmNVdGlscyA9IHJlcXVpcmUoJy4vQXN5bmNVdGlscycpO1xuXG52YXIgX1BhdGhVdGlscyA9IHJlcXVpcmUoJy4vUGF0aFV0aWxzJyk7XG5cbnZhciBfcnVuVHJhbnNpdGlvbkhvb2sgPSByZXF1aXJlKCcuL3J1blRyYW5zaXRpb25Ib29rJyk7XG5cbnZhciBfcnVuVHJhbnNpdGlvbkhvb2syID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcnVuVHJhbnNpdGlvbkhvb2spO1xuXG52YXIgX0FjdGlvbnMgPSByZXF1aXJlKCcuL0FjdGlvbnMnKTtcblxudmFyIF9Mb2NhdGlvblV0aWxzID0gcmVxdWlyZSgnLi9Mb2NhdGlvblV0aWxzJyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBjcmVhdGVIaXN0b3J5ID0gZnVuY3Rpb24gY3JlYXRlSGlzdG9yeSgpIHtcbiAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcbiAgdmFyIGdldEN1cnJlbnRMb2NhdGlvbiA9IG9wdGlvbnMuZ2V0Q3VycmVudExvY2F0aW9uO1xuICB2YXIgZ2V0VXNlckNvbmZpcm1hdGlvbiA9IG9wdGlvbnMuZ2V0VXNlckNvbmZpcm1hdGlvbjtcbiAgdmFyIHB1c2hMb2NhdGlvbiA9IG9wdGlvbnMucHVzaExvY2F0aW9uO1xuICB2YXIgcmVwbGFjZUxvY2F0aW9uID0gb3B0aW9ucy5yZXBsYWNlTG9jYXRpb247XG4gIHZhciBnbyA9IG9wdGlvbnMuZ287XG4gIHZhciBrZXlMZW5ndGggPSBvcHRpb25zLmtleUxlbmd0aDtcblxuXG4gIHZhciBjdXJyZW50TG9jYXRpb24gPSB2b2lkIDA7XG4gIHZhciBwZW5kaW5nTG9jYXRpb24gPSB2b2lkIDA7XG4gIHZhciBiZWZvcmVMaXN0ZW5lcnMgPSBbXTtcbiAgdmFyIGxpc3RlbmVycyA9IFtdO1xuICB2YXIgYWxsS2V5cyA9IFtdO1xuXG4gIHZhciBnZXRDdXJyZW50SW5kZXggPSBmdW5jdGlvbiBnZXRDdXJyZW50SW5kZXgoKSB7XG4gICAgaWYgKHBlbmRpbmdMb2NhdGlvbiAmJiBwZW5kaW5nTG9jYXRpb24uYWN0aW9uID09PSBfQWN0aW9ucy5QT1ApIHJldHVybiBhbGxLZXlzLmluZGV4T2YocGVuZGluZ0xvY2F0aW9uLmtleSk7XG5cbiAgICBpZiAoY3VycmVudExvY2F0aW9uKSByZXR1cm4gYWxsS2V5cy5pbmRleE9mKGN1cnJlbnRMb2NhdGlvbi5rZXkpO1xuXG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIHZhciB1cGRhdGVMb2NhdGlvbiA9IGZ1bmN0aW9uIHVwZGF0ZUxvY2F0aW9uKG5leHRMb2NhdGlvbikge1xuICAgIHZhciBjdXJyZW50SW5kZXggPSBnZXRDdXJyZW50SW5kZXgoKTtcblxuICAgIGN1cnJlbnRMb2NhdGlvbiA9IG5leHRMb2NhdGlvbjtcblxuICAgIGlmIChjdXJyZW50TG9jYXRpb24uYWN0aW9uID09PSBfQWN0aW9ucy5QVVNIKSB7XG4gICAgICBhbGxLZXlzID0gW10uY29uY2F0KGFsbEtleXMuc2xpY2UoMCwgY3VycmVudEluZGV4ICsgMSksIFtjdXJyZW50TG9jYXRpb24ua2V5XSk7XG4gICAgfSBlbHNlIGlmIChjdXJyZW50TG9jYXRpb24uYWN0aW9uID09PSBfQWN0aW9ucy5SRVBMQUNFKSB7XG4gICAgICBhbGxLZXlzW2N1cnJlbnRJbmRleF0gPSBjdXJyZW50TG9jYXRpb24ua2V5O1xuICAgIH1cblxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChsaXN0ZW5lcikge1xuICAgICAgcmV0dXJuIGxpc3RlbmVyKGN1cnJlbnRMb2NhdGlvbik7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIGxpc3RlbkJlZm9yZSA9IGZ1bmN0aW9uIGxpc3RlbkJlZm9yZShsaXN0ZW5lcikge1xuICAgIGJlZm9yZUxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYmVmb3JlTGlzdGVuZXJzID0gYmVmb3JlTGlzdGVuZXJzLmZpbHRlcihmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbSAhPT0gbGlzdGVuZXI7XG4gICAgICB9KTtcbiAgICB9O1xuICB9O1xuXG4gIHZhciBsaXN0ZW4gPSBmdW5jdGlvbiBsaXN0ZW4obGlzdGVuZXIpIHtcbiAgICBsaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGxpc3RlbmVycyA9IGxpc3RlbmVycy5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0gIT09IGxpc3RlbmVyO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfTtcblxuICB2YXIgY29uZmlybVRyYW5zaXRpb25UbyA9IGZ1bmN0aW9uIGNvbmZpcm1UcmFuc2l0aW9uVG8obG9jYXRpb24sIGNhbGxiYWNrKSB7XG4gICAgKDAsIF9Bc3luY1V0aWxzLmxvb3BBc3luYykoYmVmb3JlTGlzdGVuZXJzLmxlbmd0aCwgZnVuY3Rpb24gKGluZGV4LCBuZXh0LCBkb25lKSB7XG4gICAgICAoMCwgX3J1blRyYW5zaXRpb25Ib29rMi5kZWZhdWx0KShiZWZvcmVMaXN0ZW5lcnNbaW5kZXhdLCBsb2NhdGlvbiwgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0ICE9IG51bGwgPyBkb25lKHJlc3VsdCkgOiBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgICAgaWYgKGdldFVzZXJDb25maXJtYXRpb24gJiYgdHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGdldFVzZXJDb25maXJtYXRpb24obWVzc2FnZSwgZnVuY3Rpb24gKG9rKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG9rICE9PSBmYWxzZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobWVzc2FnZSAhPT0gZmFsc2UpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIHZhciB0cmFuc2l0aW9uVG8gPSBmdW5jdGlvbiB0cmFuc2l0aW9uVG8obmV4dExvY2F0aW9uKSB7XG4gICAgaWYgKGN1cnJlbnRMb2NhdGlvbiAmJiAoMCwgX0xvY2F0aW9uVXRpbHMubG9jYXRpb25zQXJlRXF1YWwpKGN1cnJlbnRMb2NhdGlvbiwgbmV4dExvY2F0aW9uKSB8fCBwZW5kaW5nTG9jYXRpb24gJiYgKDAsIF9Mb2NhdGlvblV0aWxzLmxvY2F0aW9uc0FyZUVxdWFsKShwZW5kaW5nTG9jYXRpb24sIG5leHRMb2NhdGlvbikpIHJldHVybjsgLy8gTm90aGluZyB0byBkb1xuXG4gICAgcGVuZGluZ0xvY2F0aW9uID0gbmV4dExvY2F0aW9uO1xuXG4gICAgY29uZmlybVRyYW5zaXRpb25UbyhuZXh0TG9jYXRpb24sIGZ1bmN0aW9uIChvaykge1xuICAgICAgaWYgKHBlbmRpbmdMb2NhdGlvbiAhPT0gbmV4dExvY2F0aW9uKSByZXR1cm47IC8vIFRyYW5zaXRpb24gd2FzIGludGVycnVwdGVkIGR1cmluZyBjb25maXJtYXRpb25cblxuICAgICAgcGVuZGluZ0xvY2F0aW9uID0gbnVsbDtcblxuICAgICAgaWYgKG9rKSB7XG4gICAgICAgIC8vIFRyZWF0IFBVU0ggdG8gc2FtZSBwYXRoIGxpa2UgUkVQTEFDRSB0byBiZSBjb25zaXN0ZW50IHdpdGggYnJvd3NlcnNcbiAgICAgICAgaWYgKG5leHRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBVU0gpIHtcbiAgICAgICAgICB2YXIgcHJldlBhdGggPSAoMCwgX1BhdGhVdGlscy5jcmVhdGVQYXRoKShjdXJyZW50TG9jYXRpb24pO1xuICAgICAgICAgIHZhciBuZXh0UGF0aCA9ICgwLCBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgpKG5leHRMb2NhdGlvbik7XG5cbiAgICAgICAgICBpZiAobmV4dFBhdGggPT09IHByZXZQYXRoICYmICgwLCBfTG9jYXRpb25VdGlscy5zdGF0ZXNBcmVFcXVhbCkoY3VycmVudExvY2F0aW9uLnN0YXRlLCBuZXh0TG9jYXRpb24uc3RhdGUpKSBuZXh0TG9jYXRpb24uYWN0aW9uID0gX0FjdGlvbnMuUkVQTEFDRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXh0TG9jYXRpb24uYWN0aW9uID09PSBfQWN0aW9ucy5QT1ApIHtcbiAgICAgICAgICB1cGRhdGVMb2NhdGlvbihuZXh0TG9jYXRpb24pO1xuICAgICAgICB9IGVsc2UgaWYgKG5leHRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlBVU0gpIHtcbiAgICAgICAgICBpZiAocHVzaExvY2F0aW9uKG5leHRMb2NhdGlvbikgIT09IGZhbHNlKSB1cGRhdGVMb2NhdGlvbihuZXh0TG9jYXRpb24pO1xuICAgICAgICB9IGVsc2UgaWYgKG5leHRMb2NhdGlvbi5hY3Rpb24gPT09IF9BY3Rpb25zLlJFUExBQ0UpIHtcbiAgICAgICAgICBpZiAocmVwbGFjZUxvY2F0aW9uKG5leHRMb2NhdGlvbikgIT09IGZhbHNlKSB1cGRhdGVMb2NhdGlvbihuZXh0TG9jYXRpb24pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnRMb2NhdGlvbiAmJiBuZXh0TG9jYXRpb24uYWN0aW9uID09PSBfQWN0aW9ucy5QT1ApIHtcbiAgICAgICAgdmFyIHByZXZJbmRleCA9IGFsbEtleXMuaW5kZXhPZihjdXJyZW50TG9jYXRpb24ua2V5KTtcbiAgICAgICAgdmFyIG5leHRJbmRleCA9IGFsbEtleXMuaW5kZXhPZihuZXh0TG9jYXRpb24ua2V5KTtcblxuICAgICAgICBpZiAocHJldkluZGV4ICE9PSAtMSAmJiBuZXh0SW5kZXggIT09IC0xKSBnbyhwcmV2SW5kZXggLSBuZXh0SW5kZXgpOyAvLyBSZXN0b3JlIHRoZSBVUkxcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICB2YXIgcHVzaCA9IGZ1bmN0aW9uIHB1c2goaW5wdXQpIHtcbiAgICByZXR1cm4gdHJhbnNpdGlvblRvKGNyZWF0ZUxvY2F0aW9uKGlucHV0LCBfQWN0aW9ucy5QVVNIKSk7XG4gIH07XG5cbiAgdmFyIHJlcGxhY2UgPSBmdW5jdGlvbiByZXBsYWNlKGlucHV0KSB7XG4gICAgcmV0dXJuIHRyYW5zaXRpb25UbyhjcmVhdGVMb2NhdGlvbihpbnB1dCwgX0FjdGlvbnMuUkVQTEFDRSkpO1xuICB9O1xuXG4gIHZhciBnb0JhY2sgPSBmdW5jdGlvbiBnb0JhY2soKSB7XG4gICAgcmV0dXJuIGdvKC0xKTtcbiAgfTtcblxuICB2YXIgZ29Gb3J3YXJkID0gZnVuY3Rpb24gZ29Gb3J3YXJkKCkge1xuICAgIHJldHVybiBnbygxKTtcbiAgfTtcblxuICB2YXIgY3JlYXRlS2V5ID0gZnVuY3Rpb24gY3JlYXRlS2V5KCkge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwga2V5TGVuZ3RoIHx8IDYpO1xuICB9O1xuXG4gIHZhciBjcmVhdGVIcmVmID0gZnVuY3Rpb24gY3JlYXRlSHJlZihsb2NhdGlvbikge1xuICAgIHJldHVybiAoMCwgX1BhdGhVdGlscy5jcmVhdGVQYXRoKShsb2NhdGlvbik7XG4gIH07XG5cbiAgdmFyIGNyZWF0ZUxvY2F0aW9uID0gZnVuY3Rpb24gY3JlYXRlTG9jYXRpb24obG9jYXRpb24sIGFjdGlvbikge1xuICAgIHZhciBrZXkgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDIgfHwgYXJndW1lbnRzWzJdID09PSB1bmRlZmluZWQgPyBjcmVhdGVLZXkoKSA6IGFyZ3VtZW50c1syXTtcbiAgICByZXR1cm4gKDAsIF9Mb2NhdGlvblV0aWxzLmNyZWF0ZUxvY2F0aW9uKShsb2NhdGlvbiwgYWN0aW9uLCBrZXkpO1xuICB9O1xuXG4gIHJldHVybiB7XG4gICAgZ2V0Q3VycmVudExvY2F0aW9uOiBnZXRDdXJyZW50TG9jYXRpb24sXG4gICAgbGlzdGVuQmVmb3JlOiBsaXN0ZW5CZWZvcmUsXG4gICAgbGlzdGVuOiBsaXN0ZW4sXG4gICAgdHJhbnNpdGlvblRvOiB0cmFuc2l0aW9uVG8sXG4gICAgcHVzaDogcHVzaCxcbiAgICByZXBsYWNlOiByZXBsYWNlLFxuICAgIGdvOiBnbyxcbiAgICBnb0JhY2s6IGdvQmFjayxcbiAgICBnb0ZvcndhcmQ6IGdvRm9yd2FyZCxcbiAgICBjcmVhdGVLZXk6IGNyZWF0ZUtleSxcbiAgICBjcmVhdGVQYXRoOiBfUGF0aFV0aWxzLmNyZWF0ZVBhdGgsXG4gICAgY3JlYXRlSHJlZjogY3JlYXRlSHJlZixcbiAgICBjcmVhdGVMb2NhdGlvbjogY3JlYXRlTG9jYXRpb25cbiAgfTtcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUhpc3Rvcnk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG52YXIgX3dhcm5pbmcgPSByZXF1aXJlKCd3YXJuaW5nJyk7XG5cbnZhciBfd2FybmluZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF93YXJuaW5nKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIHJ1blRyYW5zaXRpb25Ib29rID0gZnVuY3Rpb24gcnVuVHJhbnNpdGlvbkhvb2soaG9vaywgbG9jYXRpb24sIGNhbGxiYWNrKSB7XG4gIHZhciByZXN1bHQgPSBob29rKGxvY2F0aW9uLCBjYWxsYmFjayk7XG5cbiAgaWYgKGhvb2subGVuZ3RoIDwgMikge1xuICAgIC8vIEFzc3VtZSB0aGUgaG9vayBydW5zIHN5bmNocm9ub3VzbHkgYW5kIGF1dG9tYXRpY2FsbHlcbiAgICAvLyBjYWxsIHRoZSBjYWxsYmFjayB3aXRoIHRoZSByZXR1cm4gdmFsdWUuXG4gICAgY2FsbGJhY2socmVzdWx0KTtcbiAgfSBlbHNlIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gKDAsIF93YXJuaW5nMi5kZWZhdWx0KShyZXN1bHQgPT09IHVuZGVmaW5lZCwgJ1lvdSBzaG91bGQgbm90IFwicmV0dXJuXCIgaW4gYSB0cmFuc2l0aW9uIGhvb2sgd2l0aCBhIGNhbGxiYWNrIGFyZ3VtZW50OyAnICsgJ2NhbGwgdGhlIGNhbGxiYWNrIGluc3RlYWQnKSA6IHZvaWQgMDtcbiAgfVxufTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gcnVuVHJhbnNpdGlvbkhvb2s7IiwiLyoqXG4gKiBDb3B5cmlnaHQgMjAxMy0yMDE1LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgaW52YXJpYW50ID0gZnVuY3Rpb24oY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YXJpYW50IHJlcXVpcmVzIGFuIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHZhciBlcnJvcjtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAnTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArXG4gICAgICAgICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLidcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBhcmdzID0gW2EsIGIsIGMsIGQsIGUsIGZdO1xuICAgICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICBmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24oKSB7IHJldHVybiBhcmdzW2FyZ0luZGV4KytdOyB9KVxuICAgICAgKTtcbiAgICAgIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gICAgfVxuXG4gICAgZXJyb3IuZnJhbWVzVG9Qb3AgPSAxOyAvLyB3ZSBkb24ndCBjYXJlIGFib3V0IGludmFyaWFudCdzIG93biBmcmFtZVxuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGludmFyaWFudDtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKipcbiAqIENvcHlyaWdodCAyMDE0LTIwMTUsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogU2ltaWxhciB0byBpbnZhcmlhbnQgYnV0IG9ubHkgbG9ncyBhIHdhcm5pbmcgaWYgdGhlIGNvbmRpdGlvbiBpcyBub3QgbWV0LlxuICogVGhpcyBjYW4gYmUgdXNlZCB0byBsb2cgaXNzdWVzIGluIGRldmVsb3BtZW50IGVudmlyb25tZW50cyBpbiBjcml0aWNhbFxuICogcGF0aHMuIFJlbW92aW5nIHRoZSBsb2dnaW5nIGNvZGUgZm9yIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRzIHdpbGwga2VlcCB0aGVcbiAqIHNhbWUgbG9naWMgYW5kIGZvbGxvdyB0aGUgc2FtZSBjb2RlIHBhdGhzLlxuICovXG5cbnZhciB3YXJuaW5nID0gZnVuY3Rpb24oKSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgd2FybmluZyA9IGZ1bmN0aW9uKGNvbmRpdGlvbiwgZm9ybWF0LCBhcmdzKSB7XG4gICAgdmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gPiAyID8gbGVuIC0gMiA6IDApO1xuICAgIGZvciAodmFyIGtleSA9IDI7IGtleSA8IGxlbjsga2V5KyspIHtcbiAgICAgIGFyZ3Nba2V5IC0gMl0gPSBhcmd1bWVudHNba2V5XTtcbiAgICB9XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdgd2FybmluZyhjb25kaXRpb24sIGZvcm1hdCwgLi4uYXJncylgIHJlcXVpcmVzIGEgd2FybmluZyAnICtcbiAgICAgICAgJ21lc3NhZ2UgYXJndW1lbnQnXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmIChmb3JtYXQubGVuZ3RoIDwgMTAgfHwgKC9eW3NcXFddKiQvKS50ZXN0KGZvcm1hdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1RoZSB3YXJuaW5nIGZvcm1hdCBzaG91bGQgYmUgYWJsZSB0byB1bmlxdWVseSBpZGVudGlmeSB0aGlzICcgK1xuICAgICAgICAnd2FybmluZy4gUGxlYXNlLCB1c2UgYSBtb3JlIGRlc2NyaXB0aXZlIGZvcm1hdCB0aGFuOiAnICsgZm9ybWF0XG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghY29uZGl0aW9uKSB7XG4gICAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgICAgdmFyIG1lc3NhZ2UgPSAnV2FybmluZzogJyArXG4gICAgICAgIGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gYXJnc1thcmdJbmRleCsrXTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvLyBUaGlzIGVycm9yIHdhcyB0aHJvd24gYXMgYSBjb252ZW5pZW5jZSBzbyB0aGF0IHlvdSBjYW4gdXNlIHRoaXMgc3RhY2tcbiAgICAgICAgLy8gdG8gZmluZCB0aGUgY2FsbHNpdGUgdGhhdCBjYXVzZWQgdGhpcyB3YXJuaW5nIHRvIGZpcmUuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH0gY2F0Y2goeCkge31cbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd2FybmluZztcbiIsIlxuaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IFNpZGViYXIgZnJvbSAnLi9jb21wb25lbnRzL1NpZGViYXInXG5pbXBvcnQgRGF0YWJhc2VCcmVhZENydW1iIGZyb20gJy4vcGFnZXMvRGF0YWJhc2VCcmVhZENydW1iJ1xuXG5jbGFzcyBBcHAgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lci1mbHVpZFwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCI+XG5cbiAgICAgICAgICAgICAgICAgICAgPFNpZGViYXIgey4uLnRoaXMucHJvcHMucGFyYW1zfS8+XG5cbiAgICAgICAgICAgICAgICAgICAgPG1haW4gY2xhc3NOYW1lPVwiY29sLW1kLTEwIG9mZnNldC1tZC0yXCIgc3R5bGU9e3ttYXJnaW5Ub3A6IDEwfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8RGF0YWJhc2VCcmVhZENydW1iIHsuLi50aGlzLnByb3BzfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAge3RoaXMucHJvcHMuY2hpbGRyZW59XG4gICAgICAgICAgICAgICAgICAgIDwvbWFpbj5cblxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXBwIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IFJlYWN0RE9NIGZyb20gJ3JlYWN0LWRvbSdcblxuaW1wb3J0IHtSb3V0ZXIsIFJvdXRlLCBJbmRleFJvdXRlfSBmcm9tICdyZWFjdC1yb3V0ZXInXG5pbXBvcnQgQ3JlYXRlQnJvd3Nlckhpc3RvcnkgZnJvbSAnaGlzdG9yeS9saWIvY3JlYXRlQnJvd3Nlckhpc3RvcnknXG5cbmltcG9ydCBBcHAgZnJvbSAnLi9BcHAnXG5pbXBvcnQgSG9tZVBhZ2UgZnJvbSAnLi9wYWdlcy9Ib21lUGFnZSdcbmltcG9ydCBEYXRhYmFzZVBhZ2UgZnJvbSAnLi9wYWdlcy9kYXRhYmFzZS9EYXRhYmFzZVBhZ2UnXG5pbXBvcnQgVGFibGVQYWdlIGZyb20gJy4vcGFnZXMvZGF0YWJhc2UvdGFibGUvVGFibGVQYWdlJ1xuXG5jb25zdCByb3V0ZXMgPSAgKFxuICAgIDxSb3V0ZXIgaGlzdG9yeT17Q3JlYXRlQnJvd3Nlckhpc3RvcnkoKX0+XG4gICAgICAgIDxSb3V0ZSBwYXRoPVwiL1wiIGNvbXBvbmVudD17QXBwfT5cbiAgICAgICAgICAgIDxJbmRleFJvdXRlIGNvbXBvbmVudD17SG9tZVBhZ2V9IC8+XG4gICAgICAgICAgICA8Um91dGUgcGF0aD1cIi9cIiBjb21wb25lbnQ9e0hvbWVQYWdlfSAvPlxuICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCIvZGF0YWJhc2UvOmRibmFtZVwiIGNvbXBvbmVudD17RGF0YWJhc2VQYWdlfSAvPlxuICAgICAgICAgICAgPFJvdXRlIHBhdGg9XCIvZGF0YWJhc2UvOmRibmFtZS86dGFibGVuYW1lXCIgY29tcG9uZW50PXtUYWJsZVBhZ2V9IC8+XG4gICAgICAgIDwvUm91dGU+XG4gICAgPC9Sb3V0ZXI+XG4pO1xuXG5SZWFjdERPTS5yZW5kZXIocm91dGVzLCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXBwJykpOyIsImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCBIdHRwIGZyb20gJy4uL3NlcnZpY2VzL0h0dHAnXG5pbXBvcnQge0xpbmt9IGZyb20gJ3JlYWN0LXJvdXRlcidcblxuY2xhc3MgU2lkZWJhciBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICAgICAgZGF0YWJhc2VzOiBbXSxcbiAgICAgICAgICAgIHNlbGVjdGVkRGJuYW1lOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb21wb25lbnREaWRNb3VudCgpIHtcblxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHNlbGVjdGVkRGJuYW1lOiB0aGlzLnByb3BzLmRibmFtZSxcbiAgICAgICAgICAgIHNlbGVjdGVkVGFibGVuYW1lOiB0aGlzLnByb3BzLnRhYmxlbmFtZSxcbiAgICAgICAgfSlcblxuICAgICAgICB0aGlzLmxpc3REYXRhYmFzZXMoKVxuICAgIH1cblxuICAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMobmV4dFByb3BzKSB7XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBzZWxlY3RlZERibmFtZTogbmV4dFByb3BzLmRibmFtZSxcbiAgICAgICAgICAgIHNlbGVjdGVkVGFibGVuYW1lOiBuZXh0UHJvcHMudGFibGVuYW1lXG4gICAgICAgIH0pXG5cbiAgICB9XG5cbiAgICBsaXN0RGF0YWJhc2VzKCkge1xuXG4gICAgICAgIGxldCBzZWxmID0gdGhpc1xuXG4gICAgICAgIEh0dHAucG9zdChcIi9kYXRhYmFzZS9saXN0XCIpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICAgICAgaWYoci5kYXRhLmNvZGUgPT0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYuc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgICAgICBkYXRhYmFzZXM6IHIuZGF0YS5wYXlsb2FkXG4gICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgZGF0YWJhc2VzID0gc2VsZi5zdGF0ZS5kYXRhYmFzZXNcbiAgICAgICAgY29uc3QgdGFibGVzID0gc2VsZi5zdGF0ZS50YWJsZXNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPG5hdiBjbGFzc05hbWU9XCJjb2wtbWQtMiBoaWRkZW4teHMtZG93biBiZy1mYWRlZCBzaWRlYmFyXCI+XG4gICAgICAgICAgICAgICAgPHVsIGNsYXNzTmFtZT1cIm5hdiBuYXYtcGlsbHMgZmxleC1jb2x1bW5cIj5cblxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhYmFzZXMubWFwKGZ1bmN0aW9uIChpdGVtLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17aWR4fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibmF2LWl0ZW1cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxMaW5rXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG89e1wiL2RhdGFiYXNlL1wiICsgaXRlbS5EYXRhYmFzZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e1wibmF2LWxpbmsgXCIgKyAoaXRlbS5EYXRhYmFzZSA9PSBzZWxmLnN0YXRlLnNlbGVjdGVkRGJuYW1lID8gXCJhY3RpdmVcIiA6IG51bGwpfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5EYXRhYmFzZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvTGluaz5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIDwvdWw+XG4gICAgICAgICAgICA8L25hdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBTaWRlYmFyIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuXG5jbGFzcyBUYWIgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdiB7Li4udGhpcy5wcm9wc30+e3RoaXMucHJvcHMuY2hpbGRyZW59PC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGFiIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuXG5jbGFzcyBBYm91dFBhZ2UgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG5cbiAgICAgICAgdGhpcy5zdGF0ZSA9IHtcbiAgICAgICAgICAgIHNlbGVjdGVkOiAtMVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1RhYkFjdGl2ZSA9IHRoaXMuaXNUYWJBY3RpdmUuYmluZCh0aGlzKVxuICAgICAgICB0aGlzLnNldFRhYiA9IHRoaXMuc2V0VGFiLmJpbmQodGhpcylcbiAgICB9XG5cbiAgICBpc1RhYkFjdGl2ZShpZHgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLnN0YXRlLnNlbGVjdGVkID09IGlkeCkgPyBcIm5hdi1saW5rIGFjdGl2ZVwiIDogXCJuYXYtbGlua1wiXG4gICAgfVxuXG4gICAgc2V0VGFiKGlkeCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHNlbGVjdGVkOiBpZHhcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBjb21wb25lbnREaWRNb3VudCgpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBzZWxlY3RlZDogdGhpcy5wcm9wcy5zZWxlY3RlZFxuICAgICAgICB9KVxuICAgIH1cblxuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBsZXQgc2VsZiA9IHRoaXNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8dWwgY2xhc3NOYW1lPVwibmF2IG5hdi10YWJzXCI+XG5cbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5wcm9wcy5jaGlsZHJlbi5tYXAoZnVuY3Rpb24gKHRhYiwgaWR4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGxpIGNsYXNzTmFtZT1cIm5hdi1pdGVtIHBvaW50ZXJcIiBrZXk9e2lkeH0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YSBjbGFzc05hbWU9e3NlbGYuaXNUYWJBY3RpdmUoaWR4KX0gb25DbGljaz17KCkgPT4gc2VsZi5zZXRUYWIoaWR4KX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3RhYi5wcm9wcy5sYWJlbH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICA8L3VsPlxuXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17e21hcmdpblRvcDogNX19PlxuICAgICAgICAgICAgICAgICAgICB7c2VsZi5wcm9wcy5jaGlsZHJlbltzZWxmLnN0YXRlLnNlbGVjdGVkXX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWJvdXRQYWdlIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHtMaW5rfSBmcm9tICdyZWFjdC1yb3V0ZXInXG5cbi8qXG4qIHRoaXMgY29tcG9uZW50IGxpdmVzIGluIEFwcFxuKiB0b3Agb2YgY29udGVudFxuKiAqL1xuXG5jbGFzcyBEYXRhYmFzZUJyZWFkQ3J1bWIgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IHByb3BzID0gc2VsZi5wcm9wc1xuICAgICAgICBjb25zdCBkYm5hbWUgPSBwcm9wcy5wYXJhbXMuZGJuYW1lXG4gICAgICAgIGNvbnN0IHRhYmxlbmFtZSA9IHByb3BzLnBhcmFtcy50YWJsZW5hbWVcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8bmF2IGNsYXNzTmFtZT1cImJyZWFkY3J1bWJcIj5cbiAgICAgICAgICAgICAgICAgICAgPExpbmsgY2xhc3NOYW1lPVwiYnJlYWRjcnVtYi1pdGVtXCJ0bz1cIi9cIj5Ib21lPC9MaW5rPlxuXG4gICAgICAgICAgICAgICAgICAgIHtkYm5hbWUgPyA8TGluayBjbGFzc05hbWU9e1wiYnJlYWRjcnVtYi1pdGVtIFwiICsgKHRhYmxlbmFtZSA/IFwiXCIgOiBcImFjdGl2ZVwiKX0gdG89e1wiL2RhdGFiYXNlL1wiICsgZGJuYW1lfT57ZGJuYW1lfTwvTGluaz4gOiBudWxsIH1cbiAgICAgICAgICAgICAgICAgICAge3RhYmxlbmFtZSA/IDxMaW5rICBjbGFzc05hbWU9e1wiYnJlYWRjcnVtYi1pdGVtIGFjdGl2ZVwifSB0bz17XCIvZGF0YWJhc2UvXCIgKyBkYm5hbWUgKyBcIi9cIiArIHRhYmxlbmFtZX0+e3RhYmxlbmFtZX08L0xpbms+IDogbnVsbCB9XG5cbiAgICAgICAgICAgICAgICA8L25hdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApXG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERhdGFiYXNlQnJlYWRDcnVtYiIsImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcblxuY2xhc3MgSG9tZVBhZ2UgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZXBhZ2UgPGJyLz5cbiAgICAgICAgICAgICAgICBob21lcGFnZSA8YnIvPlxuICAgICAgICAgICAgICAgIGhvbWVwYWdlIDxici8+XG4gICAgICAgICAgICAgICAgaG9tZVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSG9tZVBhZ2UiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgSHR0cCBmcm9tICcuLi8uLi9zZXJ2aWNlcy9IdHRwJ1xuaW1wb3J0IFV0aWwgZnJvbSAnLi4vLi4vc2VydmljZXMvVXRpbCdcbmltcG9ydCB7TGlua30gZnJvbSAncmVhY3Qtcm91dGVyJ1xuXG5cbi8qXG4qIExpc3QgdGFibGVzIGluIHRoaXMgcGFnZSBmb3IgYSBzZWxlY3RlZCBkYm5hbWVcbiovXG5cbmNsYXNzIERhdGFiYXNlUGFnZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICAgICAgdGFibGVzOiBbXVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7XG4gICAgICAgIHRoaXMubGlzdFRhYmxlcyh0aGlzLnByb3BzLnBhcmFtcy5kYm5hbWUpXG4gICAgfVxuXG5cbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKG5leHRQcm9wcykge1xuICAgICAgICB0aGlzLmxpc3RUYWJsZXMobmV4dFByb3BzLnBhcmFtcy5kYm5hbWUpXG4gICAgfVxuXG5cbiAgICBsaXN0VGFibGVzKGRibmFtZSkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG5cbiAgICAgICAgSHR0cC5wb3N0KFwiL3RhYmxlL2xpc3RcIiwge2RibmFtZTogZGJuYW1lfSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgICAgICBpZihyLmRhdGEuY29kZSA9PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VsZi5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIHRhYmxlczogci5kYXRhLnBheWxvYWRcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgcHJvcHMgPSBzZWxmLnByb3BzXG4gICAgICAgIGNvbnN0IGRibmFtZSA9IHByb3BzLnBhcmFtcy5kYm5hbWUgLyogZnJvbSBwYXJhbXMgYmVjYXVzZSB0aGlzIGNvbXBvbmVudCBpcyBhIHBhZ2UgKi9cbiAgICAgICAgY29uc3QgdGFibGVzID0gc2VsZi5zdGF0ZS50YWJsZXNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cblxuICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzc05hbWU9XCJ0YWJsZSB0YWJsZS1zbSB0YWJsZS1ob3ZlclwiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlRhYmxlPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGg+T3BlcmF0aW9uczwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlcy5tYXAoZnVuY3Rpb24gKHRhYmxlLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpZHh9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TGluayB0bz17XCIvZGF0YWJhc2UvXCIgKyBkYm5hbWUgKyBcIi9cIiArIHRhYmxlfT57dGFibGV9PC9MaW5rPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD4jIzwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEYXRhYmFzZVBhZ2UiLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQge0xpbmt9IGZyb20gJ3JlYWN0LXJvdXRlcidcbmltcG9ydCBUYWIgZnJvbSAnLi4vLi4vLi4vY29tcG9uZW50cy9UYWInXG5pbXBvcnQgVGFicyBmcm9tICcuLi8uLi8uLi9jb21wb25lbnRzL1RhYnMnXG5pbXBvcnQgVGFibGVTdHJ1Y3R1cmUgZnJvbSAnLi90YWJzL3N0cnVjdHVyZS9UYWJsZVN0cnVjdHVyZSdcbmltcG9ydCBUYWJsZVJvd3MgZnJvbSAnLi90YWJzL3Jvd3MvVGFibGVSb3dzJ1xuXG4vKlxuICogSW4gdGhpcyBjb21wb25lbnQsIHRoZXJlIGFyZSB0d28gY29tcG9uZW50cyBzaG93aW5nOlxuICogRGF0YWJhc2VUYWJsZVBhZ2VDb2x1bW5zIGFuZCBEYXRhYmFzZVRhYmxlUGFnZVJvd3NcbiAqL1xuXG5jbGFzcyBEYXRhYmFzZVRhYmxlUGFnZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge31cbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgcHJvcHMgPSBzZWxmLnByb3BzXG4gICAgICAgIGNvbnN0IGRibmFtZSA9IHByb3BzLnBhcmFtcy5kYm5hbWVcbiAgICAgICAgY29uc3QgdGFibGVuYW1lID0gcHJvcHMucGFyYW1zLnRhYmxlbmFtZVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuXG4gICAgICAgICAgICAgICAgPFRhYnMgc2VsZWN0ZWQ9ezB9PlxuICAgICAgICAgICAgICAgICAgICA8VGFiIGxhYmVsPVwiUm93c1wiPjxUYWJsZVJvd3Mgey4uLnNlbGYucHJvcHMucGFyYW1zfS8+PC9UYWI+XG4gICAgICAgICAgICAgICAgICAgIDxUYWIgbGFiZWw9XCJTdHJ1Y3R1cmVcIj48VGFibGVTdHJ1Y3R1cmUgey4uLnNlbGYucHJvcHMucGFyYW1zfS8+PC9UYWI+XG4gICAgICAgICAgICAgICAgPC9UYWJzPlxuXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEYXRhYmFzZVRhYmxlUGFnZSIsImltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCBIdHRwIGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL0h0dHAnXG5pbXBvcnQge0xpbmt9IGZyb20gJ3JlYWN0LXJvdXRlcidcbmltcG9ydCBSb3cgZnJvbSAnLi9jb21wb25lbnQvUm93J1xuXG4vKlxuICogTGlzdCBzdHJ1Y3R1cmUgaW4gdGhpcyBjb21wb25lbnQgZm9yIGEgc2VsZWN0ZWQgdGFibGVuYW1lXG4gKi9cblxuY2xhc3MgVGFibGVSb3dzIGV4dGVuZHMgUmVhY3QuQ29tcG9uZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgICAgIHN1cGVyKHByb3BzKVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSB7XG4gICAgICAgICAgICBjb2x1bW5zOiBbXSxcbiAgICAgICAgICAgIHJvd3M6IFtdLFxuICAgICAgICAgICAgcGFnZTogMFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7XG5cbiAgICAgICAgLyogZmlyc3QgbGlzdCBzdHJ1Y3R1cmUsIGJlY2F1c2Ugd2UgbmVlZCB0aGVtIHRvIHNob3cgaW4gdGFibGUgPHRoZWFkLz4gKi9cbiAgICAgICAgdGhpcy5saXN0Q29sdW1ucygpXG4gICAgfVxuXG4gICAgbGlzdENvbHVtbnMoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgZGJuYW1lID0gc2VsZi5wcm9wcy5kYm5hbWVcbiAgICAgICAgY29uc3QgdGFibGVuYW1lID0gc2VsZi5wcm9wcy50YWJsZW5hbWVcblxuICAgICAgICBIdHRwLnBvc3QoXCIvdGFibGUvY29sdW1uL2xpc3RcIiwge2RibmFtZTogZGJuYW1lLCB0YWJsZW5hbWU6IHRhYmxlbmFtZX0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICAgICAgaWYoci5kYXRhLmNvZGUgPT0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYuc2V0U3RhdGUoe1xuICAgICAgICAgICAgICAgICAgICBjb2x1bW5zOiByLmRhdGEucGF5bG9hZFxuICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICBzZWxmLmxpc3RSb3dzKClcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgbGlzdFJvd3MoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgZGJuYW1lID0gc2VsZi5wcm9wcy5kYm5hbWVcbiAgICAgICAgY29uc3QgdGFibGVuYW1lID0gc2VsZi5wcm9wcy50YWJsZW5hbWVcblxuICAgICAgICBIdHRwLnBvc3QoXCIvdGFibGUvcm93c1wiLCB7ZGJuYW1lOiBkYm5hbWUsIHRhYmxlbmFtZTogdGFibGVuYW1lLCBwYWdlOiBzZWxmLnN0YXRlLnBhZ2V9KVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHIpIHtcblxuICAgICAgICAgICAgICAgIGlmKHIuZGF0YS5jb2RlID09IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWxmLnNldFN0YXRlKHtcbiAgICAgICAgICAgICAgICAgICAgcm93czogci5kYXRhLnBheWxvYWRcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZW5kZXIoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXNcbiAgICAgICAgY29uc3QgY29sdW1ucyA9IHNlbGYuc3RhdGUuY29sdW1uc1xuICAgICAgICBjb25zdCByb3dzID0gc2VsZi5zdGF0ZS5yb3dzXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cInRhYmxlIHRhYmxlLXNtIHRhYmxlLWhvdmVyIHRhYmxlLXN0cmlwZWRcIj5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1ucy5tYXAoZnVuY3Rpb24gKGNvbCwgaWR4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gPHRoIGtleT17aWR4fT57Y29sLkZpZWxkfTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3dzLm1hcChmdW5jdGlvbiAocm93LCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gPFJvd1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2lkeH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGJuYW1lPXtzZWxmLnByb3BzLmRibmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFibGVuYW1lPXtzZWxmLnByb3BzLnRhYmxlbmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1ucz17Y29sdW1uc31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93PXtyb3d9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGFibGVSb3dzIiwiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuXG5jbGFzcyBDb2x1bW4gZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7fVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IHByb3BzID0gdGhpcy5wcm9wc1xuICAgICAgICBsZXQgZmllbGQgID0gcHJvcHMuZmllbGRcbiAgICAgICAgbGV0IHJvdyAgPSBwcm9wcy5yb3dcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPHRkPlxuICAgICAgICAgICAgICAgIHtyb3dbZmllbGRdfVxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgKVxuICAgIH1cblxufVxuXG5Db2x1bW4ucHJvcFR5cGVzID0ge1xuICAgIGZpZWxkOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgcm93OiBSZWFjdC5Qcm9wVHlwZXMub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgZGJuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgdGFibGVuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBDb2x1bW4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgQ29sdW1uIGZyb20gJy4vQ29sdW1uJ1xuXG5jbGFzcyBSb3cgZXh0ZW5kcyBSZWFjdC5Db21wb25lbnQge1xuXG4gICAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICAgICAgc3VwZXIocHJvcHMpXG4gICAgfVxuXG4gICAgY29tcG9uZW50RGlkTW91bnQoKSB7fVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IHByb3BzID0gdGhpcy5wcm9wc1xuICAgICAgICBsZXQgY29sdW1ucyAgPSBwcm9wcy5jb2x1bW5zXG4gICAgICAgIGxldCByb3cgID0gcHJvcHMucm93XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnMubWFwKGZ1bmN0aW9uIChjb2wsIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDxDb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2lkeH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3c9e3Jvd31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZD17Y29sLkZpZWxkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRibmFtZT17cHJvcHMuZGJuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlbmFtZT17cHJvcHMudGFibGVuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICApXG4gICAgfVxuXG59XG5cblJvdy5wcm9wVHlwZXMgPSB7XG4gICAgY29sdW1uczogUmVhY3QuUHJvcFR5cGVzLmFycmF5LmlzUmVxdWlyZWQsXG4gICAgcm93OiBSZWFjdC5Qcm9wVHlwZXMub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgZGJuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgdGFibGVuYW1lOiBSZWFjdC5Qcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG59O1xuXG5leHBvcnQgZGVmYXVsdCBSb3ciLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgSHR0cCBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9IdHRwJ1xuaW1wb3J0IHtMaW5rfSBmcm9tICdyZWFjdC1yb3V0ZXInXG5cbi8qXG4gKiBMaXN0IHN0cnVjdHVyZSBpbiB0aGlzIGNvbXBvbmVudCBmb3IgYSBzZWxlY3RlZCB0YWJsZW5hbWVcbiAqL1xuXG5jbGFzcyBUYWJsZVN0cnVjdHVyZSBleHRlbmRzIFJlYWN0LkNvbXBvbmVudCB7XG5cbiAgICBjb25zdHJ1Y3Rvcihwcm9wcykge1xuICAgICAgICBzdXBlcihwcm9wcylcblxuICAgICAgICB0aGlzLnN0YXRlID0ge1xuICAgICAgICAgICAgY29sdW1uczogW11cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbXBvbmVudERpZE1vdW50KCkge1xuICAgICAgICB0aGlzLmxpc3RDb2x1bW5zKClcbiAgICB9XG5cbiAgICBsaXN0Q29sdW1ucygpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpc1xuICAgICAgICBjb25zdCBkYm5hbWUgPSBzZWxmLnByb3BzLmRibmFtZVxuICAgICAgICBjb25zdCB0YWJsZW5hbWUgPSBzZWxmLnByb3BzLnRhYmxlbmFtZVxuXG4gICAgICAgIEh0dHAucG9zdChcIi90YWJsZS9jb2x1bW4vbGlzdFwiLCB7ZGJuYW1lOiBkYm5hbWUsIHRhYmxlbmFtZTogdGFibGVuYW1lfSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgICAgICBpZihyLmRhdGEuY29kZSA9PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2VsZi5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnM6IHIuZGF0YS5wYXlsb2FkXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzXG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBzZWxmLnN0YXRlLmNvbHVtbnNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwidGFibGUgdGFibGUtc20gdGFibGUtaG92ZXIgdGFibGUtc3RyaXBlZFwiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5Db2x1bW48L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlR5cGU8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPk51bGw/PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5EZWZhdWx0PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5PcGVyYXRpb25zPC90aD5cbiAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5zLm1hcChmdW5jdGlvbiAoY29sLCBpZHgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIga2V5PXtpZHh9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KGNvbC5LZXkgPT0gXCJQUklcIikgPyA8c3Bhbj48aSBjbGFzc05hbWU9XCJmYSBmYS1rZXlcIj48L2k+Jm5ic3A7PC9zcGFuPiA6IG51bGx9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NvbC5GaWVsZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPVwicG9pbnRlclwiPntjb2wuVHlwZX08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT1cInBvaW50ZXJcIj57Y29sLk51bGx9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9XCJwb2ludGVyXCI+e2NvbC5EZWZhdWx0fTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQ+IyM8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGFibGVTdHJ1Y3R1cmUiLCJpbXBvcnQgYXhpb3MgZnJvbSAnYXhpb3MnXG5cblxuY29uc3QgSHR0cCA9IHtcblxuICAgIHBvc3QodXJsLCBkYXRhKSB7XG5cbiAgICAgICAgaWYoIWRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEgPSB7fVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGF4aW9zLnBvc3QodXJsLCBkYXRhKVxuICAgIH0sXG5cbiAgICBnZXQodXJsKSB7XG4gICAgICAgIHJldHVybiBheGlvcy5nZXQodXJsKVxuICAgIH0sXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSHR0cCIsImltcG9ydCB7YnJvd3Nlckhpc3Rvcnl9IGZyb20gJ3JlYWN0LXJvdXRlcidcblxuY29uc3QgVXRpbCA9IHtcblxuICAgIHJlZGlyZWN0KHVybCkge1xuICAgICAgICBicm93c2VySGlzdG9yeS5wdXNoKHVybClcbiAgICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVXRpbCJdfQ==

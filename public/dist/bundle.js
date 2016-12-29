(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")

module.exports = function(redrawService) {
	return function(root, component) {
		if (component === null) {
			redrawService.render(root, [])
			redrawService.unsubscribe(root)
			return
		}
		
		if (component.view == null) throw new Error("m.mount(element, component) expects a component, not a vnode")
		
		var run = function() {
			redrawService.render(root, Vnode(component))
		}
		redrawService.subscribe(root, run)
		redrawService.redraw()
	}
}

},{"../render/vnode":16}],2:[function(require,module,exports){
"use strict"

var coreRenderer = require("../render/render")

function throttle(callback) {
	//60fps translates to 16.6ms, round it down since setTimeout requires int
	var time = 16
	var last = 0, pending = null
	var timeout = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout
	return function() {
		var now = Date.now()
		if (last === 0 || now - last >= time) {
			last = now
			callback()
		}
		else if (pending === null) {
			pending = timeout(function() {
				pending = null
				callback()
				last = Date.now()
			}, time - (now - last))
		}
	}
}

module.exports = function($window) {
	var renderService = coreRenderer($window)
	renderService.setEventCallback(function(e) {
		if (e.redraw !== false) redraw()
	})
	
	var callbacks = []
	function subscribe(key, callback) {
		unsubscribe(key)
		callbacks.push(key, throttle(callback))
	}
	function unsubscribe(key) {
		var index = callbacks.indexOf(key)
		if (index > -1) callbacks.splice(index, 2)
	}
    function redraw() {
        for (var i = 1; i < callbacks.length; i += 2) {
            callbacks[i]()
        }
    }
	return {subscribe: subscribe, unsubscribe: unsubscribe, redraw: redraw, render: renderService.render}
}

},{"../render/render":14}],3:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")
var Promise = require("../promise/promise")
var coreRouter = require("../router/router")

module.exports = function($window, redrawService) {
	var routeService = coreRouter($window)

	var identity = function(v) {return v}
	var render, component, attrs, currentPath, updatePending = false
	var route = function(root, defaultRoute, routes) {
		if (root == null) throw new Error("Ensure the DOM element that was passed to `m.route` is not undefined")
		var update = function(routeResolver, comp, params, path) {
			component = comp != null && typeof comp.view === "function" ? comp : "div", attrs = params, currentPath = path, updatePending = false
			render = (routeResolver.render || identity).bind(routeResolver)
			run()
		}
		var run = function() {
			if (render != null) redrawService.render(root, render(Vnode(component, attrs.key, attrs)))
		}
		var bail = function() {
			routeService.setPath(defaultRoute)
		}
		routeService.defineRoutes(routes, function(payload, params, path) {
			if (payload.view) update({}, payload, params, path)
			else {
				if (payload.onmatch) {
					updatePending = true
					Promise.resolve(payload.onmatch(params, path)).then(function(resolved) {
						if (updatePending) update(payload, resolved, params, path)
					}, bail)
				}
				else update(payload, "div", params, path)
			}
		}, bail)
		redrawService.subscribe(root, run)
	}
	route.set = function(path, data, options) {
		if (updatePending) options = {replace: true}
		updatePending = false
		routeService.setPath(path, data, options)
	}
	route.get = function() {return currentPath}
	route.prefix = function(prefix) {routeService.prefix = prefix}
	route.link = function(vnode) {
		vnode.dom.setAttribute("href", routeService.prefix + vnode.attrs.href)
		vnode.dom.onclick = function(e) {
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return
			e.preventDefault()
			e.redraw = false
			var href = this.getAttribute("href")
			if (href.indexOf(routeService.prefix) === 0) href = href.slice(routeService.prefix.length)
			route.set(href, undefined, undefined)
		}
	}

	return route
}

},{"../promise/promise":7,"../render/vnode":16,"../router/router":20}],4:[function(require,module,exports){
var hyperscript = require("./render/hyperscript")

hyperscript.trust = require("./render/trust")
hyperscript.fragment = require("./render/fragment")

module.exports = hyperscript

},{"./render/fragment":12,"./render/hyperscript":13,"./render/trust":15}],5:[function(require,module,exports){
"use strict"

var m = require("./hyperscript")
var requestService = require("./request")
var redrawService = require("./redraw")

requestService.setCompletionCallback(redrawService.redraw)

m.mount = require("./mount")
m.route = require("./route")
m.withAttr = require("./util/withAttr")
m.render = require("./render").render
m.redraw = redrawService.redraw
m.request = requestService.request
m.jsonp = requestService.jsonp
m.parseQueryString = require("./querystring/parse")
m.buildQueryString = require("./querystring/build")
m.version = "bleeding-edge"

module.exports = m

},{"./hyperscript":4,"./mount":6,"./querystring/build":8,"./querystring/parse":9,"./redraw":10,"./render":11,"./request":17,"./route":19,"./util/withAttr":23}],6:[function(require,module,exports){
var redrawService = require("./redraw")

module.exports = require("./api/mount")(redrawService)
},{"./api/mount":1,"./redraw":10}],7:[function(require,module,exports){
(function (global){
"use strict"
/** @constructor */
var PromisePolyfill = function(executor) {
	if (!(this instanceof PromisePolyfill)) throw new Error("Promise must be called with `new`")
	if (typeof executor !== "function") throw new TypeError("executor must be a function")

	var self = this, resolvers = [], rejectors = [], resolveCurrent = handler(resolvers, true), rejectCurrent = handler(rejectors, false)
	var instance = self._instance = {resolvers: resolvers, rejectors: rejectors}
	var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout
	function handler(list, shouldAbsorb) {
		return function execute(value) {
			var then
			try {
				if (shouldAbsorb && value != null && (typeof value === "object" || typeof value === "function") && typeof (then = value.then) === "function") {
					if (value === self) throw new TypeError("Promise can't be resolved w/ itself")
					executeOnce(then.bind(value))
				}
				else {
					callAsync(function() {
						if (!shouldAbsorb && list.length === 0) console.error("Possible unhandled promise rejection:", value)
						for (var i = 0; i < list.length; i++) list[i](value)
						resolvers.length = 0, rejectors.length = 0
						instance.state = shouldAbsorb
						instance.retry = function() {execute(value)}
					})
				}
			}
			catch (e) {
				rejectCurrent(e)
			}
		}
	}
	function executeOnce(then) {
		var runs = 0
		function run(fn) {
			return function(value) {
				if (runs++ > 0) return
				fn(value)
			}
		}
		var onerror = run(rejectCurrent)
		try {then(run(resolveCurrent), onerror)} catch (e) {onerror(e)}
	}

	executeOnce(executor)
}
PromisePolyfill.prototype.then = function(onFulfilled, onRejection) {
	var self = this, instance = self._instance
	function handle(callback, list, next, state) {
		list.push(function(value) {
			if (typeof callback !== "function") next(value)
			else try {resolveNext(callback(value))} catch (e) {if (rejectNext) rejectNext(e)}
		})
		if (typeof instance.retry === "function" && state === instance.state) instance.retry()
	}
	var resolveNext, rejectNext
	var promise = new PromisePolyfill(function(resolve, reject) {resolveNext = resolve, rejectNext = reject})
	handle(onFulfilled, instance.resolvers, resolveNext, true), handle(onRejection, instance.rejectors, rejectNext, false)
	return promise
}
PromisePolyfill.prototype.catch = function(onRejection) {
	return this.then(null, onRejection)
}
PromisePolyfill.resolve = function(value) {
	if (value instanceof PromisePolyfill) return value
	return new PromisePolyfill(function(resolve) {resolve(value)})
}
PromisePolyfill.reject = function(value) {
	return new PromisePolyfill(function(resolve, reject) {reject(value)})
}
PromisePolyfill.all = function(list) {
	return new PromisePolyfill(function(resolve, reject) {
		var total = list.length, count = 0, values = []
		if (list.length === 0) resolve([])
		else for (var i = 0; i < list.length; i++) {
			(function(i) {
				function consume(value) {
					count++
					values[i] = value
					if (count === total) resolve(values)
				}
				if (list[i] != null && (typeof list[i] === "object" || typeof list[i] === "function") && typeof list[i].then === "function") {
					list[i].then(consume, reject)
				}
				else consume(list[i])
			})(i)
		}
	})
}
PromisePolyfill.race = function(list) {
	return new PromisePolyfill(function(resolve, reject) {
		for (var i = 0; i < list.length; i++) {
			list[i].then(resolve, reject)
		}
	})
}

if (typeof Promise === "undefined") {
	if (typeof window !== "undefined") window.Promise = PromisePolyfill
	else if (typeof global !== "undefined") global.Promise = PromisePolyfill
}

module.exports = typeof Promise !== "undefined" ? Promise : PromisePolyfill
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){
"use strict"

module.exports = function(object) {
	if (Object.prototype.toString.call(object) !== "[object Object]") return ""

	var args = []
	for (var key in object) {
		destructure(key, object[key])
	}
	return args.join("&")

	function destructure(key, value) {
		if (value instanceof Array) {
			for (var i = 0; i < value.length; i++) {
				destructure(key + "[" + i + "]", value[i])
			}
		}
		else if (Object.prototype.toString.call(value) === "[object Object]") {
			for (var i in value) {
				destructure(key + "[" + i + "]", value[i])
			}
		}
		else args.push(encodeURIComponent(key) + (value != null && value !== "" ? "=" + encodeURIComponent(value) : ""))
	}
}

},{}],9:[function(require,module,exports){
"use strict"

module.exports = function(string) {
	if (string === "" || string == null) return {}
	if (string.charAt(0) === "?") string = string.slice(1)

	var entries = string.split("&"), data = {}, counters = {}
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i].split("=")
		var key = decodeURIComponent(entry[0])
		var value = entry.length === 2 ? decodeURIComponent(entry[1]) : ""

		if (value === "true") value = true
		else if (value === "false") value = false

		var levels = key.split(/\]\[?|\[/)
		var cursor = data
		if (key.indexOf("[") > -1) levels.pop()
		for (var j = 0; j < levels.length; j++) {
			var level = levels[j], nextLevel = levels[j + 1]
			var isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10))
			var isValue = j === levels.length - 1
			if (level === "") {
				var key = levels.slice(0, j).join()
				if (counters[key] == null) counters[key] = 0
				level = counters[key]++
			}
			if (cursor[level] == null) {
				cursor[level] = isValue ? value : isNumber ? [] : {}
			}
			cursor = cursor[level]
		}
	}
	return data
}

},{}],10:[function(require,module,exports){
module.exports = require("./api/redraw")(window)
},{"./api/redraw":2}],11:[function(require,module,exports){
module.exports = require("./render/render")(window)
},{"./render/render":14}],12:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")

module.exports = function(attrs, children) {
	return Vnode("[", attrs.key, attrs, Vnode.normalizeChildren(children), undefined, undefined)
}

},{"../render/vnode":16}],13:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")

var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g
var selectorCache = {}
function hyperscript(selector) {
	if (selector == null || typeof selector !== "string" && selector.view == null) {
		throw Error("The selector must be either a string or a component.");
	}

	if (typeof selector === "string" && selectorCache[selector] === undefined) {
		var match, tag, classes = [], attributes = {}
		while (match = selectorParser.exec(selector)) {
			var type = match[1], value = match[2]
			if (type === "" && value !== "") tag = value
			else if (type === "#") attributes.id = value
			else if (type === ".") classes.push(value)
			else if (match[3][0] === "[") {
				var attrValue = match[6]
				if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\")
				if (match[4] === "class") classes.push(attrValue)
				else attributes[match[4]] = attrValue || true
			}
		}
		if (classes.length > 0) attributes.className = classes.join(" ")
		selectorCache[selector] = function(attrs, children) {
			var hasAttrs = false, childList, text
			var className = attrs.className || attrs.class
			for (var key in attributes) attrs[key] = attributes[key]
			if (className !== undefined) {
				if (attrs.class !== undefined) {
					attrs.class = undefined
					attrs.className = className
				}
				if (attributes.className !== undefined) attrs.className = attributes.className + " " + className
			}
			for (var key in attrs) {
				if (key !== "key") {
					hasAttrs = true
					break
				}
			}
			if (children instanceof Array && children.length == 1 && children[0] != null && children[0].tag === "#") text = children[0].children
			else childList = children

			return Vnode(tag || "div", attrs.key, hasAttrs ? attrs : undefined, childList, text, undefined)
		}
	}
	var attrs, children, childrenIndex
	if (arguments[1] == null || typeof arguments[1] === "object" && arguments[1].tag === undefined && !(arguments[1] instanceof Array)) {
		attrs = arguments[1]
		childrenIndex = 2
	}
	else childrenIndex = 1
	if (arguments.length === childrenIndex + 1) {
		children = arguments[childrenIndex] instanceof Array ? arguments[childrenIndex] : [arguments[childrenIndex]]
	}
	else {
		children = []
		for (var i = childrenIndex; i < arguments.length; i++) children.push(arguments[i])
	}

	if (typeof selector === "string") return selectorCache[selector](attrs || {}, Vnode.normalizeChildren(children))

	return Vnode(selector, attrs && attrs.key, attrs || {}, Vnode.normalizeChildren(children), undefined, undefined)
}

module.exports = hyperscript

},{"../render/vnode":16}],14:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")

module.exports = function($window) {
	var $doc = $window.document
	var $emptyFragment = $doc.createDocumentFragment()

	var onevent
	function setEventCallback(callback) {return onevent = callback}

	//create
	function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i]
			if (vnode != null) {
				insertNode(parent, createNode(vnode, hooks, ns), nextSibling)
			}
		}
	}
	function createNode(vnode, hooks, ns) {
		var tag = vnode.tag
		if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks)
		if (typeof tag === "string") {
			switch (tag) {
				case "#": return createText(vnode)
				case "<": return createHTML(vnode)
				case "[": return createFragment(vnode, hooks, ns)
				default: return createElement(vnode, hooks, ns)
			}
		}
		else return createComponent(vnode, hooks, ns)
	}
	function createText(vnode) {
		return vnode.dom = $doc.createTextNode(vnode.children)
	}
	function createHTML(vnode) {
		var match = vnode.children.match(/^\s*?<(\w+)/im) || []
		var parent = {caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup"}[match[1]] || "div"
		var temp = $doc.createElement(parent)

		temp.innerHTML = vnode.children
		vnode.dom = temp.firstChild
		vnode.domSize = temp.childNodes.length
		var fragment = $doc.createDocumentFragment()
		var child
		while (child = temp.firstChild) {
			fragment.appendChild(child)
		}
		return fragment
	}
	function createFragment(vnode, hooks, ns) {
		var fragment = $doc.createDocumentFragment()
		if (vnode.children != null) {
			var children = vnode.children
			createNodes(fragment, children, 0, children.length, hooks, null, ns)
		}
		vnode.dom = fragment.firstChild
		vnode.domSize = fragment.childNodes.length
		return fragment
	}
	function createElement(vnode, hooks, ns) {
		var tag = vnode.tag
		switch (vnode.tag) {
			case "svg": ns = "http://www.w3.org/2000/svg"; break
			case "math": ns = "http://www.w3.org/1998/Math/MathML"; break
		}

		var attrs = vnode.attrs
		var is = attrs && attrs.is

		var element = ns ?
			is ? $doc.createElementNS(ns, tag, {is: is}) : $doc.createElementNS(ns, tag) :
			is ? $doc.createElement(tag, {is: is}) : $doc.createElement(tag)
		vnode.dom = element

		if (attrs != null) {
			setAttrs(vnode, attrs, ns)
		}

		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
			setContentEditable(vnode)
		}
		else {
			if (vnode.text != null) {
				if (vnode.text !== "") element.textContent = vnode.text
				else vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]
			}
			if (vnode.children != null) {
				var children = vnode.children
				createNodes(element, children, 0, children.length, hooks, null, ns)
				setLateAttrs(vnode)
			}
		}
		return element
	}
	function createComponent(vnode, hooks, ns) {
		// For object literals since `Vnode()` always sets the `state` field.
		if (!vnode.state) vnode.state = {}
		assign(vnode.state, vnode.tag)

		var view = vnode.tag.view
		if (view.reentrantLock != null) return $emptyFragment
		view.reentrantLock = true
		initLifecycle(vnode.tag, vnode, hooks)
		vnode.instance = Vnode.normalize(view.call(vnode.state, vnode))
		view.reentrantLock = null
		if (vnode.instance != null) {
			if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as arguments")
			var element = createNode(vnode.instance, hooks, ns)
			vnode.dom = vnode.instance.dom
			vnode.domSize = vnode.dom != null ? vnode.instance.domSize : 0
			return element
		}
		else {
			vnode.domSize = 0
			return $emptyFragment
		}
	}

	//update
	function updateNodes(parent, old, vnodes, hooks, nextSibling, ns) {
		if (old === vnodes || old == null && vnodes == null) return
		else if (old == null) createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, undefined)
		else if (vnodes == null) removeNodes(old, 0, old.length, vnodes)
		else {
			var isUnkeyed = false
			for (var i = 0; i < vnodes.length; i++) {
				if (vnodes[i] != null) {
					isUnkeyed = vnodes[i].key == null
					break
				}
			}
			if (old.length === vnodes.length && isUnkeyed) {
				for (var i = 0; i < old.length; i++) {
					if (old[i] === vnodes[i]) continue
					else if (old[i] == null) insertNode(parent, createNode(vnodes[i], hooks, ns), getNextSibling(old, i + 1, nextSibling))
					else if (vnodes[i] == null) removeNodes(old, i, i + 1, vnodes)
					else updateNode(parent, old[i], vnodes[i], hooks, getNextSibling(old, i + 1, nextSibling), false, ns)
				}
			}
			else {
				var recycling = isRecyclable(old, vnodes)
				if (recycling) old = old.concat(old.pool)

				var oldStart = 0, start = 0, oldEnd = old.length - 1, end = vnodes.length - 1, map
				while (oldEnd >= oldStart && end >= start) {
					var o = old[oldStart], v = vnodes[start]
					if (o === v && !recycling) oldStart++, start++
					else if (o == null) oldStart++
					else if (v == null) start++
					else if (o.key === v.key) {
						oldStart++, start++
						updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), recycling, ns)
						if (recycling && o.tag === v.tag) insertNode(parent, toFragment(o), nextSibling)
					}
					else {
						var o = old[oldEnd]
						if (o === v && !recycling) oldEnd--, start++
						else if (o == null) oldEnd--
						else if (v == null) start++
						else if (o.key === v.key) {
							updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), recycling, ns)
							if (recycling || start < end) insertNode(parent, toFragment(o), getNextSibling(old, oldStart, nextSibling))
							oldEnd--, start++
						}
						else break
					}
				}
				while (oldEnd >= oldStart && end >= start) {
					var o = old[oldEnd], v = vnodes[end]
					if (o === v && !recycling) oldEnd--, end--
					else if (o == null) oldEnd--
					else if (v == null) end--
					else if (o.key === v.key) {
						updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), recycling, ns)
						if (recycling && o.tag === v.tag) insertNode(parent, toFragment(o), nextSibling)
						if (o.dom != null) nextSibling = o.dom
						oldEnd--, end--
					}
					else {
						if (!map) map = getKeyMap(old, oldEnd)
						if (v != null) {
							var oldIndex = map[v.key]
							if (oldIndex != null) {
								var movable = old[oldIndex]
								updateNode(parent, movable, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), recycling, ns)
								insertNode(parent, toFragment(movable), nextSibling)
								old[oldIndex].skip = true
								if (movable.dom != null) nextSibling = movable.dom
							}
							else {
								var dom = createNode(v, hooks, undefined)
								insertNode(parent, dom, nextSibling)
								nextSibling = dom
							}
						}
						end--
					}
					if (end < start) break
				}
				createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns)
				removeNodes(old, oldStart, oldEnd + 1, vnodes)
			}
		}
	}
	function updateNode(parent, old, vnode, hooks, nextSibling, recycling, ns) {
		var oldTag = old.tag, tag = vnode.tag
		if (oldTag === tag) {
			vnode.state = old.state
			vnode.events = old.events
			if (shouldUpdate(vnode, old)) return
			if (vnode.attrs != null) {
				updateLifecycle(vnode.attrs, vnode, hooks, recycling)
			}
			if (typeof oldTag === "string") {
				switch (oldTag) {
					case "#": updateText(old, vnode); break
					case "<": updateHTML(parent, old, vnode, nextSibling); break
					case "[": updateFragment(parent, old, vnode, hooks, nextSibling, ns); break
					default: updateElement(old, vnode, hooks, ns)
				}
			}
			else updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns)
		}
		else {
			removeNode(old, null)
			insertNode(parent, createNode(vnode, hooks, ns), nextSibling)
		}
	}
	function updateText(old, vnode) {
		if (old.children.toString() !== vnode.children.toString()) {
			old.dom.nodeValue = vnode.children
		}
		vnode.dom = old.dom
	}
	function updateHTML(parent, old, vnode, nextSibling) {
		if (old.children !== vnode.children) {
			toFragment(old)
			insertNode(parent, createHTML(vnode), nextSibling)
		}
		else vnode.dom = old.dom, vnode.domSize = old.domSize
	}
	function updateFragment(parent, old, vnode, hooks, nextSibling, ns) {
		updateNodes(parent, old.children, vnode.children, hooks, nextSibling, ns)
		var domSize = 0, children = vnode.children
		vnode.dom = null
		if (children != null) {
			for (var i = 0; i < children.length; i++) {
				var child = children[i]
				if (child != null && child.dom != null) {
					if (vnode.dom == null) vnode.dom = child.dom
					domSize += child.domSize || 1
				}
			}
			if (domSize !== 1) vnode.domSize = domSize
		}
	}
	function updateElement(old, vnode, hooks, ns) {
		var element = vnode.dom = old.dom
		switch (vnode.tag) {
			case "svg": ns = "http://www.w3.org/2000/svg"; break
			case "math": ns = "http://www.w3.org/1998/Math/MathML"; break
		}
		if (vnode.tag === "textarea") {
			if (vnode.attrs == null) vnode.attrs = {}
			if (vnode.text != null) {
				vnode.attrs.value = vnode.text //FIXME handle multiple children
				vnode.text = undefined
			}
		}
		updateAttrs(vnode, old.attrs, vnode.attrs, ns)
		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
			setContentEditable(vnode)
		}
		else if (old.text != null && vnode.text != null && vnode.text !== "") {
			if (old.text.toString() !== vnode.text.toString()) old.dom.firstChild.nodeValue = vnode.text
		}
		else {
			if (old.text != null) old.children = [Vnode("#", undefined, undefined, old.text, undefined, old.dom.firstChild)]
			if (vnode.text != null) vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]
			updateNodes(element, old.children, vnode.children, hooks, null, ns)
		}
	}
	function updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns) {
		vnode.instance = Vnode.normalize(vnode.tag.view.call(vnode.state, vnode))
		updateLifecycle(vnode.tag, vnode, hooks, recycling)
		if (vnode.instance != null) {
			if (old.instance == null) insertNode(parent, createNode(vnode.instance, hooks, ns), nextSibling)
			else updateNode(parent, old.instance, vnode.instance, hooks, nextSibling, recycling, ns)
			vnode.dom = vnode.instance.dom
			vnode.domSize = vnode.instance.domSize
		}
		else if (old.instance != null) {
			removeNode(old.instance, null)
			vnode.dom = undefined
			vnode.domSize = 0
		}
		else {
			vnode.dom = old.dom
			vnode.domSize = old.domSize
		}
	}
	function isRecyclable(old, vnodes) {
		if (old.pool != null && Math.abs(old.pool.length - vnodes.length) <= Math.abs(old.length - vnodes.length)) {
			var oldChildrenLength = old[0] && old[0].children && old[0].children.length || 0
			var poolChildrenLength = old.pool[0] && old.pool[0].children && old.pool[0].children.length || 0
			var vnodesChildrenLength = vnodes[0] && vnodes[0].children && vnodes[0].children.length || 0
			if (Math.abs(poolChildrenLength - vnodesChildrenLength) <= Math.abs(oldChildrenLength - vnodesChildrenLength)) {
				return true
			}
		}
		return false
	}
	function getKeyMap(vnodes, end) {
		var map = {}, i = 0
		for (var i = 0; i < end; i++) {
			var vnode = vnodes[i]
			if (vnode != null) {
				var key = vnode.key
				if (key != null) map[key] = i
			}
		}
		return map
	}
	function toFragment(vnode) {
		var count = vnode.domSize
		if (count != null || vnode.dom == null) {
			var fragment = $doc.createDocumentFragment()
			if (count > 0) {
				var dom = vnode.dom
				while (--count) fragment.appendChild(dom.nextSibling)
				fragment.insertBefore(dom, fragment.firstChild)
			}
			return fragment
		}
		else return vnode.dom
	}
	function getNextSibling(vnodes, i, nextSibling) {
		for (; i < vnodes.length; i++) {
			if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom
		}
		return nextSibling
	}

	function insertNode(parent, dom, nextSibling) {
		if (nextSibling && nextSibling.parentNode) parent.insertBefore(dom, nextSibling)
		else parent.appendChild(dom)
	}

	function setContentEditable(vnode) {
		var children = vnode.children
		if (children != null && children.length === 1 && children[0].tag === "<") {
			var content = children[0].children
			if (vnode.dom.innerHTML !== content) vnode.dom.innerHTML = content
		}
		else if (vnode.text != null || children != null && children.length !== 0) throw new Error("Child node of a contenteditable must be trusted")
	}

	//remove
	function removeNodes(vnodes, start, end, context) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i]
			if (vnode != null) {
				if (vnode.skip) vnode.skip = false
				else removeNode(vnode, context)
			}
		}
	}
	function once(f) {
		var called = false
		return function() {
			if (!called) {
				called = true
				f()
			}
		}
	}
	function removeNode(vnode, context) {
		var expected = 1, called = 0
		if (vnode.attrs && vnode.attrs.onbeforeremove) {
			expected++
			vnode.attrs.onbeforeremove.call(vnode.state, vnode, once(continuation))
		}
		if (typeof vnode.tag !== "string" && vnode.tag.onbeforeremove) {
			expected++
			vnode.tag.onbeforeremove.call(vnode.state, vnode, once(continuation))
		}
		continuation()
		function continuation() {
			if (++called === expected) {
				onremove(vnode)
				if (vnode.dom) {
					var count = vnode.domSize || 1
					if (count > 1) {
						var dom = vnode.dom
						while (--count) {
							removeNodeFromDOM(dom.nextSibling)
						}
					}
					removeNodeFromDOM(vnode.dom)
					if (context != null && vnode.domSize == null && !hasIntegrationMethods(vnode.attrs) && typeof vnode.tag === "string") { //TODO test custom elements
						if (!context.pool) context.pool = [vnode]
						else context.pool.push(vnode)
					}
				}
			}
		}
	}
	function removeNodeFromDOM(node) {
		var parent = node.parentNode
		if (parent != null) parent.removeChild(node)
	}
	function onremove(vnode) {
		if (vnode.attrs && vnode.attrs.onremove) vnode.attrs.onremove.call(vnode.state, vnode)
		if (typeof vnode.tag !== "string" && vnode.tag.onremove) vnode.tag.onremove.call(vnode.state, vnode)
		if (vnode.instance != null) onremove(vnode.instance)
		else {
			var children = vnode.children
			if (children instanceof Array) {
				for (var i = 0; i < children.length; i++) {
					var child = children[i]
					if (child != null) onremove(child)
				}
			}
		}
	}

	//attrs
	function setAttrs(vnode, attrs, ns) {
		for (var key in attrs) {
			setAttr(vnode, key, null, attrs[key], ns)
		}
	}
	function setAttr(vnode, key, old, value, ns) {
		var element = vnode.dom
		if (key === "key" || (old === value && !isFormAttribute(vnode, key)) && typeof value !== "object" || typeof value === "undefined" || isLifecycleMethod(key)) return
		var nsLastIndex = key.indexOf(":")
		if (nsLastIndex > -1 && key.substr(0, nsLastIndex) === "xlink") {
			element.setAttributeNS("http://www.w3.org/1999/xlink", key.slice(nsLastIndex + 1), value)
		}
		else if (key[0] === "o" && key[1] === "n" && typeof value === "function") updateEvent(vnode, key, value)
		else if (key === "style") updateStyle(element, old, value)
		else if (key in element && !isAttribute(key) && ns === undefined) {
			//setting input[value] to same value by typing on focused element moves cursor to end in Chrome
			if (vnode.tag === "input" && key === "value" && vnode.dom.value === value && vnode.dom === $doc.activeElement) return
			//setting select[value] to same value while having select open blinks select dropdown in Chrome
			if (vnode.tag === "select" && key === "value" && vnode.dom.value === value && vnode.dom === $doc.activeElement) return
			//setting option[value] to same value while having select open blinks select dropdown in Chrome
			if (vnode.tag === "option" && key === "value" && vnode.dom.value === value) return
			element[key] = value
		}
		else {
			if (typeof value === "boolean") {
				if (value) element.setAttribute(key, "")
				else element.removeAttribute(key)
			}
			else element.setAttribute(key === "className" ? "class" : key, value)
		}
	}
	function setLateAttrs(vnode) {
		var attrs = vnode.attrs
		if (vnode.tag === "select" && attrs != null) {
			if ("value" in attrs) setAttr(vnode, "value", null, attrs.value, undefined)
			if ("selectedIndex" in attrs) setAttr(vnode, "selectedIndex", null, attrs.selectedIndex, undefined)
		}
	}
	function updateAttrs(vnode, old, attrs, ns) {
		if (attrs != null) {
			for (var key in attrs) {
				setAttr(vnode, key, old && old[key], attrs[key], ns)
			}
		}
		if (old != null) {
			for (var key in old) {
				if (attrs == null || !(key in attrs)) {
					if (key === "className") key = "class"
					if (key[0] === "o" && key[1] === "n" && !isLifecycleMethod(key)) updateEvent(vnode, key, undefined)
					else if (key !== "key") vnode.dom.removeAttribute(key)
				}
			}
		}
	}
	function isFormAttribute(vnode, attr) {
		return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && vnode.dom === $doc.activeElement
	}
	function isLifecycleMethod(attr) {
		return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate"
	}
	function isAttribute(attr) {
		return attr === "href" || attr === "list" || attr === "form" || attr === "width" || attr === "height"// || attr === "type"
	}
	function hasIntegrationMethods(source) {
		return source != null && (source.oncreate || source.onupdate || source.onbeforeremove || source.onremove)
	}

	//style
	function updateStyle(element, old, style) {
		if (old === style) element.style.cssText = "", old = null
		if (style == null) element.style.cssText = ""
		else if (typeof style === "string") element.style.cssText = style
		else {
			if (typeof old === "string") element.style.cssText = ""
			for (var key in style) {
				element.style[key] = style[key]
			}
			if (old != null && typeof old !== "string") {
				for (var key in old) {
					if (!(key in style)) element.style[key] = ""
				}
			}
		}
	}

	//event
	function updateEvent(vnode, key, value) {
		var element = vnode.dom
		var callback = typeof onevent !== "function" ? value : function(e) {
			var result = value.call(element, e)
			onevent.call(element, e)
			return result
		}
		if (key in element) element[key] = typeof value === "function" ? callback : null
		else {
			var eventName = key.slice(2)
			if (vnode.events === undefined) vnode.events = {}
			if (vnode.events[key] === callback) return
			if (vnode.events[key] != null) element.removeEventListener(eventName, vnode.events[key], false)
			if (typeof value === "function") {
				vnode.events[key] = callback
				element.addEventListener(eventName, vnode.events[key], false)
			}
		}
	}

	//lifecycle
	function initLifecycle(source, vnode, hooks) {
		if (typeof source.oninit === "function") source.oninit.call(vnode.state, vnode)
		if (typeof source.oncreate === "function") hooks.push(source.oncreate.bind(vnode.state, vnode))
	}
	function updateLifecycle(source, vnode, hooks, recycling) {
		if (recycling) initLifecycle(source, vnode, hooks)
		else if (typeof source.onupdate === "function") hooks.push(source.onupdate.bind(vnode.state, vnode))
	}
	function shouldUpdate(vnode, old) {
		var forceVnodeUpdate, forceComponentUpdate
		if (vnode.attrs != null && typeof vnode.attrs.onbeforeupdate === "function") forceVnodeUpdate = vnode.attrs.onbeforeupdate.call(vnode.state, vnode, old)
		if (typeof vnode.tag !== "string" && typeof vnode.tag.onbeforeupdate === "function") forceComponentUpdate = vnode.tag.onbeforeupdate.call(vnode.state, vnode, old)
		if (!(forceVnodeUpdate === undefined && forceComponentUpdate === undefined) && !forceVnodeUpdate && !forceComponentUpdate) {
			vnode.dom = old.dom
			vnode.domSize = old.domSize
			vnode.instance = old.instance
			return true
		}
		return false
	}

	function assign(target, source) {
		Object.keys(source).forEach(function(k){target[k] = source[k]})
	}

	function render(dom, vnodes) {
		if (!dom) throw new Error("Ensure the DOM element being passed to m.route/m.mount/m.render is not undefined.")
		var hooks = []
		var active = $doc.activeElement

		// First time rendering into a node clears it out
		if (dom.vnodes == null) dom.textContent = ""

		if (!(vnodes instanceof Array)) vnodes = [vnodes]
		updateNodes(dom, dom.vnodes, Vnode.normalizeChildren(vnodes), hooks, null, undefined)
		dom.vnodes = vnodes
		for (var i = 0; i < hooks.length; i++) hooks[i]()
		if ($doc.activeElement !== active) active.focus()
	}

	return {render: render, setEventCallback: setEventCallback}
}

},{"../render/vnode":16}],15:[function(require,module,exports){
"use strict"

var Vnode = require("../render/vnode")

module.exports = function(html) {
	if (html == null) html = ""
	return Vnode("<", undefined, undefined, html, undefined, undefined)
}

},{"../render/vnode":16}],16:[function(require,module,exports){
function Vnode(tag, key, attrs, children, text, dom) {
	return {tag: tag, key: key, attrs: attrs, children: children, text: text, dom: dom, domSize: undefined, state: {}, events: undefined, instance: undefined, skip: false}
}
Vnode.normalize = function(node) {
	if (node instanceof Array) return Vnode("[", undefined, undefined, Vnode.normalizeChildren(node), undefined, undefined)
	if (node != null && typeof node !== "object") return Vnode("#", undefined, undefined, node, undefined, undefined)
	return node
}
Vnode.normalizeChildren = function normalizeChildren(children) {
	for (var i = 0; i < children.length; i++) {
		children[i] = Vnode.normalize(children[i])
	}
	return children
}

module.exports = Vnode

},{}],17:[function(require,module,exports){
var PromisePolyfill = require("./promise/promise")
module.exports = require("./request/request")(window, PromisePolyfill)

},{"./promise/promise":7,"./request/request":18}],18:[function(require,module,exports){
"use strict"

var buildQueryString = require("../querystring/build")

module.exports = function($window, Promise) {
	var callbackCount = 0

	var oncompletion
	function setCompletionCallback(callback) {oncompletion = callback}
	function finalizer() {
		var count = 0
		function complete() {if (--count === 0 && typeof oncompletion === "function") oncompletion()}

		return function finalize(promise) {
			var then = promise.then
			promise.then = function() {
				count++
				var next = then.apply(promise, arguments)
				next.then(complete, function(e) {
					complete()
					if (count === 0) throw e
				})
				return finalize(next)
			}
			return promise
		}
	}
	function normalize(args, extra) {
		if (typeof args === "string") {
			var url = args
			args = extra || {}
			if (args.url == null) args.url = url
		}
		return args
	}
	
	function request(args, extra) {
		var finalize = finalizer()
		args = normalize(args, extra)

		var promise = new Promise(function(resolve, reject) {
			if (args.method == null) args.method = "GET"
			args.method = args.method.toUpperCase()

			var useBody = typeof args.useBody === "boolean" ? args.useBody : args.method !== "GET" && args.method !== "TRACE"

			if (typeof args.serialize !== "function") args.serialize = typeof FormData !== "undefined" && args.data instanceof FormData ? function(value) {return value} : JSON.stringify
			if (typeof args.deserialize !== "function") args.deserialize = deserialize
			if (typeof args.extract !== "function") args.extract = extract

			args.url = interpolate(args.url, args.data)
			if (useBody) args.data = args.serialize(args.data)
			else args.url = assemble(args.url, args.data)

			var xhr = new $window.XMLHttpRequest()
			xhr.open(args.method, args.url, typeof args.async === "boolean" ? args.async : true, typeof args.user === "string" ? args.user : undefined, typeof args.password === "string" ? args.password : undefined)

			if (args.serialize === JSON.stringify && useBody) {
				xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8")
			}
			if (args.deserialize === deserialize) {
				xhr.setRequestHeader("Accept", "application/json, text/*")
			}
			if (args.withCredentials) xhr.withCredentials = args.withCredentials

			if (typeof args.config === "function") xhr = args.config(xhr, args) || xhr

			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					try {
						var response = (args.extract !== extract) ? args.extract(xhr, args) : args.deserialize(args.extract(xhr, args))
						if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
							resolve(cast(args.type, response))
						}
						else {
							var error = new Error(xhr.responseText)
							for (var key in response) error[key] = response[key]
							reject(error)
						}
					}
					catch (e) {
						reject(e)
					}
				}
			}

			if (useBody && (args.data != null)) xhr.send(args.data)
			else xhr.send()
		})
		return args.background === true ? promise : finalize(promise)
	}

	function jsonp(args, extra) {
		var finalize = finalizer()
		args = normalize(args, extra)
		
		var promise = new Promise(function(resolve, reject) {
			var callbackName = args.callbackName || "_mithril_" + Math.round(Math.random() * 1e16) + "_" + callbackCount++
			var script = $window.document.createElement("script")
			$window[callbackName] = function(data) {
				script.parentNode.removeChild(script)
				resolve(cast(args.type, data))
				delete $window[callbackName]
			}
			script.onerror = function() {
				script.parentNode.removeChild(script)
				reject(new Error("JSONP request failed"))
				delete $window[callbackName]
			}
			if (args.data == null) args.data = {}
			args.url = interpolate(args.url, args.data)
			args.data[args.callbackKey || "callback"] = callbackName
			script.src = assemble(args.url, args.data)
			$window.document.documentElement.appendChild(script)
		})
		return args.background === true? promise : finalize(promise)
	}

	function interpolate(url, data) {
		if (data == null) return url

		var tokens = url.match(/:[^\/]+/gi) || []
		for (var i = 0; i < tokens.length; i++) {
			var key = tokens[i].slice(1)
			if (data[key] != null) {
				url = url.replace(tokens[i], data[key])
				delete data[key]
			}
		}
		return url
	}

	function assemble(url, data) {
		var querystring = buildQueryString(data)
		if (querystring !== "") {
			var prefix = url.indexOf("?") < 0 ? "?" : "&"
			url += prefix + querystring
		}
		return url
	}

	function deserialize(data) {
		try {return data !== "" ? JSON.parse(data) : null}
		catch (e) {throw new Error(data)}
	}

	function extract(xhr) {return xhr.responseText}

	function cast(type, data) {
		if (typeof type === "function") {
			if (data instanceof Array) {
				for (var i = 0; i < data.length; i++) {
					data[i] = new type(data[i])
				}
			}
			else return new type(data)
		}
		return data
	}

	return {request: request, jsonp: jsonp, setCompletionCallback: setCompletionCallback}
}

},{"../querystring/build":8}],19:[function(require,module,exports){
var redrawService = require("./redraw")

module.exports = require("./api/router")(window, redrawService)
},{"./api/router":3,"./redraw":10}],20:[function(require,module,exports){
"use strict"

var buildQueryString = require("../querystring/build")
var parseQueryString = require("../querystring/parse")

module.exports = function($window) {
	var supportsPushState = typeof $window.history.pushState === "function"
	var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout

	function normalize(fragment) {
		var data = $window.location[fragment].replace(/(?:%[a-f89][a-f0-9])+/gim, decodeURIComponent)
		if (fragment === "pathname" && data[0] !== "/") data = "/" + data
		return data
	}

	var asyncId
	function debounceAsync(callback) {
		return function() {
			if (asyncId != null) return
			asyncId = callAsync(function() {
				asyncId = null
				callback()
			})
		}
	}

	function parsePath(path, queryData, hashData) {
		var queryIndex = path.indexOf("?")
		var hashIndex = path.indexOf("#")
		var pathEnd = queryIndex > -1 ? queryIndex : hashIndex > -1 ? hashIndex : path.length
		if (queryIndex > -1) {
			var queryEnd = hashIndex > -1 ? hashIndex : path.length
			var queryParams = parseQueryString(path.slice(queryIndex + 1, queryEnd))
			for (var key in queryParams) queryData[key] = queryParams[key]
		}
		if (hashIndex > -1) {
			var hashParams = parseQueryString(path.slice(hashIndex + 1))
			for (var key in hashParams) hashData[key] = hashParams[key]
		}
		return path.slice(0, pathEnd)
	}

	var router = {prefix: "#!"}
	router.getPath = function() {
		var type = router.prefix.charAt(0)
		switch (type) {
			case "#": return normalize("hash").slice(router.prefix.length)
			case "?": return normalize("search").slice(router.prefix.length) + normalize("hash")
			default: return normalize("pathname").slice(router.prefix.length) + normalize("search") + normalize("hash")
		}
	}
	router.setPath = function(path, data, options) {
		var queryData = {}, hashData = {}
		path = parsePath(path, queryData, hashData)
		if (data != null) {
			for (var key in data) queryData[key] = data[key]
			path = path.replace(/:([^\/]+)/g, function(match, token) {
				delete queryData[token]
				return data[token]
			})
		}

		var query = buildQueryString(queryData)
		if (query) path += "?" + query

		var hash = buildQueryString(hashData)
		if (hash) path += "#" + hash

		if (supportsPushState) {
			if (options && options.replace) $window.history.replaceState(null, null, router.prefix + path)
			else $window.history.pushState(null, null, router.prefix + path)
			$window.onpopstate()
		}
		else $window.location.href = router.prefix + path
	}
	router.defineRoutes = function(routes, resolve, reject) {
		function resolveRoute() {
			var path = router.getPath()
			var params = {}
			var pathname = parsePath(path, params, params)
			
			for (var route in routes) {
				var matcher = new RegExp("^" + route.replace(/:[^\/]+?\.{3}/g, "(.*?)").replace(/:[^\/]+/g, "([^\\/]+)") + "\/?$")

				if (matcher.test(pathname)) {
					pathname.replace(matcher, function() {
						var keys = route.match(/:[^\/]+/g) || []
						var values = [].slice.call(arguments, 1, -2)
						for (var i = 0; i < keys.length; i++) {
							params[keys[i].replace(/:|\./g, "")] = decodeURIComponent(values[i])
						}
						resolve(routes[route], params, path, route)
					})
					return
				}
			}

			reject(path, params)
		}
		
		if (supportsPushState) $window.onpopstate = debounceAsync(resolveRoute)
		else if (router.prefix.charAt(0) === "#") $window.onhashchange = resolveRoute
		resolveRoute()
	}
	
	return router
}

},{"../querystring/build":8,"../querystring/parse":9}],21:[function(require,module,exports){
module.exports = require("./stream/stream")
},{"./stream/stream":22}],22:[function(require,module,exports){
"use strict"

var guid = 0, HALT = {}
function createStream() {
	function stream() {
		if (arguments.length > 0 && arguments[0] !== HALT) updateStream(stream, arguments[0])
		return stream._state.value
	}
	initStream(stream)

	if (arguments.length > 0 && arguments[0] !== HALT) updateStream(stream, arguments[0])

	return stream
}
function initStream(stream) {
	stream.constructor = createStream
	stream._state = {id: guid++, value: undefined, state: 0, derive: undefined, recover: undefined, deps: {}, parents: [], endStream: undefined}
	stream.map = stream["fantasy-land/map"] = map, stream["fantasy-land/ap"] = ap, stream["fantasy-land/of"] = createStream
	stream.valueOf = valueOf, stream.toJSON = toJSON, stream.toString = valueOf

	Object.defineProperties(stream, {
		end: {get: function() {
			if (!stream._state.endStream) {
				var endStream = createStream()
				endStream.map(function(value) {
					if (value === true) unregisterStream(stream), unregisterStream(endStream)
					return value
				})
				stream._state.endStream = endStream
			}
			return stream._state.endStream
		}}
	})
}
function updateStream(stream, value) {
	updateState(stream, value)
	for (var id in stream._state.deps) updateDependency(stream._state.deps[id], false)
	finalize(stream)
}
function updateState(stream, value) {
	stream._state.value = value
	stream._state.changed = true
	if (stream._state.state !== 2) stream._state.state = 1
}
function updateDependency(stream, mustSync) {
	var state = stream._state, parents = state.parents
	if (parents.length > 0 && parents.every(active) && (mustSync || parents.some(changed))) {
		var value = stream._state.derive()
		if (value === HALT) return false
		updateState(stream, value)
	}
}
function finalize(stream) {
	stream._state.changed = false
	for (var id in stream._state.deps) stream._state.deps[id]._state.changed = false
}

function combine(fn, streams) {
	if (!streams.every(valid)) throw new Error("Ensure that each item passed to m.prop.combine/m.prop.merge is a stream")
	return initDependency(createStream(), streams, function() {
		return fn.apply(this, streams.concat([streams.filter(changed)]))
	})
}

function initDependency(dep, streams, derive) {
	var state = dep._state
	state.derive = derive
	state.parents = streams.filter(notEnded)

	registerDependency(dep, state.parents)
	updateDependency(dep, true)

	return dep
}
function registerDependency(stream, parents) {
	for (var i = 0; i < parents.length; i++) {
		parents[i]._state.deps[stream._state.id] = stream
		registerDependency(stream, parents[i]._state.parents)
	}
}
function unregisterStream(stream) {
	for (var i = 0; i < stream._state.parents.length; i++) {
		var parent = stream._state.parents[i]
		delete parent._state.deps[stream._state.id]
	}
	for (var id in stream._state.deps) {
		var dependent = stream._state.deps[id]
		var index = dependent._state.parents.indexOf(stream)
		if (index > -1) dependent._state.parents.splice(index, 1)
	}
	stream._state.state = 2 //ended
	stream._state.deps = {}
}

function map(fn) {return combine(function(stream) {return fn(stream())}, [this])}
function ap(stream) {return combine(function(s1, s2) {return s1()(s2())}, [stream, this])}
function valueOf() {return this._state.value}
function toJSON() {return this._state.value != null && typeof this._state.value.toJSON === "function" ? this._state.value.toJSON() : this._state.value}

function valid(stream) {return stream._state }
function active(stream) {return stream._state.state === 1}
function changed(stream) {return stream._state.changed}
function notEnded(stream) {return stream._state.state !== 2}

function merge(streams) {
	return combine(function() {
		return streams.map(function(s) {return s()})
	}, streams)
}
createStream["fantasy-land/of"] = createStream
createStream.merge = merge
createStream.combine = combine
createStream.HALT = HALT

module.exports = createStream

},{}],23:[function(require,module,exports){
"use strict"

module.exports = function(attrName, callback, context) {
	return function(e) {
		return callback.call(context || this, attrName in e.currentTarget ? e.currentTarget[attrName] : e.currentTarget.getAttribute(attrName))
	}
}

},{}],24:[function(require,module,exports){
'use strict';

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _IndexPage = require('./core/page/IndexPage');

var _IndexPage2 = _interopRequireDefault(_IndexPage);

var _DatabasePage = require('./core/page/DatabasePage');

var _DatabasePage2 = _interopRequireDefault(_DatabasePage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.onload = function () {

    // routes
    _mithril2.default.route(document.querySelector("routes"), "/", {
        "/": _IndexPage2.default,
        "/db/:dbname": _DatabasePage2.default
    });
};

},{"./core/page/DatabasePage":30,"./core/page/IndexPage":31,"mithril":5}],25:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _Http = require('../service/Http');

var _Http2 = _interopRequireDefault(_Http);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx m */

exports.default = {

    databases: [],
    response: {},

    oncreate: function oncreate() {

        var self = this;

        _Http2.default.post("/database/list", {}).then(function (r) {

            if (r.code == 200) {
                self.databases = r.payload;
            } else {
                self.response = r;
            }
        });
    },

    chooseDatabase: function chooseDatabase(database) {
        _mithril2.default.route.set("/db/" + database);
    },

    view: function view() {

        var self = this;

        return (0, _mithril2.default)(
            'div',
            null,
            (0, _mithril2.default)(
                'table',
                { className: 'w3-table-all w3-hoverable' },
                (0, _mithril2.default)(
                    'thead',
                    null,
                    (0, _mithril2.default)(
                        'tr',
                        null,
                        (0, _mithril2.default)(
                            'th',
                            null,
                            'Database name'
                        )
                    )
                ),
                (0, _mithril2.default)(
                    'tbody',
                    null,
                    self.databases.map(function (database) {
                        return (0, _mithril2.default)(
                            'tr',
                            { key: database.Database },
                            (0, _mithril2.default)(
                                'td',
                                {
                                    onclick: self.chooseDatabase.bind(self, database.Database)
                                },
                                database.Database
                            )
                        );
                    })
                )
            )
        );
    }

};

},{"../service/Http":32,"mithril":5}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /** @jsx m */

var _mithril = require("mithril");

var _mithril2 = _interopRequireDefault(_mithril);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {

    oninit: function oninit() {},

    view: function view(vnode) {
        return (0, _mithril2.default)(
            "div",
            _extends({}, vnode.attrs, { className: "w3-padding-top" }),
            vnode.children
        );
    }

};

},{"mithril":5}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _Http = require('../service/Http');

var _Http2 = _interopRequireDefault(_Http);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx m */

exports.default = {

    tables: [],
    dbname: null,
    selectedTable: null,
    response: {},

    oninit: function oninit(vnode) {
        this.dbname = vnode.attrs.dbname;
    },

    oncreate: function oncreate() {
        this.listTables();
    },

    listTables: function listTables() {
        var self = this;

        _Http2.default.post("/table/list", { dbname: this.dbname }).then(function (r) {

            if (r.code == 200) {
                self.tables = r.payload;
            } else {
                self.response = r;
            }
        });
    },

    _onTableSelect: function _onTableSelect(table, onTableSelect) {
        this.selectedTable = table;
        onTableSelect(table);
    },

    view: function view(vnode) {

        var self = this;

        return (0, _mithril2.default)(
            'div',
            null,
            (0, _mithril2.default)(
                'table',
                { className: 'w3-table-all w3-hoverable' },
                (0, _mithril2.default)(
                    'thead',
                    null,
                    (0, _mithril2.default)(
                        'tr',
                        null,
                        (0, _mithril2.default)(
                            'th',
                            null,
                            'Table name'
                        )
                    )
                ),
                (0, _mithril2.default)(
                    'tbody',
                    null,
                    self.tables.map(function (table) {

                        var isActive = "";

                        if (table === self.selectedTable) {
                            isActive = "w3-green";
                        }

                        return (0, _mithril2.default)(
                            'tr',
                            { key: table, className: isActive },
                            (0, _mithril2.default)(
                                'td',
                                {
                                    onclick: self._onTableSelect.bind(self, table, vnode.attrs.onTableSelect)
                                },
                                table
                            )
                        );
                    })
                )
            )
        );
    }

};

},{"../service/Http":32,"mithril":5}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _Http = require('../service/Http');

var _Http2 = _interopRequireDefault(_Http);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx m */

exports.default = {

    tablename: null,
    dbname: null,
    row: null,
    column: null,
    response: {},

    oninit: function oninit(vnode) {
        this.dbname = vnode.attrs.dbname;
        this.tablename = vnode.attrs.tablename;
        this.row = vnode.attrs.row;
        this.column = vnode.attrs.column;
    },

    onRowDoubleClick: function onRowDoubleClick() {
        this.row[this.column.Field]._isEditing = !this.row[this.column.Field]._isEditing;
    },

    onRowEnterKey: function onRowEnterKey(e) {
        e.preventDefault();
        this.row[this.column.Field]._isEditing = false;
        console.log(this.row[this.column.Field]["data"]);
    },

    view: function view(vnode) {

        var self = this;

        var toShow;
        var input = (0, _mithril2.default)(
            'form',
            { onsubmit: self.onRowEnterKey.bind(self) },
            (0, _mithril2.default)('input', {
                type: 'text',
                value: self.row[self.column.Field]["data"](),
                onchange: _mithril2.default.withAttr("value", self.row[self.column.Field]["data"]),
                style: 'width:100%;'
            })
        );

        if (self.row[self.column.Field]._isEditing) {
            toShow = input;
        } else {
            toShow = self.row[self.column.Field]["data"]();
        }

        return (0, _mithril2.default)(
            'td',
            {
                ondblclick: self.onRowDoubleClick.bind(self)
            },
            toShow
        );
    }

};

},{"../service/Http":32,"mithril":5}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {

    selected: -1,
    onTabChangeFunc: null,

    oninit: function oninit(vnode) {
        this.selected = typeof vnode.attrs.selected == 'number' ? parseInt(vnode.attrs.selected) : -1;
        this.onTabChangeFunc = vnode.attrs.onTabChange;
    },

    oncreate: function oncreate(vnode) {
        this.selectTab(0);
    },

    selectTab: function selectTab(index) {
        this.selected = index;
        this.onTabChangeFunc && this.onTabChangeFunc(index);
    },

    view: function view(vnode) {

        var self = this;

        return (0, _mithril2.default)(
            'div',
            null,
            (0, _mithril2.default)(
                'ul',
                { className: 'w3-navbar w3-light-gray w3-border' },
                vnode.children.map(function (tab, index) {

                    var bgColor = "";

                    if (self.selected == index) {
                        bgColor = "w3-gray";
                    }

                    return (0, _mithril2.default)(
                        'li',
                        { className: bgColor },
                        (0, _mithril2.default)(
                            'a',
                            { className: 'pointer', onclick: self.selectTab.bind(self, index) },
                            tab.attrs.label
                        )
                    );
                })
            ),
            self.selected > -1 ? (0, _mithril2.default)(
                'div',
                null,
                vnode.children[self.selected]
            ) : ''
        );
    }

}; /** @jsx m */

},{"mithril":5}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _stream = require('mithril/stream');

var _stream2 = _interopRequireDefault(_stream);

var _Http = require('../service/Http');

var _Http2 = _interopRequireDefault(_Http);

var _TableList = require('../component/TableList');

var _TableList2 = _interopRequireDefault(_TableList);

var _TableListRow = require('../component/TableListRow');

var _TableListRow2 = _interopRequireDefault(_TableListRow);

var _Tab = require('../component/Tab');

var _Tab2 = _interopRequireDefault(_Tab);

var _Tabs = require('../component/Tabs');

var _Tabs2 = _interopRequireDefault(_Tabs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = {

    dbname: null,
    tablename: null,
    columns: [],
    rows: [],
    limit: 10,
    page: 1,
    response: {},

    oninit: function oninit(vnode) {
        this.page = vnode.attrs.page || 1;
        this.dbname = vnode.attrs.dbname;
        this.tablename = vnode.attrs.tablename || null;
    },

    oncreate: function oncreate(vnode) {

        var self = this;

        if (this.tablename) {
            self.listColumns();
        }
    },

    onTableSelect: function onTableSelect(table) {
        this.tablename = table;
        this.listColumns();
    },

    listColumns: function listColumns() {
        var self = this;

        self.columns = [];
        self.rows = [];

        _Http2.default.post("/table/column/list", {
            dbname: self.dbname,
            tablename: self.tablename
        }).then(function (r) {

            if (r.code == 200) {
                self.columns = r.payload;
            } else {
                self.response = r;
            }

            //after columns
            self.listRows(self.page);
        });
    },


    listRows: function listRows() {

        var self = this;

        _Http2.default.post("/table/rows", {
            dbname: self.dbname, tablename: self.tablename,
            limit: self.limit, offset: (parseInt(self.page) - 1) * self.limit
        }).then(function (r) {

            if (r.code == 200) {
                for (var j = 0; j < r.payload.length; j++) {

                    var row = r.payload[j];

                    // map row data to this obj using m.prop()
                    var tempRowData = {};

                    for (var i = 0; i < self.columns.length; i++) {

                        var column = self.columns[i];

                        tempRowData[column.Field] = {};

                        tempRowData[column.Field]["_isEditing"] = false;
                        tempRowData[column.Field]["data"] = (0, _stream2.default)(row[column.Field]);
                    }

                    self.rows.push(tempRowData);
                }
            } else {
                self.response = r;
            }
        });
    },

    hasRows: function hasRows() {
        return this.rows.length > 0;
    },

    loadOld: function loadOld() {
        this.page = this.page - 1;
        this.rows = [];
        this.listRows();
    },

    loadNew: function loadNew() {
        this.page = this.page + 1;
        this.rows = [];
        this.listRows();
    },

    view: function view() {

        var self = this;

        return (0, _mithril2.default)(
            'div',
            null,
            (0, _mithril2.default)(
                'div',
                { className: 'w3-row' },
                (0, _mithril2.default)(
                    'div',
                    { className: 'w3-col m3' },
                    (0, _mithril2.default)(_TableList2.default, { dbname: self.dbname, onTableSelect: self.onTableSelect.bind(self) })
                ),
                (0, _mithril2.default)(
                    'div',
                    { className: 'w3-col', style: "width:10px;" },
                    '\xA0'
                ),
                (0, _mithril2.default)(
                    'div',
                    { className: 'w3-rest' },
                    (0, _mithril2.default)(
                        _Tabs2.default,
                        null,
                        (0, _mithril2.default)(
                            _Tab2.default,
                            { label: 'Columns' },
                            (0, _mithril2.default)(
                                'table',
                                { className: 'w3-table-all w3-hoverable' },
                                (0, _mithril2.default)(
                                    'thead',
                                    null,
                                    (0, _mithril2.default)(
                                        'tr',
                                        null,
                                        self.columns.map(function (r) {
                                            return (0, _mithril2.default)(
                                                'th',
                                                null,
                                                r.Field
                                            );
                                        })
                                    )
                                ),
                                (0, _mithril2.default)(
                                    'tbody',
                                    null,
                                    self.rows.map(function (row) {

                                        return (0, _mithril2.default)(
                                            'tr',
                                            null,
                                            self.columns.map(function (column) {

                                                return (0, _mithril2.default)(_TableListRow2.default, {
                                                    dbname: self.dbname,
                                                    tablename: self.tablename,
                                                    row: row,
                                                    column: column
                                                });
                                            })
                                        );
                                    })
                                )
                            ),
                            self.hasRows() ? (0, _mithril2.default)(
                                'ul',
                                { 'class': 'w3-pagination w3-borde' },
                                (0, _mithril2.default)(
                                    'li',
                                    null,
                                    (0, _mithril2.default)(
                                        'a',
                                        { onclick: self.loadOld.bind(self) },
                                        '\xAB'
                                    )
                                ),
                                (0, _mithril2.default)(
                                    'li',
                                    null,
                                    (0, _mithril2.default)(
                                        'a',
                                        { onclick: self.loadNew.bind(self) },
                                        '\xBB'
                                    )
                                )
                            ) : ''
                        ),
                        (0, _mithril2.default)(
                            _Tab2.default,
                            { label: 'Query' },
                            'Query'
                        )
                    )
                )
            )
        );
    }

}; /** @jsx m */

},{"../component/Tab":26,"../component/TableList":27,"../component/TableListRow":28,"../component/Tabs":29,"../service/Http":32,"mithril":5,"mithril/stream":21}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require('mithril');

var _mithril2 = _interopRequireDefault(_mithril);

var _DbList = require('../component/DbList');

var _DbList2 = _interopRequireDefault(_DbList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/** @jsx m */

exports.default = {

    view: function view() {

        var self = this;

        return (0, _mithril2.default)(
            'div',
            null,
            (0, _mithril2.default)(_DbList2.default, null)
        );
    }

};

},{"../component/DbList":25,"mithril":5}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mithril = require("mithril");

var _mithril2 = _interopRequireDefault(_mithril);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function req(url, data, type) {

    if (!data) {
        data = {};
    }

    return _mithril2.default.request({
        method: type,
        url: url,
        data: data
    });
}

function post(url, data) {
    return req(url, data, "POST");
}

function get(url, data) {
    return req(url, data, "GET");
}

exports.default = { post: post, get: get };

},{"mithril":5}]},{},[24])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9hcGkvbW91bnQuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9hcGkvcmVkcmF3LmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvYXBpL3JvdXRlci5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL2h5cGVyc2NyaXB0LmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9tb3VudC5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3Byb21pc2UvcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3F1ZXJ5c3RyaW5nL2J1aWxkLmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvcXVlcnlzdHJpbmcvcGFyc2UuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9yZWRyYXcuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9yZW5kZXIuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9yZW5kZXIvZnJhZ21lbnQuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9yZW5kZXIvaHlwZXJzY3JpcHQuanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC9yZW5kZXIvcmVuZGVyLmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvcmVuZGVyL3RydXN0LmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvcmVuZGVyL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvcmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3JlcXVlc3QvcmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3JvdXRlLmpzIiwibm9kZV9tb2R1bGVzL21pdGhyaWwvcm91dGVyL3JvdXRlci5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3N0cmVhbS5qcyIsIm5vZGVfbW9kdWxlcy9taXRocmlsL3N0cmVhbS9zdHJlYW0uanMiLCJub2RlX21vZHVsZXMvbWl0aHJpbC91dGlsL3dpdGhBdHRyLmpzIiwicHVibGljL2FwcC5qcyIsInB1YmxpYy9jb3JlL2NvbXBvbmVudC9EYkxpc3QuanMiLCJwdWJsaWMvY29yZS9jb21wb25lbnQvVGFiLmpzIiwicHVibGljL2NvcmUvY29tcG9uZW50L1RhYmxlTGlzdC5qcyIsInB1YmxpYy9jb3JlL2NvbXBvbmVudC9UYWJsZUxpc3RSb3cuanMiLCJwdWJsaWMvY29yZS9jb21wb25lbnQvVGFicy5qcyIsInB1YmxpYy9jb3JlL3BhZ2UvRGF0YWJhc2VQYWdlLmpzIiwicHVibGljL2NvcmUvcGFnZS9JbmRleFBhZ2UuanMiLCJwdWJsaWMvY29yZS9zZXJ2aWNlL0h0dHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBOzs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBOztBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsa0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEtBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0dBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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SEE7O2tCQUtnQjs7QUFFWixVQUFNLGdCQUFZOztBQUVkLFlBQUksT0FBTyxJQUFYOztBQUVBLGVBQ0k7QUFBQTtBQUFBO0FBQ0k7QUFESixTQURKO0FBS0g7O0FBWFcsQzs7Ozs7Ozs7O0FDTGhCOzs7Ozs7QUFFQSxTQUFTLEdBQVQsQ0FBYSxHQUFiLEVBQWtCLElBQWxCLEVBQXdCLElBQXhCLEVBQThCOztBQUUxQixRQUFHLENBQUMsSUFBSixFQUFVO0FBQ04sZUFBTyxFQUFQO0FBQ0g7O0FBRUQsV0FBTyxrQkFBRSxPQUFGLENBQVU7QUFDYixnQkFBUSxJQURLO0FBRWIsYUFBSyxHQUZRO0FBR2IsY0FBTTtBQUhPLEtBQVYsQ0FBUDtBQUtIOztBQUVELFNBQVMsSUFBVCxDQUFlLEdBQWYsRUFBb0IsSUFBcEIsRUFBMEI7QUFDdEIsV0FBTyxJQUFJLEdBQUosRUFBUyxJQUFULEVBQWUsTUFBZixDQUFQO0FBQ0g7O0FBRUQsU0FBUyxHQUFULENBQWMsR0FBZCxFQUFtQixJQUFuQixFQUF5QjtBQUNyQixXQUFPLElBQUksR0FBSixFQUFTLElBQVQsRUFBZSxLQUFmLENBQVA7QUFDSDs7a0JBRWMsRUFBRSxVQUFGLEVBQVEsUUFBUixFIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihyZWRyYXdTZXJ2aWNlKSB7XG5cdHJldHVybiBmdW5jdGlvbihyb290LCBjb21wb25lbnQpIHtcblx0XHRpZiAoY29tcG9uZW50ID09PSBudWxsKSB7XG5cdFx0XHRyZWRyYXdTZXJ2aWNlLnJlbmRlcihyb290LCBbXSlcblx0XHRcdHJlZHJhd1NlcnZpY2UudW5zdWJzY3JpYmUocm9vdClcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHRcblx0XHRpZiAoY29tcG9uZW50LnZpZXcgPT0gbnVsbCkgdGhyb3cgbmV3IEVycm9yKFwibS5tb3VudChlbGVtZW50LCBjb21wb25lbnQpIGV4cGVjdHMgYSBjb21wb25lbnQsIG5vdCBhIHZub2RlXCIpXG5cdFx0XG5cdFx0dmFyIHJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmVkcmF3U2VydmljZS5yZW5kZXIocm9vdCwgVm5vZGUoY29tcG9uZW50KSlcblx0XHR9XG5cdFx0cmVkcmF3U2VydmljZS5zdWJzY3JpYmUocm9vdCwgcnVuKVxuXHRcdHJlZHJhd1NlcnZpY2UucmVkcmF3KClcblx0fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIGNvcmVSZW5kZXJlciA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvcmVuZGVyXCIpXG5cbmZ1bmN0aW9uIHRocm90dGxlKGNhbGxiYWNrKSB7XG5cdC8vNjBmcHMgdHJhbnNsYXRlcyB0byAxNi42bXMsIHJvdW5kIGl0IGRvd24gc2luY2Ugc2V0VGltZW91dCByZXF1aXJlcyBpbnRcblx0dmFyIHRpbWUgPSAxNlxuXHR2YXIgbGFzdCA9IDAsIHBlbmRpbmcgPSBudWxsXG5cdHZhciB0aW1lb3V0ID0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9PT0gXCJmdW5jdGlvblwiID8gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDogc2V0VGltZW91dFxuXHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vdyA9IERhdGUubm93KClcblx0XHRpZiAobGFzdCA9PT0gMCB8fCBub3cgLSBsYXN0ID49IHRpbWUpIHtcblx0XHRcdGxhc3QgPSBub3dcblx0XHRcdGNhbGxiYWNrKClcblx0XHR9XG5cdFx0ZWxzZSBpZiAocGVuZGluZyA9PT0gbnVsbCkge1xuXHRcdFx0cGVuZGluZyA9IHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHBlbmRpbmcgPSBudWxsXG5cdFx0XHRcdGNhbGxiYWNrKClcblx0XHRcdFx0bGFzdCA9IERhdGUubm93KClcblx0XHRcdH0sIHRpbWUgLSAobm93IC0gbGFzdCkpXG5cdFx0fVxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHdpbmRvdykge1xuXHR2YXIgcmVuZGVyU2VydmljZSA9IGNvcmVSZW5kZXJlcigkd2luZG93KVxuXHRyZW5kZXJTZXJ2aWNlLnNldEV2ZW50Q2FsbGJhY2soZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLnJlZHJhdyAhPT0gZmFsc2UpIHJlZHJhdygpXG5cdH0pXG5cdFxuXHR2YXIgY2FsbGJhY2tzID0gW11cblx0ZnVuY3Rpb24gc3Vic2NyaWJlKGtleSwgY2FsbGJhY2spIHtcblx0XHR1bnN1YnNjcmliZShrZXkpXG5cdFx0Y2FsbGJhY2tzLnB1c2goa2V5LCB0aHJvdHRsZShjYWxsYmFjaykpXG5cdH1cblx0ZnVuY3Rpb24gdW5zdWJzY3JpYmUoa2V5KSB7XG5cdFx0dmFyIGluZGV4ID0gY2FsbGJhY2tzLmluZGV4T2Yoa2V5KVxuXHRcdGlmIChpbmRleCA+IC0xKSBjYWxsYmFja3Muc3BsaWNlKGluZGV4LCAyKVxuXHR9XG4gICAgZnVuY3Rpb24gcmVkcmF3KCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICAgICAgY2FsbGJhY2tzW2ldKClcbiAgICAgICAgfVxuICAgIH1cblx0cmV0dXJuIHtzdWJzY3JpYmU6IHN1YnNjcmliZSwgdW5zdWJzY3JpYmU6IHVuc3Vic2NyaWJlLCByZWRyYXc6IHJlZHJhdywgcmVuZGVyOiByZW5kZXJTZXJ2aWNlLnJlbmRlcn1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcbnZhciBQcm9taXNlID0gcmVxdWlyZShcIi4uL3Byb21pc2UvcHJvbWlzZVwiKVxudmFyIGNvcmVSb3V0ZXIgPSByZXF1aXJlKFwiLi4vcm91dGVyL3JvdXRlclwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCR3aW5kb3csIHJlZHJhd1NlcnZpY2UpIHtcblx0dmFyIHJvdXRlU2VydmljZSA9IGNvcmVSb3V0ZXIoJHdpbmRvdylcblxuXHR2YXIgaWRlbnRpdHkgPSBmdW5jdGlvbih2KSB7cmV0dXJuIHZ9XG5cdHZhciByZW5kZXIsIGNvbXBvbmVudCwgYXR0cnMsIGN1cnJlbnRQYXRoLCB1cGRhdGVQZW5kaW5nID0gZmFsc2Vcblx0dmFyIHJvdXRlID0gZnVuY3Rpb24ocm9vdCwgZGVmYXVsdFJvdXRlLCByb3V0ZXMpIHtcblx0XHRpZiAocm9vdCA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoXCJFbnN1cmUgdGhlIERPTSBlbGVtZW50IHRoYXQgd2FzIHBhc3NlZCB0byBgbS5yb3V0ZWAgaXMgbm90IHVuZGVmaW5lZFwiKVxuXHRcdHZhciB1cGRhdGUgPSBmdW5jdGlvbihyb3V0ZVJlc29sdmVyLCBjb21wLCBwYXJhbXMsIHBhdGgpIHtcblx0XHRcdGNvbXBvbmVudCA9IGNvbXAgIT0gbnVsbCAmJiB0eXBlb2YgY29tcC52aWV3ID09PSBcImZ1bmN0aW9uXCIgPyBjb21wIDogXCJkaXZcIiwgYXR0cnMgPSBwYXJhbXMsIGN1cnJlbnRQYXRoID0gcGF0aCwgdXBkYXRlUGVuZGluZyA9IGZhbHNlXG5cdFx0XHRyZW5kZXIgPSAocm91dGVSZXNvbHZlci5yZW5kZXIgfHwgaWRlbnRpdHkpLmJpbmQocm91dGVSZXNvbHZlcilcblx0XHRcdHJ1bigpXG5cdFx0fVxuXHRcdHZhciBydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmIChyZW5kZXIgIT0gbnVsbCkgcmVkcmF3U2VydmljZS5yZW5kZXIocm9vdCwgcmVuZGVyKFZub2RlKGNvbXBvbmVudCwgYXR0cnMua2V5LCBhdHRycykpKVxuXHRcdH1cblx0XHR2YXIgYmFpbCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cm91dGVTZXJ2aWNlLnNldFBhdGgoZGVmYXVsdFJvdXRlKVxuXHRcdH1cblx0XHRyb3V0ZVNlcnZpY2UuZGVmaW5lUm91dGVzKHJvdXRlcywgZnVuY3Rpb24ocGF5bG9hZCwgcGFyYW1zLCBwYXRoKSB7XG5cdFx0XHRpZiAocGF5bG9hZC52aWV3KSB1cGRhdGUoe30sIHBheWxvYWQsIHBhcmFtcywgcGF0aClcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAocGF5bG9hZC5vbm1hdGNoKSB7XG5cdFx0XHRcdFx0dXBkYXRlUGVuZGluZyA9IHRydWVcblx0XHRcdFx0XHRQcm9taXNlLnJlc29sdmUocGF5bG9hZC5vbm1hdGNoKHBhcmFtcywgcGF0aCkpLnRoZW4oZnVuY3Rpb24ocmVzb2x2ZWQpIHtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGVQZW5kaW5nKSB1cGRhdGUocGF5bG9hZCwgcmVzb2x2ZWQsIHBhcmFtcywgcGF0aClcblx0XHRcdFx0XHR9LCBiYWlsKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgdXBkYXRlKHBheWxvYWQsIFwiZGl2XCIsIHBhcmFtcywgcGF0aClcblx0XHRcdH1cblx0XHR9LCBiYWlsKVxuXHRcdHJlZHJhd1NlcnZpY2Uuc3Vic2NyaWJlKHJvb3QsIHJ1bilcblx0fVxuXHRyb3V0ZS5zZXQgPSBmdW5jdGlvbihwYXRoLCBkYXRhLCBvcHRpb25zKSB7XG5cdFx0aWYgKHVwZGF0ZVBlbmRpbmcpIG9wdGlvbnMgPSB7cmVwbGFjZTogdHJ1ZX1cblx0XHR1cGRhdGVQZW5kaW5nID0gZmFsc2Vcblx0XHRyb3V0ZVNlcnZpY2Uuc2V0UGF0aChwYXRoLCBkYXRhLCBvcHRpb25zKVxuXHR9XG5cdHJvdXRlLmdldCA9IGZ1bmN0aW9uKCkge3JldHVybiBjdXJyZW50UGF0aH1cblx0cm91dGUucHJlZml4ID0gZnVuY3Rpb24ocHJlZml4KSB7cm91dGVTZXJ2aWNlLnByZWZpeCA9IHByZWZpeH1cblx0cm91dGUubGluayA9IGZ1bmN0aW9uKHZub2RlKSB7XG5cdFx0dm5vZGUuZG9tLnNldEF0dHJpYnV0ZShcImhyZWZcIiwgcm91dGVTZXJ2aWNlLnByZWZpeCArIHZub2RlLmF0dHJzLmhyZWYpXG5cdFx0dm5vZGUuZG9tLm9uY2xpY2sgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLnNoaWZ0S2V5IHx8IGUud2hpY2ggPT09IDIpIHJldHVyblxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRlLnJlZHJhdyA9IGZhbHNlXG5cdFx0XHR2YXIgaHJlZiA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKVxuXHRcdFx0aWYgKGhyZWYuaW5kZXhPZihyb3V0ZVNlcnZpY2UucHJlZml4KSA9PT0gMCkgaHJlZiA9IGhyZWYuc2xpY2Uocm91dGVTZXJ2aWNlLnByZWZpeC5sZW5ndGgpXG5cdFx0XHRyb3V0ZS5zZXQoaHJlZiwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJvdXRlXG59XG4iLCJ2YXIgaHlwZXJzY3JpcHQgPSByZXF1aXJlKFwiLi9yZW5kZXIvaHlwZXJzY3JpcHRcIilcblxuaHlwZXJzY3JpcHQudHJ1c3QgPSByZXF1aXJlKFwiLi9yZW5kZXIvdHJ1c3RcIilcbmh5cGVyc2NyaXB0LmZyYWdtZW50ID0gcmVxdWlyZShcIi4vcmVuZGVyL2ZyYWdtZW50XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaHlwZXJzY3JpcHRcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBtID0gcmVxdWlyZShcIi4vaHlwZXJzY3JpcHRcIilcbnZhciByZXF1ZXN0U2VydmljZSA9IHJlcXVpcmUoXCIuL3JlcXVlc3RcIilcbnZhciByZWRyYXdTZXJ2aWNlID0gcmVxdWlyZShcIi4vcmVkcmF3XCIpXG5cbnJlcXVlc3RTZXJ2aWNlLnNldENvbXBsZXRpb25DYWxsYmFjayhyZWRyYXdTZXJ2aWNlLnJlZHJhdylcblxubS5tb3VudCA9IHJlcXVpcmUoXCIuL21vdW50XCIpXG5tLnJvdXRlID0gcmVxdWlyZShcIi4vcm91dGVcIilcbm0ud2l0aEF0dHIgPSByZXF1aXJlKFwiLi91dGlsL3dpdGhBdHRyXCIpXG5tLnJlbmRlciA9IHJlcXVpcmUoXCIuL3JlbmRlclwiKS5yZW5kZXJcbm0ucmVkcmF3ID0gcmVkcmF3U2VydmljZS5yZWRyYXdcbm0ucmVxdWVzdCA9IHJlcXVlc3RTZXJ2aWNlLnJlcXVlc3Rcbm0uanNvbnAgPSByZXF1ZXN0U2VydmljZS5qc29ucFxubS5wYXJzZVF1ZXJ5U3RyaW5nID0gcmVxdWlyZShcIi4vcXVlcnlzdHJpbmcvcGFyc2VcIilcbm0uYnVpbGRRdWVyeVN0cmluZyA9IHJlcXVpcmUoXCIuL3F1ZXJ5c3RyaW5nL2J1aWxkXCIpXG5tLnZlcnNpb24gPSBcImJsZWVkaW5nLWVkZ2VcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IG1cbiIsInZhciByZWRyYXdTZXJ2aWNlID0gcmVxdWlyZShcIi4vcmVkcmF3XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vYXBpL21vdW50XCIpKHJlZHJhd1NlcnZpY2UpIiwiXCJ1c2Ugc3RyaWN0XCJcbi8qKiBAY29uc3RydWN0b3IgKi9cbnZhciBQcm9taXNlUG9seWZpbGwgPSBmdW5jdGlvbihleGVjdXRvcikge1xuXHRpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZVBvbHlmaWxsKSkgdGhyb3cgbmV3IEVycm9yKFwiUHJvbWlzZSBtdXN0IGJlIGNhbGxlZCB3aXRoIGBuZXdgXCIpXG5cdGlmICh0eXBlb2YgZXhlY3V0b3IgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcImV4ZWN1dG9yIG11c3QgYmUgYSBmdW5jdGlvblwiKVxuXG5cdHZhciBzZWxmID0gdGhpcywgcmVzb2x2ZXJzID0gW10sIHJlamVjdG9ycyA9IFtdLCByZXNvbHZlQ3VycmVudCA9IGhhbmRsZXIocmVzb2x2ZXJzLCB0cnVlKSwgcmVqZWN0Q3VycmVudCA9IGhhbmRsZXIocmVqZWN0b3JzLCBmYWxzZSlcblx0dmFyIGluc3RhbmNlID0gc2VsZi5faW5zdGFuY2UgPSB7cmVzb2x2ZXJzOiByZXNvbHZlcnMsIHJlamVjdG9yczogcmVqZWN0b3JzfVxuXHR2YXIgY2FsbEFzeW5jID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogc2V0VGltZW91dFxuXHRmdW5jdGlvbiBoYW5kbGVyKGxpc3QsIHNob3VsZEFic29yYikge1xuXHRcdHJldHVybiBmdW5jdGlvbiBleGVjdXRlKHZhbHVlKSB7XG5cdFx0XHR2YXIgdGhlblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHNob3VsZEFic29yYiAmJiB2YWx1ZSAhPSBudWxsICYmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpICYmIHR5cGVvZiAodGhlbiA9IHZhbHVlLnRoZW4pID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHRpZiAodmFsdWUgPT09IHNlbGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcm9taXNlIGNhbid0IGJlIHJlc29sdmVkIHcvIGl0c2VsZlwiKVxuXHRcdFx0XHRcdGV4ZWN1dGVPbmNlKHRoZW4uYmluZCh2YWx1ZSkpXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y2FsbEFzeW5jKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYgKCFzaG91bGRBYnNvcmIgJiYgbGlzdC5sZW5ndGggPT09IDApIGNvbnNvbGUuZXJyb3IoXCJQb3NzaWJsZSB1bmhhbmRsZWQgcHJvbWlzZSByZWplY3Rpb246XCIsIHZhbHVlKVxuXHRcdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSBsaXN0W2ldKHZhbHVlKVxuXHRcdFx0XHRcdFx0cmVzb2x2ZXJzLmxlbmd0aCA9IDAsIHJlamVjdG9ycy5sZW5ndGggPSAwXG5cdFx0XHRcdFx0XHRpbnN0YW5jZS5zdGF0ZSA9IHNob3VsZEFic29yYlxuXHRcdFx0XHRcdFx0aW5zdGFuY2UucmV0cnkgPSBmdW5jdGlvbigpIHtleGVjdXRlKHZhbHVlKX1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaCAoZSkge1xuXHRcdFx0XHRyZWplY3RDdXJyZW50KGUpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGV4ZWN1dGVPbmNlKHRoZW4pIHtcblx0XHR2YXIgcnVucyA9IDBcblx0XHRmdW5jdGlvbiBydW4oZm4pIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAocnVucysrID4gMCkgcmV0dXJuXG5cdFx0XHRcdGZuKHZhbHVlKVxuXHRcdFx0fVxuXHRcdH1cblx0XHR2YXIgb25lcnJvciA9IHJ1bihyZWplY3RDdXJyZW50KVxuXHRcdHRyeSB7dGhlbihydW4ocmVzb2x2ZUN1cnJlbnQpLCBvbmVycm9yKX0gY2F0Y2ggKGUpIHtvbmVycm9yKGUpfVxuXHR9XG5cblx0ZXhlY3V0ZU9uY2UoZXhlY3V0b3IpXG59XG5Qcm9taXNlUG9seWZpbGwucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3Rpb24pIHtcblx0dmFyIHNlbGYgPSB0aGlzLCBpbnN0YW5jZSA9IHNlbGYuX2luc3RhbmNlXG5cdGZ1bmN0aW9uIGhhbmRsZShjYWxsYmFjaywgbGlzdCwgbmV4dCwgc3RhdGUpIHtcblx0XHRsaXN0LnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdGlmICh0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikgbmV4dCh2YWx1ZSlcblx0XHRcdGVsc2UgdHJ5IHtyZXNvbHZlTmV4dChjYWxsYmFjayh2YWx1ZSkpfSBjYXRjaCAoZSkge2lmIChyZWplY3ROZXh0KSByZWplY3ROZXh0KGUpfVxuXHRcdH0pXG5cdFx0aWYgKHR5cGVvZiBpbnN0YW5jZS5yZXRyeSA9PT0gXCJmdW5jdGlvblwiICYmIHN0YXRlID09PSBpbnN0YW5jZS5zdGF0ZSkgaW5zdGFuY2UucmV0cnkoKVxuXHR9XG5cdHZhciByZXNvbHZlTmV4dCwgcmVqZWN0TmV4dFxuXHR2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlUG9seWZpbGwoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7cmVzb2x2ZU5leHQgPSByZXNvbHZlLCByZWplY3ROZXh0ID0gcmVqZWN0fSlcblx0aGFuZGxlKG9uRnVsZmlsbGVkLCBpbnN0YW5jZS5yZXNvbHZlcnMsIHJlc29sdmVOZXh0LCB0cnVlKSwgaGFuZGxlKG9uUmVqZWN0aW9uLCBpbnN0YW5jZS5yZWplY3RvcnMsIHJlamVjdE5leHQsIGZhbHNlKVxuXHRyZXR1cm4gcHJvbWlzZVxufVxuUHJvbWlzZVBvbHlmaWxsLnByb3RvdHlwZS5jYXRjaCA9IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG5cdHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pXG59XG5Qcm9taXNlUG9seWZpbGwucmVzb2x2ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdGlmICh2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2VQb2x5ZmlsbCkgcmV0dXJuIHZhbHVlXG5cdHJldHVybiBuZXcgUHJvbWlzZVBvbHlmaWxsKGZ1bmN0aW9uKHJlc29sdmUpIHtyZXNvbHZlKHZhbHVlKX0pXG59XG5Qcm9taXNlUG9seWZpbGwucmVqZWN0ID0gZnVuY3Rpb24odmFsdWUpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlUG9seWZpbGwoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7cmVqZWN0KHZhbHVlKX0pXG59XG5Qcm9taXNlUG9seWZpbGwuYWxsID0gZnVuY3Rpb24obGlzdCkge1xuXHRyZXR1cm4gbmV3IFByb21pc2VQb2x5ZmlsbChmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHR2YXIgdG90YWwgPSBsaXN0Lmxlbmd0aCwgY291bnQgPSAwLCB2YWx1ZXMgPSBbXVxuXHRcdGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkgcmVzb2x2ZShbXSlcblx0XHRlbHNlIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0KGZ1bmN0aW9uKGkpIHtcblx0XHRcdFx0ZnVuY3Rpb24gY29uc3VtZSh2YWx1ZSkge1xuXHRcdFx0XHRcdGNvdW50Kytcblx0XHRcdFx0XHR2YWx1ZXNbaV0gPSB2YWx1ZVxuXHRcdFx0XHRcdGlmIChjb3VudCA9PT0gdG90YWwpIHJlc29sdmUodmFsdWVzKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChsaXN0W2ldICE9IG51bGwgJiYgKHR5cGVvZiBsaXN0W2ldID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBsaXN0W2ldID09PSBcImZ1bmN0aW9uXCIpICYmIHR5cGVvZiBsaXN0W2ldLnRoZW4gPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdGxpc3RbaV0udGhlbihjb25zdW1lLCByZWplY3QpXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBjb25zdW1lKGxpc3RbaV0pXG5cdFx0XHR9KShpKVxuXHRcdH1cblx0fSlcbn1cblByb21pc2VQb2x5ZmlsbC5yYWNlID0gZnVuY3Rpb24obGlzdCkge1xuXHRyZXR1cm4gbmV3IFByb21pc2VQb2x5ZmlsbChmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdGxpc3RbaV0udGhlbihyZXNvbHZlLCByZWplY3QpXG5cdFx0fVxuXHR9KVxufVxuXG5pZiAodHlwZW9mIFByb21pc2UgPT09IFwidW5kZWZpbmVkXCIpIHtcblx0aWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHdpbmRvdy5Qcm9taXNlID0gUHJvbWlzZVBvbHlmaWxsXG5cdGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIpIGdsb2JhbC5Qcm9taXNlID0gUHJvbWlzZVBvbHlmaWxsXG59XG5cbm1vZHVsZS5leHBvcnRzID0gdHlwZW9mIFByb21pc2UgIT09IFwidW5kZWZpbmVkXCIgPyBQcm9taXNlIDogUHJvbWlzZVBvbHlmaWxsIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmplY3QpIHtcblx0aWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpICE9PSBcIltvYmplY3QgT2JqZWN0XVwiKSByZXR1cm4gXCJcIlxuXG5cdHZhciBhcmdzID0gW11cblx0Zm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuXHRcdGRlc3RydWN0dXJlKGtleSwgb2JqZWN0W2tleV0pXG5cdH1cblx0cmV0dXJuIGFyZ3Muam9pbihcIiZcIilcblxuXHRmdW5jdGlvbiBkZXN0cnVjdHVyZShrZXksIHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0ZGVzdHJ1Y3R1cmUoa2V5ICsgXCJbXCIgKyBpICsgXCJdXCIsIHZhbHVlW2ldKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpID09PSBcIltvYmplY3QgT2JqZWN0XVwiKSB7XG5cdFx0XHRmb3IgKHZhciBpIGluIHZhbHVlKSB7XG5cdFx0XHRcdGRlc3RydWN0dXJlKGtleSArIFwiW1wiICsgaSArIFwiXVwiLCB2YWx1ZVtpXSlcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSBhcmdzLnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZSAhPT0gXCJcIiA/IFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlKSA6IFwiXCIpKVxuXHR9XG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRpZiAoc3RyaW5nID09PSBcIlwiIHx8IHN0cmluZyA9PSBudWxsKSByZXR1cm4ge31cblx0aWYgKHN0cmluZy5jaGFyQXQoMCkgPT09IFwiP1wiKSBzdHJpbmcgPSBzdHJpbmcuc2xpY2UoMSlcblxuXHR2YXIgZW50cmllcyA9IHN0cmluZy5zcGxpdChcIiZcIiksIGRhdGEgPSB7fSwgY291bnRlcnMgPSB7fVxuXHRmb3IgKHZhciBpID0gMDsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHR2YXIgZW50cnkgPSBlbnRyaWVzW2ldLnNwbGl0KFwiPVwiKVxuXHRcdHZhciBrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoZW50cnlbMF0pXG5cdFx0dmFyIHZhbHVlID0gZW50cnkubGVuZ3RoID09PSAyID8gZGVjb2RlVVJJQ29tcG9uZW50KGVudHJ5WzFdKSA6IFwiXCJcblxuXHRcdGlmICh2YWx1ZSA9PT0gXCJ0cnVlXCIpIHZhbHVlID0gdHJ1ZVxuXHRcdGVsc2UgaWYgKHZhbHVlID09PSBcImZhbHNlXCIpIHZhbHVlID0gZmFsc2VcblxuXHRcdHZhciBsZXZlbHMgPSBrZXkuc3BsaXQoL1xcXVxcWz98XFxbLylcblx0XHR2YXIgY3Vyc29yID0gZGF0YVxuXHRcdGlmIChrZXkuaW5kZXhPZihcIltcIikgPiAtMSkgbGV2ZWxzLnBvcCgpXG5cdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBsZXZlbHMubGVuZ3RoOyBqKyspIHtcblx0XHRcdHZhciBsZXZlbCA9IGxldmVsc1tqXSwgbmV4dExldmVsID0gbGV2ZWxzW2ogKyAxXVxuXHRcdFx0dmFyIGlzTnVtYmVyID0gbmV4dExldmVsID09IFwiXCIgfHwgIWlzTmFOKHBhcnNlSW50KG5leHRMZXZlbCwgMTApKVxuXHRcdFx0dmFyIGlzVmFsdWUgPSBqID09PSBsZXZlbHMubGVuZ3RoIC0gMVxuXHRcdFx0aWYgKGxldmVsID09PSBcIlwiKSB7XG5cdFx0XHRcdHZhciBrZXkgPSBsZXZlbHMuc2xpY2UoMCwgaikuam9pbigpXG5cdFx0XHRcdGlmIChjb3VudGVyc1trZXldID09IG51bGwpIGNvdW50ZXJzW2tleV0gPSAwXG5cdFx0XHRcdGxldmVsID0gY291bnRlcnNba2V5XSsrXG5cdFx0XHR9XG5cdFx0XHRpZiAoY3Vyc29yW2xldmVsXSA9PSBudWxsKSB7XG5cdFx0XHRcdGN1cnNvcltsZXZlbF0gPSBpc1ZhbHVlID8gdmFsdWUgOiBpc051bWJlciA/IFtdIDoge31cblx0XHRcdH1cblx0XHRcdGN1cnNvciA9IGN1cnNvcltsZXZlbF1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGRhdGFcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vYXBpL3JlZHJhd1wiKSh3aW5kb3cpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9yZW5kZXIvcmVuZGVyXCIpKHdpbmRvdykiLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgVm5vZGUgPSByZXF1aXJlKFwiLi4vcmVuZGVyL3Zub2RlXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oYXR0cnMsIGNoaWxkcmVuKSB7XG5cdHJldHVybiBWbm9kZShcIltcIiwgYXR0cnMua2V5LCBhdHRycywgVm5vZGUubm9ybWFsaXplQ2hpbGRyZW4oY2hpbGRyZW4pLCB1bmRlZmluZWQsIHVuZGVmaW5lZClcbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxudmFyIHNlbGVjdG9yUGFyc2VyID0gLyg/OihefCN8XFwuKShbXiNcXC5cXFtcXF1dKykpfChcXFsoLis/KSg/Olxccyo9XFxzKihcInwnfCkoKD86XFxcXFtcIidcXF1dfC4pKj8pXFw1KT9cXF0pL2dcbnZhciBzZWxlY3RvckNhY2hlID0ge31cbmZ1bmN0aW9uIGh5cGVyc2NyaXB0KHNlbGVjdG9yKSB7XG5cdGlmIChzZWxlY3RvciA9PSBudWxsIHx8IHR5cGVvZiBzZWxlY3RvciAhPT0gXCJzdHJpbmdcIiAmJiBzZWxlY3Rvci52aWV3ID09IG51bGwpIHtcblx0XHR0aHJvdyBFcnJvcihcIlRoZSBzZWxlY3RvciBtdXN0IGJlIGVpdGhlciBhIHN0cmluZyBvciBhIGNvbXBvbmVudC5cIik7XG5cdH1cblxuXHRpZiAodHlwZW9mIHNlbGVjdG9yID09PSBcInN0cmluZ1wiICYmIHNlbGVjdG9yQ2FjaGVbc2VsZWN0b3JdID09PSB1bmRlZmluZWQpIHtcblx0XHR2YXIgbWF0Y2gsIHRhZywgY2xhc3NlcyA9IFtdLCBhdHRyaWJ1dGVzID0ge31cblx0XHR3aGlsZSAobWF0Y2ggPSBzZWxlY3RvclBhcnNlci5leGVjKHNlbGVjdG9yKSkge1xuXHRcdFx0dmFyIHR5cGUgPSBtYXRjaFsxXSwgdmFsdWUgPSBtYXRjaFsyXVxuXHRcdFx0aWYgKHR5cGUgPT09IFwiXCIgJiYgdmFsdWUgIT09IFwiXCIpIHRhZyA9IHZhbHVlXG5cdFx0XHRlbHNlIGlmICh0eXBlID09PSBcIiNcIikgYXR0cmlidXRlcy5pZCA9IHZhbHVlXG5cdFx0XHRlbHNlIGlmICh0eXBlID09PSBcIi5cIikgY2xhc3Nlcy5wdXNoKHZhbHVlKVxuXHRcdFx0ZWxzZSBpZiAobWF0Y2hbM11bMF0gPT09IFwiW1wiKSB7XG5cdFx0XHRcdHZhciBhdHRyVmFsdWUgPSBtYXRjaFs2XVxuXHRcdFx0XHRpZiAoYXR0clZhbHVlKSBhdHRyVmFsdWUgPSBhdHRyVmFsdWUucmVwbGFjZSgvXFxcXChbXCInXSkvZywgXCIkMVwiKS5yZXBsYWNlKC9cXFxcXFxcXC9nLCBcIlxcXFxcIilcblx0XHRcdFx0aWYgKG1hdGNoWzRdID09PSBcImNsYXNzXCIpIGNsYXNzZXMucHVzaChhdHRyVmFsdWUpXG5cdFx0XHRcdGVsc2UgYXR0cmlidXRlc1ttYXRjaFs0XV0gPSBhdHRyVmFsdWUgfHwgdHJ1ZVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY2xhc3Nlcy5sZW5ndGggPiAwKSBhdHRyaWJ1dGVzLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbihcIiBcIilcblx0XHRzZWxlY3RvckNhY2hlW3NlbGVjdG9yXSA9IGZ1bmN0aW9uKGF0dHJzLCBjaGlsZHJlbikge1xuXHRcdFx0dmFyIGhhc0F0dHJzID0gZmFsc2UsIGNoaWxkTGlzdCwgdGV4dFxuXHRcdFx0dmFyIGNsYXNzTmFtZSA9IGF0dHJzLmNsYXNzTmFtZSB8fCBhdHRycy5jbGFzc1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIGF0dHJpYnV0ZXMpIGF0dHJzW2tleV0gPSBhdHRyaWJ1dGVzW2tleV1cblx0XHRcdGlmIChjbGFzc05hbWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAoYXR0cnMuY2xhc3MgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGF0dHJzLmNsYXNzID0gdW5kZWZpbmVkXG5cdFx0XHRcdFx0YXR0cnMuY2xhc3NOYW1lID0gY2xhc3NOYW1lXG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGF0dHJpYnV0ZXMuY2xhc3NOYW1lICE9PSB1bmRlZmluZWQpIGF0dHJzLmNsYXNzTmFtZSA9IGF0dHJpYnV0ZXMuY2xhc3NOYW1lICsgXCIgXCIgKyBjbGFzc05hbWVcblx0XHRcdH1cblx0XHRcdGZvciAodmFyIGtleSBpbiBhdHRycykge1xuXHRcdFx0XHRpZiAoa2V5ICE9PSBcImtleVwiKSB7XG5cdFx0XHRcdFx0aGFzQXR0cnMgPSB0cnVlXG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGNoaWxkcmVuIGluc3RhbmNlb2YgQXJyYXkgJiYgY2hpbGRyZW4ubGVuZ3RoID09IDEgJiYgY2hpbGRyZW5bMF0gIT0gbnVsbCAmJiBjaGlsZHJlblswXS50YWcgPT09IFwiI1wiKSB0ZXh0ID0gY2hpbGRyZW5bMF0uY2hpbGRyZW5cblx0XHRcdGVsc2UgY2hpbGRMaXN0ID0gY2hpbGRyZW5cblxuXHRcdFx0cmV0dXJuIFZub2RlKHRhZyB8fCBcImRpdlwiLCBhdHRycy5rZXksIGhhc0F0dHJzID8gYXR0cnMgOiB1bmRlZmluZWQsIGNoaWxkTGlzdCwgdGV4dCwgdW5kZWZpbmVkKVxuXHRcdH1cblx0fVxuXHR2YXIgYXR0cnMsIGNoaWxkcmVuLCBjaGlsZHJlbkluZGV4XG5cdGlmIChhcmd1bWVudHNbMV0gPT0gbnVsbCB8fCB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcIm9iamVjdFwiICYmIGFyZ3VtZW50c1sxXS50YWcgPT09IHVuZGVmaW5lZCAmJiAhKGFyZ3VtZW50c1sxXSBpbnN0YW5jZW9mIEFycmF5KSkge1xuXHRcdGF0dHJzID0gYXJndW1lbnRzWzFdXG5cdFx0Y2hpbGRyZW5JbmRleCA9IDJcblx0fVxuXHRlbHNlIGNoaWxkcmVuSW5kZXggPSAxXG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID09PSBjaGlsZHJlbkluZGV4ICsgMSkge1xuXHRcdGNoaWxkcmVuID0gYXJndW1lbnRzW2NoaWxkcmVuSW5kZXhdIGluc3RhbmNlb2YgQXJyYXkgPyBhcmd1bWVudHNbY2hpbGRyZW5JbmRleF0gOiBbYXJndW1lbnRzW2NoaWxkcmVuSW5kZXhdXVxuXHR9XG5cdGVsc2Uge1xuXHRcdGNoaWxkcmVuID0gW11cblx0XHRmb3IgKHZhciBpID0gY2hpbGRyZW5JbmRleDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgY2hpbGRyZW4ucHVzaChhcmd1bWVudHNbaV0pXG5cdH1cblxuXHRpZiAodHlwZW9mIHNlbGVjdG9yID09PSBcInN0cmluZ1wiKSByZXR1cm4gc2VsZWN0b3JDYWNoZVtzZWxlY3Rvcl0oYXR0cnMgfHwge30sIFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKGNoaWxkcmVuKSlcblxuXHRyZXR1cm4gVm5vZGUoc2VsZWN0b3IsIGF0dHJzICYmIGF0dHJzLmtleSwgYXR0cnMgfHwge30sIFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKGNoaWxkcmVuKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaHlwZXJzY3JpcHRcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkd2luZG93KSB7XG5cdHZhciAkZG9jID0gJHdpbmRvdy5kb2N1bWVudFxuXHR2YXIgJGVtcHR5RnJhZ21lbnQgPSAkZG9jLmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuXG5cdHZhciBvbmV2ZW50XG5cdGZ1bmN0aW9uIHNldEV2ZW50Q2FsbGJhY2soY2FsbGJhY2spIHtyZXR1cm4gb25ldmVudCA9IGNhbGxiYWNrfVxuXG5cdC8vY3JlYXRlXG5cdGZ1bmN0aW9uIGNyZWF0ZU5vZGVzKHBhcmVudCwgdm5vZGVzLCBzdGFydCwgZW5kLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKSB7XG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcblx0XHRcdHZhciB2bm9kZSA9IHZub2Rlc1tpXVxuXHRcdFx0aWYgKHZub2RlICE9IG51bGwpIHtcblx0XHRcdFx0aW5zZXJ0Tm9kZShwYXJlbnQsIGNyZWF0ZU5vZGUodm5vZGUsIGhvb2tzLCBucyksIG5leHRTaWJsaW5nKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVOb2RlKHZub2RlLCBob29rcywgbnMpIHtcblx0XHR2YXIgdGFnID0gdm5vZGUudGFnXG5cdFx0aWYgKHZub2RlLmF0dHJzICE9IG51bGwpIGluaXRMaWZlY3ljbGUodm5vZGUuYXR0cnMsIHZub2RlLCBob29rcylcblx0XHRpZiAodHlwZW9mIHRhZyA9PT0gXCJzdHJpbmdcIikge1xuXHRcdFx0c3dpdGNoICh0YWcpIHtcblx0XHRcdFx0Y2FzZSBcIiNcIjogcmV0dXJuIGNyZWF0ZVRleHQodm5vZGUpXG5cdFx0XHRcdGNhc2UgXCI8XCI6IHJldHVybiBjcmVhdGVIVE1MKHZub2RlKVxuXHRcdFx0XHRjYXNlIFwiW1wiOiByZXR1cm4gY3JlYXRlRnJhZ21lbnQodm5vZGUsIGhvb2tzLCBucylcblx0XHRcdFx0ZGVmYXVsdDogcmV0dXJuIGNyZWF0ZUVsZW1lbnQodm5vZGUsIGhvb2tzLCBucylcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSByZXR1cm4gY3JlYXRlQ29tcG9uZW50KHZub2RlLCBob29rcywgbnMpXG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlVGV4dCh2bm9kZSkge1xuXHRcdHJldHVybiB2bm9kZS5kb20gPSAkZG9jLmNyZWF0ZVRleHROb2RlKHZub2RlLmNoaWxkcmVuKVxuXHR9XG5cdGZ1bmN0aW9uIGNyZWF0ZUhUTUwodm5vZGUpIHtcblx0XHR2YXIgbWF0Y2ggPSB2bm9kZS5jaGlsZHJlbi5tYXRjaCgvXlxccyo/PChcXHcrKS9pbSkgfHwgW11cblx0XHR2YXIgcGFyZW50ID0ge2NhcHRpb246IFwidGFibGVcIiwgdGhlYWQ6IFwidGFibGVcIiwgdGJvZHk6IFwidGFibGVcIiwgdGZvb3Q6IFwidGFibGVcIiwgdHI6IFwidGJvZHlcIiwgdGg6IFwidHJcIiwgdGQ6IFwidHJcIiwgY29sZ3JvdXA6IFwidGFibGVcIiwgY29sOiBcImNvbGdyb3VwXCJ9W21hdGNoWzFdXSB8fCBcImRpdlwiXG5cdFx0dmFyIHRlbXAgPSAkZG9jLmNyZWF0ZUVsZW1lbnQocGFyZW50KVxuXG5cdFx0dGVtcC5pbm5lckhUTUwgPSB2bm9kZS5jaGlsZHJlblxuXHRcdHZub2RlLmRvbSA9IHRlbXAuZmlyc3RDaGlsZFxuXHRcdHZub2RlLmRvbVNpemUgPSB0ZW1wLmNoaWxkTm9kZXMubGVuZ3RoXG5cdFx0dmFyIGZyYWdtZW50ID0gJGRvYy5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcblx0XHR2YXIgY2hpbGRcblx0XHR3aGlsZSAoY2hpbGQgPSB0ZW1wLmZpcnN0Q2hpbGQpIHtcblx0XHRcdGZyYWdtZW50LmFwcGVuZENoaWxkKGNoaWxkKVxuXHRcdH1cblx0XHRyZXR1cm4gZnJhZ21lbnRcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVGcmFnbWVudCh2bm9kZSwgaG9va3MsIG5zKSB7XG5cdFx0dmFyIGZyYWdtZW50ID0gJGRvYy5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcblx0XHRpZiAodm5vZGUuY2hpbGRyZW4gIT0gbnVsbCkge1xuXHRcdFx0dmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblx0XHRcdGNyZWF0ZU5vZGVzKGZyYWdtZW50LCBjaGlsZHJlbiwgMCwgY2hpbGRyZW4ubGVuZ3RoLCBob29rcywgbnVsbCwgbnMpXG5cdFx0fVxuXHRcdHZub2RlLmRvbSA9IGZyYWdtZW50LmZpcnN0Q2hpbGRcblx0XHR2bm9kZS5kb21TaXplID0gZnJhZ21lbnQuY2hpbGROb2Rlcy5sZW5ndGhcblx0XHRyZXR1cm4gZnJhZ21lbnRcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHZub2RlLCBob29rcywgbnMpIHtcblx0XHR2YXIgdGFnID0gdm5vZGUudGFnXG5cdFx0c3dpdGNoICh2bm9kZS50YWcpIHtcblx0XHRcdGNhc2UgXCJzdmdcIjogbnMgPSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI7IGJyZWFrXG5cdFx0XHRjYXNlIFwibWF0aFwiOiBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTFwiOyBicmVha1xuXHRcdH1cblxuXHRcdHZhciBhdHRycyA9IHZub2RlLmF0dHJzXG5cdFx0dmFyIGlzID0gYXR0cnMgJiYgYXR0cnMuaXNcblxuXHRcdHZhciBlbGVtZW50ID0gbnMgP1xuXHRcdFx0aXMgPyAkZG9jLmNyZWF0ZUVsZW1lbnROUyhucywgdGFnLCB7aXM6IGlzfSkgOiAkZG9jLmNyZWF0ZUVsZW1lbnROUyhucywgdGFnKSA6XG5cdFx0XHRpcyA/ICRkb2MuY3JlYXRlRWxlbWVudCh0YWcsIHtpczogaXN9KSA6ICRkb2MuY3JlYXRlRWxlbWVudCh0YWcpXG5cdFx0dm5vZGUuZG9tID0gZWxlbWVudFxuXG5cdFx0aWYgKGF0dHJzICE9IG51bGwpIHtcblx0XHRcdHNldEF0dHJzKHZub2RlLCBhdHRycywgbnMpXG5cdFx0fVxuXG5cdFx0aWYgKHZub2RlLmF0dHJzICE9IG51bGwgJiYgdm5vZGUuYXR0cnMuY29udGVudGVkaXRhYmxlICE9IG51bGwpIHtcblx0XHRcdHNldENvbnRlbnRFZGl0YWJsZSh2bm9kZSlcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodm5vZGUudGV4dCAhPSBudWxsKSB7XG5cdFx0XHRcdGlmICh2bm9kZS50ZXh0ICE9PSBcIlwiKSBlbGVtZW50LnRleHRDb250ZW50ID0gdm5vZGUudGV4dFxuXHRcdFx0XHRlbHNlIHZub2RlLmNoaWxkcmVuID0gW1Zub2RlKFwiI1wiLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdm5vZGUudGV4dCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXVxuXHRcdFx0fVxuXHRcdFx0aWYgKHZub2RlLmNoaWxkcmVuICE9IG51bGwpIHtcblx0XHRcdFx0dmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblx0XHRcdFx0Y3JlYXRlTm9kZXMoZWxlbWVudCwgY2hpbGRyZW4sIDAsIGNoaWxkcmVuLmxlbmd0aCwgaG9va3MsIG51bGwsIG5zKVxuXHRcdFx0XHRzZXRMYXRlQXR0cnModm5vZGUpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBlbGVtZW50XG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KHZub2RlLCBob29rcywgbnMpIHtcblx0XHQvLyBGb3Igb2JqZWN0IGxpdGVyYWxzIHNpbmNlIGBWbm9kZSgpYCBhbHdheXMgc2V0cyB0aGUgYHN0YXRlYCBmaWVsZC5cblx0XHRpZiAoIXZub2RlLnN0YXRlKSB2bm9kZS5zdGF0ZSA9IHt9XG5cdFx0YXNzaWduKHZub2RlLnN0YXRlLCB2bm9kZS50YWcpXG5cblx0XHR2YXIgdmlldyA9IHZub2RlLnRhZy52aWV3XG5cdFx0aWYgKHZpZXcucmVlbnRyYW50TG9jayAhPSBudWxsKSByZXR1cm4gJGVtcHR5RnJhZ21lbnRcblx0XHR2aWV3LnJlZW50cmFudExvY2sgPSB0cnVlXG5cdFx0aW5pdExpZmVjeWNsZSh2bm9kZS50YWcsIHZub2RlLCBob29rcylcblx0XHR2bm9kZS5pbnN0YW5jZSA9IFZub2RlLm5vcm1hbGl6ZSh2aWV3LmNhbGwodm5vZGUuc3RhdGUsIHZub2RlKSlcblx0XHR2aWV3LnJlZW50cmFudExvY2sgPSBudWxsXG5cdFx0aWYgKHZub2RlLmluc3RhbmNlICE9IG51bGwpIHtcblx0XHRcdGlmICh2bm9kZS5pbnN0YW5jZSA9PT0gdm5vZGUpIHRocm93IEVycm9yKFwiQSB2aWV3IGNhbm5vdCByZXR1cm4gdGhlIHZub2RlIGl0IHJlY2VpdmVkIGFzIGFyZ3VtZW50c1wiKVxuXHRcdFx0dmFyIGVsZW1lbnQgPSBjcmVhdGVOb2RlKHZub2RlLmluc3RhbmNlLCBob29rcywgbnMpXG5cdFx0XHR2bm9kZS5kb20gPSB2bm9kZS5pbnN0YW5jZS5kb21cblx0XHRcdHZub2RlLmRvbVNpemUgPSB2bm9kZS5kb20gIT0gbnVsbCA/IHZub2RlLmluc3RhbmNlLmRvbVNpemUgOiAwXG5cdFx0XHRyZXR1cm4gZWxlbWVudFxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHZub2RlLmRvbVNpemUgPSAwXG5cdFx0XHRyZXR1cm4gJGVtcHR5RnJhZ21lbnRcblx0XHR9XG5cdH1cblxuXHQvL3VwZGF0ZVxuXHRmdW5jdGlvbiB1cGRhdGVOb2RlcyhwYXJlbnQsIG9sZCwgdm5vZGVzLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKSB7XG5cdFx0aWYgKG9sZCA9PT0gdm5vZGVzIHx8IG9sZCA9PSBudWxsICYmIHZub2RlcyA9PSBudWxsKSByZXR1cm5cblx0XHRlbHNlIGlmIChvbGQgPT0gbnVsbCkgY3JlYXRlTm9kZXMocGFyZW50LCB2bm9kZXMsIDAsIHZub2Rlcy5sZW5ndGgsIGhvb2tzLCBuZXh0U2libGluZywgdW5kZWZpbmVkKVxuXHRcdGVsc2UgaWYgKHZub2RlcyA9PSBudWxsKSByZW1vdmVOb2RlcyhvbGQsIDAsIG9sZC5sZW5ndGgsIHZub2Rlcylcblx0XHRlbHNlIHtcblx0XHRcdHZhciBpc1Vua2V5ZWQgPSBmYWxzZVxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB2bm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHZub2Rlc1tpXSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0aXNVbmtleWVkID0gdm5vZGVzW2ldLmtleSA9PSBudWxsXG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9sZC5sZW5ndGggPT09IHZub2Rlcy5sZW5ndGggJiYgaXNVbmtleWVkKSB7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKG9sZFtpXSA9PT0gdm5vZGVzW2ldKSBjb250aW51ZVxuXHRcdFx0XHRcdGVsc2UgaWYgKG9sZFtpXSA9PSBudWxsKSBpbnNlcnROb2RlKHBhcmVudCwgY3JlYXRlTm9kZSh2bm9kZXNbaV0sIGhvb2tzLCBucyksIGdldE5leHRTaWJsaW5nKG9sZCwgaSArIDEsIG5leHRTaWJsaW5nKSlcblx0XHRcdFx0XHRlbHNlIGlmICh2bm9kZXNbaV0gPT0gbnVsbCkgcmVtb3ZlTm9kZXMob2xkLCBpLCBpICsgMSwgdm5vZGVzKVxuXHRcdFx0XHRcdGVsc2UgdXBkYXRlTm9kZShwYXJlbnQsIG9sZFtpXSwgdm5vZGVzW2ldLCBob29rcywgZ2V0TmV4dFNpYmxpbmcob2xkLCBpICsgMSwgbmV4dFNpYmxpbmcpLCBmYWxzZSwgbnMpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgcmVjeWNsaW5nID0gaXNSZWN5Y2xhYmxlKG9sZCwgdm5vZGVzKVxuXHRcdFx0XHRpZiAocmVjeWNsaW5nKSBvbGQgPSBvbGQuY29uY2F0KG9sZC5wb29sKVxuXG5cdFx0XHRcdHZhciBvbGRTdGFydCA9IDAsIHN0YXJ0ID0gMCwgb2xkRW5kID0gb2xkLmxlbmd0aCAtIDEsIGVuZCA9IHZub2Rlcy5sZW5ndGggLSAxLCBtYXBcblx0XHRcdFx0d2hpbGUgKG9sZEVuZCA+PSBvbGRTdGFydCAmJiBlbmQgPj0gc3RhcnQpIHtcblx0XHRcdFx0XHR2YXIgbyA9IG9sZFtvbGRTdGFydF0sIHYgPSB2bm9kZXNbc3RhcnRdXG5cdFx0XHRcdFx0aWYgKG8gPT09IHYgJiYgIXJlY3ljbGluZykgb2xkU3RhcnQrKywgc3RhcnQrK1xuXHRcdFx0XHRcdGVsc2UgaWYgKG8gPT0gbnVsbCkgb2xkU3RhcnQrK1xuXHRcdFx0XHRcdGVsc2UgaWYgKHYgPT0gbnVsbCkgc3RhcnQrK1xuXHRcdFx0XHRcdGVsc2UgaWYgKG8ua2V5ID09PSB2LmtleSkge1xuXHRcdFx0XHRcdFx0b2xkU3RhcnQrKywgc3RhcnQrK1xuXHRcdFx0XHRcdFx0dXBkYXRlTm9kZShwYXJlbnQsIG8sIHYsIGhvb2tzLCBnZXROZXh0U2libGluZyhvbGQsIG9sZFN0YXJ0LCBuZXh0U2libGluZyksIHJlY3ljbGluZywgbnMpXG5cdFx0XHRcdFx0XHRpZiAocmVjeWNsaW5nICYmIG8udGFnID09PSB2LnRhZykgaW5zZXJ0Tm9kZShwYXJlbnQsIHRvRnJhZ21lbnQobyksIG5leHRTaWJsaW5nKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdHZhciBvID0gb2xkW29sZEVuZF1cblx0XHRcdFx0XHRcdGlmIChvID09PSB2ICYmICFyZWN5Y2xpbmcpIG9sZEVuZC0tLCBzdGFydCsrXG5cdFx0XHRcdFx0XHRlbHNlIGlmIChvID09IG51bGwpIG9sZEVuZC0tXG5cdFx0XHRcdFx0XHRlbHNlIGlmICh2ID09IG51bGwpIHN0YXJ0Kytcblx0XHRcdFx0XHRcdGVsc2UgaWYgKG8ua2V5ID09PSB2LmtleSkge1xuXHRcdFx0XHRcdFx0XHR1cGRhdGVOb2RlKHBhcmVudCwgbywgdiwgaG9va3MsIGdldE5leHRTaWJsaW5nKG9sZCwgb2xkRW5kICsgMSwgbmV4dFNpYmxpbmcpLCByZWN5Y2xpbmcsIG5zKVxuXHRcdFx0XHRcdFx0XHRpZiAocmVjeWNsaW5nIHx8IHN0YXJ0IDwgZW5kKSBpbnNlcnROb2RlKHBhcmVudCwgdG9GcmFnbWVudChvKSwgZ2V0TmV4dFNpYmxpbmcob2xkLCBvbGRTdGFydCwgbmV4dFNpYmxpbmcpKVxuXHRcdFx0XHRcdFx0XHRvbGRFbmQtLSwgc3RhcnQrK1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBicmVha1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR3aGlsZSAob2xkRW5kID49IG9sZFN0YXJ0ICYmIGVuZCA+PSBzdGFydCkge1xuXHRcdFx0XHRcdHZhciBvID0gb2xkW29sZEVuZF0sIHYgPSB2bm9kZXNbZW5kXVxuXHRcdFx0XHRcdGlmIChvID09PSB2ICYmICFyZWN5Y2xpbmcpIG9sZEVuZC0tLCBlbmQtLVxuXHRcdFx0XHRcdGVsc2UgaWYgKG8gPT0gbnVsbCkgb2xkRW5kLS1cblx0XHRcdFx0XHRlbHNlIGlmICh2ID09IG51bGwpIGVuZC0tXG5cdFx0XHRcdFx0ZWxzZSBpZiAoby5rZXkgPT09IHYua2V5KSB7XG5cdFx0XHRcdFx0XHR1cGRhdGVOb2RlKHBhcmVudCwgbywgdiwgaG9va3MsIGdldE5leHRTaWJsaW5nKG9sZCwgb2xkRW5kICsgMSwgbmV4dFNpYmxpbmcpLCByZWN5Y2xpbmcsIG5zKVxuXHRcdFx0XHRcdFx0aWYgKHJlY3ljbGluZyAmJiBvLnRhZyA9PT0gdi50YWcpIGluc2VydE5vZGUocGFyZW50LCB0b0ZyYWdtZW50KG8pLCBuZXh0U2libGluZylcblx0XHRcdFx0XHRcdGlmIChvLmRvbSAhPSBudWxsKSBuZXh0U2libGluZyA9IG8uZG9tXG5cdFx0XHRcdFx0XHRvbGRFbmQtLSwgZW5kLS1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoIW1hcCkgbWFwID0gZ2V0S2V5TWFwKG9sZCwgb2xkRW5kKVxuXHRcdFx0XHRcdFx0aWYgKHYgIT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHR2YXIgb2xkSW5kZXggPSBtYXBbdi5rZXldXG5cdFx0XHRcdFx0XHRcdGlmIChvbGRJbmRleCAhPSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIG1vdmFibGUgPSBvbGRbb2xkSW5kZXhdXG5cdFx0XHRcdFx0XHRcdFx0dXBkYXRlTm9kZShwYXJlbnQsIG1vdmFibGUsIHYsIGhvb2tzLCBnZXROZXh0U2libGluZyhvbGQsIG9sZEVuZCArIDEsIG5leHRTaWJsaW5nKSwgcmVjeWNsaW5nLCBucylcblx0XHRcdFx0XHRcdFx0XHRpbnNlcnROb2RlKHBhcmVudCwgdG9GcmFnbWVudChtb3ZhYmxlKSwgbmV4dFNpYmxpbmcpXG5cdFx0XHRcdFx0XHRcdFx0b2xkW29sZEluZGV4XS5za2lwID0gdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdGlmIChtb3ZhYmxlLmRvbSAhPSBudWxsKSBuZXh0U2libGluZyA9IG1vdmFibGUuZG9tXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGRvbSA9IGNyZWF0ZU5vZGUodiwgaG9va3MsIHVuZGVmaW5lZClcblx0XHRcdFx0XHRcdFx0XHRpbnNlcnROb2RlKHBhcmVudCwgZG9tLCBuZXh0U2libGluZylcblx0XHRcdFx0XHRcdFx0XHRuZXh0U2libGluZyA9IGRvbVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbmQtLVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZW5kIDwgc3RhcnQpIGJyZWFrXG5cdFx0XHRcdH1cblx0XHRcdFx0Y3JlYXRlTm9kZXMocGFyZW50LCB2bm9kZXMsIHN0YXJ0LCBlbmQgKyAxLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdFx0XHRyZW1vdmVOb2RlcyhvbGQsIG9sZFN0YXJ0LCBvbGRFbmQgKyAxLCB2bm9kZXMpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZU5vZGUocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIHJlY3ljbGluZywgbnMpIHtcblx0XHR2YXIgb2xkVGFnID0gb2xkLnRhZywgdGFnID0gdm5vZGUudGFnXG5cdFx0aWYgKG9sZFRhZyA9PT0gdGFnKSB7XG5cdFx0XHR2bm9kZS5zdGF0ZSA9IG9sZC5zdGF0ZVxuXHRcdFx0dm5vZGUuZXZlbnRzID0gb2xkLmV2ZW50c1xuXHRcdFx0aWYgKHNob3VsZFVwZGF0ZSh2bm9kZSwgb2xkKSkgcmV0dXJuXG5cdFx0XHRpZiAodm5vZGUuYXR0cnMgIT0gbnVsbCkge1xuXHRcdFx0XHR1cGRhdGVMaWZlY3ljbGUodm5vZGUuYXR0cnMsIHZub2RlLCBob29rcywgcmVjeWNsaW5nKVxuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBvbGRUYWcgPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdFx0c3dpdGNoIChvbGRUYWcpIHtcblx0XHRcdFx0XHRjYXNlIFwiI1wiOiB1cGRhdGVUZXh0KG9sZCwgdm5vZGUpOyBicmVha1xuXHRcdFx0XHRcdGNhc2UgXCI8XCI6IHVwZGF0ZUhUTUwocGFyZW50LCBvbGQsIHZub2RlLCBuZXh0U2libGluZyk7IGJyZWFrXG5cdFx0XHRcdFx0Y2FzZSBcIltcIjogdXBkYXRlRnJhZ21lbnQocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKTsgYnJlYWtcblx0XHRcdFx0XHRkZWZhdWx0OiB1cGRhdGVFbGVtZW50KG9sZCwgdm5vZGUsIGhvb2tzLCBucylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB1cGRhdGVDb21wb25lbnQocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIHJlY3ljbGluZywgbnMpXG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmVtb3ZlTm9kZShvbGQsIG51bGwpXG5cdFx0XHRpbnNlcnROb2RlKHBhcmVudCwgY3JlYXRlTm9kZSh2bm9kZSwgaG9va3MsIG5zKSwgbmV4dFNpYmxpbmcpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZVRleHQob2xkLCB2bm9kZSkge1xuXHRcdGlmIChvbGQuY2hpbGRyZW4udG9TdHJpbmcoKSAhPT0gdm5vZGUuY2hpbGRyZW4udG9TdHJpbmcoKSkge1xuXHRcdFx0b2xkLmRvbS5ub2RlVmFsdWUgPSB2bm9kZS5jaGlsZHJlblxuXHRcdH1cblx0XHR2bm9kZS5kb20gPSBvbGQuZG9tXG5cdH1cblx0ZnVuY3Rpb24gdXBkYXRlSFRNTChwYXJlbnQsIG9sZCwgdm5vZGUsIG5leHRTaWJsaW5nKSB7XG5cdFx0aWYgKG9sZC5jaGlsZHJlbiAhPT0gdm5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdHRvRnJhZ21lbnQob2xkKVxuXHRcdFx0aW5zZXJ0Tm9kZShwYXJlbnQsIGNyZWF0ZUhUTUwodm5vZGUpLCBuZXh0U2libGluZylcblx0XHR9XG5cdFx0ZWxzZSB2bm9kZS5kb20gPSBvbGQuZG9tLCB2bm9kZS5kb21TaXplID0gb2xkLmRvbVNpemVcblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVGcmFnbWVudChwYXJlbnQsIG9sZCwgdm5vZGUsIGhvb2tzLCBuZXh0U2libGluZywgbnMpIHtcblx0XHR1cGRhdGVOb2RlcyhwYXJlbnQsIG9sZC5jaGlsZHJlbiwgdm5vZGUuY2hpbGRyZW4sIGhvb2tzLCBuZXh0U2libGluZywgbnMpXG5cdFx0dmFyIGRvbVNpemUgPSAwLCBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cdFx0dm5vZGUuZG9tID0gbnVsbFxuXHRcdGlmIChjaGlsZHJlbiAhPSBudWxsKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG5cdFx0XHRcdGlmIChjaGlsZCAhPSBudWxsICYmIGNoaWxkLmRvbSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0aWYgKHZub2RlLmRvbSA9PSBudWxsKSB2bm9kZS5kb20gPSBjaGlsZC5kb21cblx0XHRcdFx0XHRkb21TaXplICs9IGNoaWxkLmRvbVNpemUgfHwgMVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZG9tU2l6ZSAhPT0gMSkgdm5vZGUuZG9tU2l6ZSA9IGRvbVNpemVcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gdXBkYXRlRWxlbWVudChvbGQsIHZub2RlLCBob29rcywgbnMpIHtcblx0XHR2YXIgZWxlbWVudCA9IHZub2RlLmRvbSA9IG9sZC5kb21cblx0XHRzd2l0Y2ggKHZub2RlLnRhZykge1xuXHRcdFx0Y2FzZSBcInN2Z1wiOiBucyA9IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIjsgYnJlYWtcblx0XHRcdGNhc2UgXCJtYXRoXCI6IG5zID0gXCJodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MXCI7IGJyZWFrXG5cdFx0fVxuXHRcdGlmICh2bm9kZS50YWcgPT09IFwidGV4dGFyZWFcIikge1xuXHRcdFx0aWYgKHZub2RlLmF0dHJzID09IG51bGwpIHZub2RlLmF0dHJzID0ge31cblx0XHRcdGlmICh2bm9kZS50ZXh0ICE9IG51bGwpIHtcblx0XHRcdFx0dm5vZGUuYXR0cnMudmFsdWUgPSB2bm9kZS50ZXh0IC8vRklYTUUgaGFuZGxlIG11bHRpcGxlIGNoaWxkcmVuXG5cdFx0XHRcdHZub2RlLnRleHQgPSB1bmRlZmluZWRcblx0XHRcdH1cblx0XHR9XG5cdFx0dXBkYXRlQXR0cnModm5vZGUsIG9sZC5hdHRycywgdm5vZGUuYXR0cnMsIG5zKVxuXHRcdGlmICh2bm9kZS5hdHRycyAhPSBudWxsICYmIHZub2RlLmF0dHJzLmNvbnRlbnRlZGl0YWJsZSAhPSBudWxsKSB7XG5cdFx0XHRzZXRDb250ZW50RWRpdGFibGUodm5vZGUpXG5cdFx0fVxuXHRcdGVsc2UgaWYgKG9sZC50ZXh0ICE9IG51bGwgJiYgdm5vZGUudGV4dCAhPSBudWxsICYmIHZub2RlLnRleHQgIT09IFwiXCIpIHtcblx0XHRcdGlmIChvbGQudGV4dC50b1N0cmluZygpICE9PSB2bm9kZS50ZXh0LnRvU3RyaW5nKCkpIG9sZC5kb20uZmlyc3RDaGlsZC5ub2RlVmFsdWUgPSB2bm9kZS50ZXh0XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0aWYgKG9sZC50ZXh0ICE9IG51bGwpIG9sZC5jaGlsZHJlbiA9IFtWbm9kZShcIiNcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIG9sZC50ZXh0LCB1bmRlZmluZWQsIG9sZC5kb20uZmlyc3RDaGlsZCldXG5cdFx0XHRpZiAodm5vZGUudGV4dCAhPSBudWxsKSB2bm9kZS5jaGlsZHJlbiA9IFtWbm9kZShcIiNcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHZub2RlLnRleHQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKV1cblx0XHRcdHVwZGF0ZU5vZGVzKGVsZW1lbnQsIG9sZC5jaGlsZHJlbiwgdm5vZGUuY2hpbGRyZW4sIGhvb2tzLCBudWxsLCBucylcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gdXBkYXRlQ29tcG9uZW50KHBhcmVudCwgb2xkLCB2bm9kZSwgaG9va3MsIG5leHRTaWJsaW5nLCByZWN5Y2xpbmcsIG5zKSB7XG5cdFx0dm5vZGUuaW5zdGFuY2UgPSBWbm9kZS5ub3JtYWxpemUodm5vZGUudGFnLnZpZXcuY2FsbCh2bm9kZS5zdGF0ZSwgdm5vZGUpKVxuXHRcdHVwZGF0ZUxpZmVjeWNsZSh2bm9kZS50YWcsIHZub2RlLCBob29rcywgcmVjeWNsaW5nKVxuXHRcdGlmICh2bm9kZS5pbnN0YW5jZSAhPSBudWxsKSB7XG5cdFx0XHRpZiAob2xkLmluc3RhbmNlID09IG51bGwpIGluc2VydE5vZGUocGFyZW50LCBjcmVhdGVOb2RlKHZub2RlLmluc3RhbmNlLCBob29rcywgbnMpLCBuZXh0U2libGluZylcblx0XHRcdGVsc2UgdXBkYXRlTm9kZShwYXJlbnQsIG9sZC5pbnN0YW5jZSwgdm5vZGUuaW5zdGFuY2UsIGhvb2tzLCBuZXh0U2libGluZywgcmVjeWNsaW5nLCBucylcblx0XHRcdHZub2RlLmRvbSA9IHZub2RlLmluc3RhbmNlLmRvbVxuXHRcdFx0dm5vZGUuZG9tU2l6ZSA9IHZub2RlLmluc3RhbmNlLmRvbVNpemVcblx0XHR9XG5cdFx0ZWxzZSBpZiAob2xkLmluc3RhbmNlICE9IG51bGwpIHtcblx0XHRcdHJlbW92ZU5vZGUob2xkLmluc3RhbmNlLCBudWxsKVxuXHRcdFx0dm5vZGUuZG9tID0gdW5kZWZpbmVkXG5cdFx0XHR2bm9kZS5kb21TaXplID0gMFxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHZub2RlLmRvbSA9IG9sZC5kb21cblx0XHRcdHZub2RlLmRvbVNpemUgPSBvbGQuZG9tU2l6ZVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBpc1JlY3ljbGFibGUob2xkLCB2bm9kZXMpIHtcblx0XHRpZiAob2xkLnBvb2wgIT0gbnVsbCAmJiBNYXRoLmFicyhvbGQucG9vbC5sZW5ndGggLSB2bm9kZXMubGVuZ3RoKSA8PSBNYXRoLmFicyhvbGQubGVuZ3RoIC0gdm5vZGVzLmxlbmd0aCkpIHtcblx0XHRcdHZhciBvbGRDaGlsZHJlbkxlbmd0aCA9IG9sZFswXSAmJiBvbGRbMF0uY2hpbGRyZW4gJiYgb2xkWzBdLmNoaWxkcmVuLmxlbmd0aCB8fCAwXG5cdFx0XHR2YXIgcG9vbENoaWxkcmVuTGVuZ3RoID0gb2xkLnBvb2xbMF0gJiYgb2xkLnBvb2xbMF0uY2hpbGRyZW4gJiYgb2xkLnBvb2xbMF0uY2hpbGRyZW4ubGVuZ3RoIHx8IDBcblx0XHRcdHZhciB2bm9kZXNDaGlsZHJlbkxlbmd0aCA9IHZub2Rlc1swXSAmJiB2bm9kZXNbMF0uY2hpbGRyZW4gJiYgdm5vZGVzWzBdLmNoaWxkcmVuLmxlbmd0aCB8fCAwXG5cdFx0XHRpZiAoTWF0aC5hYnMocG9vbENoaWxkcmVuTGVuZ3RoIC0gdm5vZGVzQ2hpbGRyZW5MZW5ndGgpIDw9IE1hdGguYWJzKG9sZENoaWxkcmVuTGVuZ3RoIC0gdm5vZGVzQ2hpbGRyZW5MZW5ndGgpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cdGZ1bmN0aW9uIGdldEtleU1hcCh2bm9kZXMsIGVuZCkge1xuXHRcdHZhciBtYXAgPSB7fSwgaSA9IDBcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGVuZDsgaSsrKSB7XG5cdFx0XHR2YXIgdm5vZGUgPSB2bm9kZXNbaV1cblx0XHRcdGlmICh2bm9kZSAhPSBudWxsKSB7XG5cdFx0XHRcdHZhciBrZXkgPSB2bm9kZS5rZXlcblx0XHRcdFx0aWYgKGtleSAhPSBudWxsKSBtYXBba2V5XSA9IGlcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG1hcFxuXHR9XG5cdGZ1bmN0aW9uIHRvRnJhZ21lbnQodm5vZGUpIHtcblx0XHR2YXIgY291bnQgPSB2bm9kZS5kb21TaXplXG5cdFx0aWYgKGNvdW50ICE9IG51bGwgfHwgdm5vZGUuZG9tID09IG51bGwpIHtcblx0XHRcdHZhciBmcmFnbWVudCA9ICRkb2MuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG5cdFx0XHRpZiAoY291bnQgPiAwKSB7XG5cdFx0XHRcdHZhciBkb20gPSB2bm9kZS5kb21cblx0XHRcdFx0d2hpbGUgKC0tY291bnQpIGZyYWdtZW50LmFwcGVuZENoaWxkKGRvbS5uZXh0U2libGluZylcblx0XHRcdFx0ZnJhZ21lbnQuaW5zZXJ0QmVmb3JlKGRvbSwgZnJhZ21lbnQuZmlyc3RDaGlsZClcblx0XHRcdH1cblx0XHRcdHJldHVybiBmcmFnbWVudFxuXHRcdH1cblx0XHRlbHNlIHJldHVybiB2bm9kZS5kb21cblx0fVxuXHRmdW5jdGlvbiBnZXROZXh0U2libGluZyh2bm9kZXMsIGksIG5leHRTaWJsaW5nKSB7XG5cdFx0Zm9yICg7IGkgPCB2bm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICh2bm9kZXNbaV0gIT0gbnVsbCAmJiB2bm9kZXNbaV0uZG9tICE9IG51bGwpIHJldHVybiB2bm9kZXNbaV0uZG9tXG5cdFx0fVxuXHRcdHJldHVybiBuZXh0U2libGluZ1xuXHR9XG5cblx0ZnVuY3Rpb24gaW5zZXJ0Tm9kZShwYXJlbnQsIGRvbSwgbmV4dFNpYmxpbmcpIHtcblx0XHRpZiAobmV4dFNpYmxpbmcgJiYgbmV4dFNpYmxpbmcucGFyZW50Tm9kZSkgcGFyZW50Lmluc2VydEJlZm9yZShkb20sIG5leHRTaWJsaW5nKVxuXHRcdGVsc2UgcGFyZW50LmFwcGVuZENoaWxkKGRvbSlcblx0fVxuXG5cdGZ1bmN0aW9uIHNldENvbnRlbnRFZGl0YWJsZSh2bm9kZSkge1xuXHRcdHZhciBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cdFx0aWYgKGNoaWxkcmVuICE9IG51bGwgJiYgY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIGNoaWxkcmVuWzBdLnRhZyA9PT0gXCI8XCIpIHtcblx0XHRcdHZhciBjb250ZW50ID0gY2hpbGRyZW5bMF0uY2hpbGRyZW5cblx0XHRcdGlmICh2bm9kZS5kb20uaW5uZXJIVE1MICE9PSBjb250ZW50KSB2bm9kZS5kb20uaW5uZXJIVE1MID0gY29udGVudFxuXHRcdH1cblx0XHRlbHNlIGlmICh2bm9kZS50ZXh0ICE9IG51bGwgfHwgY2hpbGRyZW4gIT0gbnVsbCAmJiBjaGlsZHJlbi5sZW5ndGggIT09IDApIHRocm93IG5ldyBFcnJvcihcIkNoaWxkIG5vZGUgb2YgYSBjb250ZW50ZWRpdGFibGUgbXVzdCBiZSB0cnVzdGVkXCIpXG5cdH1cblxuXHQvL3JlbW92ZVxuXHRmdW5jdGlvbiByZW1vdmVOb2Rlcyh2bm9kZXMsIHN0YXJ0LCBlbmQsIGNvbnRleHQpIHtcblx0XHRmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuXHRcdFx0dmFyIHZub2RlID0gdm5vZGVzW2ldXG5cdFx0XHRpZiAodm5vZGUgIT0gbnVsbCkge1xuXHRcdFx0XHRpZiAodm5vZGUuc2tpcCkgdm5vZGUuc2tpcCA9IGZhbHNlXG5cdFx0XHRcdGVsc2UgcmVtb3ZlTm9kZSh2bm9kZSwgY29udGV4dClcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gb25jZShmKSB7XG5cdFx0dmFyIGNhbGxlZCA9IGZhbHNlXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCFjYWxsZWQpIHtcblx0XHRcdFx0Y2FsbGVkID0gdHJ1ZVxuXHRcdFx0XHRmKClcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gcmVtb3ZlTm9kZSh2bm9kZSwgY29udGV4dCkge1xuXHRcdHZhciBleHBlY3RlZCA9IDEsIGNhbGxlZCA9IDBcblx0XHRpZiAodm5vZGUuYXR0cnMgJiYgdm5vZGUuYXR0cnMub25iZWZvcmVyZW1vdmUpIHtcblx0XHRcdGV4cGVjdGVkKytcblx0XHRcdHZub2RlLmF0dHJzLm9uYmVmb3JlcmVtb3ZlLmNhbGwodm5vZGUuc3RhdGUsIHZub2RlLCBvbmNlKGNvbnRpbnVhdGlvbikpXG5cdFx0fVxuXHRcdGlmICh0eXBlb2Ygdm5vZGUudGFnICE9PSBcInN0cmluZ1wiICYmIHZub2RlLnRhZy5vbmJlZm9yZXJlbW92ZSkge1xuXHRcdFx0ZXhwZWN0ZWQrK1xuXHRcdFx0dm5vZGUudGFnLm9uYmVmb3JlcmVtb3ZlLmNhbGwodm5vZGUuc3RhdGUsIHZub2RlLCBvbmNlKGNvbnRpbnVhdGlvbikpXG5cdFx0fVxuXHRcdGNvbnRpbnVhdGlvbigpXG5cdFx0ZnVuY3Rpb24gY29udGludWF0aW9uKCkge1xuXHRcdFx0aWYgKCsrY2FsbGVkID09PSBleHBlY3RlZCkge1xuXHRcdFx0XHRvbnJlbW92ZSh2bm9kZSlcblx0XHRcdFx0aWYgKHZub2RlLmRvbSkge1xuXHRcdFx0XHRcdHZhciBjb3VudCA9IHZub2RlLmRvbVNpemUgfHwgMVxuXHRcdFx0XHRcdGlmIChjb3VudCA+IDEpIHtcblx0XHRcdFx0XHRcdHZhciBkb20gPSB2bm9kZS5kb21cblx0XHRcdFx0XHRcdHdoaWxlICgtLWNvdW50KSB7XG5cdFx0XHRcdFx0XHRcdHJlbW92ZU5vZGVGcm9tRE9NKGRvbS5uZXh0U2libGluZylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVtb3ZlTm9kZUZyb21ET00odm5vZGUuZG9tKVxuXHRcdFx0XHRcdGlmIChjb250ZXh0ICE9IG51bGwgJiYgdm5vZGUuZG9tU2l6ZSA9PSBudWxsICYmICFoYXNJbnRlZ3JhdGlvbk1ldGhvZHModm5vZGUuYXR0cnMpICYmIHR5cGVvZiB2bm9kZS50YWcgPT09IFwic3RyaW5nXCIpIHsgLy9UT0RPIHRlc3QgY3VzdG9tIGVsZW1lbnRzXG5cdFx0XHRcdFx0XHRpZiAoIWNvbnRleHQucG9vbCkgY29udGV4dC5wb29sID0gW3Zub2RlXVxuXHRcdFx0XHRcdFx0ZWxzZSBjb250ZXh0LnBvb2wucHVzaCh2bm9kZSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gcmVtb3ZlTm9kZUZyb21ET00obm9kZSkge1xuXHRcdHZhciBwYXJlbnQgPSBub2RlLnBhcmVudE5vZGVcblx0XHRpZiAocGFyZW50ICE9IG51bGwpIHBhcmVudC5yZW1vdmVDaGlsZChub2RlKVxuXHR9XG5cdGZ1bmN0aW9uIG9ucmVtb3ZlKHZub2RlKSB7XG5cdFx0aWYgKHZub2RlLmF0dHJzICYmIHZub2RlLmF0dHJzLm9ucmVtb3ZlKSB2bm9kZS5hdHRycy5vbnJlbW92ZS5jYWxsKHZub2RlLnN0YXRlLCB2bm9kZSlcblx0XHRpZiAodHlwZW9mIHZub2RlLnRhZyAhPT0gXCJzdHJpbmdcIiAmJiB2bm9kZS50YWcub25yZW1vdmUpIHZub2RlLnRhZy5vbnJlbW92ZS5jYWxsKHZub2RlLnN0YXRlLCB2bm9kZSlcblx0XHRpZiAodm5vZGUuaW5zdGFuY2UgIT0gbnVsbCkgb25yZW1vdmUodm5vZGUuaW5zdGFuY2UpXG5cdFx0ZWxzZSB7XG5cdFx0XHR2YXIgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlblxuXHRcdFx0aWYgKGNoaWxkcmVuIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG5cdFx0XHRcdFx0aWYgKGNoaWxkICE9IG51bGwpIG9ucmVtb3ZlKGNoaWxkKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly9hdHRyc1xuXHRmdW5jdGlvbiBzZXRBdHRycyh2bm9kZSwgYXR0cnMsIG5zKSB7XG5cdFx0Zm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG5cdFx0XHRzZXRBdHRyKHZub2RlLCBrZXksIG51bGwsIGF0dHJzW2tleV0sIG5zKVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBzZXRBdHRyKHZub2RlLCBrZXksIG9sZCwgdmFsdWUsIG5zKSB7XG5cdFx0dmFyIGVsZW1lbnQgPSB2bm9kZS5kb21cblx0XHRpZiAoa2V5ID09PSBcImtleVwiIHx8IChvbGQgPT09IHZhbHVlICYmICFpc0Zvcm1BdHRyaWJ1dGUodm5vZGUsIGtleSkpICYmIHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwidW5kZWZpbmVkXCIgfHwgaXNMaWZlY3ljbGVNZXRob2Qoa2V5KSkgcmV0dXJuXG5cdFx0dmFyIG5zTGFzdEluZGV4ID0ga2V5LmluZGV4T2YoXCI6XCIpXG5cdFx0aWYgKG5zTGFzdEluZGV4ID4gLTEgJiYga2V5LnN1YnN0cigwLCBuc0xhc3RJbmRleCkgPT09IFwieGxpbmtcIikge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGVOUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIiwga2V5LnNsaWNlKG5zTGFzdEluZGV4ICsgMSksIHZhbHVlKVxuXHRcdH1cblx0XHRlbHNlIGlmIChrZXlbMF0gPT09IFwib1wiICYmIGtleVsxXSA9PT0gXCJuXCIgJiYgdHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHVwZGF0ZUV2ZW50KHZub2RlLCBrZXksIHZhbHVlKVxuXHRcdGVsc2UgaWYgKGtleSA9PT0gXCJzdHlsZVwiKSB1cGRhdGVTdHlsZShlbGVtZW50LCBvbGQsIHZhbHVlKVxuXHRcdGVsc2UgaWYgKGtleSBpbiBlbGVtZW50ICYmICFpc0F0dHJpYnV0ZShrZXkpICYmIG5zID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vc2V0dGluZyBpbnB1dFt2YWx1ZV0gdG8gc2FtZSB2YWx1ZSBieSB0eXBpbmcgb24gZm9jdXNlZCBlbGVtZW50IG1vdmVzIGN1cnNvciB0byBlbmQgaW4gQ2hyb21lXG5cdFx0XHRpZiAodm5vZGUudGFnID09PSBcImlucHV0XCIgJiYga2V5ID09PSBcInZhbHVlXCIgJiYgdm5vZGUuZG9tLnZhbHVlID09PSB2YWx1ZSAmJiB2bm9kZS5kb20gPT09ICRkb2MuYWN0aXZlRWxlbWVudCkgcmV0dXJuXG5cdFx0XHQvL3NldHRpbmcgc2VsZWN0W3ZhbHVlXSB0byBzYW1lIHZhbHVlIHdoaWxlIGhhdmluZyBzZWxlY3Qgb3BlbiBibGlua3Mgc2VsZWN0IGRyb3Bkb3duIGluIENocm9tZVxuXHRcdFx0aWYgKHZub2RlLnRhZyA9PT0gXCJzZWxlY3RcIiAmJiBrZXkgPT09IFwidmFsdWVcIiAmJiB2bm9kZS5kb20udmFsdWUgPT09IHZhbHVlICYmIHZub2RlLmRvbSA9PT0gJGRvYy5hY3RpdmVFbGVtZW50KSByZXR1cm5cblx0XHRcdC8vc2V0dGluZyBvcHRpb25bdmFsdWVdIHRvIHNhbWUgdmFsdWUgd2hpbGUgaGF2aW5nIHNlbGVjdCBvcGVuIGJsaW5rcyBzZWxlY3QgZHJvcGRvd24gaW4gQ2hyb21lXG5cdFx0XHRpZiAodm5vZGUudGFnID09PSBcIm9wdGlvblwiICYmIGtleSA9PT0gXCJ2YWx1ZVwiICYmIHZub2RlLmRvbS52YWx1ZSA9PT0gdmFsdWUpIHJldHVyblxuXHRcdFx0ZWxlbWVudFtrZXldID0gdmFsdWVcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuXHRcdFx0XHRpZiAodmFsdWUpIGVsZW1lbnQuc2V0QXR0cmlidXRlKGtleSwgXCJcIilcblx0XHRcdFx0ZWxzZSBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShrZXkpXG5cdFx0XHR9XG5cdFx0XHRlbHNlIGVsZW1lbnQuc2V0QXR0cmlidXRlKGtleSA9PT0gXCJjbGFzc05hbWVcIiA/IFwiY2xhc3NcIiA6IGtleSwgdmFsdWUpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldExhdGVBdHRycyh2bm9kZSkge1xuXHRcdHZhciBhdHRycyA9IHZub2RlLmF0dHJzXG5cdFx0aWYgKHZub2RlLnRhZyA9PT0gXCJzZWxlY3RcIiAmJiBhdHRycyAhPSBudWxsKSB7XG5cdFx0XHRpZiAoXCJ2YWx1ZVwiIGluIGF0dHJzKSBzZXRBdHRyKHZub2RlLCBcInZhbHVlXCIsIG51bGwsIGF0dHJzLnZhbHVlLCB1bmRlZmluZWQpXG5cdFx0XHRpZiAoXCJzZWxlY3RlZEluZGV4XCIgaW4gYXR0cnMpIHNldEF0dHIodm5vZGUsIFwic2VsZWN0ZWRJbmRleFwiLCBudWxsLCBhdHRycy5zZWxlY3RlZEluZGV4LCB1bmRlZmluZWQpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZUF0dHJzKHZub2RlLCBvbGQsIGF0dHJzLCBucykge1xuXHRcdGlmIChhdHRycyAhPSBudWxsKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcblx0XHRcdFx0c2V0QXR0cih2bm9kZSwga2V5LCBvbGQgJiYgb2xkW2tleV0sIGF0dHJzW2tleV0sIG5zKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAob2xkICE9IG51bGwpIHtcblx0XHRcdGZvciAodmFyIGtleSBpbiBvbGQpIHtcblx0XHRcdFx0aWYgKGF0dHJzID09IG51bGwgfHwgIShrZXkgaW4gYXR0cnMpKSB7XG5cdFx0XHRcdFx0aWYgKGtleSA9PT0gXCJjbGFzc05hbWVcIikga2V5ID0gXCJjbGFzc1wiXG5cdFx0XHRcdFx0aWYgKGtleVswXSA9PT0gXCJvXCIgJiYga2V5WzFdID09PSBcIm5cIiAmJiAhaXNMaWZlY3ljbGVNZXRob2Qoa2V5KSkgdXBkYXRlRXZlbnQodm5vZGUsIGtleSwgdW5kZWZpbmVkKVxuXHRcdFx0XHRcdGVsc2UgaWYgKGtleSAhPT0gXCJrZXlcIikgdm5vZGUuZG9tLnJlbW92ZUF0dHJpYnV0ZShrZXkpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gaXNGb3JtQXR0cmlidXRlKHZub2RlLCBhdHRyKSB7XG5cdFx0cmV0dXJuIGF0dHIgPT09IFwidmFsdWVcIiB8fCBhdHRyID09PSBcImNoZWNrZWRcIiB8fCBhdHRyID09PSBcInNlbGVjdGVkSW5kZXhcIiB8fCBhdHRyID09PSBcInNlbGVjdGVkXCIgJiYgdm5vZGUuZG9tID09PSAkZG9jLmFjdGl2ZUVsZW1lbnRcblx0fVxuXHRmdW5jdGlvbiBpc0xpZmVjeWNsZU1ldGhvZChhdHRyKSB7XG5cdFx0cmV0dXJuIGF0dHIgPT09IFwib25pbml0XCIgfHwgYXR0ciA9PT0gXCJvbmNyZWF0ZVwiIHx8IGF0dHIgPT09IFwib251cGRhdGVcIiB8fCBhdHRyID09PSBcIm9ucmVtb3ZlXCIgfHwgYXR0ciA9PT0gXCJvbmJlZm9yZXJlbW92ZVwiIHx8IGF0dHIgPT09IFwib25iZWZvcmV1cGRhdGVcIlxuXHR9XG5cdGZ1bmN0aW9uIGlzQXR0cmlidXRlKGF0dHIpIHtcblx0XHRyZXR1cm4gYXR0ciA9PT0gXCJocmVmXCIgfHwgYXR0ciA9PT0gXCJsaXN0XCIgfHwgYXR0ciA9PT0gXCJmb3JtXCIgfHwgYXR0ciA9PT0gXCJ3aWR0aFwiIHx8IGF0dHIgPT09IFwiaGVpZ2h0XCIvLyB8fCBhdHRyID09PSBcInR5cGVcIlxuXHR9XG5cdGZ1bmN0aW9uIGhhc0ludGVncmF0aW9uTWV0aG9kcyhzb3VyY2UpIHtcblx0XHRyZXR1cm4gc291cmNlICE9IG51bGwgJiYgKHNvdXJjZS5vbmNyZWF0ZSB8fCBzb3VyY2Uub251cGRhdGUgfHwgc291cmNlLm9uYmVmb3JlcmVtb3ZlIHx8IHNvdXJjZS5vbnJlbW92ZSlcblx0fVxuXG5cdC8vc3R5bGVcblx0ZnVuY3Rpb24gdXBkYXRlU3R5bGUoZWxlbWVudCwgb2xkLCBzdHlsZSkge1xuXHRcdGlmIChvbGQgPT09IHN0eWxlKSBlbGVtZW50LnN0eWxlLmNzc1RleHQgPSBcIlwiLCBvbGQgPSBudWxsXG5cdFx0aWYgKHN0eWxlID09IG51bGwpIGVsZW1lbnQuc3R5bGUuY3NzVGV4dCA9IFwiXCJcblx0XHRlbHNlIGlmICh0eXBlb2Ygc3R5bGUgPT09IFwic3RyaW5nXCIpIGVsZW1lbnQuc3R5bGUuY3NzVGV4dCA9IHN0eWxlXG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodHlwZW9mIG9sZCA9PT0gXCJzdHJpbmdcIikgZWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gXCJcIlxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHN0eWxlKSB7XG5cdFx0XHRcdGVsZW1lbnQuc3R5bGVba2V5XSA9IHN0eWxlW2tleV1cblx0XHRcdH1cblx0XHRcdGlmIChvbGQgIT0gbnVsbCAmJiB0eXBlb2Ygb2xkICE9PSBcInN0cmluZ1wiKSB7XG5cdFx0XHRcdGZvciAodmFyIGtleSBpbiBvbGQpIHtcblx0XHRcdFx0XHRpZiAoIShrZXkgaW4gc3R5bGUpKSBlbGVtZW50LnN0eWxlW2tleV0gPSBcIlwiXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvL2V2ZW50XG5cdGZ1bmN0aW9uIHVwZGF0ZUV2ZW50KHZub2RlLCBrZXksIHZhbHVlKSB7XG5cdFx0dmFyIGVsZW1lbnQgPSB2bm9kZS5kb21cblx0XHR2YXIgY2FsbGJhY2sgPSB0eXBlb2Ygb25ldmVudCAhPT0gXCJmdW5jdGlvblwiID8gdmFsdWUgOiBmdW5jdGlvbihlKSB7XG5cdFx0XHR2YXIgcmVzdWx0ID0gdmFsdWUuY2FsbChlbGVtZW50LCBlKVxuXHRcdFx0b25ldmVudC5jYWxsKGVsZW1lbnQsIGUpXG5cdFx0XHRyZXR1cm4gcmVzdWx0XG5cdFx0fVxuXHRcdGlmIChrZXkgaW4gZWxlbWVudCkgZWxlbWVudFtrZXldID0gdHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgPyBjYWxsYmFjayA6IG51bGxcblx0XHRlbHNlIHtcblx0XHRcdHZhciBldmVudE5hbWUgPSBrZXkuc2xpY2UoMilcblx0XHRcdGlmICh2bm9kZS5ldmVudHMgPT09IHVuZGVmaW5lZCkgdm5vZGUuZXZlbnRzID0ge31cblx0XHRcdGlmICh2bm9kZS5ldmVudHNba2V5XSA9PT0gY2FsbGJhY2spIHJldHVyblxuXHRcdFx0aWYgKHZub2RlLmV2ZW50c1trZXldICE9IG51bGwpIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIHZub2RlLmV2ZW50c1trZXldLCBmYWxzZSlcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR2bm9kZS5ldmVudHNba2V5XSA9IGNhbGxiYWNrXG5cdFx0XHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIHZub2RlLmV2ZW50c1trZXldLCBmYWxzZSlcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvL2xpZmVjeWNsZVxuXHRmdW5jdGlvbiBpbml0TGlmZWN5Y2xlKHNvdXJjZSwgdm5vZGUsIGhvb2tzKSB7XG5cdFx0aWYgKHR5cGVvZiBzb3VyY2Uub25pbml0ID09PSBcImZ1bmN0aW9uXCIpIHNvdXJjZS5vbmluaXQuY2FsbCh2bm9kZS5zdGF0ZSwgdm5vZGUpXG5cdFx0aWYgKHR5cGVvZiBzb3VyY2Uub25jcmVhdGUgPT09IFwiZnVuY3Rpb25cIikgaG9va3MucHVzaChzb3VyY2Uub25jcmVhdGUuYmluZCh2bm9kZS5zdGF0ZSwgdm5vZGUpKVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZUxpZmVjeWNsZShzb3VyY2UsIHZub2RlLCBob29rcywgcmVjeWNsaW5nKSB7XG5cdFx0aWYgKHJlY3ljbGluZykgaW5pdExpZmVjeWNsZShzb3VyY2UsIHZub2RlLCBob29rcylcblx0XHRlbHNlIGlmICh0eXBlb2Ygc291cmNlLm9udXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIGhvb2tzLnB1c2goc291cmNlLm9udXBkYXRlLmJpbmQodm5vZGUuc3RhdGUsIHZub2RlKSlcblx0fVxuXHRmdW5jdGlvbiBzaG91bGRVcGRhdGUodm5vZGUsIG9sZCkge1xuXHRcdHZhciBmb3JjZVZub2RlVXBkYXRlLCBmb3JjZUNvbXBvbmVudFVwZGF0ZVxuXHRcdGlmICh2bm9kZS5hdHRycyAhPSBudWxsICYmIHR5cGVvZiB2bm9kZS5hdHRycy5vbmJlZm9yZXVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiKSBmb3JjZVZub2RlVXBkYXRlID0gdm5vZGUuYXR0cnMub25iZWZvcmV1cGRhdGUuY2FsbCh2bm9kZS5zdGF0ZSwgdm5vZGUsIG9sZClcblx0XHRpZiAodHlwZW9mIHZub2RlLnRhZyAhPT0gXCJzdHJpbmdcIiAmJiB0eXBlb2Ygdm5vZGUudGFnLm9uYmVmb3JldXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIGZvcmNlQ29tcG9uZW50VXBkYXRlID0gdm5vZGUudGFnLm9uYmVmb3JldXBkYXRlLmNhbGwodm5vZGUuc3RhdGUsIHZub2RlLCBvbGQpXG5cdFx0aWYgKCEoZm9yY2VWbm9kZVVwZGF0ZSA9PT0gdW5kZWZpbmVkICYmIGZvcmNlQ29tcG9uZW50VXBkYXRlID09PSB1bmRlZmluZWQpICYmICFmb3JjZVZub2RlVXBkYXRlICYmICFmb3JjZUNvbXBvbmVudFVwZGF0ZSkge1xuXHRcdFx0dm5vZGUuZG9tID0gb2xkLmRvbVxuXHRcdFx0dm5vZGUuZG9tU2l6ZSA9IG9sZC5kb21TaXplXG5cdFx0XHR2bm9kZS5pbnN0YW5jZSA9IG9sZC5pbnN0YW5jZVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxuXHRmdW5jdGlvbiBhc3NpZ24odGFyZ2V0LCBzb3VyY2UpIHtcblx0XHRPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goZnVuY3Rpb24oayl7dGFyZ2V0W2tdID0gc291cmNlW2tdfSlcblx0fVxuXG5cdGZ1bmN0aW9uIHJlbmRlcihkb20sIHZub2Rlcykge1xuXHRcdGlmICghZG9tKSB0aHJvdyBuZXcgRXJyb3IoXCJFbnN1cmUgdGhlIERPTSBlbGVtZW50IGJlaW5nIHBhc3NlZCB0byBtLnJvdXRlL20ubW91bnQvbS5yZW5kZXIgaXMgbm90IHVuZGVmaW5lZC5cIilcblx0XHR2YXIgaG9va3MgPSBbXVxuXHRcdHZhciBhY3RpdmUgPSAkZG9jLmFjdGl2ZUVsZW1lbnRcblxuXHRcdC8vIEZpcnN0IHRpbWUgcmVuZGVyaW5nIGludG8gYSBub2RlIGNsZWFycyBpdCBvdXRcblx0XHRpZiAoZG9tLnZub2RlcyA9PSBudWxsKSBkb20udGV4dENvbnRlbnQgPSBcIlwiXG5cblx0XHRpZiAoISh2bm9kZXMgaW5zdGFuY2VvZiBBcnJheSkpIHZub2RlcyA9IFt2bm9kZXNdXG5cdFx0dXBkYXRlTm9kZXMoZG9tLCBkb20udm5vZGVzLCBWbm9kZS5ub3JtYWxpemVDaGlsZHJlbih2bm9kZXMpLCBob29rcywgbnVsbCwgdW5kZWZpbmVkKVxuXHRcdGRvbS52bm9kZXMgPSB2bm9kZXNcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgaSsrKSBob29rc1tpXSgpXG5cdFx0aWYgKCRkb2MuYWN0aXZlRWxlbWVudCAhPT0gYWN0aXZlKSBhY3RpdmUuZm9jdXMoKVxuXHR9XG5cblx0cmV0dXJuIHtyZW5kZXI6IHJlbmRlciwgc2V0RXZlbnRDYWxsYmFjazogc2V0RXZlbnRDYWxsYmFja31cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihodG1sKSB7XG5cdGlmIChodG1sID09IG51bGwpIGh0bWwgPSBcIlwiXG5cdHJldHVybiBWbm9kZShcIjxcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGh0bWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKVxufVxuIiwiZnVuY3Rpb24gVm5vZGUodGFnLCBrZXksIGF0dHJzLCBjaGlsZHJlbiwgdGV4dCwgZG9tKSB7XG5cdHJldHVybiB7dGFnOiB0YWcsIGtleToga2V5LCBhdHRyczogYXR0cnMsIGNoaWxkcmVuOiBjaGlsZHJlbiwgdGV4dDogdGV4dCwgZG9tOiBkb20sIGRvbVNpemU6IHVuZGVmaW5lZCwgc3RhdGU6IHt9LCBldmVudHM6IHVuZGVmaW5lZCwgaW5zdGFuY2U6IHVuZGVmaW5lZCwgc2tpcDogZmFsc2V9XG59XG5Wbm9kZS5ub3JtYWxpemUgPSBmdW5jdGlvbihub2RlKSB7XG5cdGlmIChub2RlIGluc3RhbmNlb2YgQXJyYXkpIHJldHVybiBWbm9kZShcIltcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKG5vZGUpLCB1bmRlZmluZWQsIHVuZGVmaW5lZClcblx0aWYgKG5vZGUgIT0gbnVsbCAmJiB0eXBlb2Ygbm9kZSAhPT0gXCJvYmplY3RcIikgcmV0dXJuIFZub2RlKFwiI1wiLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbm9kZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXG5cdHJldHVybiBub2RlXG59XG5Wbm9kZS5ub3JtYWxpemVDaGlsZHJlbiA9IGZ1bmN0aW9uIG5vcm1hbGl6ZUNoaWxkcmVuKGNoaWxkcmVuKSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0XHRjaGlsZHJlbltpXSA9IFZub2RlLm5vcm1hbGl6ZShjaGlsZHJlbltpXSlcblx0fVxuXHRyZXR1cm4gY2hpbGRyZW5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBWbm9kZVxuIiwidmFyIFByb21pc2VQb2x5ZmlsbCA9IHJlcXVpcmUoXCIuL3Byb21pc2UvcHJvbWlzZVwiKVxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9yZXF1ZXN0L3JlcXVlc3RcIikod2luZG93LCBQcm9taXNlUG9seWZpbGwpXG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgYnVpbGRRdWVyeVN0cmluZyA9IHJlcXVpcmUoXCIuLi9xdWVyeXN0cmluZy9idWlsZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCR3aW5kb3csIFByb21pc2UpIHtcblx0dmFyIGNhbGxiYWNrQ291bnQgPSAwXG5cblx0dmFyIG9uY29tcGxldGlvblxuXHRmdW5jdGlvbiBzZXRDb21wbGV0aW9uQ2FsbGJhY2soY2FsbGJhY2spIHtvbmNvbXBsZXRpb24gPSBjYWxsYmFja31cblx0ZnVuY3Rpb24gZmluYWxpemVyKCkge1xuXHRcdHZhciBjb3VudCA9IDBcblx0XHRmdW5jdGlvbiBjb21wbGV0ZSgpIHtpZiAoLS1jb3VudCA9PT0gMCAmJiB0eXBlb2Ygb25jb21wbGV0aW9uID09PSBcImZ1bmN0aW9uXCIpIG9uY29tcGxldGlvbigpfVxuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uIGZpbmFsaXplKHByb21pc2UpIHtcblx0XHRcdHZhciB0aGVuID0gcHJvbWlzZS50aGVuXG5cdFx0XHRwcm9taXNlLnRoZW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0Y291bnQrK1xuXHRcdFx0XHR2YXIgbmV4dCA9IHRoZW4uYXBwbHkocHJvbWlzZSwgYXJndW1lbnRzKVxuXHRcdFx0XHRuZXh0LnRoZW4oY29tcGxldGUsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRjb21wbGV0ZSgpXG5cdFx0XHRcdFx0aWYgKGNvdW50ID09PSAwKSB0aHJvdyBlXG5cdFx0XHRcdH0pXG5cdFx0XHRcdHJldHVybiBmaW5hbGl6ZShuZXh0KVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHByb21pc2Vcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gbm9ybWFsaXplKGFyZ3MsIGV4dHJhKSB7XG5cdFx0aWYgKHR5cGVvZiBhcmdzID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHR2YXIgdXJsID0gYXJnc1xuXHRcdFx0YXJncyA9IGV4dHJhIHx8IHt9XG5cdFx0XHRpZiAoYXJncy51cmwgPT0gbnVsbCkgYXJncy51cmwgPSB1cmxcblx0XHR9XG5cdFx0cmV0dXJuIGFyZ3Ncblx0fVxuXHRcblx0ZnVuY3Rpb24gcmVxdWVzdChhcmdzLCBleHRyYSkge1xuXHRcdHZhciBmaW5hbGl6ZSA9IGZpbmFsaXplcigpXG5cdFx0YXJncyA9IG5vcm1hbGl6ZShhcmdzLCBleHRyYSlcblxuXHRcdHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRpZiAoYXJncy5tZXRob2QgPT0gbnVsbCkgYXJncy5tZXRob2QgPSBcIkdFVFwiXG5cdFx0XHRhcmdzLm1ldGhvZCA9IGFyZ3MubWV0aG9kLnRvVXBwZXJDYXNlKClcblxuXHRcdFx0dmFyIHVzZUJvZHkgPSB0eXBlb2YgYXJncy51c2VCb2R5ID09PSBcImJvb2xlYW5cIiA/IGFyZ3MudXNlQm9keSA6IGFyZ3MubWV0aG9kICE9PSBcIkdFVFwiICYmIGFyZ3MubWV0aG9kICE9PSBcIlRSQUNFXCJcblxuXHRcdFx0aWYgKHR5cGVvZiBhcmdzLnNlcmlhbGl6ZSAhPT0gXCJmdW5jdGlvblwiKSBhcmdzLnNlcmlhbGl6ZSA9IHR5cGVvZiBGb3JtRGF0YSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBhcmdzLmRhdGEgaW5zdGFuY2VvZiBGb3JtRGF0YSA/IGZ1bmN0aW9uKHZhbHVlKSB7cmV0dXJuIHZhbHVlfSA6IEpTT04uc3RyaW5naWZ5XG5cdFx0XHRpZiAodHlwZW9mIGFyZ3MuZGVzZXJpYWxpemUgIT09IFwiZnVuY3Rpb25cIikgYXJncy5kZXNlcmlhbGl6ZSA9IGRlc2VyaWFsaXplXG5cdFx0XHRpZiAodHlwZW9mIGFyZ3MuZXh0cmFjdCAhPT0gXCJmdW5jdGlvblwiKSBhcmdzLmV4dHJhY3QgPSBleHRyYWN0XG5cblx0XHRcdGFyZ3MudXJsID0gaW50ZXJwb2xhdGUoYXJncy51cmwsIGFyZ3MuZGF0YSlcblx0XHRcdGlmICh1c2VCb2R5KSBhcmdzLmRhdGEgPSBhcmdzLnNlcmlhbGl6ZShhcmdzLmRhdGEpXG5cdFx0XHRlbHNlIGFyZ3MudXJsID0gYXNzZW1ibGUoYXJncy51cmwsIGFyZ3MuZGF0YSlcblxuXHRcdFx0dmFyIHhociA9IG5ldyAkd2luZG93LlhNTEh0dHBSZXF1ZXN0KClcblx0XHRcdHhoci5vcGVuKGFyZ3MubWV0aG9kLCBhcmdzLnVybCwgdHlwZW9mIGFyZ3MuYXN5bmMgPT09IFwiYm9vbGVhblwiID8gYXJncy5hc3luYyA6IHRydWUsIHR5cGVvZiBhcmdzLnVzZXIgPT09IFwic3RyaW5nXCIgPyBhcmdzLnVzZXIgOiB1bmRlZmluZWQsIHR5cGVvZiBhcmdzLnBhc3N3b3JkID09PSBcInN0cmluZ1wiID8gYXJncy5wYXNzd29yZCA6IHVuZGVmaW5lZClcblxuXHRcdFx0aWYgKGFyZ3Muc2VyaWFsaXplID09PSBKU09OLnN0cmluZ2lmeSAmJiB1c2VCb2R5KSB7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiKVxuXHRcdFx0fVxuXHRcdFx0aWYgKGFyZ3MuZGVzZXJpYWxpemUgPT09IGRlc2VyaWFsaXplKSB7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQWNjZXB0XCIsIFwiYXBwbGljYXRpb24vanNvbiwgdGV4dC8qXCIpXG5cdFx0XHR9XG5cdFx0XHRpZiAoYXJncy53aXRoQ3JlZGVudGlhbHMpIHhoci53aXRoQ3JlZGVudGlhbHMgPSBhcmdzLndpdGhDcmVkZW50aWFsc1xuXG5cdFx0XHRpZiAodHlwZW9mIGFyZ3MuY29uZmlnID09PSBcImZ1bmN0aW9uXCIpIHhociA9IGFyZ3MuY29uZmlnKHhociwgYXJncykgfHwgeGhyXG5cblx0XHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHZhciByZXNwb25zZSA9IChhcmdzLmV4dHJhY3QgIT09IGV4dHJhY3QpID8gYXJncy5leHRyYWN0KHhociwgYXJncykgOiBhcmdzLmRlc2VyaWFsaXplKGFyZ3MuZXh0cmFjdCh4aHIsIGFyZ3MpKVxuXHRcdFx0XHRcdFx0aWYgKCh4aHIuc3RhdHVzID49IDIwMCAmJiB4aHIuc3RhdHVzIDwgMzAwKSB8fCB4aHIuc3RhdHVzID09PSAzMDQpIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShjYXN0KGFyZ3MudHlwZSwgcmVzcG9uc2UpKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHZhciBlcnJvciA9IG5ldyBFcnJvcih4aHIucmVzcG9uc2VUZXh0KVxuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBrZXkgaW4gcmVzcG9uc2UpIGVycm9yW2tleV0gPSByZXNwb25zZVtrZXldXG5cdFx0XHRcdFx0XHRcdHJlamVjdChlcnJvcilcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHJlamVjdChlKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodXNlQm9keSAmJiAoYXJncy5kYXRhICE9IG51bGwpKSB4aHIuc2VuZChhcmdzLmRhdGEpXG5cdFx0XHRlbHNlIHhoci5zZW5kKClcblx0XHR9KVxuXHRcdHJldHVybiBhcmdzLmJhY2tncm91bmQgPT09IHRydWUgPyBwcm9taXNlIDogZmluYWxpemUocHJvbWlzZSlcblx0fVxuXG5cdGZ1bmN0aW9uIGpzb25wKGFyZ3MsIGV4dHJhKSB7XG5cdFx0dmFyIGZpbmFsaXplID0gZmluYWxpemVyKClcblx0XHRhcmdzID0gbm9ybWFsaXplKGFyZ3MsIGV4dHJhKVxuXHRcdFxuXHRcdHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tOYW1lID0gYXJncy5jYWxsYmFja05hbWUgfHwgXCJfbWl0aHJpbF9cIiArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDFlMTYpICsgXCJfXCIgKyBjYWxsYmFja0NvdW50Kytcblx0XHRcdHZhciBzY3JpcHQgPSAkd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIilcblx0XHRcdCR3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdFx0c2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KVxuXHRcdFx0XHRyZXNvbHZlKGNhc3QoYXJncy50eXBlLCBkYXRhKSlcblx0XHRcdFx0ZGVsZXRlICR3aW5kb3dbY2FsbGJhY2tOYW1lXVxuXHRcdFx0fVxuXHRcdFx0c2NyaXB0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KVxuXHRcdFx0XHRyZWplY3QobmV3IEVycm9yKFwiSlNPTlAgcmVxdWVzdCBmYWlsZWRcIikpXG5cdFx0XHRcdGRlbGV0ZSAkd2luZG93W2NhbGxiYWNrTmFtZV1cblx0XHRcdH1cblx0XHRcdGlmIChhcmdzLmRhdGEgPT0gbnVsbCkgYXJncy5kYXRhID0ge31cblx0XHRcdGFyZ3MudXJsID0gaW50ZXJwb2xhdGUoYXJncy51cmwsIGFyZ3MuZGF0YSlcblx0XHRcdGFyZ3MuZGF0YVthcmdzLmNhbGxiYWNrS2V5IHx8IFwiY2FsbGJhY2tcIl0gPSBjYWxsYmFja05hbWVcblx0XHRcdHNjcmlwdC5zcmMgPSBhc3NlbWJsZShhcmdzLnVybCwgYXJncy5kYXRhKVxuXHRcdFx0JHdpbmRvdy5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoc2NyaXB0KVxuXHRcdH0pXG5cdFx0cmV0dXJuIGFyZ3MuYmFja2dyb3VuZCA9PT0gdHJ1ZT8gcHJvbWlzZSA6IGZpbmFsaXplKHByb21pc2UpXG5cdH1cblxuXHRmdW5jdGlvbiBpbnRlcnBvbGF0ZSh1cmwsIGRhdGEpIHtcblx0XHRpZiAoZGF0YSA9PSBudWxsKSByZXR1cm4gdXJsXG5cblx0XHR2YXIgdG9rZW5zID0gdXJsLm1hdGNoKC86W15cXC9dKy9naSkgfHwgW11cblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGtleSA9IHRva2Vuc1tpXS5zbGljZSgxKVxuXHRcdFx0aWYgKGRhdGFba2V5XSAhPSBudWxsKSB7XG5cdFx0XHRcdHVybCA9IHVybC5yZXBsYWNlKHRva2Vuc1tpXSwgZGF0YVtrZXldKVxuXHRcdFx0XHRkZWxldGUgZGF0YVtrZXldXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1cmxcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VtYmxlKHVybCwgZGF0YSkge1xuXHRcdHZhciBxdWVyeXN0cmluZyA9IGJ1aWxkUXVlcnlTdHJpbmcoZGF0YSlcblx0XHRpZiAocXVlcnlzdHJpbmcgIT09IFwiXCIpIHtcblx0XHRcdHZhciBwcmVmaXggPSB1cmwuaW5kZXhPZihcIj9cIikgPCAwID8gXCI/XCIgOiBcIiZcIlxuXHRcdFx0dXJsICs9IHByZWZpeCArIHF1ZXJ5c3RyaW5nXG5cdFx0fVxuXHRcdHJldHVybiB1cmxcblx0fVxuXG5cdGZ1bmN0aW9uIGRlc2VyaWFsaXplKGRhdGEpIHtcblx0XHR0cnkge3JldHVybiBkYXRhICE9PSBcIlwiID8gSlNPTi5wYXJzZShkYXRhKSA6IG51bGx9XG5cdFx0Y2F0Y2ggKGUpIHt0aHJvdyBuZXcgRXJyb3IoZGF0YSl9XG5cdH1cblxuXHRmdW5jdGlvbiBleHRyYWN0KHhocikge3JldHVybiB4aHIucmVzcG9uc2VUZXh0fVxuXG5cdGZ1bmN0aW9uIGNhc3QodHlwZSwgZGF0YSkge1xuXHRcdGlmICh0eXBlb2YgdHlwZSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRpZiAoZGF0YSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGRhdGFbaV0gPSBuZXcgdHlwZShkYXRhW2ldKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHJldHVybiBuZXcgdHlwZShkYXRhKVxuXHRcdH1cblx0XHRyZXR1cm4gZGF0YVxuXHR9XG5cblx0cmV0dXJuIHtyZXF1ZXN0OiByZXF1ZXN0LCBqc29ucDoganNvbnAsIHNldENvbXBsZXRpb25DYWxsYmFjazogc2V0Q29tcGxldGlvbkNhbGxiYWNrfVxufVxuIiwidmFyIHJlZHJhd1NlcnZpY2UgPSByZXF1aXJlKFwiLi9yZWRyYXdcIilcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9hcGkvcm91dGVyXCIpKHdpbmRvdywgcmVkcmF3U2VydmljZSkiLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgYnVpbGRRdWVyeVN0cmluZyA9IHJlcXVpcmUoXCIuLi9xdWVyeXN0cmluZy9idWlsZFwiKVxudmFyIHBhcnNlUXVlcnlTdHJpbmcgPSByZXF1aXJlKFwiLi4vcXVlcnlzdHJpbmcvcGFyc2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkd2luZG93KSB7XG5cdHZhciBzdXBwb3J0c1B1c2hTdGF0ZSA9IHR5cGVvZiAkd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlID09PSBcImZ1bmN0aW9uXCJcblx0dmFyIGNhbGxBc3luYyA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IHNldFRpbWVvdXRcblxuXHRmdW5jdGlvbiBub3JtYWxpemUoZnJhZ21lbnQpIHtcblx0XHR2YXIgZGF0YSA9ICR3aW5kb3cubG9jYXRpb25bZnJhZ21lbnRdLnJlcGxhY2UoLyg/OiVbYS1mODldW2EtZjAtOV0pKy9naW0sIGRlY29kZVVSSUNvbXBvbmVudClcblx0XHRpZiAoZnJhZ21lbnQgPT09IFwicGF0aG5hbWVcIiAmJiBkYXRhWzBdICE9PSBcIi9cIikgZGF0YSA9IFwiL1wiICsgZGF0YVxuXHRcdHJldHVybiBkYXRhXG5cdH1cblxuXHR2YXIgYXN5bmNJZFxuXHRmdW5jdGlvbiBkZWJvdW5jZUFzeW5jKGNhbGxiYWNrKSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGFzeW5jSWQgIT0gbnVsbCkgcmV0dXJuXG5cdFx0XHRhc3luY0lkID0gY2FsbEFzeW5jKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhc3luY0lkID0gbnVsbFxuXHRcdFx0XHRjYWxsYmFjaygpXG5cdFx0XHR9KVxuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHBhcnNlUGF0aChwYXRoLCBxdWVyeURhdGEsIGhhc2hEYXRhKSB7XG5cdFx0dmFyIHF1ZXJ5SW5kZXggPSBwYXRoLmluZGV4T2YoXCI/XCIpXG5cdFx0dmFyIGhhc2hJbmRleCA9IHBhdGguaW5kZXhPZihcIiNcIilcblx0XHR2YXIgcGF0aEVuZCA9IHF1ZXJ5SW5kZXggPiAtMSA/IHF1ZXJ5SW5kZXggOiBoYXNoSW5kZXggPiAtMSA/IGhhc2hJbmRleCA6IHBhdGgubGVuZ3RoXG5cdFx0aWYgKHF1ZXJ5SW5kZXggPiAtMSkge1xuXHRcdFx0dmFyIHF1ZXJ5RW5kID0gaGFzaEluZGV4ID4gLTEgPyBoYXNoSW5kZXggOiBwYXRoLmxlbmd0aFxuXHRcdFx0dmFyIHF1ZXJ5UGFyYW1zID0gcGFyc2VRdWVyeVN0cmluZyhwYXRoLnNsaWNlKHF1ZXJ5SW5kZXggKyAxLCBxdWVyeUVuZCkpXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gcXVlcnlQYXJhbXMpIHF1ZXJ5RGF0YVtrZXldID0gcXVlcnlQYXJhbXNba2V5XVxuXHRcdH1cblx0XHRpZiAoaGFzaEluZGV4ID4gLTEpIHtcblx0XHRcdHZhciBoYXNoUGFyYW1zID0gcGFyc2VRdWVyeVN0cmluZyhwYXRoLnNsaWNlKGhhc2hJbmRleCArIDEpKVxuXHRcdFx0Zm9yICh2YXIga2V5IGluIGhhc2hQYXJhbXMpIGhhc2hEYXRhW2tleV0gPSBoYXNoUGFyYW1zW2tleV1cblx0XHR9XG5cdFx0cmV0dXJuIHBhdGguc2xpY2UoMCwgcGF0aEVuZClcblx0fVxuXG5cdHZhciByb3V0ZXIgPSB7cHJlZml4OiBcIiMhXCJ9XG5cdHJvdXRlci5nZXRQYXRoID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHR5cGUgPSByb3V0ZXIucHJlZml4LmNoYXJBdCgwKVxuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBcIiNcIjogcmV0dXJuIG5vcm1hbGl6ZShcImhhc2hcIikuc2xpY2Uocm91dGVyLnByZWZpeC5sZW5ndGgpXG5cdFx0XHRjYXNlIFwiP1wiOiByZXR1cm4gbm9ybWFsaXplKFwic2VhcmNoXCIpLnNsaWNlKHJvdXRlci5wcmVmaXgubGVuZ3RoKSArIG5vcm1hbGl6ZShcImhhc2hcIilcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBub3JtYWxpemUoXCJwYXRobmFtZVwiKS5zbGljZShyb3V0ZXIucHJlZml4Lmxlbmd0aCkgKyBub3JtYWxpemUoXCJzZWFyY2hcIikgKyBub3JtYWxpemUoXCJoYXNoXCIpXG5cdFx0fVxuXHR9XG5cdHJvdXRlci5zZXRQYXRoID0gZnVuY3Rpb24ocGF0aCwgZGF0YSwgb3B0aW9ucykge1xuXHRcdHZhciBxdWVyeURhdGEgPSB7fSwgaGFzaERhdGEgPSB7fVxuXHRcdHBhdGggPSBwYXJzZVBhdGgocGF0aCwgcXVlcnlEYXRhLCBoYXNoRGF0YSlcblx0XHRpZiAoZGF0YSAhPSBudWxsKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gZGF0YSkgcXVlcnlEYXRhW2tleV0gPSBkYXRhW2tleV1cblx0XHRcdHBhdGggPSBwYXRoLnJlcGxhY2UoLzooW15cXC9dKykvZywgZnVuY3Rpb24obWF0Y2gsIHRva2VuKSB7XG5cdFx0XHRcdGRlbGV0ZSBxdWVyeURhdGFbdG9rZW5dXG5cdFx0XHRcdHJldHVybiBkYXRhW3Rva2VuXVxuXHRcdFx0fSlcblx0XHR9XG5cblx0XHR2YXIgcXVlcnkgPSBidWlsZFF1ZXJ5U3RyaW5nKHF1ZXJ5RGF0YSlcblx0XHRpZiAocXVlcnkpIHBhdGggKz0gXCI/XCIgKyBxdWVyeVxuXG5cdFx0dmFyIGhhc2ggPSBidWlsZFF1ZXJ5U3RyaW5nKGhhc2hEYXRhKVxuXHRcdGlmIChoYXNoKSBwYXRoICs9IFwiI1wiICsgaGFzaFxuXG5cdFx0aWYgKHN1cHBvcnRzUHVzaFN0YXRlKSB7XG5cdFx0XHRpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlcGxhY2UpICR3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUobnVsbCwgbnVsbCwgcm91dGVyLnByZWZpeCArIHBhdGgpXG5cdFx0XHRlbHNlICR3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgcm91dGVyLnByZWZpeCArIHBhdGgpXG5cdFx0XHQkd2luZG93Lm9ucG9wc3RhdGUoKVxuXHRcdH1cblx0XHRlbHNlICR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJvdXRlci5wcmVmaXggKyBwYXRoXG5cdH1cblx0cm91dGVyLmRlZmluZVJvdXRlcyA9IGZ1bmN0aW9uKHJvdXRlcywgcmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZVJvdXRlKCkge1xuXHRcdFx0dmFyIHBhdGggPSByb3V0ZXIuZ2V0UGF0aCgpXG5cdFx0XHR2YXIgcGFyYW1zID0ge31cblx0XHRcdHZhciBwYXRobmFtZSA9IHBhcnNlUGF0aChwYXRoLCBwYXJhbXMsIHBhcmFtcylcblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgcm91dGUgaW4gcm91dGVzKSB7XG5cdFx0XHRcdHZhciBtYXRjaGVyID0gbmV3IFJlZ0V4cChcIl5cIiArIHJvdXRlLnJlcGxhY2UoLzpbXlxcL10rP1xcLnszfS9nLCBcIiguKj8pXCIpLnJlcGxhY2UoLzpbXlxcL10rL2csIFwiKFteXFxcXC9dKylcIikgKyBcIlxcLz8kXCIpXG5cblx0XHRcdFx0aWYgKG1hdGNoZXIudGVzdChwYXRobmFtZSkpIHtcblx0XHRcdFx0XHRwYXRobmFtZS5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0dmFyIGtleXMgPSByb3V0ZS5tYXRjaCgvOlteXFwvXSsvZykgfHwgW11cblx0XHRcdFx0XHRcdHZhciB2YWx1ZXMgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSwgLTIpXG5cdFx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0cGFyYW1zW2tleXNbaV0ucmVwbGFjZSgvOnxcXC4vZywgXCJcIildID0gZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlc1tpXSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJlc29sdmUocm91dGVzW3JvdXRlXSwgcGFyYW1zLCBwYXRoLCByb3V0ZSlcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJlamVjdChwYXRoLCBwYXJhbXMpXG5cdFx0fVxuXHRcdFxuXHRcdGlmIChzdXBwb3J0c1B1c2hTdGF0ZSkgJHdpbmRvdy5vbnBvcHN0YXRlID0gZGVib3VuY2VBc3luYyhyZXNvbHZlUm91dGUpXG5cdFx0ZWxzZSBpZiAocm91dGVyLnByZWZpeC5jaGFyQXQoMCkgPT09IFwiI1wiKSAkd2luZG93Lm9uaGFzaGNoYW5nZSA9IHJlc29sdmVSb3V0ZVxuXHRcdHJlc29sdmVSb3V0ZSgpXG5cdH1cblx0XG5cdHJldHVybiByb3V0ZXJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vc3RyZWFtL3N0cmVhbVwiKSIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBndWlkID0gMCwgSEFMVCA9IHt9XG5mdW5jdGlvbiBjcmVhdGVTdHJlYW0oKSB7XG5cdGZ1bmN0aW9uIHN0cmVhbSgpIHtcblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSBIQUxUKSB1cGRhdGVTdHJlYW0oc3RyZWFtLCBhcmd1bWVudHNbMF0pXG5cdFx0cmV0dXJuIHN0cmVhbS5fc3RhdGUudmFsdWVcblx0fVxuXHRpbml0U3RyZWFtKHN0cmVhbSlcblxuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDAgJiYgYXJndW1lbnRzWzBdICE9PSBIQUxUKSB1cGRhdGVTdHJlYW0oc3RyZWFtLCBhcmd1bWVudHNbMF0pXG5cblx0cmV0dXJuIHN0cmVhbVxufVxuZnVuY3Rpb24gaW5pdFN0cmVhbShzdHJlYW0pIHtcblx0c3RyZWFtLmNvbnN0cnVjdG9yID0gY3JlYXRlU3RyZWFtXG5cdHN0cmVhbS5fc3RhdGUgPSB7aWQ6IGd1aWQrKywgdmFsdWU6IHVuZGVmaW5lZCwgc3RhdGU6IDAsIGRlcml2ZTogdW5kZWZpbmVkLCByZWNvdmVyOiB1bmRlZmluZWQsIGRlcHM6IHt9LCBwYXJlbnRzOiBbXSwgZW5kU3RyZWFtOiB1bmRlZmluZWR9XG5cdHN0cmVhbS5tYXAgPSBzdHJlYW1bXCJmYW50YXN5LWxhbmQvbWFwXCJdID0gbWFwLCBzdHJlYW1bXCJmYW50YXN5LWxhbmQvYXBcIl0gPSBhcCwgc3RyZWFtW1wiZmFudGFzeS1sYW5kL29mXCJdID0gY3JlYXRlU3RyZWFtXG5cdHN0cmVhbS52YWx1ZU9mID0gdmFsdWVPZiwgc3RyZWFtLnRvSlNPTiA9IHRvSlNPTiwgc3RyZWFtLnRvU3RyaW5nID0gdmFsdWVPZlxuXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHN0cmVhbSwge1xuXHRcdGVuZDoge2dldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRpZiAoIXN0cmVhbS5fc3RhdGUuZW5kU3RyZWFtKSB7XG5cdFx0XHRcdHZhciBlbmRTdHJlYW0gPSBjcmVhdGVTdHJlYW0oKVxuXHRcdFx0XHRlbmRTdHJlYW0ubWFwKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID09PSB0cnVlKSB1bnJlZ2lzdGVyU3RyZWFtKHN0cmVhbSksIHVucmVnaXN0ZXJTdHJlYW0oZW5kU3RyZWFtKVxuXHRcdFx0XHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0XHR9KVxuXHRcdFx0XHRzdHJlYW0uX3N0YXRlLmVuZFN0cmVhbSA9IGVuZFN0cmVhbVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0cmVhbS5fc3RhdGUuZW5kU3RyZWFtXG5cdFx0fX1cblx0fSlcbn1cbmZ1bmN0aW9uIHVwZGF0ZVN0cmVhbShzdHJlYW0sIHZhbHVlKSB7XG5cdHVwZGF0ZVN0YXRlKHN0cmVhbSwgdmFsdWUpXG5cdGZvciAodmFyIGlkIGluIHN0cmVhbS5fc3RhdGUuZGVwcykgdXBkYXRlRGVwZW5kZW5jeShzdHJlYW0uX3N0YXRlLmRlcHNbaWRdLCBmYWxzZSlcblx0ZmluYWxpemUoc3RyZWFtKVxufVxuZnVuY3Rpb24gdXBkYXRlU3RhdGUoc3RyZWFtLCB2YWx1ZSkge1xuXHRzdHJlYW0uX3N0YXRlLnZhbHVlID0gdmFsdWVcblx0c3RyZWFtLl9zdGF0ZS5jaGFuZ2VkID0gdHJ1ZVxuXHRpZiAoc3RyZWFtLl9zdGF0ZS5zdGF0ZSAhPT0gMikgc3RyZWFtLl9zdGF0ZS5zdGF0ZSA9IDFcbn1cbmZ1bmN0aW9uIHVwZGF0ZURlcGVuZGVuY3koc3RyZWFtLCBtdXN0U3luYykge1xuXHR2YXIgc3RhdGUgPSBzdHJlYW0uX3N0YXRlLCBwYXJlbnRzID0gc3RhdGUucGFyZW50c1xuXHRpZiAocGFyZW50cy5sZW5ndGggPiAwICYmIHBhcmVudHMuZXZlcnkoYWN0aXZlKSAmJiAobXVzdFN5bmMgfHwgcGFyZW50cy5zb21lKGNoYW5nZWQpKSkge1xuXHRcdHZhciB2YWx1ZSA9IHN0cmVhbS5fc3RhdGUuZGVyaXZlKClcblx0XHRpZiAodmFsdWUgPT09IEhBTFQpIHJldHVybiBmYWxzZVxuXHRcdHVwZGF0ZVN0YXRlKHN0cmVhbSwgdmFsdWUpXG5cdH1cbn1cbmZ1bmN0aW9uIGZpbmFsaXplKHN0cmVhbSkge1xuXHRzdHJlYW0uX3N0YXRlLmNoYW5nZWQgPSBmYWxzZVxuXHRmb3IgKHZhciBpZCBpbiBzdHJlYW0uX3N0YXRlLmRlcHMpIHN0cmVhbS5fc3RhdGUuZGVwc1tpZF0uX3N0YXRlLmNoYW5nZWQgPSBmYWxzZVxufVxuXG5mdW5jdGlvbiBjb21iaW5lKGZuLCBzdHJlYW1zKSB7XG5cdGlmICghc3RyZWFtcy5ldmVyeSh2YWxpZCkpIHRocm93IG5ldyBFcnJvcihcIkVuc3VyZSB0aGF0IGVhY2ggaXRlbSBwYXNzZWQgdG8gbS5wcm9wLmNvbWJpbmUvbS5wcm9wLm1lcmdlIGlzIGEgc3RyZWFtXCIpXG5cdHJldHVybiBpbml0RGVwZW5kZW5jeShjcmVhdGVTdHJlYW0oKSwgc3RyZWFtcywgZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIGZuLmFwcGx5KHRoaXMsIHN0cmVhbXMuY29uY2F0KFtzdHJlYW1zLmZpbHRlcihjaGFuZ2VkKV0pKVxuXHR9KVxufVxuXG5mdW5jdGlvbiBpbml0RGVwZW5kZW5jeShkZXAsIHN0cmVhbXMsIGRlcml2ZSkge1xuXHR2YXIgc3RhdGUgPSBkZXAuX3N0YXRlXG5cdHN0YXRlLmRlcml2ZSA9IGRlcml2ZVxuXHRzdGF0ZS5wYXJlbnRzID0gc3RyZWFtcy5maWx0ZXIobm90RW5kZWQpXG5cblx0cmVnaXN0ZXJEZXBlbmRlbmN5KGRlcCwgc3RhdGUucGFyZW50cylcblx0dXBkYXRlRGVwZW5kZW5jeShkZXAsIHRydWUpXG5cblx0cmV0dXJuIGRlcFxufVxuZnVuY3Rpb24gcmVnaXN0ZXJEZXBlbmRlbmN5KHN0cmVhbSwgcGFyZW50cykge1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHBhcmVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRwYXJlbnRzW2ldLl9zdGF0ZS5kZXBzW3N0cmVhbS5fc3RhdGUuaWRdID0gc3RyZWFtXG5cdFx0cmVnaXN0ZXJEZXBlbmRlbmN5KHN0cmVhbSwgcGFyZW50c1tpXS5fc3RhdGUucGFyZW50cylcblx0fVxufVxuZnVuY3Rpb24gdW5yZWdpc3RlclN0cmVhbShzdHJlYW0pIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzdHJlYW0uX3N0YXRlLnBhcmVudHMubGVuZ3RoOyBpKyspIHtcblx0XHR2YXIgcGFyZW50ID0gc3RyZWFtLl9zdGF0ZS5wYXJlbnRzW2ldXG5cdFx0ZGVsZXRlIHBhcmVudC5fc3RhdGUuZGVwc1tzdHJlYW0uX3N0YXRlLmlkXVxuXHR9XG5cdGZvciAodmFyIGlkIGluIHN0cmVhbS5fc3RhdGUuZGVwcykge1xuXHRcdHZhciBkZXBlbmRlbnQgPSBzdHJlYW0uX3N0YXRlLmRlcHNbaWRdXG5cdFx0dmFyIGluZGV4ID0gZGVwZW5kZW50Ll9zdGF0ZS5wYXJlbnRzLmluZGV4T2Yoc3RyZWFtKVxuXHRcdGlmIChpbmRleCA+IC0xKSBkZXBlbmRlbnQuX3N0YXRlLnBhcmVudHMuc3BsaWNlKGluZGV4LCAxKVxuXHR9XG5cdHN0cmVhbS5fc3RhdGUuc3RhdGUgPSAyIC8vZW5kZWRcblx0c3RyZWFtLl9zdGF0ZS5kZXBzID0ge31cbn1cblxuZnVuY3Rpb24gbWFwKGZuKSB7cmV0dXJuIGNvbWJpbmUoZnVuY3Rpb24oc3RyZWFtKSB7cmV0dXJuIGZuKHN0cmVhbSgpKX0sIFt0aGlzXSl9XG5mdW5jdGlvbiBhcChzdHJlYW0pIHtyZXR1cm4gY29tYmluZShmdW5jdGlvbihzMSwgczIpIHtyZXR1cm4gczEoKShzMigpKX0sIFtzdHJlYW0sIHRoaXNdKX1cbmZ1bmN0aW9uIHZhbHVlT2YoKSB7cmV0dXJuIHRoaXMuX3N0YXRlLnZhbHVlfVxuZnVuY3Rpb24gdG9KU09OKCkge3JldHVybiB0aGlzLl9zdGF0ZS52YWx1ZSAhPSBudWxsICYmIHR5cGVvZiB0aGlzLl9zdGF0ZS52YWx1ZS50b0pTT04gPT09IFwiZnVuY3Rpb25cIiA/IHRoaXMuX3N0YXRlLnZhbHVlLnRvSlNPTigpIDogdGhpcy5fc3RhdGUudmFsdWV9XG5cbmZ1bmN0aW9uIHZhbGlkKHN0cmVhbSkge3JldHVybiBzdHJlYW0uX3N0YXRlIH1cbmZ1bmN0aW9uIGFjdGl2ZShzdHJlYW0pIHtyZXR1cm4gc3RyZWFtLl9zdGF0ZS5zdGF0ZSA9PT0gMX1cbmZ1bmN0aW9uIGNoYW5nZWQoc3RyZWFtKSB7cmV0dXJuIHN0cmVhbS5fc3RhdGUuY2hhbmdlZH1cbmZ1bmN0aW9uIG5vdEVuZGVkKHN0cmVhbSkge3JldHVybiBzdHJlYW0uX3N0YXRlLnN0YXRlICE9PSAyfVxuXG5mdW5jdGlvbiBtZXJnZShzdHJlYW1zKSB7XG5cdHJldHVybiBjb21iaW5lKGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzdHJlYW1zLm1hcChmdW5jdGlvbihzKSB7cmV0dXJuIHMoKX0pXG5cdH0sIHN0cmVhbXMpXG59XG5jcmVhdGVTdHJlYW1bXCJmYW50YXN5LWxhbmQvb2ZcIl0gPSBjcmVhdGVTdHJlYW1cbmNyZWF0ZVN0cmVhbS5tZXJnZSA9IG1lcmdlXG5jcmVhdGVTdHJlYW0uY29tYmluZSA9IGNvbWJpbmVcbmNyZWF0ZVN0cmVhbS5IQUxUID0gSEFMVFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVN0cmVhbVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhdHRyTmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGUpIHtcblx0XHRyZXR1cm4gY2FsbGJhY2suY2FsbChjb250ZXh0IHx8IHRoaXMsIGF0dHJOYW1lIGluIGUuY3VycmVudFRhcmdldCA/IGUuY3VycmVudFRhcmdldFthdHRyTmFtZV0gOiBlLmN1cnJlbnRUYXJnZXQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSlcblx0fVxufVxuIiwiaW1wb3J0IG0gZnJvbSAnbWl0aHJpbCdcbmltcG9ydCBJbmRleFBhZ2UgZnJvbSAnLi9jb3JlL3BhZ2UvSW5kZXhQYWdlJ1xuaW1wb3J0IERhdGFiYXNlUGFnZSBmcm9tICcuL2NvcmUvcGFnZS9EYXRhYmFzZVBhZ2UnXG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyByb3V0ZXNcbiAgICBtLnJvdXRlKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJyb3V0ZXNcIiksIFwiL1wiLCB7XG4gICAgICAgIFwiL1wiOiBJbmRleFBhZ2UsXG4gICAgICAgIFwiL2RiLzpkYm5hbWVcIjogRGF0YWJhc2VQYWdlXG4gICAgfSlcblxufSIsIi8qKiBAanN4IG0gKi9cblxuaW1wb3J0IG0gZnJvbSAnbWl0aHJpbCdcbmltcG9ydCBIdHRwIGZyb20gJy4uL3NlcnZpY2UvSHR0cCdcblxuZXhwb3J0IGRlZmF1bHQgIHtcblxuICAgIGRhdGFiYXNlczogW10sXG4gICAgcmVzcG9uc2U6IHt9LFxuXG4gICAgb25jcmVhdGU6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICBIdHRwLnBvc3QoXCIvZGF0YWJhc2UvbGlzdFwiLCB7fSkudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICBpZihyLmNvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5kYXRhYmFzZXMgPSByLnBheWxvYWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZXNwb25zZSA9IHJcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KVxuICAgIH0sXG5cbiAgICBjaG9vc2VEYXRhYmFzZTogZnVuY3Rpb24gKGRhdGFiYXNlKSB7XG4gICAgICAgIG0ucm91dGUuc2V0KFwiL2RiL1wiICsgZGF0YWJhc2UpXG4gICAgfSxcblxuICAgIHZpZXc6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cblxuICAgICAgICAgICAgICAgIDx0YWJsZSBjbGFzc05hbWU9XCJ3My10YWJsZS1hbGwgdzMtaG92ZXJhYmxlXCI+XG5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dHI+PHRoPkRhdGFiYXNlIG5hbWU8L3RoPjwvdHI+XG4gICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5kYXRhYmFzZXMubWFwKGZ1bmN0aW9uIChkYXRhYmFzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIGtleT17ZGF0YWJhc2UuRGF0YWJhc2V9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbmNsaWNrPXtzZWxmLmNob29zZURhdGFiYXNlLmJpbmQoc2VsZiwgZGF0YWJhc2UuRGF0YWJhc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2RhdGFiYXNlLkRhdGFiYXNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuXG4gICAgICAgICAgICAgICAgPC90YWJsZT5cblxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxuXG59IiwiLyoqIEBqc3ggbSAqL1xuXG5pbXBvcnQgbSBmcm9tICdtaXRocmlsJ1xuXG5leHBvcnQgZGVmYXVsdCAge1xuXG4gICAgb25pbml0OiBmdW5jdGlvbiAoKSB7XG5cbiAgICB9LFxuXG4gICAgdmlldzogZnVuY3Rpb24gKHZub2RlKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IHsuLi52bm9kZS5hdHRyc30gY2xhc3NOYW1lPVwidzMtcGFkZGluZy10b3BcIj5cbiAgICAgICAgICAgICAgICB7dm5vZGUuY2hpbGRyZW59XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG5cbn0iLCIvKiogQGpzeCBtICovXG5cbmltcG9ydCBtIGZyb20gJ21pdGhyaWwnXG5pbXBvcnQgSHR0cCBmcm9tICcuLi9zZXJ2aWNlL0h0dHAnXG5cbmV4cG9ydCBkZWZhdWx0ICB7XG5cbiAgICB0YWJsZXM6IFtdLFxuICAgIGRibmFtZTogbnVsbCxcbiAgICBzZWxlY3RlZFRhYmxlOiBudWxsLFxuICAgIHJlc3BvbnNlOiB7fSxcblxuICAgIG9uaW5pdDogZnVuY3Rpb24gKHZub2RlKSB7XG4gICAgICAgIHRoaXMuZGJuYW1lID0gdm5vZGUuYXR0cnMuZGJuYW1lXG4gICAgfSxcblxuICAgIG9uY3JlYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMubGlzdFRhYmxlcygpXG4gICAgfSxcblxuICAgIGxpc3RUYWJsZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgICAgICAgSHR0cC5wb3N0KFwiL3RhYmxlL2xpc3RcIiwge2RibmFtZTogdGhpcy5kYm5hbWV9KS50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgIGlmKHIuY29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICBzZWxmLnRhYmxlcyA9IHIucGF5bG9hZFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlc3BvbnNlID0gclxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH0sXG5cbiAgICBfb25UYWJsZVNlbGVjdDogZnVuY3Rpb24gKHRhYmxlLCBvblRhYmxlU2VsZWN0KSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWRUYWJsZSA9IHRhYmxlXG4gICAgICAgIG9uVGFibGVTZWxlY3QodGFibGUpXG4gICAgfSxcblxuICAgIHZpZXc6IGZ1bmN0aW9uICh2bm9kZSkge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuXG4gICAgICAgICAgICAgICAgPHRhYmxlIGNsYXNzTmFtZT1cInczLXRhYmxlLWFsbCB3My1ob3ZlcmFibGVcIj5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRyPjx0aD5UYWJsZSBuYW1lPC90aD48L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG5cbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi50YWJsZXMubWFwKGZ1bmN0aW9uICh0YWJsZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGlzQWN0aXZlID0gXCJcIlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodGFibGUgPT09IHNlbGYuc2VsZWN0ZWRUYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZSA9IFwidzMtZ3JlZW5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBrZXk9e3RhYmxlfSBjbGFzc05hbWU9e2lzQWN0aXZlfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25jbGljaz17c2VsZi5fb25UYWJsZVNlbGVjdC5iaW5kKHNlbGYsIHRhYmxlLCB2bm9kZS5hdHRycy5vblRhYmxlU2VsZWN0KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dGFibGV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG5cbn0iLCIvKiogQGpzeCBtICovXG5cbmltcG9ydCBtIGZyb20gJ21pdGhyaWwnXG5pbXBvcnQgSHR0cCBmcm9tICcuLi9zZXJ2aWNlL0h0dHAnXG5cbmV4cG9ydCBkZWZhdWx0ICB7XG5cbiAgICB0YWJsZW5hbWU6IG51bGwsXG4gICAgZGJuYW1lOiBudWxsLFxuICAgIHJvdzogbnVsbCxcbiAgICBjb2x1bW46IG51bGwsXG4gICAgcmVzcG9uc2U6IHt9LFxuXG4gICAgb25pbml0OiBmdW5jdGlvbiAodm5vZGUpIHtcbiAgICAgICAgdGhpcy5kYm5hbWUgPSB2bm9kZS5hdHRycy5kYm5hbWVcbiAgICAgICAgdGhpcy50YWJsZW5hbWUgPSB2bm9kZS5hdHRycy50YWJsZW5hbWVcbiAgICAgICAgdGhpcy5yb3cgPSB2bm9kZS5hdHRycy5yb3dcbiAgICAgICAgdGhpcy5jb2x1bW4gPSB2bm9kZS5hdHRycy5jb2x1bW5cbiAgICB9LFxuXG4gICAgb25Sb3dEb3VibGVDbGljazogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJvd1t0aGlzLmNvbHVtbi5GaWVsZF0uX2lzRWRpdGluZyA9ICF0aGlzLnJvd1t0aGlzLmNvbHVtbi5GaWVsZF0uX2lzRWRpdGluZ1xuICAgIH0sXG5cbiAgICBvblJvd0VudGVyS2V5OiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgdGhpcy5yb3dbdGhpcy5jb2x1bW4uRmllbGRdLl9pc0VkaXRpbmcgPSBmYWxzZVxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLnJvd1t0aGlzLmNvbHVtbi5GaWVsZF1bXCJkYXRhXCJdKVxuICAgIH0sXG5cbiAgICB2aWV3OiBmdW5jdGlvbiAodm5vZGUpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICB2YXIgdG9TaG93XG4gICAgICAgIHZhciBpbnB1dCA9IChcbiAgICAgICAgICAgIDxmb3JtIG9uc3VibWl0PXtzZWxmLm9uUm93RW50ZXJLZXkuYmluZChzZWxmKX0+XG4gICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxuICAgICAgICAgICAgICAgIHZhbHVlPXtzZWxmLnJvd1tzZWxmLmNvbHVtbi5GaWVsZF1bXCJkYXRhXCJdKCl9XG4gICAgICAgICAgICAgICAgb25jaGFuZ2U9e20ud2l0aEF0dHIoXCJ2YWx1ZVwiLCBzZWxmLnJvd1tzZWxmLmNvbHVtbi5GaWVsZF1bXCJkYXRhXCJdKX1cbiAgICAgICAgICAgICAgICBzdHlsZT1cIndpZHRoOjEwMCU7XCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9mb3JtPlxuICAgICAgICApXG5cbiAgICAgICAgaWYoc2VsZi5yb3dbc2VsZi5jb2x1bW4uRmllbGRdLl9pc0VkaXRpbmcpIHtcbiAgICAgICAgICAgIHRvU2hvdyA9IGlucHV0XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0b1Nob3cgPSBzZWxmLnJvd1tzZWxmLmNvbHVtbi5GaWVsZF1bXCJkYXRhXCJdKClcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8dGRcbiAgICAgICAgICAgICAgICBvbmRibGNsaWNrPXtzZWxmLm9uUm93RG91YmxlQ2xpY2suYmluZChzZWxmKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7dG9TaG93fVxuICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgKTtcbiAgICB9XG5cbn0iLCIvKiogQGpzeCBtICovXG5cbmltcG9ydCBtIGZyb20gJ21pdGhyaWwnXG5cbmV4cG9ydCBkZWZhdWx0ICB7XG5cbiAgICBzZWxlY3RlZDogLTEsXG4gICAgb25UYWJDaGFuZ2VGdW5jOiBudWxsLFxuXG4gICAgb25pbml0OiBmdW5jdGlvbiAodm5vZGUpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IHR5cGVvZiB2bm9kZS5hdHRycy5zZWxlY3RlZCA9PSAnbnVtYmVyJyA/IHBhcnNlSW50KHZub2RlLmF0dHJzLnNlbGVjdGVkKSA6IC0xXG4gICAgICAgIHRoaXMub25UYWJDaGFuZ2VGdW5jID0gdm5vZGUuYXR0cnMub25UYWJDaGFuZ2VcbiAgICB9LFxuXG4gICAgb25jcmVhdGU6IGZ1bmN0aW9uICh2bm9kZSkge1xuICAgICAgICB0aGlzLnNlbGVjdFRhYigwKVxuICAgIH0sXG5cblxuICAgIHNlbGVjdFRhYjogZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSBpbmRleFxuICAgICAgICB0aGlzLm9uVGFiQ2hhbmdlRnVuYyAmJiB0aGlzLm9uVGFiQ2hhbmdlRnVuYyhpbmRleClcbiAgICB9LFxuXG4gICAgdmlldzogZnVuY3Rpb24gKHZub2RlKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXY+XG5cbiAgICAgICAgICAgICAgICA8dWwgY2xhc3NOYW1lPVwidzMtbmF2YmFyIHczLWxpZ2h0LWdyYXkgdzMtYm9yZGVyXCI+XG5cbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdm5vZGUuY2hpbGRyZW4ubWFwKGZ1bmN0aW9uICh0YWIsIGluZGV4KSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiZ0NvbG9yID0gXCJcIlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoc2VsZi5zZWxlY3RlZCA9PSBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZ0NvbG9yID0gXCJ3My1ncmF5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGkgY2xhc3NOYW1lPXtiZ0NvbG9yfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhIGNsYXNzTmFtZT1cInBvaW50ZXJcIiBvbmNsaWNrPXtzZWxmLnNlbGVjdFRhYi5iaW5kKHNlbGYsIGluZGV4KX0+e3RhYi5hdHRycy5sYWJlbH08L2E+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIDwvdWw+XG5cbiAgICAgICAgICAgICAgICB7LyogdGFiIGNvbnRlbnQgKi99XG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnNlbGVjdGVkID4gLTEgP1xuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dm5vZGUuY2hpbGRyZW5bc2VsZi5zZWxlY3RlZF19XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDogJydcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKTtcbiAgICB9XG5cbn0iLCIvKiogQGpzeCBtICovXG5cbmltcG9ydCBtIGZyb20gJ21pdGhyaWwnXG5pbXBvcnQgc3RyZWFtIGZyb20gJ21pdGhyaWwvc3RyZWFtJ1xuaW1wb3J0IEh0dHAgZnJvbSAnLi4vc2VydmljZS9IdHRwJ1xuaW1wb3J0IFRhYmxlTGlzdCBmcm9tICcuLi9jb21wb25lbnQvVGFibGVMaXN0J1xuaW1wb3J0IFRhYmxlTGlzdFJvdyBmcm9tICcuLi9jb21wb25lbnQvVGFibGVMaXN0Um93J1xuaW1wb3J0IFRhYiBmcm9tICcuLi9jb21wb25lbnQvVGFiJ1xuaW1wb3J0IFRhYnMgZnJvbSAnLi4vY29tcG9uZW50L1RhYnMnXG5cbmV4cG9ydCBkZWZhdWx0ICB7XG5cbiAgICBkYm5hbWU6IG51bGwsXG4gICAgdGFibGVuYW1lOiBudWxsLFxuICAgIGNvbHVtbnM6IFtdLFxuICAgIHJvd3M6IFtdLFxuICAgIGxpbWl0OiAxMCxcbiAgICBwYWdlOiAxLFxuICAgIHJlc3BvbnNlOiB7fSxcblxuICAgIG9uaW5pdDogZnVuY3Rpb24gKHZub2RlKSB7XG4gICAgICAgIHRoaXMucGFnZSA9IHZub2RlLmF0dHJzLnBhZ2UgfHwgMVxuICAgICAgICB0aGlzLmRibmFtZSA9IHZub2RlLmF0dHJzLmRibmFtZVxuICAgICAgICB0aGlzLnRhYmxlbmFtZSA9IHZub2RlLmF0dHJzLnRhYmxlbmFtZSB8fCBudWxsXG4gICAgfSxcblxuICAgIG9uY3JlYXRlOiBmdW5jdGlvbiAodm5vZGUpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICBpZih0aGlzLnRhYmxlbmFtZSkge1xuICAgICAgICAgICAgc2VsZi5saXN0Q29sdW1ucygpXG4gICAgICAgIH1cblxuICAgIH0sXG5cbiAgICBvblRhYmxlU2VsZWN0OiBmdW5jdGlvbiAodGFibGUpIHtcbiAgICAgICAgdGhpcy50YWJsZW5hbWUgPSB0YWJsZVxuICAgICAgICB0aGlzLmxpc3RDb2x1bW5zKClcbiAgICB9LFxuXG4gICAgbGlzdENvbHVtbnMgKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICBzZWxmLmNvbHVtbnMgPSBbXVxuICAgICAgICBzZWxmLnJvd3MgPSBbXVxuXG4gICAgICAgIEh0dHBcbiAgICAgICAgICAgIC5wb3N0KFwiL3RhYmxlL2NvbHVtbi9saXN0XCIsIHtcbiAgICAgICAgICAgICAgICBkYm5hbWU6IHNlbGYuZGJuYW1lLFxuICAgICAgICAgICAgICAgIHRhYmxlbmFtZTogc2VsZi50YWJsZW5hbWVcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocikge1xuXG4gICAgICAgICAgICBpZihyLmNvZGUgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5jb2x1bW5zID0gci5wYXlsb2FkXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbGYucmVzcG9uc2UgPSByXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vYWZ0ZXIgY29sdW1uc1xuICAgICAgICAgICAgc2VsZi5saXN0Um93cyhzZWxmLnBhZ2UpXG4gICAgICAgIH0pXG4gICAgfSxcblxuICAgIGxpc3RSb3dzIDogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuXG4gICAgICAgIEh0dHAucG9zdChcIi90YWJsZS9yb3dzXCIsIHtcbiAgICAgICAgICAgIGRibmFtZTogc2VsZi5kYm5hbWUsIHRhYmxlbmFtZTogc2VsZi50YWJsZW5hbWUsXG4gICAgICAgICAgICBsaW1pdDogc2VsZi5saW1pdCwgb2Zmc2V0OiAocGFyc2VJbnQoc2VsZi5wYWdlKSAtIDEpICogc2VsZi5saW1pdFxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChyKSB7XG5cbiAgICAgICAgICAgIGlmKHIuY29kZSA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHIucGF5bG9hZC5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByb3cgPSByLnBheWxvYWRbal1cblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXAgcm93IGRhdGEgdG8gdGhpcyBvYmogdXNpbmcgbS5wcm9wKClcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXBSb3dEYXRhID0ge31cblxuXG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsZi5jb2x1bW5zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjb2x1bW4gPSBzZWxmLmNvbHVtbnNbaV1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcFJvd0RhdGFbY29sdW1uLkZpZWxkXSA9IHt9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBSb3dEYXRhW2NvbHVtbi5GaWVsZF1bXCJfaXNFZGl0aW5nXCJdID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBSb3dEYXRhW2NvbHVtbi5GaWVsZF1bXCJkYXRhXCJdID0gc3RyZWFtKHJvd1tjb2x1bW4uRmllbGRdKVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5yb3dzLnB1c2godGVtcFJvd0RhdGEpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlc3BvbnNlID0gclxuICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICB9KVxuICAgIH0sXG5cbiAgICBoYXNSb3dzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvd3MubGVuZ3RoID4gMFxuICAgIH0sXG5cbiAgICBsb2FkT2xkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucGFnZSA9IHRoaXMucGFnZSAtIDFcbiAgICAgICAgdGhpcy5yb3dzID0gW11cbiAgICAgICAgdGhpcy5saXN0Um93cygpXG4gICAgfSxcblxuICAgIGxvYWROZXc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5wYWdlID0gdGhpcy5wYWdlICsgMVxuICAgICAgICB0aGlzLnJvd3MgPSBbXVxuICAgICAgICB0aGlzLmxpc3RSb3dzKClcbiAgICB9LFxuXG4gICAgdmlldzogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3My1yb3dcIj5cblxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInczLWNvbCBtM1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFRhYmxlTGlzdCBkYm5hbWU9e3NlbGYuZGJuYW1lfSBvblRhYmxlU2VsZWN0PXtzZWxmLm9uVGFibGVTZWxlY3QuYmluZChzZWxmKX0vPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInczLWNvbFwiIHN0eWxlPXtcIndpZHRoOjEwcHg7XCJ9PiZuYnNwOzwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidzMtcmVzdFwiPlxuXG4gICAgICAgICAgICAgICAgICAgICAgICA8VGFicz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGFiIGxhYmVsPVwiQ29sdW1uc1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGFibGUgY2xhc3NOYW1lPVwidzMtdGFibGUtYWxsIHczLWhvdmVyYWJsZVwiPlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvbHVtbnMubWFwKGZ1bmN0aW9uIChyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gPHRoPntyLkZpZWxkfTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5yb3dzLm1hcChmdW5jdGlvbiAocm93KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvbHVtbnMubWFwKGZ1bmN0aW9uIChjb2x1bW4pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDxUYWJsZUxpc3RSb3dcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYm5hbWU9e3NlbGYuZGJuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhYmxlbmFtZT17c2VsZi50YWJsZW5hbWV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93PXtyb3d9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uPXtjb2x1bW59XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90YWJsZT5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmhhc1Jvd3MoKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XCJ3My1wYWdpbmF0aW9uIHczLWJvcmRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGxpPjxhIG9uY2xpY2s9e3NlbGYubG9hZE9sZC5iaW5kKHNlbGYpfT4mbGFxdW87PC9hPjwvbGk+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGxpPjxhIG9uY2xpY2s9e3NlbGYubG9hZE5ldy5iaW5kKHNlbGYpfT4mcmFxdW87PC9hPjwvbGk+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3VsPiA6ICcnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGFiPlxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7LyogcXVlcnkgc2VjdGlvbiAqL31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGFiIGxhYmVsPVwiUXVlcnlcIj5RdWVyeTwvVGFiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9UYWJzPlxuXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cblxufSIsIi8qKiBAanN4IG0gKi9cblxuaW1wb3J0IG0gZnJvbSAnbWl0aHJpbCdcbmltcG9ydCBEYkxpc3QgZnJvbSAnLi4vY29tcG9uZW50L0RiTGlzdCdcblxuZXhwb3J0IGRlZmF1bHQgIHtcblxuICAgIHZpZXc6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8RGJMaXN0Lz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cblxufSIsImltcG9ydCBtIGZyb20gJ21pdGhyaWwnXG5cbmZ1bmN0aW9uIHJlcSh1cmwsIGRhdGEsIHR5cGUpIHtcblxuICAgIGlmKCFkYXRhKSB7XG4gICAgICAgIGRhdGEgPSB7fVxuICAgIH1cblxuICAgIHJldHVybiBtLnJlcXVlc3Qoe1xuICAgICAgICBtZXRob2Q6IHR5cGUsXG4gICAgICAgIHVybDogdXJsLFxuICAgICAgICBkYXRhOiBkYXRhXG4gICAgfSlcbn1cblxuZnVuY3Rpb24gcG9zdCAodXJsLCBkYXRhKSB7XG4gICAgcmV0dXJuIHJlcSh1cmwsIGRhdGEsIFwiUE9TVFwiKVxufVxuXG5mdW5jdGlvbiBnZXQgKHVybCwgZGF0YSkge1xuICAgIHJldHVybiByZXEodXJsLCBkYXRhLCBcIkdFVFwiKVxufVxuXG5leHBvcnQgZGVmYXVsdCB7IHBvc3QsIGdldCB9Il19

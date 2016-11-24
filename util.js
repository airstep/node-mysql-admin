var crypto = require('crypto')

function send (res, code, message, payload) {

	var _payload = {}

	if(payload) {
		_payload = payload
	}

	res.send({code: code, message: message, payload: _payload})
}

exports.send = function (res, code, message, payload) {
	send(res, code, message, payload)
}

exports.ok = function (res, message, payload) {
	send(res, 200, message, payload)
}

exports.err = function (res, message, payload) {
	send(res, 404, message, payload)
}

exports.randomString = function (len) {
	return crypto.randomBytes(Math.floor(len/2)).toString('hex')
}

var isInt = function(n) {
   return n % 1 === 0
}

var isFloat = function(n) {
   return Number(n) === n && n % 1 !== 0
}

exports.isNumber = function(n) {
	return isFloat(n) || isInt(n)
}
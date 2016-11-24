var util = require("../../util")
var mysql = require("../../mysql")

exports.register = function (req, res) {

	var body = req.body
	var username = body.username
	var password = body.password

	if(!username) {
		return util.err(res, "Username is required")
	}

	if(!password) {
		return util.err(res, "Password is required")
	}

	var uid = util.randomString(10)
	var sql = "SELECT * FROM user WHERE username = ?"

	mysql.query(sql, [username], function (err, result) {

		if(result[0]) {
			return util.err(res, "This username is exists")
		}

		if(err) {
			return util.err(res, "Database error")
		}

		// go on
		var sql = "INSERT INTO user (uid, username, password, created_at) VALUES(?,?,?, NOW())"
		mysql.query(sql, [uid, username, password], function (err, result) {

			if(err) {
				return util.err(res, "Database error")
			}

			giveToken(uid, function (err, token) {
					
				if(err) {
					return util.err(res, err)
				}

				util.ok(res, "OK", {token: token})
			})
		})
	})
}

exports.login = function (req, res) {

	var body = req.body
	var username = body.username
	var password = body.password

	if(!username) {
		return util.err(res, "Username is required")
	}

	if(!password) {
		return util.err(res, "Password is required")
	}

	var sql = "SELECT * FROM user WHERE username = ? AND password = ?"

	mysql.query(sql, [username, password], function (err, result) {

		if(err) {
			return util.err(res, "Database error")
		}

		if(!result[0]) {
			return util.err(res, "Unknown username and password combination")
		}

		var uid = result[0].uid

		giveToken(uid, function (err, token) {
			
			if(err) {
				return util.err(res, err)
			}

			util.ok(res, "OK", {token: token})
		})
	})
}

exports.identify = function (req, res, next) {
	
	var token = req.body.token
	var sql = "SELECT * FROM user_token WHERE token = ?"

	if(!token) {
		return util.err(res, "Unauthorized request")
	}

	mysql.query(sql, [token], function (err, result) {

		if(result[0]) {
			var uid = result[0].uid
			req.uid = uid
			next()
		} else {
			util.err(res, "Unauthorized request")
		}
	})
}

function giveToken(uid, pass) {

	var token = util.randomString(10)
	var sql = "INSERT INTO user_token (uid, token, created_at) VALUES(?,?,NOW())"

	mysql.query(sql, [uid, token], function (err, result) {
		
		if(err) {
			return pass("Database error")
		}

		pass(null, token)
	})
}
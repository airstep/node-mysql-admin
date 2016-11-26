var util = require("../util")
var mysql = require("../mysql")

exports.list = function (req, res) {

	var sql = "SHOW DATABASES"
	mysql.query(sql, [], function (err, result) {
		
		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}

exports.drop = function (req, res) {

	var sql = "DROP DATABASE " + req.body.dbname
	mysql.query(sql, [], function (err, result) {
		
		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}

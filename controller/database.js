var util = require("../util")
var mysql = require("../mysql")

exports.list = function (req, res) {

	mysql.query("SHOW DATABASES", [], function (err, result) {
		
		if(err) {
			return util.err(res, "Database error")
		}

		util.ok(res, "OK", result)

	})
	
}

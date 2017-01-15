var util = require("../util")
var mysql = require("../mysql")
var _ = require("lodash")
var LIMIT = 10

exports.list = function (req, res) {

	var dbname = req.body.dbname

	if(!dbname) {
		return util.err(res, "Database not selected")
	}

	var sql = "SHOW TABLES IN " + dbname

	mysql.query(sql, [], function (err, result) {

		if(err) {
			return util.err(res, err.toString(), err)
		}

		var tables = []

		for (var i = 0; i < result.length; i++) {
		 	tables.push(result[i]["Tables_in_" + dbname])
		 } 

		util.ok(res, "OK", tables)

	})
	
}
exports.columnlist = function (req, res) {

	var dbname = req.body.dbname
	var tablename = req.body.tablename

	if(!dbname) {
		return util.err(res, "Database not selected")
	}

	if(!tablename) {
		return util.err(res, "Table not selected")
	}

	var sql = "SHOW COLUMNS IN "+ tablename +" IN " + dbname


	mysql.query(sql, [], function (err, result) {

		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}
exports.rows = function (req, res) {

	var dbname = req.body.dbname
	var tablename = req.body.tablename
	var page = req.body.page

	if(!dbname) {
		return util.err(res, "Database not selected")
	}

	if(!tablename) {
		return util.err(res, "Table not selected")
	}

	if(page == null || page == undefined) {
        page = 0
	}

	if(page < 0) {
        page = 0
	}

	var sql = "SELECT * FROM " + dbname +"."+ tablename + " LIMIT " + LIMIT + " OFFSET " + (page * LIMIT)
	

	mysql.query(sql, [], function (err, result) {

		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}
exports.drop = function (req, res) {

	var sql = "DROP TABLE " + req.body.dbname + "." + req.body.tablename
	mysql.query(sql, [], function (err, result) {
		
		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}
exports.empty = function (req, res) {

	var sql = "TRUNCATE " + req.body.dbname + "." + req.body.tablename
	mysql.query(sql, [], function (err, result) {
		
		if(err) {
			return util.err(res, err.toString(), err)
		}

		util.ok(res, "OK", result)

	})
	
}

var util = require("../util")
var mysql = require("../mysql")
var _ = require("lodash")

exports.drop = function (req, res) {

    var dbname = req.body.dbname
    var tablename = req.body.tablename
    var column = req.body.column
    var dropTable = req.body.dropTable

    var sql = "ALTER TABLE " + dbname + "." + tablename + " DROP COLUMN " + column

    if(dropTable) {
        sql = "DROP TABLE " + dbname + "." + tablename
    }

    mysql.query(sql, [], function (err, result) {

        if(err) {
            return util.err(res, err.toString(), err)
        }

        if(dropTable) {
            util.ok(res, "Column dropped", {tableDropped: true})
        } else {
            util.ok(res, "Column dropped")
        }

    })

}
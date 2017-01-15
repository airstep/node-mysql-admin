var express = require('express')
var bodyParser = require('body-parser')
var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.use(express.static(__dirname + "/public"))

app.get("*", function (req, res) {
	res.sendFile(__dirname + "/public/index.html")
})

var dbCtrl = require("./controller/database")
var tableCtrl = require("./controller/table")

app.post("/database/list", dbCtrl.list)
app.post("/database/drop", dbCtrl.drop)

app.post("/table/list", tableCtrl.list)
app.post("/table/column/list", tableCtrl.columnlist)
app.post("/table/rows", tableCtrl.rows)
app.post("/table/drop", tableCtrl.drop)
app.post("/table/empty", tableCtrl.empty)

app.listen(2222)


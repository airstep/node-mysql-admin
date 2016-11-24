var express = require('express')
var bodyParser = require('body-parser')
var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.use(express.static(__dirname + "/public"))

app.get("*", function (req, res) {
	res.sendFile(__dirname + "/public/index.html")
})

app.use("/database", require("./routes/database"))
app.use("/table", require("./routes/table"))

app.listen(2222)


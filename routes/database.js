var express = require('express')
var router = express.Router()
var database = require("../controller/database")

router.post("/list", database.list)

module.exports = router

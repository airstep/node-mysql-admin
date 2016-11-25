var express = require('express')
var router = express.Router()
var table = require("../controller/table")

router.post("/list", table.list)
router.post("/column/list", table.columnlist)
router.post("/rows", table.rows)
router.post("/drop", table.drop)
router.post("/empty", table.empty)

module.exports = router

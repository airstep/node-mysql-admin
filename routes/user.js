var express = require('express')
var router = express.Router()
var auth = require("./user/auth")

router.post("/auth/register", auth.register)
router.post("/auth/login", auth.login)

module.exports = router

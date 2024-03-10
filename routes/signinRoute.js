const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URL);
var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post("/", upload.single(), async (req, res) => {
  var NewUser = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: await bcrypt.hash(req.body.password, 10),
  });

  NewUser.save()
    .then(() => {
      res.status(200).json({ message: "User Signin Successfull" });
    })
    .catch((err) => {
      console.log(err.message);
      res.status(300).json({ message: "User Already Exists" });
    });
});

module.exports = router;

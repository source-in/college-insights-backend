const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/jwtVerificationMid");
require("dotenv").config();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post("/getPerticularUser", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    if (err) {
      return res.status(403).json({ message: "Token is not valid" });
    }
    User.findOne({ _id: req.body.userID })
      .select("-password") // Exclude password field
      .then((user) => {
        res.status(200).json({ user });
      })
      .catch((err) => {
        console.log("Error in /getPerticularUser", err);
        res
          .status(300)
          .json({ message: "Something went wrong in /getPerticularUser" });
      });
  });
});

module.exports = router;

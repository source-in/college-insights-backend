const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
const Orderhistory = require("../models/orderHistory");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/jwtVerificationMid");
require("dotenv").config();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.get("/getAlluser", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    User.find().then((response) => {
      res.status(200).json({ message: "Data Fetched", response });
    });
  });
});

router.post("/makeAdmin", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    if (process.env.USER_ROLE_CHANGE_PASSWORD === req.body.adminPass) {
      User.updateOne(
        { _id: req.body.userID },
        {
          $set: {
            role: "admin",
          },
        }
      )
        .then((response) => {
          res.status(200).json({ message: "Alert : New Admin Added" });
        })
        .catch((err) => {
          res.status(300).jason({ message: "Admin Not Updated..!" });
        });
    } else {
      res.status(300).json({ changeRole: "Fail" });
    }
  });
});

router.post("/makeUser", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    if (process.env.USER_ROLE_CHANGE_PASSWORD === req.body.adminPass) {
      User.updateOne(
        { _id: req.body.userID },
        {
          $set: {
            role: "user",
          },
        }
      )
        .then((response) => {
          console.log();
          res.status(200).json({ message: "Alert : New Admin Added" });
        })
        .catch((err) => {
          res.status(300).json({ message: "Admin Not Updated..!" });
        });
    } else {
      res.status(300).json({ changeRole: "Fail" });
    }
  });
});

router.post("/userOrder", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    Orderhistory.find({ paymentid: req.body.paymentID })
      .populate({
        path: "orderlist",
        populate: { path: "productID", model: "Product" },
      })
      .then((response) => {
        res.status(200).json({ response });
      })
      .catch((err) => {
        console.log(err, "err");
      });
  });
});

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

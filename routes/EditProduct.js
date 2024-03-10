const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const multer = require("multer");
const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
const Product = require("../models/product");

const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/jwtVerificationMid");
const { response } = require("express");

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post("/", upload.single("productImg"), verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    if (req.file !== undefined) {
      let fileType = req.file.mimetype.split("/")[1];
      let newFilename = req.file.filename + "." + fileType;
      fs.rename(
        path.resolve(process.cwd(), `uploads/${req.file.filename}`),
        path.resolve(process.cwd(), `uploads/${newFilename}`),
        (data) => {
          console.log("File Uploaded");
        }
      );
      Product.updateOne(
        { _id: req.body.productId },
        {
          $set: {
            prouctname: req.body.productName,
            image: newFilename,
            desc: req.body.Desc,
            category: req.body.category,
            tags: req.body.tags,
            tax: req.body.tax,
            price: req.body.netprice,
            costofitem: req.body.costofItem,
            stakedprice: req.body.stakedPrice,
          },
        }
      )
        .then((response) => {
          res.status(200).json({ message: "Product Updated", response });
        })
        .catch((err) => {
          res.status(300).json({ message: "Something Went Wrong..!!" });
        });
    } else {
      Product.updateOne(
        { _id: req.body.productId },
        {
          $set: {
            prouctname: req.body.productName,
            desc: req.body.Desc,
            category: req.body.category,
            tags: req.body.tags,
            tax: req.body.tax,
            price: req.body.netprice,
            costofitem: req.body.costofItem,
            stakedprice: req.body.stakedPrice,
          },
        }
      )
        .then((response) => {
          res.status(200).json({ message: "Product Updated" });
        })
        .catch((err) => {
          res.status(300).json({ message: "Something Went Wrong..!!" });
        });
    }
  });
});

module.exports = router;

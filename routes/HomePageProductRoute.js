const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const Product = require("../models/product");

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.get("/featureproductgetAllProducts", (req, res) => {
  Product.find({ types: "Feature Product" }).then((response) => {
    res.status(200).json({ message: "data Found", response });
  });
});

router.get("/latestgetAllProducts", (req, res) => {
  Product.find({ types: "Latest Product" }).then((response) => {
    res.status(200).json({ message: "data Found", response });
  });
});

router.get("/topcategorygetAllProducts", (req, res) => {
  Product.find({ types: "Top Category" }).then((response) => {
    res.status(200).json({ message: "data Found", response });
  });
});

module.exports = router;

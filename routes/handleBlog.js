const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
const Orderhistory = require("../models/orderHistory");
const BlogCommentSchema = require("../models/blogComment");
const BlogSchema = require("../models/blogData");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/jwtVerificationMid");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const TagSchema = require("../models/tags");

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post("/addBlog", upload.single("blogImage"), async (req, res) => {
  let newFilename;
  if (req.file) {
    let fileType = req.file.mimetype.split("/")[1];
    newFilename = req.file.filename + "." + fileType;
    fs.rename(
      path.resolve(process.cwd(), `uploads/${req.file.filename}`),
      path.resolve(process.cwd(), `uploads/${newFilename}`),
      (error) => {
        if (error) {
          console.error("File renaming error:", error);
          return res
            .status(500)
            .json({ message: "Error processing file upload" });
        }
        console.log("File Uploaded");
      }
    );
  }

  // Assuming tag names are sent in a request body field named 'tags' as an array of strings
  let tagNames = req.body.tags || [];

  tagNames = tagNames.split(",");

  try {
    // Find or create tags and collect their IDs
    const tags = await Promise.all(
      tagNames.map(async (tagName) => {
        let tag = await TagSchema.findOne({ name: tagName });
        if (!tag) {
          // If the tag doesn't exist, create it
          tag = new TagSchema({ name: tagName });
          await tag.save();
        }
        return tag._id; // Return the tag ID
      })
    );

    // Create the new blog with tag IDs
    const newBlog = new BlogSchema({
      title: req.body.title,
      content: req.body.content,
      authorID: req.body.authorID,
      blogImage: newFilename || "",
      tags: tags, // Save tag IDs
    });

    const savedBlog = await newBlog.save();
    res
      .status(200)
      .json({ message: "Blog Saved Successfully", blog: savedBlog });
  } catch (err) {
    console.error("Error saving blog:", err);
    res
      .status(500)
      .json({ message: "Something went wrong in saving the Blog" });
  }
});

router.get("/getAllBlog", (req, res) => {
  BlogSchema.find()
    .populate("authorID", "-password")
    .populate("tags")
    .then((response) => {
      res.status(200).json({ response });
    })
    .catch((err) => {
      console.log(err, "err in Getting Blogs");
      res
        .status(300)
        .json({ message: "Something went Wrong in fetvhing All Blogs." });
    });
});

router.post("/getAllDisplayBlog", (req, res) => {
  BlogSchema.find({ approveByAdmin: true })
    .populate("authorID")
    .then((response) => {
      res.status(200).json({ response });
    })
    .catch((err) => {
      res
        .status(300)
        .json({ message: "Sometinh went Wrong in fetching Blogs" });
    });
});

router.post("/getBlogById", (req, res) => {
  BlogSchema.findOne({ _id: req.body.blogID })
    .populate("authorID", "-password")
    .populate("tags")
    .then((response) => {
      res.status(200).json({ response });
    })
    .catch((err) => {
      console.log("err in Getting Blog", err);
      res
        .status(300)
        .json({ message: "Something went Wrong in Fetching Blog" });
    });
});

router.post("/approveBlog", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    console.log("Approveing");
    BlogSchema.updateOne(
      { _id: req.body.blogID },
      {
        $set: {
          approveByAdmin: true,
        },
      }
    )
      .then((response) => {
        res.status(200).json({ message: "Blog Approved" });
      })
      .catch((err) => {
        res
          .status(300)
          .json({ message: "Something went wrong in approving Blog" });
      });
  });
});

router.post("/deleteBlog", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    BlogSchema.deleteOne({ _id: req.body.blogID })
      .then((response) => {
        res.status(200).json({ message: "BLog Deletedd Successfully" });
      })
      .catch((err) => {
        res
          .status(300)
          .json({ message: "Something went wring in deleting the BLog" });
      });
  });
});

router.post("/getThisBlog", (req, res) => {
  BlogSchema.findOne({ _id: req.body.blogID })
    .populate("authorID")
    .then((response) => {
      res.status(200).json({ response });
    })
    .catch((err) => {
      res.status(300).json({ message: "Fail to fetch this Blog" });
    });
});

// Like a blog
router.post("/likeBlog", (req, res) => {
  const { blogID, userID } = req.body;
  BlogSchema.findByIdAndUpdate(
    blogID,
    { $addToSet: { likes: userID } }, // Use $addToSet to ensure no duplicates
    { new: true },
    (error, result) => {
      if (error) {
        return res
          .status(500)
          .json({ message: "Error liking the blog", error });
      }
      return res
        .status(200)
        .json({ message: "Blog liked successfully", result });
    }
  );
});

// Unlike a blog
router.post("/unlikeBlog", (req, res) => {
  const { blogID, userID } = req.body;
  BlogSchema.findByIdAndUpdate(
    blogID,
    { $pull: { likes: userID } }, // Use $pull to remove the user ID from likes
    { new: true },
    (error, result) => {
      if (error) {
        return res
          .status(500)
          .json({ message: "Error unliking the blog", error });
      }
      return res
        .status(200)
        .json({ message: "Blog unliked successfully", result });
    }
  );
});

router.post("/addComment", (req, res) => {
  const newblogComment = new BlogCommentSchema({
    blogID: req.body.blogID,
    userID: req.body.userID,
    comment: req.body.comment,
  });

  newblogComment
    .save()
    .then((response) => {
      res.status(200).json({ message: "comment Posted" });
    })
    .catch((err) => {
      res.status(300).json({ message: "comment Not Posted" });
    });
});

router.post("/fetchComment", (req, res) => {
  BlogCommentSchema.find({ blogID: req.body.blogID })
    .populate("userID")
    .then((response) => {
      res.status(200).json({ response });
    })
    .catch((err) => {
      res.status(300).josn({ message: "Commnet not fetch" });
    });
});

router.get("/relatedBlogs/:blogID", async (req, res) => {
  try {
    const { blogID } = req.params;
    // Step 2: Get the Tags of the Main Blog
    const mainBlog = await BlogSchema.findById(blogID).select("tags");
    if (!mainBlog) {
      return res.status(404).json({ message: "Main blog not found." });
    }

    let query = {};
    if (mainBlog.tags.length > 0) {
      // Step 3: Find Related Blogs by Tags
      query = { tags: { $in: mainBlog.tags }, _id: { $ne: blogID } }; // Exclude the main blog
    }

    // Step 4 & 5: Fetch Related or Any Blogs with Limit
    const relatedBlogs = await BlogSchema.find(query)
      .populate("authorID", "-password")
      .limit(5);

    // Step 6: Fallback to Any Blogs if No Related Blogs Found
    if (relatedBlogs.length === 0) {
      const fallbackBlogs = await BlogSchema.find({ _id: { $ne: blogID } })
        .populate("authorID", "-password")
        .limit(5);
      return res.status(200).json(fallbackBlogs);
    }

    return res.status(200).json(relatedBlogs);
  } catch (error) {
    console.error("Error fetching related blogs:", error);
    res.status(500).json({ message: "Error fetching related blogs." });
  }
});

module.exports = router;

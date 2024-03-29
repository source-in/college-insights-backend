const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
const mongoose = require("mongoose");
const User = require("../models/userData");
const BlogCommentSchema = require("../models/blogComment");
const BlogSchema = require("../models/blogData");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/jwtVerificationMid");
require("dotenv").config();
const TagSchema = require("../models/tags");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.post("/addBlog", upload.single("blogImage"), async (req, res) => {
  try {
    let blogImageUrl;
    if (req.file) {
      const file = req.file;
      const key = `${Date.now().toString()}-${file.originalname}`;
      const contentType = file.mimetype;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: contentType,
      });

      await s3Client.send(command);

      blogImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    let tagNames = req.body.tags || [];
    if (tagNames.length > 0) {
      tagNames = tagNames
        .split(",")
        .map((tag) => capitalizeFirstLetter(tag.trim()));
    }

    const tags = await Promise.all(
      tagNames.map(async (tagName) => {
        let tag = await TagSchema.findOne({ name: tagName });
        if (!tag) {
          tag = new TagSchema({ name: tagName });
          await tag.save();
        }
        return tag._id;
      })
    );

    const newBlog = new BlogSchema({
      title: req.body.title,
      content: req.body.content,
      authorID: req.body.authorID,
      blogImage: blogImageUrl || "",
      tags: tags,
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
    .sort({ createdAt: -1 })
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

router.get("/getUserBlogs/:userID", async (req, res) => {
  const { userID } = req.params;
  try {
    const userBlogs = await BlogSchema.find({ authorID: userID });

    if (userBlogs.length === 0) {
      // Handle the case where the user has no blogs
      return res.status(200).json({ message: "No blogs found for this user." });
    }

    res.status(200).json(userBlogs);
  } catch (err) {
    console.error("Error in getting user blogs:", err);
    res
      .status(500)
      .json({ message: "Something went wrong in fetching user blogs." });
  }
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

router.post("/deleteBlog", verifyToken, (req, res) => {
  jwt.verify(req.token, "secretkey", (err, result) => {
    BlogSchema.deleteOne({ _id: req.body.blogID })
      .then((response) => {
        res.status(200).json({ message: "Blog Deleted Successfully" });
      })
      .catch((err) => {
        res
          .status(300)
          .json({ message: "Something went wrong in deleting the BLog" });
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
    { $addToSet: { likes: userID } },
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
    { $pull: { likes: userID } },
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
    const mainBlog = await BlogSchema.findById(blogID).select("tags");
    if (!mainBlog) {
      return res.status(404).json({ message: "Main blog not found." });
    }

    let query = {};
    if (mainBlog.tags.length > 0) {
      query = { tags: { $in: mainBlog.tags }, _id: { $ne: blogID } };
    }

    const relatedBlogs = await BlogSchema.find(query)
      .populate("authorID", "-password")
      .limit(5);

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

router.put(
  "/editBlog/:blogID",
  upload.single("blogImage"),
  async (req, res) => {
    const { blogID } = req.params;
    const updatedData = req.body;

    let blogImageUrl;

    try {
      if (req.file) {
        const file = req.file;
        const key = `${Date.now().toString()}-${file.originalname}`;
        const contentType = file.mimetype;
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: contentType,
        });

        await s3Client.send(command);

        blogImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      } else if (req.body.blogImage === "null") {
        blogImageUrl = null;
      }

      const tagNames = updatedData.tags
        ? updatedData.tags
            .split(",")
            .map((tag) => capitalizeFirstLetter(tag.trim()))
        : [];

      const tags = await Promise.all(
        tagNames.map(async (tagName) => {
          let tag = await TagSchema.findOne({ name: tagName });
          if (!tag) {
            tag = new TagSchema({ name: tagName });
            await tag.save();
          }
          return tag._id;
        })
      );

      const updateFields = {
        title: updatedData.title,
        content: updatedData.content,
        tags: tags,
      };

      if (blogImageUrl !== undefined) {
        updateFields.blogImage = blogImageUrl;
      }

      const updatedBlog = await BlogSchema.findOneAndUpdate(
        { _id: blogID },
        { $set: updateFields },
        { new: true }
      );

      if (!updatedBlog) {
        return res
          .status(404)
          .json({ message: "Blog not found or user not authorized to edit." });
      }

      res
        .status(200)
        .json({ message: "Blog updated successfully", updatedBlog });
    } catch (error) {
      console.error("Error updating blog:", error);
      res.status(500).json({ message: "Error updating the blog." });
    }
  }
);

router.get("/getAllTags", async (req, res) => {
  try {
    const tags = await TagSchema.find({}).sort({ name: 1 });
    res.status(200).json({ message: "Tags fetched successfully", tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ message: "Error fetching tags." });
  }
});

module.exports = router;

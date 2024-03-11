const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require("multer");
// const upload = multer({ dest: "uploads" });
const mongoose = require("mongoose");
const User = require("../models/userData");
const Orderhistory = require("../models/orderHistory");
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
      const contentType = file.mimetype; // Use the file's original MIME type

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: contentType, // Set the MIME type
      });

      await s3Client.send(command);

      blogImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    // Assuming tag names are sent in a request body field named 'tags' as an array of strings
    let tagNames = req.body.tags || [];
    if (tagNames.length > 0) {
      tagNames = tagNames
        .split(",")
        .map((tag) => capitalizeFirstLetter(tag.trim()));
    }

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
      blogImage: blogImageUrl || "", // Use the uploaded image URL or an empty string
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
        const contentType = file.mimetype; // Get the correct content type from the uploaded file

        const command = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: contentType, // Set the correct content type
        });

        await s3Client.send(command);

        blogImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      }

      const tagNames = updatedData.tags
        ? updatedData.tags
            .split(",")
            .map((tag) => capitalizeFirstLetter(tag.trim()))
        : [];

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

      const updateFields = {
        title: updatedData.title,
        content: updatedData.content,
        tags: tags,
      };

      // Only update the image URL if a new image was uploaded
      if (blogImageUrl) {
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
    const tags = await TagSchema.find({});
    res.status(200).json({ message: "Tags fetched successfully", tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ message: "Error fetching tags." });
  }
});

module.exports = router;

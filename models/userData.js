const mongoose = require("mongoose");

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  password: String,
  role: {
    type: String,
    default: "user",
  },
  // dob: {
  //   type: String,
  // },
});

module.exports = mongoose.model("User", UserSchema);

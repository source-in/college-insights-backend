const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();

const loginRoute = require("./routes/loginRoute");
const signinRoute = require("./routes/signinRoute");
const findUserRoute = require("./routes/findUserRoute");
const manageUserRoute = require("./routes/manageUser");
const handleBlog = require("./routes/handleBlog");
const forgotPasswordRoute = require("./routes/ForgotPassword");

const path = require("path");
const app = express();

const PORT = process.env.PORT || 9857;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/static", express.static(path.resolve("uploads")));

app.use(cors());
app.use("/login", loginRoute);
app.use("/signin", signinRoute);
app.use("/findUser", findUserRoute);
app.use("/manageUser", manageUserRoute);
app.use("/forgotPassword", forgotPasswordRoute);
app.use("/handleBlog", handleBlog);

app.listen(PORT, () => {
  console.log("Server running on 3001");
});

app.get("/", (req, res) => {
  res.send("Hello");
});

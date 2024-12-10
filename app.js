require("dotenv").config();
const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const mailRoutes = require("./routes/mailRoutes");

const app = express();

// Use middleware first
app.use(cors());
app.use(express.json());

// Route handling
app.use("/api", userRoutes);
app.use("/mail", mailRoutes);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

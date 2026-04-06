const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { authenticate } = require("./middleware/auth");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandlers");

const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const recordsRouter = require("./routes/records");
const dashboardRouter = require("./routes/dashboard");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  return res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  return res.json({
    message: "Finance backend is running",
    publicEndpoints: ["GET /", "GET /health", "POST /auth/login"],
    note: "Use Authorization: Bearer <token> for protected endpoints"
  });
});

app.use("/auth", authRouter);

app.use(authenticate);

app.get("/me", (req, res) => {
  return res.json({ user: req.user });
});

app.use("/users", usersRouter);
app.use("/records", recordsRouter);
app.use("/dashboard", dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

const app = require("./app");
const { initializeDatabase } = require("./db");

const PORT = process.env.PORT || 4000;

initializeDatabase();

app.listen(PORT, () => {
  console.log(`Finance backend running on http://localhost:${PORT}`);
  console.log("Login at POST /auth/login with seeded credentials:");
  console.log("admin@finance.local / Admin@123");
  console.log("analyst@finance.local / Analyst@123");
  console.log("viewer@finance.local / Viewer@123");
});

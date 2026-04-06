const request = require("supertest");

const app = require("../src/app");
const { closeDatabase, getDb, initializeDatabase } = require("../src/db");

async function login(email, password) {
  const response = await request(app)
    .post("/auth/login")
    .send({ email, password });

  return response.body.accessToken;
}

describe("RBAC and dashboard summary", () => {
  beforeEach(() => {
    initializeDatabase({ forceReset: true });
  });

  afterAll(() => {
    closeDatabase();
  });

  test("viewer cannot create financial records", async () => {
    const viewerToken = await login("viewer@finance.local", "Viewer@123");

    const response = await request(app)
      .post("/records")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        amount: 50,
        type: "expense",
        category: "coffee",
        date: "2026-04-06",
        notes: "Should fail"
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toMatch(/Insufficient permissions/i);
  });

  test("analyst can read records but cannot write", async () => {
    const adminToken = await login("admin@finance.local", "Admin@123");

    await request(app)
      .post("/records")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amount: 200,
        type: "income",
        category: "consulting",
        date: "2026-04-03",
        notes: "Revenue"
      })
      .expect(201);

    const analystToken = await login("analyst@finance.local", "Analyst@123");

    const readResponse = await request(app)
      .get("/records")
      .set("Authorization", `Bearer ${analystToken}`);

    expect(readResponse.statusCode).toBe(200);
    expect(Array.isArray(readResponse.body.records)).toBe(true);
    expect(readResponse.body.records.length).toBe(1);

    const writeResponse = await request(app)
      .post("/records")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        amount: 25,
        type: "expense",
        category: "travel",
        date: "2026-04-03"
      });

    expect(writeResponse.statusCode).toBe(403);
  });

  test("summary endpoint returns correct totals", async () => {
    const adminToken = await login("admin@finance.local", "Admin@123");

    const seedRecords = [
      {
        amount: 1000,
        type: "income",
        category: "salary",
        date: "2026-04-01",
        notes: "salary"
      },
      {
        amount: 250,
        type: "expense",
        category: "groceries",
        date: "2026-04-02",
        notes: "groceries"
      },
      {
        amount: 200,
        type: "income",
        category: "freelance",
        date: "2026-04-03",
        notes: "contract"
      }
    ];

    for (const record of seedRecords) {
      await request(app)
        .post("/records")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(record)
        .expect(201);
    }

    const viewerToken = await login("viewer@finance.local", "Viewer@123");

    const summaryResponse = await request(app)
      .get("/dashboard/summary")
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(summaryResponse.body.totalIncome).toBe(1200);
    expect(summaryResponse.body.totalExpenses).toBe(250);
    expect(summaryResponse.body.netBalance).toBe(950);
    expect(Array.isArray(summaryResponse.body.categoryTotals)).toBe(true);
    expect(Array.isArray(summaryResponse.body.recentActivity)).toBe(true);
  });

  test("missing token is rejected for protected endpoint", async () => {
    const response = await request(app).get("/dashboard/summary");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toMatch(/Authorization/i);
  });

  test("login fails with wrong password", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "viewer@finance.local", password: "WrongPass123" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });
});

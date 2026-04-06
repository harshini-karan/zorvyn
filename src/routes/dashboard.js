const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/rbac");

const router = express.Router();

function buildDateFilters(query) {
  const clauses = [];
  const params = [];

  if (query.startDate) {
    clauses.push("date >= ?");
    params.push(query.startDate);
  }

  if (query.endDate) {
    clauses.push("date <= ?");
    params.push(query.endDate);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
}

router.get("/summary", requireRole("viewer", "analyst", "admin"), (req, res) => {
  const db = getDb();
  const { whereClause, params } = buildDateFilters(req.query);

  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalIncome,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpenses
      FROM financial_records
      ${whereClause}
      `
    )
    .get(...params);

  const categoryTotals = db
    .prepare(
      `
      SELECT category, type, SUM(amount) AS total
      FROM financial_records
      ${whereClause}
      GROUP BY category, type
      ORDER BY total DESC
      `
    )
    .all(...params);

  const recentActivity = db
    .prepare(
      `
      SELECT id, amount, type, category, date, notes, created_by, created_at
      FROM financial_records
      ${whereClause}
      ORDER BY date DESC, id DESC
      LIMIT 5
      `
    )
    .all(...params);

  const netBalance = totals.totalIncome - totals.totalExpenses;

  return res.json({
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    netBalance,
    categoryTotals,
    recentActivity
  });
});

router.get("/trends", requireRole("viewer", "analyst", "admin"), (req, res) => {
  const db = getDb();
  const period = req.query.period === "weekly" ? "weekly" : "monthly";
  const { whereClause, params } = buildDateFilters(req.query);

  const bucketExpression =
    period === "weekly"
      ? "strftime('%Y-W%W', date)"
      : "strftime('%Y-%m', date)";

  const trends = db
    .prepare(
      `
      SELECT
        ${bucketExpression} AS bucket,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
      FROM financial_records
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC
      `
    )
    .all(...params)
    .map((row) => ({
      ...row,
      net: row.income - row.expense
    }));

  return res.json({ period, trends });
});

module.exports = router;

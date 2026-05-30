import pool from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';

async function scalar(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return Object.values(rows[0])[0];
}

async function sysadminDashboard() {
  const [
    users, admins, providers, employees, items, activeOrders,
  ] = await Promise.all([
    scalar('SELECT COUNT(*) c FROM users'),
    scalar("SELECT COUNT(*) c FROM users WHERE role='admin'"),
    scalar("SELECT COUNT(*) c FROM users WHERE role='provider'"),
    scalar("SELECT COUNT(*) c FROM users WHERE role='employee'"),
    scalar('SELECT COUNT(*) c FROM items'),
    scalar("SELECT COUNT(*) c FROM orders WHERE status NOT IN ('delivered','cancelled','rejected')"),
  ]);
  const [movements] = await pool.execute(
    `SELECT m.*, i.name AS item_name FROM stock_movements m JOIN items i ON i.id=m.item_id
     ORDER BY m.created_at DESC LIMIT 10`
  );
  const [logs] = await pool.execute(
    `SELECT l.*, CONCAT(u.first_name,' ',u.last_name) AS user_name FROM logs l
     LEFT JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC LIMIT 10`
  );
  return {
    cards: { users, admins, providers, employees, items, activeOrders },
    recentMovements: movements,
    recentLogs: logs,
  };
}

async function adminDashboard(adminId) {
  const p = { adminId };
  const [totalStock, lowStock, pendingOrders, branches, usages] = await Promise.all([
    scalar(`SELECT COALESCE(SUM(s.quantity),0) v FROM stock s JOIN branches b ON b.id=s.branch_id WHERE b.administrator_id=:adminId`, p),
    scalar(`SELECT COUNT(*) c FROM stock s JOIN items i ON i.id=s.item_id JOIN branches b ON b.id=s.branch_id
            WHERE b.administrator_id=:adminId AND s.quantity <= i.minimum_stock`, p),
    scalar(`SELECT COUNT(*) c FROM orders WHERE administrator_id=:adminId AND status NOT IN ('delivered','cancelled','rejected')`, p),
    scalar(`SELECT COUNT(*) c FROM branches WHERE administrator_id=:adminId AND status='active'`, p),
    scalar(`SELECT COUNT(*) c FROM usage_records r WHERE r.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id=:adminId)`, p),
  ]);
  const [recentOrders] = await pool.execute(
    `SELECT o.*, CONCAT(pr.first_name,' ',pr.last_name) AS provider_name FROM orders o
     JOIN users pr ON pr.id=o.provider_id WHERE o.administrator_id=:adminId ORDER BY o.created_at DESC LIMIT 5`, p
  );
  const [recentMovements] = await pool.execute(
    `SELECT m.*, i.name AS item_name FROM stock_movements m JOIN items i ON i.id=m.item_id
     WHERE i.owner_type='administrator' AND i.owner_id=:adminId ORDER BY m.created_at DESC LIMIT 8`, p
  );
  const [lowStockItems] = await pool.execute(
    `SELECT i.name, b.name AS branch, s.quantity, i.minimum_stock, i.unit
     FROM stock s JOIN items i ON i.id=s.item_id JOIN branches b ON b.id=s.branch_id
     WHERE b.administrator_id=:adminId AND s.quantity <= i.minimum_stock ORDER BY s.quantity LIMIT 10`, p
  );
  return {
    cards: { totalStock, lowStock, pendingOrders, branches, usages },
    recentOrders, recentMovements, lowStockItems,
  };
}

async function providerDashboard(providerId) {
  const p = { providerId };
  const [available, pending, accepted, sent, lowStock] = await Promise.all([
    scalar('SELECT COALESCE(SUM(quantity),0) v FROM stock WHERE provider_id=:providerId', p),
    scalar("SELECT COUNT(*) c FROM orders WHERE provider_id=:providerId AND status='pending'", p),
    scalar("SELECT COUNT(*) c FROM orders WHERE provider_id=:providerId AND status='accepted'", p),
    scalar("SELECT COUNT(*) c FROM orders WHERE provider_id=:providerId AND status='sent'", p),
    scalar(`SELECT COUNT(*) c FROM stock s JOIN items i ON i.id=s.item_id WHERE s.provider_id=:providerId AND s.quantity <= i.minimum_stock`, p),
  ]);
  const [recentOrders] = await pool.execute(
    `SELECT o.*, CONCAT(a.first_name,' ',a.last_name) AS admin_name FROM orders o
     JOIN users a ON a.id=o.administrator_id WHERE o.provider_id=:providerId ORDER BY o.created_at DESC LIMIT 5`, p
  );
  return { cards: { available, pending, accepted, sent, lowStock }, recentOrders };
}

async function employeeDashboard(emp) {
  const p = { emp: emp.id, adminId: emp.administrator_id };
  const [branches, items, usages] = await Promise.all([
    scalar('SELECT COUNT(*) c FROM employee_branches WHERE user_id=:emp', { emp: emp.id }),
    scalar(`SELECT COUNT(DISTINCT s.item_id) c FROM stock s
            JOIN employee_branches eb ON eb.branch_id=s.branch_id WHERE eb.user_id=:emp AND s.quantity > 0`, { emp: emp.id }),
    scalar('SELECT COUNT(*) c FROM usage_records WHERE employee_id=:emp', { emp: emp.id }),
  ]);
  const [assignedBranches] = await pool.execute(
    `SELECT b.id, b.name FROM employee_branches eb JOIN branches b ON b.id=eb.branch_id WHERE eb.user_id=:emp`, { emp: emp.id }
  );
  const [recentUsages] = await pool.execute(
    `SELECT r.*, i.name AS item_name, b.name AS branch_name FROM usage_records r
     JOIN items i ON i.id=r.item_id JOIN branches b ON b.id=r.branch_id
     WHERE r.employee_id=:emp ORDER BY r.created_at DESC LIMIT 5`, { emp: emp.id }
  );
  return { cards: { branches, items, usages }, assignedBranches, recentUsages };
}

export const dashboard = asyncHandler(async (req, res) => {
  let data;
  switch (req.user.role) {
    case ROLES.SYSADMIN: data = await sysadminDashboard(); break;
    case ROLES.ADMIN: data = await adminDashboard(req.user.id); break;
    case ROLES.PROVIDER: data = await providerDashboard(req.user.id); break;
    case ROLES.EMPLOYEE: data = await employeeDashboard(req.user); break;
    default: data = {};
  }
  res.json({ success: true, role: req.user.role, data });
});

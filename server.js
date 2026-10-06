const express = require('express');
const db = require('./db');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const expireOld = () =>
  db.prepare("UPDATE food_items SET status='expired' WHERE status='available' AND expiry_time < ?")
    .run(new Date().toISOString());

// Register user
app.post('/api/users', (req, res) => {
  const { name, role, phone } = req.body;
  if (!name || !['donor', 'receiver'].includes(role)) return res.status(400).json({ error: 'Name and valid role required' });
  const r = db.prepare('INSERT INTO users (name, role, phone) VALUES (?,?,?)').run(name.trim(), role, phone || '');
  res.json({ id: r.lastInsertRowid, name, role, phone });
});

// Login: find a registered user by ID
app.get('/api/users/:id', (req, res) => {
  const u = db.prepare('SELECT id, name, role, phone FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User ID not found' });
  res.json(u);
});

// List food (optional ?status=)
app.get('/api/food', (req, res) => {
  expireOld();
  let sql = `SELECT f.*, d.name AS donor_name, d.phone AS donor_phone, r.name AS receiver_name
             FROM food_items f JOIN users d ON d.id=f.donor_id LEFT JOIN users r ON r.id=f.claimed_by`;
  const params = [];
  if (req.query.status) { sql += ' WHERE f.status=?'; params.push(req.query.status); }
  res.json(db.prepare(sql + ' ORDER BY f.created_at DESC').all(...params));
});

// Donor posts surplus food
app.post('/api/food', (req, res) => {
  const { donor_id, title, quantity, location, expiry_time } = req.body;
  if (!donor_id || !title || !(quantity > 0) || !location || !expiry_time) return res.status(400).json({ error: 'All fields required' });
  const donor = db.prepare("SELECT id FROM users WHERE id=? AND role='donor'").get(donor_id);
  if (!donor) return res.status(403).json({ error: 'Only donors can post food' });
  const r = db.prepare('INSERT INTO food_items (donor_id,title,quantity,location,expiry_time) VALUES (?,?,?,?,?)')
    .run(donor_id, title.trim(), quantity, location.trim(), new Date(expiry_time).toISOString());
  res.json({ id: r.lastInsertRowid });
});

// Receiver claims food (only if still available)
app.patch('/api/food/:id/claim', (req, res) => {
  expireOld();
  const receiver = db.prepare("SELECT id FROM users WHERE id=? AND role='receiver'").get(req.body.receiver_id);
  if (!receiver) return res.status(403).json({ error: 'Only receivers can claim food' });
  const r = db.prepare("UPDATE food_items SET status='claimed', claimed_by=? WHERE id=? AND status='available'")
    .run(receiver.id, req.params.id);
  if (!r.changes) return res.status(409).json({ error: 'Food no longer available' });
  res.json({ ok: true });
});

// Mark collected
app.patch('/api/food/:id/collect', (req, res) => {
  const r = db.prepare("UPDATE food_items SET status='collected' WHERE id=? AND status='claimed'").run(req.params.id);
  if (!r.changes) return res.status(409).json({ error: 'Item is not in claimed state' });
  res.json({ ok: true });
});

// Donor deletes own available listing
app.delete('/api/food/:id', (req, res) => {
  const r = db.prepare("DELETE FROM food_items WHERE id=? AND donor_id=? AND status='available'")
    .run(req.params.id, req.query.donor_id);
  if (!r.changes) return res.status(409).json({ error: 'Cannot delete this item' });
  res.json({ ok: true });
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  expireOld();
  const q = s => db.prepare(s).get();
  res.json({
    meals_saved: q("SELECT COALESCE(SUM(quantity),0) n FROM food_items WHERE status='collected'").n,
    available: q("SELECT COUNT(*) n FROM food_items WHERE status='available'").n,
    wasted: q("SELECT COALESCE(SUM(quantity),0) n FROM food_items WHERE status='expired'").n,
    donors: q("SELECT COUNT(*) n FROM users WHERE role='donor'").n
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));

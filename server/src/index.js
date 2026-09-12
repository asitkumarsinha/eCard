import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import sqlite3 from 'sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR || root;
const uploads = path.join(dataDir, 'uploads');
fs.mkdirSync(uploads, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'ecard.db'));
const app = express();
const port = process.env.PORT || 3000;
const secret = process.env.JWT_SECRET || 'change-this-development-secret';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploads));

const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function onRun(error) { error ? reject(error) : resolve(this); }));
const all = (sql, params = []) => new Promise((resolve, reject) =>
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const get = (sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));

function clientIp(req) {
  if (process.env.TRUST_PROXY === 'true') {
    return (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  }
  return req.socket.remoteAddress || '';
}

function smtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ message: 'Admin authentication is required.' });
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploads,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|svg\+xml)$/.test(file.mimetype))
});

async function initialize() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
    sort_order INTEGER DEFAULT 0, is_published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS card_images (
    id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL, title TEXT NOT NULL, alt_text TEXT NOT NULL,
    image_url TEXT NOT NULL, sort_order INTEGER DEFAULT 0, is_published INTEGER DEFAULT 1,
    license_source TEXT NOT NULL, license_type TEXT NOT NULL, attribution_text TEXT,
    reuse_confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS password_change_codes (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, code_hash TEXT NOT NULL,
    new_password_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS visitor_logs (
    id INTEGER PRIMARY KEY, visited_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT NOT NULL, path TEXT NOT NULL, user_agent TEXT,
    referrer TEXT, language TEXT
  )`);
  const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!admin) await run('INSERT INTO users (username, password_hash) VALUES (?, ?)',
    ['admin', await bcrypt.hash('admin123', 12)]);
  const count = await get('SELECT COUNT(*) AS count FROM categories');
  if (!count.count) {
    const categories = [
      ['Ganesh Festival Card', 'ganesh-festival-card', 'Celebrate Ganesh Festival with a thoughtful greeting.', 1],
      ['Diwali Card', 'diwali-card', 'Share light, warmth and festive wishes.', 2],
      ['Birthday Card', 'birthday-card', 'Make someone feel special on their birthday.', 3]
    ];
    for (const category of categories) await run(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)', category);
    const rows = await all('SELECT id, slug FROM categories');
    const templateNames = { 'ganesh-festival-card': 'ganesh', 'diwali-card': 'diwali', 'birthday-card': 'birthday' };
    for (const category of rows) {
      for (let i = 1; i <= 3; i++) {
        const name = templateNames[category.slug];
        await run(`INSERT INTO card_images
          (category_id, title, alt_text, image_url, sort_order, license_source, license_type, attribution_text, reuse_confirmed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [category.id, `${name} template ${i}`, `${name} greeting card template ${i}`, `/cards/${name}-${i}.svg`, i,
          'Original eCard artwork', 'Original', '© eCard — free to use on this website']);
      }
    }
  }
}

app.post('/api/auth/login', async (req, res) => {
  const user = await get('SELECT * FROM users WHERE username = ?', [req.body.username]);
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  res.json({ token: jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '8h' }), username: user.username });
});

app.post('/api/visitor-log', async (req, res) => {
  try {
    await run(
      `INSERT INTO visitor_logs (ip_address, path, user_agent, referrer, language)
       VALUES (?, ?, ?, ?, ?)`,
      [clientIp(req), '/', req.get('user-agent') || '', req.get('referer') || '', req.get('accept-language') || '']
    );
    res.status(204).end();
  } catch {
    res.status(204).end();
  }
});

app.get('/api/categories', async (_req, res) =>
  res.json(await all('SELECT * FROM categories WHERE is_published = 1 ORDER BY sort_order, name')));
app.get('/api/categories/:slug/templates', async (req, res) => {
  const category = await get('SELECT * FROM categories WHERE slug = ? AND is_published = 1', [req.params.slug]);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  const templates = await all('SELECT * FROM card_images WHERE category_id = ? AND is_published = 1 ORDER BY sort_order, id', [category.id]);
  res.json({ category, templates });
});

app.get('/api/admin/categories', auth, async (_req, res) => res.json(await all('SELECT * FROM categories ORDER BY sort_order, name')));
app.get('/api/admin/visitor-logs', auth, async (_req, res) => {
  res.json(await all(
    `SELECT id, visited_at, ip_address, path, user_agent, referrer, language
     FROM visitor_logs ORDER BY visited_at DESC LIMIT 200`
  ));
});

app.post('/api/admin/password-change', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must contain at least 8 characters.' });
    }
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || !(await bcrypt.compare(currentPassword || '', user.password_hash))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), user.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change failed:', error);
    res.status(500).json({ message: 'Password could not be updated. Please try again.' });
  }
});

app.post('/api/admin/categories', auth, async (req, res) => {
  const { name, slug, description = '', sortOrder = 0, isPublished = true } = req.body;
  const result = await run('INSERT INTO categories (name, slug, description, sort_order, is_published) VALUES (?, ?, ?, ?, ?)',
    [name, slug, description, sortOrder, Number(isPublished)]);
  res.status(201).json(await get('SELECT * FROM categories WHERE id = ?', [result.lastID]));
});
app.patch('/api/admin/categories/:id', auth, async (req, res) => {
  const { name, slug, description = '', sortOrder = 0, isPublished = true } = req.body;
  await run('UPDATE categories SET name=?, slug=?, description=?, sort_order=?, is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [name, slug, description, sortOrder, Number(isPublished), req.params.id]);
  res.json(await get('SELECT * FROM categories WHERE id = ?', [req.params.id]));
});
app.delete('/api/admin/categories/:id', auth, async (req, res) => {
  await run('DELETE FROM card_images WHERE category_id = ?', [req.params.id]);
  await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.get('/api/admin/templates', auth, async (_req, res) => res.json(await all(
  `SELECT card_images.*, categories.name AS category_name FROM card_images
   JOIN categories ON categories.id = card_images.category_id ORDER BY category_name, sort_order`)));
app.post('/api/admin/templates', auth, upload.single('image'), async (req, res) => {
  const data = req.body;
  if (!data.reuseConfirmed || !data.licenseSource || !data.licenseType) return res.status(400).json({ message: 'License metadata is required.' });
  if (!req.file) return res.status(400).json({ message: 'An image is required.' });
  const result = await run(`INSERT INTO card_images
    (category_id,title,alt_text,image_url,sort_order,is_published,license_source,license_type,attribution_text,reuse_confirmed)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [data.categoryId, data.title, data.altText, `/uploads/${req.file.filename}`, data.sortOrder || 0,
    Number(data.isPublished !== 'false'), data.licenseSource, data.licenseType, data.attributionText || '', 1]);
  res.status(201).json(await get('SELECT * FROM card_images WHERE id = ?', [result.lastID]));
});
app.delete('/api/admin/templates/:id', auth, async (req, res) => {
  const image = await get('SELECT image_url FROM card_images WHERE id = ?', [req.params.id]);
  if (image?.image_url.startsWith('/uploads/')) fs.rm(path.join(dataDir, image.image_url), { force: true }, () => {});
  await run('DELETE FROM card_images WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

app.post('/api/share/email', async (req, res) => {
  const { email, imageData, filename = 'ecard.png' } = req.body;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ message: 'Enter a valid recipient email.' });
  if (!process.env.SMTP_HOST) return res.status(503).json({ message: 'Email is not configured yet. Please download the card instead.' });
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'An eCard for you',
    text: 'You have received an eCard.', attachments: [{ filename, content: imageData.split(',')[1], encoding: 'base64' }] });
  res.json({ message: 'Card sent successfully.' });
});

const staticDir = process.env.STATIC_DIR || path.join(root, '..', 'client', 'dist', 'client', 'browser');
if (fs.existsSync(path.join(staticDir, 'index.html'))) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send('<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>eCard API is running</h1><p>The website files are not in this service yet. In Render, set Root Directory to the repository root (leave it empty), then use:</p><pre>Build: npm install --prefix server &amp;&amp; npm install --prefix client &amp;&amp; npm run build --prefix client\nStart: npm start --prefix server</pre></body></html>');
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.message });
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

initialize().then(() => app.listen(port, () => console.log(`eCard API listening on ${port}`)));

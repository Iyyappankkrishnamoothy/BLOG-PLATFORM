const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data file paths
const USERS_FILE = './data/users.json';
const POSTS_FILE = './data/posts.json';

// Helper: read/write JSON files
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Ensure data folder and files exist
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(POSTS_FILE)) writeJSON(POSTS_FILE, []);

// Simple token store (in-memory, good enough for academic)
const tokens = {};

// Auth middleware
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !tokens[token]) return res.status(401).json({ error: 'Unauthorized' });
  req.user = tokens[token];
  next();
}

// ─── AUTH ROUTES ────────────────────────────────────────────

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'All fields required' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username already exists' });

  const user = { id: Date.now().toString(), username, password };
  users.push(user);
  writeJSON(USERS_FILE, users);
  res.json({ message: 'Registered successfully' });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = crypto.randomBytes(16).toString('hex');
  tokens[token] = { id: user.id, username: user.username };
  res.json({ token, username: user.username });
});

// Logout
app.post('/api/logout', auth, (req, res) => {
  const token = req.headers['authorization'];
  delete tokens[token];
  res.json({ message: 'Logged out' });
});

// ─── BLOG POST ROUTES ────────────────────────────────────────

// Get all posts
app.get('/api/posts', (req, res) => {
  const posts = readJSON(POSTS_FILE);
  res.json(posts.reverse()); // newest first
});

// Get single post
app.get('/api/posts/:id', (req, res) => {
  const posts = readJSON(POSTS_FILE);
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Create post
app.post('/api/posts', auth, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  const posts = readJSON(POSTS_FILE);
  const post = {
    id: Date.now().toString(),
    title,
    content,
    author: req.user.username,
    authorId: req.user.id,
    createdAt: new Date().toISOString(),
    comments: []
  };
  posts.push(post);
  writeJSON(POSTS_FILE, posts);
  res.json(post);
});

// Edit post
app.put('/api/posts/:id', auth, (req, res) => {
  const posts = readJSON(POSTS_FILE);
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Post not found' });
  if (posts[index].authorId !== req.user.id)
    return res.status(403).json({ error: 'Not your post' });

  const { title, content } = req.body;
  posts[index].title = title || posts[index].title;
  posts[index].content = content || posts[index].content;
  posts[index].updatedAt = new Date().toISOString();
  writeJSON(POSTS_FILE, posts);
  res.json(posts[index]);
});

// Delete post
app.delete('/api/posts/:id', auth, (req, res) => {
  const posts = readJSON(POSTS_FILE);
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.authorId !== req.user.id)
    return res.status(403).json({ error: 'Not your post' });

  const updated = posts.filter(p => p.id !== req.params.id);
  writeJSON(POSTS_FILE, updated);
  res.json({ message: 'Post deleted' });
});

// ─── COMMENT ROUTES ─────────────────────────────────────────

// Add comment
app.post('/api/posts/:id/comments', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });

  const posts = readJSON(POSTS_FILE);
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Post not found' });

  const comment = {
    id: Date.now().toString(),
    text,
    author: req.user.username,
    authorId: req.user.id,
    createdAt: new Date().toISOString()
  };
  posts[index].comments.push(comment);
  writeJSON(POSTS_FILE, posts);
  res.json(comment);
});

// Delete comment
app.delete('/api/posts/:id/comments/:commentId', auth, (req, res) => {
  const posts = readJSON(POSTS_FILE);
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Post not found' });

  const comment = posts[index].comments.find(c => c.id === req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.authorId !== req.user.id)
    return res.status(403).json({ error: 'Not your comment' });

  posts[index].comments = posts[index].comments.filter(c => c.id !== req.params.commentId);
  writeJSON(POSTS_FILE, posts);
  res.json({ message: 'Comment deleted' });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
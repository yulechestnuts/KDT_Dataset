const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 4000;
const DATA_FILE = path.join(__dirname, 'posts.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PDF 파일을 브라우저에서 바로 보여주기 위한 미들웨어
app.use('/uploads', (req, res, next) => {
  if (req.path.endsWith('.pdf')) {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', 'application/pdf');
  }
  next();
}, express.static(UPLOAD_DIR));

const upload = multer({ dest: UPLOAD_DIR });

// 게시글 목록
app.get('/posts', (req, res) => {
  let posts = [];
  if (fs.existsSync(DATA_FILE)) {
    posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  res.json(posts);
});

// 게시글 작성
app.post('/posts', upload.single('file'), (req, res) => {
  let posts = [];
  if (fs.existsSync(DATA_FILE)) {
    posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  const { writer, password, content, notion } = req.body;
  const id = Date.now().toString();
  const date = new Date().toLocaleString();
  let fileUrl = '';
  if (req.file) {
    fileUrl = `/uploads/${req.file.filename}`;
  }
  posts.push({ id, writer, password, content, notion, fileUrl, date });
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  res.json({ success: true });
});

// 게시글 삭제
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  let posts = [];
  if (fs.existsSync(DATA_FILE)) {
    posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  const post = posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (post.password !== password) return res.status(403).json({ error: '비밀번호 불일치' });
  // 파일 삭제
  if (post.fileUrl) {
    const filePath = path.join(__dirname, post.fileUrl.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  posts = posts.filter(p => p.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
}); 
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'posts.json');
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

// 디렉토리 생성
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 게시글 목록 조회
export async function GET() {
  try {
    let posts = [];
    if (fs.existsSync(DATA_FILE)) {
      posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

// 게시글 작성
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const writer = formData.get('writer') as string;
    const password = formData.get('password') as string;
    const content = formData.get('content') as string;
    const notion = formData.get('notion') as string;
    const file = formData.get('file') as File;

    let posts = [];
    if (fs.existsSync(DATA_FILE)) {
      posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const id = Date.now().toString();
    const date = new Date().toLocaleString();
    let fileUrl = '';

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${id}_${file.name}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      fs.writeFileSync(filePath, buffer);
      fileUrl = `/api/uploads/${fileName}`;
    }

    posts.push({ id, writer, password, content, notion, fileUrl, date });
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
} 
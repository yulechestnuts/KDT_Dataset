import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const COMMENTS_PATH = path.join(process.cwd(), 'server', 'comments.json');
const UPLOADS_PATH = path.join(process.cwd(), 'server', 'uploads');

function readComments() {
  if (!fs.existsSync(COMMENTS_PATH)) return [];
  const data = fs.readFileSync(COMMENTS_PATH, 'utf-8');
  return JSON.parse(data);
}

function writeComments(comments: any[]) {
  fs.writeFileSync(COMMENTS_PATH, JSON.stringify(comments, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('postId');
  let comments = readComments();
  if (postId) {
    comments = comments.filter((c: any) => c.postId === postId);
  }
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const postId = formData.get('postId') as string;
  const parentId = formData.get('parentId') as string | null;
  const writer = formData.get('writer') as string;
  const password = formData.get('password') as string;
  const content = formData.get('content') as string;
  const date = new Date().toLocaleString('ko-KR');
  let fileUrl = '', fileName = '', fileType = '', fileSize = 0;

  // 파일 첨부 처리
  const file = formData.get('file') as File | null;
  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '파일은 5MB 이하만 첨부 가능합니다.' }, { status: 400 });
    }
    if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH);
    const buffer = Buffer.from(await file.arrayBuffer());
    fileName = `${Date.now()}_${file.name}`;
    fileUrl = `/uploads/${fileName}`;
    fileType = file.type;
    fileSize = file.size;
    fs.writeFileSync(path.join(UPLOADS_PATH, fileName), buffer);
  }

  const comments = readComments();
  const newComment = {
    id: `cmt-${Date.now()}`,
    postId,
    parentId: parentId || null,
    writer,
    password,
    content,
    date,
    fileUrl,
    fileName,
    fileType,
    fileSize
  };
  comments.push(newComment);
  writeComments(comments);
  return NextResponse.json(newComment);
} 
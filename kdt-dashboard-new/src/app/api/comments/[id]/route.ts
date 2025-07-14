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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const formData = await req.formData();
  const content = formData.get('content') as string;
  const password = formData.get('password') as string;
  let fileUrl = '', fileName = '', fileType = '', fileSize = 0;

  const comments = readComments();
  const idx = comments.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: '댓글 없음' }, { status: 404 });
  if (comments[idx].password !== password) return NextResponse.json({ error: '비밀번호 불일치' }, { status: 401 });

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
  } else {
    fileUrl = comments[idx].fileUrl || '';
    fileName = comments[idx].fileName || '';
    fileType = comments[idx].fileType || '';
    fileSize = comments[idx].fileSize || 0;
  }

  comments[idx] = {
    ...comments[idx],
    content,
    fileUrl,
    fileName,
    fileType,
    fileSize
  };
  writeComments(comments);
  return NextResponse.json(comments[idx]);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const { password } = await req.json();
  const comments = readComments();
  const idx = comments.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: '댓글 없음' }, { status: 404 });
  if (comments[idx].password !== password) return NextResponse.json({ error: '비밀번호 불일치' }, { status: 401 });
  comments.splice(idx, 1);
  writeComments(comments);
  return NextResponse.json({ success: true });
} 
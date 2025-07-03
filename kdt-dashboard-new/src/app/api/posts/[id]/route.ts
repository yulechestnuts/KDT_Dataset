import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'posts.json');
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

// 게시글 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { password, writer, content, notion } = await request.json();

    let posts = [];
    if (fs.existsSync(DATA_FILE)) {
      posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const postIndex = posts.findIndex((p: any) => p.id === id);
    if (postIndex === -1) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (posts[postIndex].password !== password) {
      return NextResponse.json({ error: 'Password mismatch' }, { status: 403 });
    }

    // 게시글 업데이트
    posts[postIndex] = {
      ...posts[postIndex],
      writer,
      content,
      notion,
      date: new Date().toLocaleString()
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

// 게시글 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { password } = await request.json();

    let posts = [];
    if (fs.existsSync(DATA_FILE)) {
      posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const post = posts.find((p: any) => p.id === id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.password !== password) {
      return NextResponse.json({ error: 'Password mismatch' }, { status: 403 });
    }

    // 파일 삭제
    if (post.fileUrl) {
      const fileName = post.fileUrl.split('/').pop();
      if (fileName) {
        const filePath = path.join(UPLOAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    posts = posts.filter((p: any) => p.id !== id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
} 
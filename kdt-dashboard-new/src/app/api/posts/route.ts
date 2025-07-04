import { NextRequest, NextResponse } from 'next/server';
import { getPosts, addPost } from './data';

interface Post {
  id: string;
  writer: string;
  password: string;
  content: string;
  notion?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileData?: string; // base64 파일 데이터
  date: string;
}

// 게시글 목록 조회
export async function GET() {
  try {
    const posts = getPosts();
    return NextResponse.json(posts);
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error);
    return NextResponse.json({ error: '게시글 목록을 불러오는데 실패했습니다.' }, { status: 500 });
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
    const fileUrl = formData.get('fileUrl') as string;
    const fileName = formData.get('fileName') as string;
    const fileType = formData.get('fileType') as string;
    const fileData = formData.get('fileData') as string;

    if (!writer || !password || !content) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    const newPost: Post = {
      id: Date.now().toString(),
      writer,
      password,
      content,
      notion: notion || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      fileType: fileType || undefined,
      fileData: fileData || undefined,
      date: new Date().toISOString()
    };

    addPost(newPost);

    return NextResponse.json(newPost);
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 
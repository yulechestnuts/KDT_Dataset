import { NextRequest, NextResponse } from 'next/server';

// 메모리 기반 저장소 (실제 프로덕션에서는 데이터베이스 사용 권장)
let posts: any[] = [];

// 게시글 목록 조회
export async function GET() {
  try {
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
    const fileUrl = formData.get('fileUrl') as string;
    const fileName = formData.get('fileName') as string;
    const fileType = formData.get('fileType') as string;

    const id = Date.now().toString();
    const date = new Date().toLocaleString();

    posts.push({ id, writer, password, content, notion, fileUrl, fileName, fileType, date });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';

// 메모리 기반 저장소 (실제 프로덕션에서는 데이터베이스 사용 권장)
let posts: any[] = [];

// 파일에서 데이터 로드 (실제로는 데이터베이스에서 로드)
function loadPosts() {
  try {
    // 여기서는 메모리 기반이므로 빈 배열로 시작
    posts = [];
  } catch (error) {
    console.error('게시글 로드 오류:', error);
    posts = [];
  }
}

// 파일에 데이터 저장 (실제로는 데이터베이스에 저장)
function savePosts() {
  try {
    // 여기서는 메모리 기반이므로 저장 로직 생략
    // 실제 구현시에는 데이터베이스에 저장
    console.log('게시글 저장됨:', posts.length);
  } catch (error) {
    console.error('게시글 저장 오류:', error);
  }
}

// 초기 데이터 로드
loadPosts();

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

    posts.push(newPost);
    savePosts();

    return NextResponse.json(newPost);
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 
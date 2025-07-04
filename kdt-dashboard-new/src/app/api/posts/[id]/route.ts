import { NextRequest, NextResponse } from 'next/server';

// 메모리 기반 저장소 (실제 프로덕션에서는 데이터베이스 사용 권장)
let posts: any[] = [];

// 게시글 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { password, writer, content, notion } = await request.json();

    if (!password) {
      return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });
    }

    const postIndex = posts.findIndex((p: any) => p.id === id);
    if (postIndex === -1) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (posts[postIndex].password !== password) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 게시글 업데이트
    posts[postIndex] = {
      ...posts[postIndex],
      writer,
      content,
      notion,
      date: new Date().toISOString()
    };

    return NextResponse.json({ success: true, message: '게시글이 수정되었습니다.' });
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    return NextResponse.json({ error: '게시글 수정에 실패했습니다.' }, { status: 500 });
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

    if (!password) {
      return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });
    }

    const post = posts.find((p: any) => p.id === id);
    if (!post) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (post.password !== password) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    posts = posts.filter((p: any) => p.id !== id);

    return NextResponse.json({ success: true, message: '게시글이 삭제되었습니다.' });
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    return NextResponse.json({ error: '게시글 삭제에 실패했습니다.' }, { status: 500 });
  }
} 
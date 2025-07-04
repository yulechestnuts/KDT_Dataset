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

    const post = posts.find((p: any) => p.id === id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.password !== password) {
      return NextResponse.json({ error: 'Password mismatch' }, { status: 403 });
    }

    posts = posts.filter((p: any) => p.id !== id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
} 
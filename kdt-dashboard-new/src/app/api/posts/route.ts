import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

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

// 게시글 목록 조회 (supabase에서 select)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error);
    return NextResponse.json({ error: '게시글 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

// 게시글 작성 (supabase에 insert)
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

    const newPost: Omit<Post, 'id'> = {
      writer,
      password,
      content,
      notion: notion || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      fileType: fileType || undefined,
      fileData: fileData || undefined,
      date: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([newPost])
      .select();
    if (error) throw error;

    return NextResponse.json(data?.[0]);
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 게시글 수정 (supabase에서 update)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, writer, content, notion } = body;
    if (!id || !password) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }
    // 비밀번호가 일치하는 게시글만 수정
    const { data, error } = await supabase
      .from('posts')
      .update({ writer, content, notion })
      .eq('id', id)
      .eq('password', password)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않거나 게시글이 없습니다.' }, { status: 401 });
    }
    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 게시글 삭제 (supabase에서 delete)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password } = body;
    if (!id || !password) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }
    // 비밀번호가 일치하는 게시글만 삭제
    const { error, count } = await supabase
      .from('posts')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('password', password);
    if (error) throw error;
    if (!count) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않거나 게시글이 없습니다.' }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 
"use server";
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

interface Post {
  id: string;
  writer: string;
  password: string;
  content: string;
  notion?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  date: string;
}

// DB → 프론트 변환 함수
function dbToClient(post: any): Post {
  return {
    id: post.id,
    writer: post.writer,
    password: '', // 비밀번호는 프론트에 전달하지 않음
    content: post.content,
    notion: post.notion_url || '',
    fileUrl: post.file_url || '',
    fileName: post.file_name || '',
    fileType: post.file_type || '',
    fileData: post.file_data || '',
    date: post.created_at,
  };
}

// 게시글 목록 조회
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const posts = (data || []).map(dbToClient);
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

    // 비밀번호 해시화
    const password_hash = await bcrypt.hash(password, 10);

    const insertObj: any = {
      writer,
      password_hash,
      content,
      notion_url: notion || null,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_type: fileType || null,
      file_data: fileData || null,
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([insertObj])
      .select();
    if (error) throw error;
    const post = data?.[0] ? dbToClient(data[0]) : null;
    return NextResponse.json(post);
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 게시글 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, writer, content, notion } = body;
    if (!id || !password) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }
    // DB에서 해당 게시글의 해시된 비밀번호 조회
    const { data: postData, error: getError } = await supabase
      .from('posts')
      .select('password_hash')
      .eq('id', id)
      .single();
    if (getError || !postData) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }
    const isMatch = await bcrypt.compare(password, postData.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }
    // 비밀번호가 맞으면 수정
    const { data, error } = await supabase
      .from('posts')
      .update({
        writer,
        content,
        notion_url: notion || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '게시글이 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(dbToClient(data[0]));
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 게시글 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password } = body;
    if (!id || !password) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }
    // DB에서 해당 게시글의 해시된 비밀번호 조회
    const { data: postData, error: getError } = await supabase
      .from('posts')
      .select('password_hash')
      .eq('id', id)
      .single();
    if (getError || !postData) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }
    const isMatch = await bcrypt.compare(password, postData.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }
    // 비밀번호가 맞으면 삭제
    const { error, count } = await supabase
      .from('posts')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (!count) {
      return NextResponse.json({ error: '게시글이 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 
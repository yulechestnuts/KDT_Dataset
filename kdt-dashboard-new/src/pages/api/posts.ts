import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

interface Post {
  id: string;
  writer: string;
  password: string;
  title: string; // 추가
  content: string;
  notion?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  date: string;
  category: 'notice' | 'dashboard';
}

function dbToClient(post: any): Post {
  // UTC 시간을 한국 시간(KST)으로 변환
  const utcDate = new Date(post.created_at);
  const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const kstDateString = kstDate.toISOString().replace('T', ' ').substring(0, 19);
  
  return {
    id: post.id,
    writer: post.writer,
    password: '',
    title: post.title || '', // 추가
    content: post.content,
    notion: post.notion_url || '',
    fileUrl: post.file_url || '',
    fileName: post.file_name || '',
    fileType: post.file_type || '',
    fileData: post.file_data || '',
    date: kstDateString,
    category: post.category || 'notice',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 실제 사용 중인 supabase URL 확인
  console.log('실제 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (req.method === 'GET') {
    // 게시글 목록 조회
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const posts = (data || []).map(dbToClient);
      return res.status(200).json(posts);
    } catch (error) {
      console.error('게시글 목록 조회 오류:', error);
      return res.status(500).json({ error: '게시글 목록을 불러오는데 실패했습니다.' });
    }
  } else if (req.method === 'POST') {
    // 게시글 작성
    try {
      const {
        writer,
        password,
        title, // 추가
        content,
        notion,
        fileUrl,
        fileName,
        fileType,
        fileData,
        category,
      } = req.body;

      if (!writer || !password || !content) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }

      console.log('게시글 작성 시도:', { writer, content: content.substring(0, 50) + '...', category });
      
      const password_hash = await bcrypt.hash(password, 10);
      console.log('비밀번호 해시 생성 완료:', password_hash.substring(0, 20) + '...');
      
      const insertObj: any = {
        writer,
        password_hash,
        title, // 추가
        content,
        notion_url: notion || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        file_data: fileData || null,
        category: category || 'notice',
      };

      const { data, error } = await supabase
        .from('posts')
        .insert([insertObj])
        .select();
      
      if (error) {
        console.error('supabase insert 에러 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('게시글 저장 성공:', data?.[0]?.id);
      console.log('저장된 데이터:', data?.[0]);
      
      const post = data?.[0] ? dbToClient(data[0]) : null;
      return res.status(200).json(post);
    } catch (error) {
      console.error('게시글 작성 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
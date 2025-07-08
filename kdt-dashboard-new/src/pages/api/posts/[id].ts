import type { NextApiRequest, NextApiResponse } from 'next';
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
  const { id } = req.query;
  
  if (req.method === 'PUT') {
    // 게시글 수정
    try {
      const { password, writer, content, notion, category } = req.body;
      
      if (!id || !password) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
      
      console.log('게시글 수정 시도:', { id, writer, category });
      
      // 마스터 비밀번호 확인
      const masterPassword = process.env.MASTER_PASSWORD;
      const isMasterPassword = masterPassword && password === masterPassword;
      
      if (isMasterPassword) {
        console.log('마스터 비밀번호로 수정 시도');
        // 마스터 비밀번호가 맞으면 바로 update
        const { data, error } = await supabase
          .from('posts')
          .update({
            writer,
            content,
            notion_url: notion || null,
            category: category || 'notice',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) {
          return res.status(404).json({ error: '게시글이 없습니다.' });
        }
        const message = '마스터 비밀번호로 수정 완료';
        console.log(message);
        return res.status(200).json(dbToClient(data[0]));
      }
      // 일반 비밀번호 검증
      const { data: postData, error: getError } = await supabase
        .from('posts')
        .select('password_hash')
        .eq('id', id)
        .single();
      if (getError || !postData) {
        console.error('게시글 조회 실패:', getError);
        return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
      }
      console.log('저장된 비밀번호 해시:', postData.password_hash.substring(0, 20) + '...');
      console.log('입력된 비밀번호:', password);
      const isMatch = await bcrypt.compare(password, postData.password_hash);
      console.log('비밀번호 비교 결과:', isMatch);
      if (!isMatch) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      }
      // 일반 비밀번호가 맞으면 update
      const { data, error } = await supabase
        .from('posts')
        .update({
          writer,
          content,
          notion_url: notion || null,
          category: category || 'notice',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: '게시글이 없습니다.' });
      }
      const message = '수정 완료';
      console.log(message);
      return res.status(200).json(dbToClient(data[0]));
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else if (req.method === 'DELETE') {
    // 게시글 삭제
    try {
      const { password } = req.body;
      
      if (!id || !password) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
      
      console.log('게시글 삭제 시도:', { id });
      
      // 마스터 비밀번호 확인
      const masterPassword = process.env.MASTER_PASSWORD;
      const isMasterPassword = masterPassword && password === masterPassword;
      
      if (isMasterPassword) {
        console.log('마스터 비밀번호로 삭제 시도');
      } else {
        // 일반 비밀번호 확인
        const { data: postData, error: getError } = await supabase
          .from('posts')
          .select('password_hash')
          .eq('id', id)
          .single();
        
        if (getError || !postData) {
          console.error('게시글 조회 실패:', getError);
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        
        console.log('저장된 비밀번호 해시:', postData.password_hash.substring(0, 20) + '...');
        console.log('입력된 비밀번호:', password);
        
        const isMatch = await bcrypt.compare(password, postData.password_hash);
        console.log('비밀번호 비교 결과:', isMatch);
        
        if (!isMatch) {
          return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }
      }
      
      // 비밀번호가 맞으면 삭제 (일반 비밀번호 또는 마스터 비밀번호)
      const { error, count } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      if (!count) {
        return res.status(404).json({ error: '게시글이 없습니다.' });
      }
      
      const message = isMasterPassword ? '마스터 비밀번호로 삭제 완료' : '삭제 완료';
      console.log(message);
      
      return res.status(200).json({ success: true, message });
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
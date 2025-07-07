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
}

function dbToClient(post: any): Post {
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
    date: post.created_at,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
        content,
        notion,
        fileUrl,
        fileName,
        fileType,
        fileData,
      } = req.body;
      if (!writer || !password || !content) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
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
      return res.status(200).json(post);
    } catch (error) {
      console.error('게시글 작성 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else if (req.method === 'PUT') {
    // 게시글 수정
    try {
      const { id, password, writer, content, notion } = req.body;
      if (!id || !password) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
      const { data: postData, error: getError } = await supabase
        .from('posts')
        .select('password_hash')
        .eq('id', id)
        .single();
      if (getError || !postData) {
        return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
      }
      const isMatch = await bcrypt.compare(password, postData.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      }
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
        return res.status(404).json({ error: '게시글이 없습니다.' });
      }
      return res.status(200).json(dbToClient(data[0]));
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else if (req.method === 'DELETE') {
    // 게시글 삭제
    try {
      const { id, password } = req.body;
      if (!id || !password) {
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
      const { data: postData, error: getError } = await supabase
        .from('posts')
        .select('password_hash')
        .eq('id', id)
        .single();
      if (getError || !postData) {
        return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
      }
      const isMatch = await bcrypt.compare(password, postData.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      }
      const { error, count } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      if (!count) {
        return res.status(404).json({ error: '게시글이 없습니다.' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
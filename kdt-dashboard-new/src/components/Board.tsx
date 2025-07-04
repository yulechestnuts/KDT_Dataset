"use client";
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';

const API_URL = '/api'; // Next.js API routes 경로

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

const Board: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ writer: '', password: '', content: '', notion: '', fileUrl: '', fileName: '', fileType: '', fileData: '' });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ writer: '', content: '', notion: '' });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/posts`);
      setPosts(res.data.reverse());
    } catch (error) {
      console.error('게시글을 불러오는데 실패했습니다:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('writer', form.writer);
      formData.append('password', form.password);
      formData.append('content', form.content);
      formData.append('notion', form.notion);
      formData.append('fileUrl', form.fileUrl || '');
      formData.append('fileName', form.fileName || '');
      formData.append('fileType', form.fileType || '');
      formData.append('fileData', form.fileData || '');
      await axios.post(`${API_URL}/posts`, formData);
      setForm({ writer: '', password: '', content: '', notion: '', fileUrl: '', fileName: '', fileType: '', fileData: '' });
      fetchPosts();
    } catch (error) {
      console.error('게시글 작성에 실패했습니다:', error);
      alert('게시글 작성에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const pw = prompt('비밀번호를 입력하세요');
    if (!pw) return;
    try {
      await axios.delete(`${API_URL}/posts/${id}`, { data: { password: pw } });
      fetchPosts();
    } catch (error) {
      console.error('게시글 삭제에 실패했습니다:', error);
      alert('비밀번호가 일치하지 않거나 삭제에 실패했습니다.');
    }
  };

  const handleEdit = async (id: string) => {
    const pw = prompt('비밀번호를 입력하세요');
    if (!pw) return;
    
    try {
      const post = posts.find(p => p.id === id);
      if (!post) return;
      
      if (post.password !== pw) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
      }

      setEditingId(id);
      setEditForm({
        writer: post.writer,
        content: post.content,
        notion: post.notion || ''
      });
    } catch (error) {
      console.error('수정 모드 활성화에 실패했습니다:', error);
    }
  };

  const handleEditSubmit = async (id: string) => {
    try {
      const post = posts.find(p => p.id === id);
      if (!post) return;

      await axios.put(`${API_URL}/posts/${id}`, {
        password: post.password,
        writer: editForm.writer,
        content: editForm.content,
        notion: editForm.notion
      });
      
      setEditingId(null);
      setEditForm({ writer: '', content: '', notion: '' });
      fetchPosts();
      alert('게시글이 수정되었습니다.');
    } catch (error) {
      console.error('게시글 수정에 실패했습니다:', error);
      alert('게시글 수정에 실패했습니다.');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ writer: '', content: '', notion: '' });
  };

  const handleFileUpload = async (file: File) => {
    try {
      // 파일 크기 제한 (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('파일 크기는 5MB 이하여야 합니다.');
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const fileData = `data:${file.type};base64,${base64}`;
      
      setForm({ 
        ...form, 
        fileName: file.name,
        fileType: file.type,
        fileData: fileData
      });
    } catch (error) {
      console.error('파일 변환 실패:', error);
      alert('파일 변환에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 mb-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">📝 간단 게시판</h1>
        <p className="text-blue-100">자유롭게 글을 작성하고 공유하세요</p>
      </div>

      {/* 글쓰기 폼 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">새 글 작성</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              placeholder="작성자"
              value={form.writer}
              onChange={e => setForm({ ...form, writer: e.target.value })}
              required
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <textarea
            placeholder="내용을 입력하세요..."
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            required
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">📁 파일 업로드</label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {form.fileName && (
                <p className="text-xs text-green-600">✅ {form.fileName} 선택됨</p>
              )}
              <p className="text-xs text-gray-500">
                💡 모든 파일 형식 지원 (PDF, 이미지, 문서 등)
              </p>
            </div>
            <input
              placeholder="노션 공유 링크 (선택)"
              value={form.notion}
              onChange={e => setForm({ ...form, notion: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">🔗 외부 파일 링크</label>
              <input
                placeholder="Google Drive, Dropbox, OneDrive 등 파일 링크"
                value={form.fileUrl || ''}
                onChange={e => setForm({ ...form, fileUrl: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                💡 외부 링크와 직접 업로드 중 하나만 사용하세요
              </p>
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            ✍️ 글쓰기
          </button>
        </form>
      </div>

      {/* 게시글 목록 */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">아직 작성된 글이 없습니다.</p>
            <p className="text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{post.writer}</h3>
                    <p className="text-sm text-gray-500">{post.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(post.id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200"
                    >
                      ✏️ 수정
                    </button>
                    <button 
                      onClick={() => handleDelete(post.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors duration-200"
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
                
                {editingId === post.id ? (
                  <div className="mb-4 space-y-4">
                    <input
                      placeholder="작성자"
                      value={editForm.writer}
                      onChange={e => setEditForm({ ...editForm, writer: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <textarea
                      placeholder="내용을 입력하세요..."
                      value={editForm.content}
                      onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                      required
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <input
                      placeholder="노션 공유 링크 (선택)"
                      value={editForm.notion}
                      onChange={e => setEditForm({ ...editForm, notion: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditSubmit(post.id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors duration-200"
                      >
                        ✅ 저장
                      </button>
                      <button 
                        onClick={handleEditCancel}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors duration-200"
                      >
                        ❌ 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-700 mb-4 leading-relaxed">
                    {post.content}
                  </div>
                )}

                {(post.fileUrl || post.fileName) && (
                  <div className="mb-4">
                    <a 
                      href={post.fileData || post.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      download={post.fileName}
                      className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors duration-200"
                    >
                      💾 {post.fileName || '파일 다운로드'}
                    </a>
                  </div>
                )}

                {post.notion && (
                  <div className="mt-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 노션 페이지</h4>
                      <iframe 
                        src={post.notion} 
                        className="w-full h-64 border-0 rounded" 
                        title="notion" 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Board; 
"use client";
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:4000'; // Express 서버 주소

interface Post {
  id: string;
  writer: string;
  password: string;
  content: string;
  notion?: string;
  fileUrl?: string;
  date: string;
}

const PDFViewer = ({ fileUrl }: { fileUrl: string }) => (
  <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
    <object
      data={fileUrl}
      type="application/pdf"
      className="w-full h-96"
    >
      <p className="p-4 text-center text-gray-500">
        PDF를 표시할 수 없습니다. 
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
          새 탭에서 열기
        </a>
      </p>
    </object>
  </div>
);

const Board: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ writer: '', password: '', content: '', notion: '', file: null as File | null });
  const [pdfViewId, setPdfViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (form.file) formData.append('file', form.file);
      await axios.post(`${API_URL}/posts`, formData);
      setForm({ writer: '', password: '', content: '', notion: '', file: null });
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, file: e.target.files ? e.target.files[0] : null });
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
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <input
              placeholder="노션 공유 링크 (선택)"
              value={form.notion}
              onChange={e => setForm({ ...form, notion: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
                  <button 
                    onClick={() => handleDelete(post.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors duration-200"
                  >
                    🗑️ 삭제
                  </button>
                </div>
                
                <div className="text-gray-700 mb-4 leading-relaxed">
                  {post.content}
                </div>

                {post.fileUrl && (
                  <div className="mb-4">
                    <button 
                      onClick={() => setPdfViewId(pdfViewId === post.id ? null : post.id)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200 mr-2"
                    >
                      {pdfViewId === post.id ? '📄 미리보기 닫기' : '📄 PDF 미리보기'}
                    </button>
                    <a 
                      href={`${API_URL}${post.fileUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors duration-200"
                    >
                      💾 PDF 다운로드
                    </a>
                    {pdfViewId === post.id && (
                      <PDFViewer fileUrl={`${API_URL}${post.fileUrl}`} />
                    )}
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
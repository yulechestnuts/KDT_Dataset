"use client";
import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';

const API_URL = '/api'; // Next.js API routes 경로

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
  fileData?: string; // base64 파일 데이터
  date: string;
  category: 'notice' | 'dashboard' | 'info'; // 카테고리 추가
}

interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  writer: string;
  password: string;
  content: string;
  date: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  children?: Comment[]; // 트리 구조용 children 필드 추가
}

// 트리 구조로 변환
function buildCommentTree(comments: Comment[]): Comment[] {
  const map: { [id: string]: Comment & { children?: Comment[] } } = {};
  const roots: Comment[] = [];
  comments.forEach(c => (map[c.id] = { ...c, children: [] }));
  comments.forEach(c => {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].children!.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

const CommentTree: React.FC<{ comments: Comment[]; onReply: (parentId: string) => void }> = ({ comments, onReply }) => (
  <ul className="ml-4">
    {comments.map(comment => (
      <li key={comment.id} className="mb-2">
        <div className="bg-gray-100 p-2 rounded">
          <div className="font-bold text-sm">{comment.writer} <span className="text-xs text-gray-400">{comment.date}</span></div>
          <div className="text-sm whitespace-pre-line">{comment.content}</div>
          {comment.fileUrl && (
            <div className="mt-1">
              <a href={comment.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">{comment.fileName} 다운로드</a>
            </div>
          )}
          <button className="text-xs text-blue-500 mt-1" onClick={() => onReply(comment.id)}>답글</button>
        </div>
        {comment.children && comment.children.length > 0 && (
          <CommentTree comments={comment.children} onReply={onReply} />
        )}
      </li>
    ))}
  </ul>
);

const BoardWithComments: React.FC<{ postId: string }> = ({ postId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [form, setForm] = useState({ writer: '', password: '', content: '', file: null as File | null, parentId: null as string | null });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ content: '', file: null as File | null, password: '' });

  useEffect(() => {
    fetch(`/api/comments?postId=${postId}`)
      .then(res => res.json())
      .then(data => setComments(data));
  }, [postId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, file: e.target.files ? e.target.files[0] : null });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.append('postId', postId);
    fd.append('writer', form.writer);
    fd.append('password', form.password);
    fd.append('content', form.content);
    if (form.file) fd.append('file', form.file);
    if (replyTo) fd.append('parentId', replyTo);
    const res = await fetch('/api/comments', { method: 'POST', body: fd });
    if (res.ok) {
      setForm({ writer: '', password: '', content: '', file: null, parentId: null });
      setReplyTo(null);
      const data = await res.json();
      setComments(prev => [...prev, data]);
    } else {
      alert('댓글 등록 실패: ' + (await res.json()).error);
    }
    setLoading(false);
  };
  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
  };

  // 댓글 삭제
  const handleDelete = async (commentId: string) => {
    const pw = prompt('댓글 비밀번호를 입력하세요');
    if (!pw) return;
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    } else {
      alert('비밀번호가 일치하지 않거나 삭제 실패');
    }
  };

  // 댓글 수정 모드 진입
  const handleEdit = (comment: Comment) => {
    setEditId(comment.id);
    setEditForm({ content: comment.content, file: null, password: '' });
  };
  // 댓글 수정 제출
  const handleEditSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('content', editForm.content);
    fd.append('password', editForm.password);
    if (editForm.file) fd.append('file', editForm.file);
    const res = await fetch(`/api/comments/${commentId}`, { method: 'PUT', body: fd });
    if (res.ok) {
      const updated = await res.json();
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, ...updated } : c));
      setEditId(null);
      setEditForm({ content: '', file: null, password: '' });
    } else {
      alert('비밀번호가 일치하지 않거나 수정 실패');
    }
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, file: e.target.files ? e.target.files[0] : null });
  };

  const tree = buildCommentTree(comments);
  return (
    <div className="mt-8">
      <h3 className="font-bold mb-2">댓글</h3>
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded mb-4">
        <div className="flex gap-2 mb-2">
          <input type="text" name="writer" placeholder="이름" required value={form.writer} onChange={handleChange} className="border p-2 rounded w-1/4" />
          <input type="password" name="password" placeholder="비밀번호" required value={form.password} onChange={handleChange} className="border p-2 rounded w-1/4" />
        </div>
        <textarea name="content" placeholder="댓글을 입력하세요" required value={form.content} onChange={handleChange} className="border p-3 rounded w-full min-h-[90px] mb-2 text-base" />
        <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileChange} className="border p-1 rounded mb-2 w-full" />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded" disabled={loading}>{loading ? '등록 중...' : replyTo ? '답글 등록' : '댓글 등록'}</button>
        <div className="text-xs text-gray-500 mt-2">※ 5MB 이하 파일만 첨부 가능하며, <span className="text-blue-600 font-semibold">되도록 노션 임베드 등을 활용해주세요!</span></div>
        {replyTo && <div className="text-xs text-blue-700 mt-1">답글 대상: {replyTo} <button type="button" onClick={() => setReplyTo(null)} className="ml-2 text-red-500">취소</button></div>}
      </form>
      <CommentTreeWithActions comments={tree} onReply={handleReply} onEdit={handleEdit} onDelete={handleDelete} editId={editId} editForm={editForm} onEditChange={handleEditChange} onEditFileChange={handleEditFileChange} onEditSubmit={handleEditSubmit} setEditId={setEditId} />
    </div>
  );
};

// 댓글 트리 + 수정/삭제/답글 버튼
const CommentTreeWithActions: React.FC<{
  comments: Comment[];
  onReply: (parentId: string) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
  editId: string | null;
  editForm: { content: string; file: File | null; password: string };
  onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onEditFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditSubmit: (e: React.FormEvent, commentId: string) => void;
  setEditId: (id: string | null) => void;
}> = ({ comments, onReply, onEdit, onDelete, editId, editForm, onEditChange, onEditFileChange, onEditSubmit, setEditId }) => (
  <ul className="ml-4">
    {comments.map(comment => (
      <li key={comment.id} className="mb-2">
        <div className="bg-gray-100 p-2 rounded">
          <div className="font-bold text-sm">{comment.writer} <span className="text-xs text-gray-400">{comment.date}</span></div>
          {editId === comment.id ? (
            <form onSubmit={e => onEditSubmit(e, comment.id)} className="mb-2">
              <textarea name="content" required value={editForm.content} onChange={onEditChange} className="border p-2 rounded w-full min-h-[70px] mb-1 text-base" />
              <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt" onChange={onEditFileChange} className="border p-1 rounded mb-1 w-full" />
              <input type="password" name="password" placeholder="비밀번호" required value={editForm.password} onChange={onEditChange} className="border p-1 rounded mb-1 w-full" />
              <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded mr-2">수정 완료</button>
              <button type="button" className="bg-gray-300 px-3 py-1 rounded" onClick={() => setEditId(null)}>취소</button>
            </form>
          ) : (
            <>
              <div className="text-sm whitespace-pre-line">{comment.content}</div>
              {comment.fileUrl && (
                <div className="mt-1">
                  <a href={comment.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">{comment.fileName} 다운로드</a>
                </div>
              )}
              <div className="flex gap-2 mt-1">
                <button className="text-xs text-blue-500" onClick={() => onReply(comment.id)}>답글</button>
                <button className="text-xs text-green-600" onClick={() => onEdit(comment)}>수정</button>
                <button className="text-xs text-red-500" onClick={() => onDelete(comment.id)}>삭제</button>
              </div>
            </>
          )}
        </div>
        {comment.children && comment.children.length > 0 && (
          <CommentTreeWithActions comments={comment.children} onReply={onReply} onEdit={onEdit} onDelete={onDelete} editId={editId} editForm={editForm} onEditChange={onEditChange} onEditFileChange={onEditFileChange} onEditSubmit={onEditSubmit} setEditId={setEditId} />
        )}
      </li>
    ))}
  </ul>
);

const Board: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ writer: '', password: '', title: '', content: '', notion: '', fileUrl: '', fileName: '', fileType: '', fileData: '', category: 'notice' as 'notice' | 'dashboard' | 'info' });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ writer: '', title: '', content: '', notion: '', category: 'notice' as 'notice' | 'dashboard' | 'info' });
  const [editPassword, setEditPassword] = useState('');
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'notice' | 'dashboard' | 'info'>('all');
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 15;
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'title' | 'content' | 'writer' | 'all'>('all');

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
      const postData = {
        writer: form.writer,
        password: form.password,
        title: form.title,
        content: form.content,
        notion: form.notion || '',
        fileUrl: form.fileUrl || '',
        fileName: form.fileName || '',
        fileType: form.fileType || '',
        fileData: form.fileData || '',
        category: form.category,
      };
      
      await axios.post(`${API_URL}/posts`, postData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setForm({ writer: '', password: '', title: '', content: '', notion: '', fileUrl: '', fileName: '', fileType: '', fileData: '', category: 'notice' });
      setShowWriteForm(false);
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
      // 백엔드에서 비밀번호 검증
      await axios.delete(`${API_URL}/posts/${id}`, { data: { password: pw } });
      fetchPosts();
      alert('게시글이 삭제되었습니다.');
    } catch (error: any) {
      console.error('게시글 삭제에 실패했습니다:', error);
      if (error.response?.status === 401) {
        alert('비밀번호가 일치하지 않습니다.');
      } else {
        alert('삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleEdit = async (id: string) => {
    const pw = prompt('비밀번호를 입력하세요');
    if (!pw) return;
    
    try {
      const post = posts.find(p => p.id === id);
      if (!post) {
        alert('게시글을 찾을 수 없습니다.');
        return;
      }

      setEditingId(id);
      setEditForm({
        writer: post.writer,
        title: post.title,
        content: post.content,
        notion: post.notion || '',
        category: post.category,
      });
      // 비밀번호를 임시로 저장 (수정 시 사용)
      setEditPassword(pw);
    } catch (error) {
      console.error('수정 모드 활성화에 실패했습니다:', error);
      alert('수정 모드 활성화에 실패했습니다.');
    }
  };

  const handleEditSubmit = async (id: string) => {
    try {
      const post = posts.find(p => p.id === id);
      if (!post) {
        alert('게시글을 찾을 수 없습니다.');
        return;
      }

      await axios.put(`${API_URL}/posts/${id}`, {
        password: editPassword, // 수정 시 입력받은 비밀번호 사용
        writer: editForm.writer,
        title: editForm.title,
        content: editForm.content,
        notion: editForm.notion,
        category: editForm.category,
      });
      
      setEditingId(null);
      setEditForm({ writer: '', title: '', content: '', notion: '', category: 'notice' });
      setEditPassword(''); // 비밀번호 초기화
      fetchPosts();
      alert('게시글이 수정되었습니다.');
    } catch (error: any) {
      console.error('게시글 수정에 실패했습니다:', error);
      if (error.response?.status === 401) {
        alert('비밀번호가 일치하지 않습니다.');
      } else {
        alert('수정에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ writer: '', title: '', content: '', notion: '', category: 'notice' });
  };

  const handleFileUpload = async (file: File) => {
    try {
      if (!file || !(file instanceof Blob)) {
        return;
      }

      // 파일 크기 제한 (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('파일 크기는 5MB 이하여야 합니다.');
        return;
      }

      // 파일 타입 검증
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert('지원하지 않는 파일 형식입니다. PDF, 이미지, 문서 파일만 업로드 가능합니다.');
        return;
      }

      // FileReader를 사용한 안전한 변환
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
          try {
            const result = reader.result as string;
            const base64 = result.split(',')[1]; // data:application/pdf;base64, 부분 제거
            const fileData = `data:${file.type};base64,${base64}`;
            
            setForm({ 
              ...form, 
              fileName: file.name,
              fileType: file.type,
              fileData: fileData
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => {
          reject(new Error('파일 읽기 실패'));
        };
        
        reader.readAsDataURL(file);
      });
      
    } catch (error) {
      console.error('파일 변환 실패:', error);
      alert('파일 변환에 실패했습니다. 다른 파일을 시도해주세요.');
    }
  };

  // 날짜 내림차순 정렬 (최신순)
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  // 카테고리별 게시글 필터링
  const filteredPosts = sortedPosts.filter(post => {
    if (selectedCategory === 'all') return true;
    return post.category === selectedCategory;
  });

  // 검색 필터 적용
  const searchedPosts = filteredPosts.filter(post => {
    if (!search) return true;
    const lower = (s: string | undefined) => (s || '').toLowerCase();
    if (searchType === 'title') return lower(post.title).includes(search.toLowerCase());
    if (searchType === 'content') return lower(post.content).includes(search.toLowerCase());
    if (searchType === 'writer') return lower(post.writer).includes(search.toLowerCase());
    // all
    return (
      lower(post.title).includes(search.toLowerCase()) ||
      lower(post.content).includes(search.toLowerCase()) ||
      lower(post.writer).includes(search.toLowerCase())
    );
  });

  // 페이지네이션 적용
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = searchedPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(searchedPosts.length / postsPerPage);

  // 카테고리별 게시글 수
  const noticeCount = posts.filter(post => post.category === 'notice').length;
  const dashboardCount = posts.filter(post => post.category === 'dashboard').length;
  const infoCount = posts.filter(post => post.category === 'info').length;

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

      {/* 카테고리 토글 버튼 */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium mr-2 ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          전체 글 ({posts.length})
        </button>
        <button
          onClick={() => setSelectedCategory('notice')}
          className={`px-4 py-2 rounded-lg text-sm font-medium mr-2 ${selectedCategory === 'notice' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          공지사항 ({noticeCount})
        </button>
        <button
          onClick={() => setSelectedCategory('dashboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium mr-2 ${selectedCategory === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          대시보드 ({dashboardCount})
        </button>
        <button
          onClick={() => setSelectedCategory('info')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedCategory === 'info' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          정보공유 ({infoCount})
        </button>
      </div>

      {/* 검색창 UI 추가 (카테고리 토글 아래) */}
      <div className="flex justify-center mb-6 gap-2">
        <select
          value={searchType}
          onChange={e => setSearchType(e.target.value as any)}
          className="px-2 py-1 border rounded"
        >
          <option value="all">전체</option>
          <option value="title">제목</option>
          <option value="content">내용</option>
          <option value="writer">작성자</option>
        </select>
        <input
          type="text"
          placeholder="검색어를 입력하세요"
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
        <button
          onClick={() => { setSearch(''); setCurrentPage(1); }}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-gray-700"
        >
          초기화
        </button>
      </div>

      {/* 글쓰기 토글 버튼 */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowWriteForm(!showWriteForm)}
          className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {showWriteForm ? '✖️ 글쓰기 닫기' : '✍️ 글쓰기'}
        </button>
      </div>

      {/* 글쓰기 폼 */}
      {showWriteForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">새 글 작성</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              placeholder="제목"
              value={form.title || ""}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="작성자"
                value={form.writer || ""}
                onChange={e => setForm({ ...form, writer: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={form.password || ""}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* 카테고리 선택 */}
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="category"
                  value="notice"
                  checked={form.category === 'notice'}
                  onChange={e => setForm({ ...form, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                  className="mr-2"
                />
                📢 공지사항
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="category"
                  value="dashboard"
                  checked={form.category === 'dashboard'}
                  onChange={e => setForm({ ...form, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                  className="mr-2"
                />
                📊 대시보드 변경점
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="category"
                  value="info"
                  checked={form.category === 'info'}
                  onChange={e => setForm({ ...form, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                  className="mr-2"
                />
                💡 정보공유
              </label>
            </div>
            
            <textarea
              placeholder="내용을 입력하세요..."
              value={form.content || ""}
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
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {form.fileName && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-green-600">✅ {form.fileName} 선택됨</p>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, fileName: '', fileType: '', fileData: '' })}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      ❌ 제거
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  💡 PDF, 이미지, 문서 파일 (최대 5MB)
                </p>
              </div>
              <input
                placeholder="노션 공유 링크 (선택)"
                value={form.notion || ""}
                onChange={e => setForm({ ...form, notion: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">🔗 외부 파일 링크</label>
                <input
                  placeholder="Google Drive, Dropbox, OneDrive 등 파일 링크"
                  value={form.fileUrl || ""}
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
      )}

      {/* 게시글 목록 */}
      <div className="space-y-6">
        {currentPosts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">아직 작성된 글이 없습니다.</p>
            <p className="text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          currentPosts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-200">
              <div className="p-6">
                {/* 제목/작성자/카테고리/날짜: 항상 보임 */}
                <div
                  className="cursor-pointer font-bold text-lg mb-1"
                  onClick={() => setOpenPostId(openPostId === post.id ? null : post.id)}
                >
                  {post.title || '(제목 없음)'}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs text-gray-500">{post.writer}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    post.category === 'notice' 
                      ? 'bg-red-100 text-red-800' 
                      : post.category === 'dashboard'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                  }`}>
                    {post.category === 'notice' ? '📢 공지사항' : post.category === 'dashboard' ? '📊 대시보드' : '💡 정보공유'}
                  </span>
                  <span className="text-sm text-gray-400">{post.date}</span>
                </div>
                <div className="flex gap-2 mb-4">
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
                {/* 드롭다운: 본문/파일/노션 등만 */}
                {editingId === post.id ? (
                  <div className="mb-4 space-y-4">
                    <input
                      placeholder="제목"
                      value={editForm.title || ""}
                      onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      placeholder="작성자"
                      value={editForm.writer || ""}
                      onChange={e => setEditForm({ ...editForm, writer: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {/* 카테고리 선택 (수정용) */}
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="edit-category"
                          value="notice"
                          checked={editForm.category === 'notice'}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                          className="mr-2"
                        />
                        📢 공지사항
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="edit-category"
                          value="dashboard"
                          checked={editForm.category === 'dashboard'}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                          className="mr-2"
                        />
                        📊 대시보드 변경점
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="edit-category"
                          value="info"
                          checked={editForm.category === 'info'}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value as 'notice' | 'dashboard' | 'info' })}
                          className="mr-2"
                        />
                        💡 정보공유
                      </label>
                    </div>
                    <textarea
                      placeholder="내용을 입력하세요..."
                      value={editForm.content || ""}
                      onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                      required
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <input
                      placeholder="노션 공유 링크 (선택)"
                      value={editForm.notion || ""}
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
                  openPostId === post.id && (
                    <>
                      <div className="text-gray-700 mb-4 leading-relaxed">
                        {post.content.split('\n').map((line, idx) => (
                          <React.Fragment key={idx}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))}
                      </div>
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
                      <BoardWithComments postId={post.id} />
                    </>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`mx-1 px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Board; 
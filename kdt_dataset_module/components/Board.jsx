import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const API_URL = 'http://localhost:4000'; // Express 서버 주소

function Board() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({ writer: '', password: '', content: '', notion: '', file: null });
  const [deleteInfo, setDeleteInfo] = useState({ id: '', password: '' });
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfViewId, setPdfViewId] = useState(null);

  // 게시글 목록 불러오기
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const res = await axios.get(`${API_URL}/posts`);
    setPosts(res.data.reverse());
  };

  // 글 작성
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('writer', form.writer);
    formData.append('password', form.password);
    formData.append('content', form.content);
    formData.append('notion', form.notion);
    if (form.file) formData.append('file', form.file);
    await axios.post(`${API_URL}/posts`, formData);
    setForm({ writer: '', password: '', content: '', notion: '', file: null });
    fetchPosts();
  };

  // 글 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const pw = prompt('비밀번호를 입력하세요');
    if (!pw) return;
    await axios.delete(`${API_URL}/posts/${id}`, { data: { password: pw } });
    fetchPosts();
  };

  // PDF 업로드 핸들러
  const handleFileChange = (e) => {
    setForm({ ...form, file: e.target.files[0] });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2>간단 게시판</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          placeholder="작성자"
          value={form.writer}
          onChange={e => setForm({ ...form, writer: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          required
        />
        <textarea
          placeholder="내용"
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          required
        />
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
        <input
          placeholder="노션 공유 링크 (선택)"
          value={form.notion}
          onChange={e => setForm({ ...form, notion: e.target.value })}
        />
        <button type="submit">글쓰기</button>
      </form>
      <ul>
        {posts.map(post => (
          <li key={post.id} style={{ border: '1px solid #ccc', marginBottom: 10, padding: 10 }}>
            <div><b>{post.writer}</b> ({post.date})</div>
            <div>{post.content}</div>
            {post.fileUrl && (
              <div>
                <button onClick={() => setPdfViewId(pdfViewId === post.id ? null : post.id)}>
                  {pdfViewId === post.id ? '미리보기 닫기' : 'PDF 미리보기'}
                </button>
                {pdfViewId === post.id && (
                  <div style={{ border: '1px solid #eee', margin: '10px 0' }}>
                    <Document file={`${API_URL}${post.fileUrl}`} onLoadError={console.error}>
                      <Page pageNumber={1} width={500} />
                    </Document>
                  </div>
                )}
                <a href={`${API_URL}${post.fileUrl}`} target="_blank" rel="noopener noreferrer">PDF 다운로드</a>
              </div>
            )}
            {post.notion && (
              <div>
                <iframe src={post.notion} style={{ width: '100%', height: 300, border: 0 }} title="notion" />
              </div>
            )}
            <button onClick={() => handleDelete(post.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Board; 
// 공유 데이터 저장소
let posts: any[] = [];

// 파일에서 데이터 로드 (실제로는 데이터베이스에서 로드)
export function loadPosts() {
  try {
    // 여기서는 메모리 기반이므로 빈 배열로 시작
    posts = [];
  } catch (error) {
    console.error('게시글 로드 오류:', error);
    posts = [];
  }
}

// 파일에 데이터 저장 (실제로는 데이터베이스에 저장)
export function savePosts() {
  try {
    // 여기서는 메모리 기반이므로 저장 로직 생략
    // 실제 구현시에는 데이터베이스에 저장
    console.log('게시글 저장됨:', posts.length);
  } catch (error) {
    console.error('게시글 저장 오류:', error);
  }
}

// 게시글 목록 조회
export function getPosts() {
  return posts;
}

// 게시글 추가
export function addPost(post: any) {
  posts.push(post);
  savePosts();
}

// 게시글 찾기
export function findPost(id: string) {
  return posts.find(p => p.id === id);
}

// 게시글 업데이트
export function updatePost(id: string, updatedPost: any) {
  const index = posts.findIndex(p => p.id === id);
  if (index !== -1) {
    posts[index] = { ...posts[index], ...updatedPost };
    savePosts();
    return true;
  }
  return false;
}

// 게시글 삭제
export function deletePost(id: string) {
  const initialLength = posts.length;
  posts = posts.filter(p => p.id !== id);
  if (posts.length < initialLength) {
    savePosts();
    return true;
  }
  return false;
}

// 초기 데이터 로드
loadPosts(); 
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-gray-600">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <a
          href="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          홈으로 이동
        </a>
      </div>
    </div>
  );
}

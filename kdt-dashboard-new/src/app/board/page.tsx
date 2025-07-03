import dynamic from 'next/dynamic';
import Board from '@/components/Board';

export default function BoardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">게시판</h1>
      <Board />
    </div>
  );
} 
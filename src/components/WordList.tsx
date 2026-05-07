import React from 'react';
import { Word } from '../types';
import { WordCard } from './WordCard';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Book } from 'lucide-react';

interface WordListProps {
  words: Word[];
  onEdit: (word: Word) => void;
  isLoading: boolean;
}

export function WordList({ words, onEdit, isLoading }: WordListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Đang tải từ vựng...</p>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-200">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-xl shadow-gray-200 text-gray-300 mb-6">
          <Book size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Chưa có từ vựng nào</h3>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Hãy nhập các từ bạn muốn học vào khung bên trên để AI bắt đầu khởi tạo thẻ học tập.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <AnimatePresence mode="popLayout">
        {words.map((word) => (
          <WordCard key={word.id} word={word} onEdit={onEdit} />
        ))}
      </AnimatePresence>
    </div>
  );
}

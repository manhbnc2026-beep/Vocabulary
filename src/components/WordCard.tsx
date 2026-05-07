import React from 'react';
import { Headphones, Trash2, Edit2 } from 'lucide-react';
import { Word } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface WordCardProps {
  key?: string;
  word: Word;
  onDelete?: (id: string) => void;
  onEdit?: (word: Word) => void;
}

export const getPosColor = (pos?: string) => {
  if (!pos) return 'bg-gray-50 text-gray-400 border-gray-100';
  const p = pos.toLowerCase();
  if (p.includes('noun') || p === 'n') return 'bg-blue-50 text-blue-600 border-blue-100';
  if (p.includes('verb') || p === 'v') return 'bg-yellow-50 text-yellow-600 border-yellow-100';
  if (p.includes('adj') || p.includes('adjective')) return 'bg-orange-50 text-orange-600 border-orange-100';
  if (p.includes('adv') || p.includes('adverb')) return 'bg-red-50 text-red-600 border-red-100';
  return 'bg-gray-50 text-gray-400 border-gray-100';
};

export function WordCard({ word, onDelete, onEdit }: WordCardProps) {
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(word.text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative overflow-hidden rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/40 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-500"
    >
        <div className="aspect-square relative flex items-center justify-center bg-gray-50 overflow-hidden">
          {word.imageUrl ? (
            <img
              src={word.imageUrl}
              alt={word.text}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/600x600/f3f4f6/6366f1?text=${word.text}`;
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full bg-indigo-50/30">
              <span className="text-indigo-600 font-black text-4xl tracking-tighter uppercase break-words px-4 leading-tight">
                {word.text}
              </span>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-0.5 w-4 bg-indigo-200 rounded-full" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300">
                  Vocabulary
                </span>
                <div className="h-0.5 w-4 bg-indigo-200 rounded-full" />
              </div>
            </div>
          )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={() => onEdit?.(word)}
            className="p-2.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
            title="Chỉnh sửa từ"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete?.(word.id)}
            className="p-2.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-red-500 hover:border-red-500 transition-all opacity-0 group-hover:opacity-100"
            title="Xóa từ"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "text-2xl font-black tracking-tight",
              getPosColor(word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))
            )}>
              {word.text}
            </h3>
            <button 
              onClick={speak}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                getPosColor(word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'hover:bg-') + '/10',
                getPosColor(word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))
              )}
            >
              <Headphones size={18} />
            </button>
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border transition-colors",
            getPosColor(word.partOfSpeech)
          )}>
            {word.partOfSpeech}
          </span>
        </div>

        <p className="text-sm font-mono font-medium text-indigo-500 mb-4">{word.phonetic}</p>
        
        <div className="mb-6">
          <p className="text-base font-bold text-gray-800 leading-snug">
            {word.meaningVi}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Context Examples</p>
          {word.examples.map((ex, i) => {
             const [en, vi] = ex.split(' (');
             const cleanVi = vi ? ` (${vi}` : '';
             return (
               <div key={i} className="group/ex flex items-start justify-between gap-2 text-xs text-gray-600 pl-3 border-l-2 border-indigo-100 italic transition-colors hover:border-indigo-400">
                 <p className="flex-1">{ex}</p>
                 <button 
                    onClick={() => {
                      const utterance = new SpeechSynthesisUtterance(en.trim());
                      utterance.lang = 'en-US';
                      utterance.rate = 0.9;
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="p-1 rounded-full bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all opacity-0 group-hover/ex:opacity-100"
                    title="Nghe ví dụ"
                  >
                    <Headphones size={12} />
                  </button>
               </div>
             );
          })}
        </div>
      </div>
    </motion.div>
  );
}

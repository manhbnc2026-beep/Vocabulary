import React, { useState } from 'react';
import { X, Save, Loader2, Info } from 'lucide-react';
import { Word } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface WordEditModalProps {
  word: Word;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWordData: Partial<Word>) => Promise<void>;
}

export function WordEditModal({ word, isOpen, onClose, onSave }: WordEditModalProps) {
  const [formData, setFormData] = useState({
    text: word.text,
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    meaningVi: word.meaningVi,
    examples: [...word.examples],
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExampleChange = (index: number, value: string) => {
    const newExamples = [...formData.examples];
    newExamples[index] = value;
    setFormData(prev => ({ ...prev, examples: newExamples }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden shadow-indigo-200/50"
        >
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Chỉnh sửa từ vựng</h2>
              <p className="text-xs text-gray-500 font-medium">{word.text}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Từ vựng</label>
                <input
                  type="text"
                  value={formData.text}
                  onChange={(e) => handleChange('text', e.target.value)}
                  className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Phát âm</label>
                <input
                  type="text"
                  value={formData.phonetic}
                  onChange={(e) => handleChange('phonetic', e.target.value)}
                  className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Từ loại (Ví dụ: Noun, Verb...)</label>
              <input
                type="text"
                value={formData.partOfSpeech}
                onChange={(e) => handleChange('partOfSpeech', e.target.value)}
                className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Nghĩa tiếng Việt</label>
              <textarea
                value={formData.meaningVi}
                onChange={(e) => handleChange('meaningVi', e.target.value)}
                rows={2}
                className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-sm font-bold resize-none focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Câu ví dụ</label>
                <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                  <Info size={12} />
                  <span>Dạng: Câu tiếng Anh (Nghĩa tiếng Việt)</span>
                </div>
              </div>
              {formData.examples.map((ex, i) => (
                <div key={i} className="relative">
                  <textarea
                    value={ex}
                    onChange={(e) => handleExampleChange(i, e.target.value)}
                    rows={2}
                    className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5 text-xs font-medium italic text-gray-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all resize-none"
                  />
                  <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </form>

          <div className="p-6 bg-gray-50/50 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Lưu thay đổi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

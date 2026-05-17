import React, { useState } from 'react';
import { X, Save, Loader2, Info, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Word } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

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
    imageUrl: word.imageUrl || '',
    imagePrompt: word.imagePrompt || word.text,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExampleChange = (index: number, value: string) => {
    const newExamples = [...formData.examples];
    newExamples[index] = value;
    setFormData(prev => ({ ...prev, examples: newExamples }));
  };

  const handleRegenerateImage = () => {
    setIsRegenerating(true);
    try {
      const prompt = formData.imagePrompt || formData.text;
      const newUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=256&height=256&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      setFormData(prev => ({ ...prev, imageUrl: newUrl }));
      toast.success('Đã làm mới hình ảnh!');
    } catch (error) {
      toast.error('Lỗi khi làm mới hình ảnh');
    } finally {
      setTimeout(() => setIsRegenerating(false), 500);
    }
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
          className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden shadow-indigo-200/50"
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

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Image Preview & Edit */}
            <div className="p-6 bg-gray-50 border-r border-gray-100 flex flex-col gap-4">
              <div className="aspect-square w-full rounded-2xl bg-white border border-gray-200 shadow-inner overflow-hidden relative group">
                {formData.imageUrl ? (
                  <img 
                    src={formData.imageUrl} 
                    alt="Preview" 
                    className={cn("w-full h-full object-cover transition-opacity", isRegenerating && "opacity-50")}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-indigo-50/30">
                    <span className="text-indigo-600 font-black text-2xl uppercase tracking-widest break-words leading-tight">
                      {formData.text}
                    </span>
                  </div>
                )}
                {isRegenerating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                    <RefreshCw className="animate-spin text-indigo-600" size={32} />
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Prompt tạo hình ảnh (Tiếng Anh)</label>
                  <textarea
                    value={formData.imagePrompt}
                    onChange={(e) => handleChange('imagePrompt', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all resize-none"
                    placeholder="Describe the image context..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={isRegenerating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-gray-200 text-indigo-600 font-bold text-xs hover:border-indigo-600 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw size={14} className={cn(isRegenerating && "animate-spin")} />
                  Tạo lại hình ảnh
                </button>
                <div className="space-y-1.5 pt-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Hoặc dán URL hình ảnh</label>
                   <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => handleChange('imageUrl', e.target.value)}
                    className="w-full rounded-xl bg-white border border-gray-200 px-4 py-2 text-[10px] font-medium text-gray-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Từ loại</label>
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
                </div>
                {formData.examples.map((ex, i) => (
                  <div key={i} className="relative">
                    <textarea
                      value={ex}
                      onChange={(e) => handleExampleChange(i, e.target.value)}
                      rows={2}
                      className="w-full rounded-xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm font-medium italic text-gray-600 focus:outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            </form>
          </div>

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

import React, { useState, useRef } from 'react';
import { Send, Loader2, Info, Camera, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { extractWordsFromImage } from '../services/geminiService';

interface WordFormProps {
  onSubmit: (words: string[], name: string) => Promise<void>;
  isProcessing: boolean;
  progressPercentage: number;
}

export function WordForm({ onSubmit, isProcessing, progressPercentage }: WordFormProps) {
  const [text, setText] = useState('');
  const [listName, setListName] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const words = text
      .split(/[\n,;]/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (!listName.trim()) {
      toast.error('Vui lòng nhập tên danh sách');
      return;
    }

    if (words.length === 0) {
      toast.error('Vui lòng nhập ít nhất một từ');
      return;
    }

    if (words.length > 50) {
      toast.error('Tối đa 50 từ mỗi lần nhập');
      return;
    }

    onSubmit(words, listName);
    setText('');
    setListName('');
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    const toastId = toast.loading('Đang nhận diện từ vựng từ hình ảnh...');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const words = await extractWordsFromImage(base64);
      if (words.length > 0) {
        setText(prev => (prev ? prev + '\n' + words.join('\n') : words.join('\n')));
        toast.success(`Đã nhận diện được ${words.length} từ`, { id: toastId });
      } else {
        toast.error('Không tìm thấy từ vựng trong ảnh', { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      if (error?.message === 'QUOTA_EXHAUSTED') {
        toast.error('Giới hạn sử dụng AI tạm thời đã hết. Vui lòng thử lại sau vài phút!', { id: toastId, duration: 5000 });
      } else {
        toast.error('Lỗi khi nhận diện hình ảnh', { id: toastId });
      }
    } finally {
      setIsOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="relative rounded-3xl bg-white p-6 shadow-2xl shadow-indigo-100/50 border border-indigo-50/50">
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tên danh sách từ mới
          </label>
          <input
            type="text"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="Ví dụ: Từ vựng IELTS ngày 27/04"
            className="w-full rounded-xl bg-gray-50/50 px-4 py-3 text-lg font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border border-gray-100"
          />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            Danh sách từ vựng
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {text.split(/[\n,;]/).filter(w => w.trim().length > 0).length} / 50
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageSelect}
            />
            <button
              type="button"
              disabled={isOcrProcessing || isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100 transition-all"
            >
              {isOcrProcessing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              Chụp/Chọn ảnh
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 ml-2">
              <Info size={14} />
              Cách nhau bởi dòng mới, phẩy
            </div>
          </div>
        </div>

        <textarea
          disabled={isProcessing}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ:&#10;serendipity&#10;ephemeral, incandescent; solitude"
          className={cn(
            "w-full min-h-[200px] rounded-2xl bg-gray-50/50 p-5 text-lg font-medium text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border border-gray-100",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
        />

        <div className="mt-4 flex items-center justify-between">
          {isProcessing ? (
            <div className="flex-1 mr-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Đang xử lý chuyên sâu...</span>
                <span className="text-xs font-mono font-bold text-gray-400">{progressPercentage}%</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <button
            type="submit"
            disabled={isProcessing || isOcrProcessing || !text.trim() || !listName.trim()}
            className={cn(
              "flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200",
              (isProcessing || isOcrProcessing || !text.trim() || !listName.trim()) && "opacity-50 pointer-events-none shadow-none grayscale"
            )}
          >
            {isProcessing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
            Bắt đầu tạo thẻ từ
          </button>
        </div>
      </form>
    </motion.div>
  );
}

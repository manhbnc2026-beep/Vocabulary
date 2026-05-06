import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, connectionPromise } from './lib/firebase';
import { cn } from './lib/utils';
import { Header } from './components/Header';
import { WordForm } from './components/WordForm';
import { WordList } from './components/WordList';
import { WordEditModal } from './components/WordEditModal';
import { Quiz } from './components/Quiz';
import { Word, VocabList, OperationType } from './types';
import { analyzeWords } from './services/geminiService';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, History, GraduationCap, LayoutGrid, Filter, Edit2, Check, X } from 'lucide-react';

export default function App() {
  const [user] = useAuthState(auth);
  const [words, setWords] = useState<Word[]>([]);
  const [units, setUnits] = useState<VocabList[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'library' | 'practice'>('library');
  const [editingWord, setEditingWord] = useState<Word | null>(null);

  // Trigger editing state for name
  const handleStartEditingName = () => {
    const currentUnit = units.find(u => u.id === selectedUnitId);
    if (currentUnit) {
      setEditingNameValue(currentUnit.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!user || selectedUnitId === 'all' || !editingNameValue.trim()) {
      setIsEditingName(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'vocab_lists', selectedUnitId), { 
        name: editingNameValue.trim() 
      });
      toast.success('Đã cập nhật tên nhóm!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vocab_lists/${selectedUnitId}`);
      toast.error('Lỗi khi cập nhật tên');
    } finally {
      setIsEditingName(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setUnits([]);
      return;
    }

    const q = query(
      collection(db, 'vocab_lists'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VocabList[];
      setUnits(lists);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vocab_lists');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (!isLoading) setWords([]);
      setIsLoading(false);
      return;
    }

    let q = query(
      collection(db, 'words'),
      where('userId', '==', user.uid)
    );

    if (selectedUnitId !== 'all') {
      q = query(q, where('listId', '==', selectedUnitId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Word[];
      
      const sortedWords = [...wordsData].sort((a, b) => 
        a.text.localeCompare(b.text, 'en', { sensitivity: 'base' })
      );
      
      setWords(sortedWords);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'words');
    });

    return () => unsubscribe();
  }, [user, selectedUnitId]);

  useEffect(() => {
    connectionPromise.then(connected => {
      if (!connected) {
        toast.error('Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng của bạn!', {
          duration: 10000,
          id: 'conn-error'
        });
      }
    });
  }, []);

  // Removed old migration logic

  const handleProcessWords = async (inputWords: string[], name: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để bắt đầu');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    const totalSteps = inputWords.length + 2; // analysis + updates
    let currentStep = 0;

    const updateProgress = () => {
      currentStep++;
      setProgress(Math.round((currentStep / totalSteps) * 100));
    };

    try {
      // 1. Analyze with Gemini
      const analysisToast = toast.loading('Đang phân tích nghĩa từ vựng...');
      const analyzed = await analyzeWords(inputWords);
      updateProgress();
      toast.dismiss(analysisToast);

      if (analyzed.length === 0) {
        throw new Error('AI không thể xử lý danh sách này');
      }

      // 2. Create Vocab List for this session
      let listRef;
      try {
        listRef = await addDoc(collection(db, 'vocab_lists'), {
          name,
          userId: user.uid,
          createdAt: serverTimestamp(),
          wordCount: analyzed.length
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'vocab_lists');
        return;
      }

      // 3. Save Words
      toast.loading(`Đang lưu ${analyzed.length} từ vựng...`, { id: 'save-gen' });
      
      const batch = writeBatch(db);
      for (const item of analyzed) {
        const wordRef = doc(collection(db, 'words'));
        batch.set(wordRef, {
          ...item,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(item.imagePrompt || item.text)}?width=1024&height=1024&nologo=true`,
          listId: listRef.id,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        updateProgress();
      }
      
      try {
        await batch.commit();
        updateProgress(); // Finalize progress
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'words/batch');
      }

      toast.success('Đã hoàn thành tạo thẻ từ vựng!', { id: 'save-gen' });
    } catch (error: any) {
      console.error(error);
      if (error?.message === 'QUOTA_EXHAUSTED') {
        toast.error('Giới hạn sử dụng AI tạm thời đã hết. Vui lòng thử lại sau vài phút!', { duration: 5000 });
      } else {
        toast.error('Có lỗi xảy ra trong quá trình xử lý');
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
      toast.dismiss();
    }
  };

  const handleDeleteWord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'words', id));
      toast.success('Đã xóa từ vựng');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `words/${id}`);
    }
  };

  const handleUpdateWord = async (updatedData: Partial<Word>) => {
    if (!editingWord) return;
    try {
      await updateDoc(doc(db, 'words', editingWord.id), updatedData);
      toast.success('Đã cập nhật từ vựng');
      setEditingWord(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `words/${editingWord.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-right" />
      <Header />

      <main className="container mx-auto px-4 py-12">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-indigo-50 p-8 rounded-full mb-8 shadow-inner"
            >
              <Sparkles size={64} className="text-indigo-600" />
            </motion.div>
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Xây dựng vốn từ vựng của bạn</h2>
            <p className="text-lg text-gray-500 max-w-lg mb-8 leading-relaxed">
              Nhập hàng chục từ mới mỗi ngày và để AI tự động tạo phiên âm, dịch nghĩa và hình ảnh minh họa cho bạn. Đăng nhập để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="flex items-center justify-center">
              <div className="bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-gray-100 shadow-sm flex gap-1">
                <button 
                  onClick={() => setActiveTab('library')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'library' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <LayoutGrid size={18} />
                  Thư viện
                </button>
                <button 
                  onClick={() => setActiveTab('practice')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === 'practice' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <GraduationCap size={18} />
                  Luyện tập
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'library' ? (
                <motion.div 
                  key="library"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-20"
                >
                  <section>
                    <div className="flex items-center gap-3 mb-8">
                      <div className="h-1 w-12 bg-indigo-600 rounded-full" />
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Hôm nay bạn học gì?</h2>
                    </div>
                    <WordForm 
                      onSubmit={handleProcessWords} 
                      isProcessing={isProcessing} 
                      progressPercentage={progress}
                    />
                  </section>

                  <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-12 bg-indigo-600 rounded-full" />
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                          Thư viện từ vựng
                          <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                            {words.length} từ
                          </span>
                        </h2>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                          <Filter size={14} className="text-indigo-400" />
                          {isEditingName ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                autoFocus
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="text-xs font-bold bg-transparent outline-none text-gray-800 border-b border-indigo-200 min-w-[120px]"
                              />
                              <button onClick={handleSaveName} className="text-green-500 hover:text-green-600">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:text-red-600">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select 
                                value={selectedUnitId}
                                onChange={(e) => {
                                  setSelectedUnitId(e.target.value);
                                  setIsEditingName(false);
                                }}
                                className="text-xs font-bold bg-transparent outline-none text-gray-600 cursor-pointer pr-2"
                              >
                                <option value="all">Tất cả Unit ({units.reduce((acc, u) => acc + u.wordCount, 0)})</option>
                                {units.map(unit => (
                                  <option key={unit.id} value={unit.id}>{unit.name} ({unit.wordCount} từ)</option>
                                ))}
                              </select>
                              {selectedUnitId !== 'all' && (
                                <button 
                                  onClick={handleStartEditingName}
                                  className="text-indigo-300 hover:text-indigo-600 transition-colors"
                                  title="Đổi tên Unit"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {words.length > 0 && (
                          <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                            <History size={14} />
                            Thứ tự A-Z
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <WordList 
                      words={words} 
                      onDelete={handleDeleteWord} 
                      onEdit={setEditingWord}
                      isLoading={isLoading} 
                    />
                  </section>
                </motion.div>
              ) : (
                <motion.div 
                  key="practice"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-12"
                >
                  <Quiz words={words} onClose={() => setActiveTab('library')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">&copy; 2026 VocabFlow AI</p>
          <p className="text-[10px] text-gray-400">Powered by Gemini 3 & Nano Banana</p>
        </div>
      </footer>

      {editingWord && (
        <WordEditModal 
          word={editingWord}
          isOpen={!!editingWord}
          onClose={() => setEditingWord(null)}
          onSave={handleUpdateWord}
        />
      )}
    </div>
  );
}

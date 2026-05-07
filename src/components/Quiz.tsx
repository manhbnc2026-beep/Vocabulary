import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { Word, OperationType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, Headphones } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPosColor } from './WordCard';

interface QuizProps {
  words: Word[];
  onClose: () => void;
}

type QuizType = 'meaning' | 'word' | 'pos' | 'sentence';
type PracticeMode = 'mixed' | 'sentences' | 'cards';

interface Question {
  word: Word;
  type: QuizType;
  question: string;
  options: string[];
  correctAnswer: string;
  context?: string;
}

export function Quiz({ words, onClose }: QuizProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (words.length < 4 || !mode) return;
    
    let pool = [...words];
    if (mode === 'sentences') {
      pool = pool.filter(w => w.examples.length > 0);
    }
    
    if (pool.length === 0) return;

    const limit = mode === 'cards' ? pool.length : 10;
    const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, limit);
    
    const generatedQuestions = shuffled.map(word => {
      let type: QuizType;
      if (mode === 'sentences') {
        type = 'sentence';
      } else if (mode === 'cards') {
        type = 'meaning'; // Placeholder
      } else {
        const types: QuizType[] = ['meaning', 'word', 'pos', 'sentence'];
        type = types[Math.floor(Math.random() * types.length)];
        // Fallback for words without examples
        if (type === 'sentence' && word.examples.length === 0) {
          type = 'meaning';
        }
      }

      let options: string[] = [];
      let correctAnswer = '';
      let question = '';
      let context = '';

      if (type === 'meaning') {
        question = 'Nghĩa của từ này là gì?';
        correctAnswer = word.meaningVi;
        const distractors = words
          .filter(w => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.meaningVi);
        options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
      } else if (type === 'word') {
        question = 'Từ nào có ý nghĩa sau đây?';
        correctAnswer = word.text;
        const distractors = words
          .filter(w => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.text);
        options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
        context = word.meaningVi;
      } else if (type === 'pos') {
        question = 'Loại từ của từ này là gì?';
        correctAnswer = word.partOfSpeech;
        const distractors = ['Noun', 'Verb', 'Adjective', 'Adverb']
          .filter(p => !(correctAnswer?.toLowerCase() ?? '').includes(p.toLowerCase()))
          .slice(0, 3);
        options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
      } else {
        // Sentence completion
        const example = word.examples[0] || '';
        const sentenceParts = example.split('(');
        const englishPart = sentenceParts[0].trim();
        context = sentenceParts[1] ? `(${sentenceParts[1]}` : '';
        
        const regex = new RegExp(word.text, 'gi');
        question = englishPart.replace(regex, '__________');
        correctAnswer = word.text;
        
        const distractors = words
          .filter(w => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.text);
        options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
      }

      return { word, type, options, correctAnswer, question, context };
    });

    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setSelectedAnswer(null);
  }, [words, mode]);

  const getPosColor = (pos?: string) => {
    if (!pos) return 'border-indigo-500 bg-indigo-50 text-indigo-700';
    const p = pos.toLowerCase();
    if (p.includes('noun') || p === 'n') return 'border-blue-500 bg-blue-50 text-blue-700';
    if (p.includes('verb') || p === 'v') return 'border-yellow-500 bg-yellow-50 text-yellow-700';
    if (p.includes('adj') || p.includes('adjective')) return 'border-orange-500 bg-orange-50 text-orange-700';
    if (p.includes('adv') || p.includes('adverb')) return 'border-red-500 bg-red-50 text-red-700';
    return 'border-indigo-500 bg-indigo-50 text-indigo-700';
  };

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    if (answer === questions[currentIndex].correctAnswer) {
      setScore(s => s + 1);
    }
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedAnswer(null);
    } else {
      setIsFinished(true);
      if (auth.currentUser && mode !== 'cards') {
        try {
          await addDoc(collection(db, 'quiz_sessions'), {
            userId: auth.currentUser.uid,
            score,
            total: questions.length,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'quiz_sessions');
        }
      }
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  if (words.length < 4) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[3rem] shadow-xl">
        <Info size={48} className="text-indigo-200 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Cần thêm từ vựng</h3>
        <p className="text-gray-500 mb-6">Bạn cần ít nhất 4 từ vựng trong thư viện để bắt đầu bài kiểm tra.</p>
        <button onClick={onClose} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold transition-all hover:bg-indigo-700">
          Quay lại
        </button>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Chọn hình thức luyện tập</h2>
          <p className="text-gray-500">Mỗi ngày luyện tập một chút để ghi nhớ lâu hơn!</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => setMode('mixed')}
            className="group relative p-8 bg-white rounded-[2.5rem] border-2 border-transparent hover:border-indigo-100 hover:bg-indigo-50/10 transition-all text-center shadow-xl shadow-indigo-50/30"
          >
            <div className="h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
              <RefreshCw className="text-indigo-600" size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Trắc nghiệm</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Kết hợp giữa nghĩa từ, loại từ và điền từ vào câu.</p>
          </button>

          <button 
            onClick={() => setMode('sentences')}
            className="group relative p-8 bg-white rounded-[2.5rem] border-2 border-transparent hover:border-green-100 hover:bg-green-50/10 transition-all text-center shadow-xl shadow-green-50/30"
          >
            <div className="h-16 w-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
              <ArrowRight className="text-green-600" size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Điền câu ví dụ</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Thử thách ghi nhớ từ vựng qua các ngữ cảnh thực tế.</p>
          </button>

          <button 
            onClick={() => setMode('cards')}
            className="group relative p-8 bg-white rounded-[2.5rem] border-2 border-transparent hover:border-orange-100 hover:bg-orange-50/10 transition-all text-center shadow-xl shadow-orange-50/30"
          >
            <div className="h-16 w-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
              <Trophy className="text-orange-600" size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Thẻ ghi nhớ</h3>
            <p className="text-sm text-gray-500 leading-relaxed">ÔN tập nhanh bằng cách lật thẻ xem nghĩa và phát âm.</p>
          </button>
        </div>

        <div className="text-center">
          <button onClick={onClose} className="text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase tracking-widest text-[10px]">
            Hủy và quay lại
          </button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[3rem] shadow-2xl border border-indigo-50"
      >
        <div className="h-24 w-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-100">
          <Trophy size={48} className="text-yellow-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-2">Hoàn thành!</h2>
        {mode !== 'cards' ? (
          <p className="text-gray-500 mb-8 text-lg">Bạn đã đạt được <span className="text-indigo-600 font-black">{score}/{questions.length}</span> điểm.</p>
        ) : (
          <p className="text-gray-500 mb-8 text-lg">Bạn đã ôn tập xong <span className="text-indigo-600 font-black">{questions.length}</span> từ vựng.</p>
        )}
        
        <div className="flex gap-4">
          <button 
            onClick={() => {
              setMode(null);
              setIsFinished(false);
            }}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-100 transition-all"
          >
            <RefreshCw size={20} />
            Đổi chế độ
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    );
  }

  if (mode === 'cards') {
    const currentWord = questions[currentIndex]?.word;
    if (!currentWord) return null;

    return (
      <div className="w-full max-w-xl mx-auto space-y-8">
        <div className="flex items-center justify-between px-4">
          <button onClick={() => setMode(null)} className="text-xs font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest">
            Quay lại
          </button>
          <span className="text-xs font-mono font-bold text-gray-400">{currentIndex + 1} / {questions.length}</span>
        </div>

        <div className="perspective-1000 relative h-[450px] w-full">
          <motion.div
            initial={false}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
            className="preserve-3d w-full h-full relative cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] shadow-2xl border border-indigo-50 flex flex-col items-center justify-center p-8 text-center overscroll-contain overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="relative mb-6 w-32 h-32 flex items-center justify-center">
                {currentWord.imageUrl ? (
                  <img 
                    src={currentWord.imageUrl} 
                    alt={currentWord.text} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-3xl object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center p-2 text-center shadow-inner">
                    <span className="text-indigo-600 font-black text-xl uppercase tracking-widest break-words leading-tight">
                      {currentWord.text}
                    </span>
                  </div>
                )}
              </div>
              <h3 className="text-6xl font-black text-gray-900 tracking-tighter mb-4">{currentWord.text}</h3>
              <p className="text-xl font-mono text-indigo-400">{currentWord.phonetic}</p>
              <p className="mt-8 text-xs font-black text-gray-300 uppercase tracking-[0.2em]">Chạm để lật mặt</p>
            </div>

            {/* Back */}
            <div 
              className="absolute inset-0 backface-hidden bg-indigo-600 rounded-[3rem] shadow-2xl border border-indigo-700 flex flex-col p-10 text-white rotate-y-180 overflow-y-auto"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest">{currentWord.partOfSpeech}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(currentWord.text);
                  }}
                  className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"
                >
                  <Headphones size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Nghĩa tiếng Việt</label>
                  <h4 className="text-3xl font-bold leading-tight">{currentWord.meaningVi}</h4>
                </div>
                
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Câu ví dụ</label>
                  {currentWord.examples.map((ex, i) => (
                    <div key={i} className="bg-white/10 p-4 rounded-2xl text-sm italic font-medium leading-relaxed">
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="flex gap-4">
          <button 
            disabled={currentIndex === 0}
            onClick={() => {
              setCurrentIndex(i => i - 1);
              setIsFlipped(false);
            }}
            className="flex-1 py-4 bg-white text-indigo-600 rounded-2xl font-bold border-2 border-indigo-50 disabled:opacity-30 disabled:grayscale transition-all hover:bg-indigo-50"
          >
            Trước đó
          </button>
          <button 
            onClick={() => {
              if (currentIndex < questions.length - 1) {
                setCurrentIndex(i => i + 1);
                setIsFlipped(false);
              } else {
                setIsFinished(true);
              }
            }}
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            {currentIndex === questions.length - 1 ? 'Hoàn thành' : 'Tiếp theo'}
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMode(null)} className="text-xs font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">
          Quay lại chế độ
        </button>
        <span className="text-xs font-mono font-bold text-gray-400">{currentIndex + 1} / {questions.length}</span>
      </div>
      
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Câu hỏi {currentIndex + 1} / {questions.length}</span>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">
            {currentQ.question}
          </h2>
        </div>
        <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 flex items-center justify-center font-bold text-indigo-600">
          {score}
        </div>
      </div>

      <motion.div
        key={currentIndex}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-indigo-100/50 border border-indigo-50/50 relative overflow-hidden"
      >
        <div className="flex flex-col items-center mb-10">
          {currentQ.type === 'sentence' || currentQ.type === 'word' ? (
            <div className="text-center w-full relative">
              <h3 className={cn(
                "font-black text-gray-900 tracking-tight leading-tight",
                currentQ.type === 'sentence' ? "text-2xl" : "text-4xl text-indigo-600"
              )}>
                {currentQ.type === 'sentence' ? currentQ.question : currentQ.context}
              </h3>
              {currentQ.type === 'sentence' && (
                <button 
                  onClick={() => {
                    const fullSentence = currentQ.word.examples[0]?.split(' (')[0] || '';
                    speak(fullSentence);
                  }}
                  className="mt-4 p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all mx-auto block"
                  title="Nghe câu ví dụ"
                >
                  <Headphones size={20} />
                </button>
              )}
              {currentQ.context && currentQ.type === 'sentence' && (
                <p className="mt-4 text-gray-500 font-medium italic text-lg opacity-80">
                  {currentQ.context}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <h3 className={cn(
                  "text-5xl font-black tracking-tighter",
                  getPosColor(currentQ.word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))
                )}>
                  {currentQ.word.text}
                </h3>
                <button 
                  onClick={() => speak(currentQ.word.text)}
                  className={cn(
                    "p-3 rounded-full transition-all",
                    getPosColor(currentQ.word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'bg-') + '/10',
                    getPosColor(currentQ.word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))
                  )}
                >
                  <Headphones size={24} />
                </button>
              </div>
              <p className={cn(
                "text-lg font-mono",
                getPosColor(currentQ.word.partOfSpeech).split(' ').find(c => c.startsWith('text-'))?.replace('-700', '-400')
              )}>
                {currentQ.word.phonetic}
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {currentQ.options.map((option, idx) => {
            const isCorrect = option === currentQ.correctAnswer;
            const isSelected = selectedAnswer === option;
            const status = !selectedAnswer 
              ? 'idle' 
              : isCorrect 
                ? 'correct' 
                : isSelected 
                  ? 'wrong' 
                  : 'idle';

            const dynamicCorrectClass = currentQ.type === 'pos' && isCorrect ? getPosColor(option) : "border-green-500 bg-green-50 text-green-700";

            return (
              <button
                key={idx}
                disabled={!!selectedAnswer}
                onClick={() => handleAnswer(option)}
                className={cn(
                  "relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left font-bold text-lg",
                  status === 'idle' && "border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30",
                  status === 'correct' && dynamicCorrectClass,
                  status === 'wrong' && "border-red-500 bg-red-50 text-red-700"
                )}
              >
                {option}
                {status === 'correct' && <CheckCircle2 size={24} className="text-green-500" />}
                {status === 'wrong' && <XCircle size={24} className="text-red-500" />}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedAnswer && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-8 flex justify-end"
            >
              <button
                onClick={nextQuestion}
                className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200"
              >
                {currentIndex === questions.length - 1 ? 'Xem kết quả' : 'Tiếp theo'}
                <ArrowRight size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Info({ size, className }: { size: number, className: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, connectionPromise } from './lib/firebase';
import { cn } from './lib/utils';
import { Header } from './components/Header';
import { WordForm } from './components/WordForm';
import { WordList } from './components/WordList';
import { WordEditModal } from './components/WordEditModal';
import { Quiz } from './components/Quiz';
import { Word, VocabList, OperationType, AllowedUser, AccessRequest, QuizSession, EcosystemApp } from './types';
import { analyzeWords } from './services/geminiService';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, History, GraduationCap, LayoutGrid, Filter, Edit2, Check, X, ShieldAlert, Users, Plus, Trash2, Clock, UserCheck, RefreshCw, LayoutTemplate, Globe, ArrowRight, Lock, MessageSquare, ChevronLeft } from 'lucide-react';

const ADMIN_EMAIL = 'manhbnc2026@gmail.com';

export default function App() {
  const [user] = useAuthState(auth);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [units, setUnits] = useState<VocabList[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'library' | 'practice' | 'admin'>('library');
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [ecosystemApps, setEcosystemApps] = useState<EcosystemApp[]>([]);
  
  // App management state
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [newApp, setNewApp] = useState({ name: '', description: '', icon: 'Globe', color: 'indigo' });
  
  // Authorization states
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const getIcon = (name: string, size = 24) => {
    switch (name) {
      case 'GraduationCap': return <GraduationCap size={size} />;
      case 'MessageSquare': return <MessageSquare size={size} />;
      default: return <Globe size={size} />;
    }
  };
  const [isAdmin, setIsAdmin] = useState(false);
  const [authorizedApps, setAuthorizedApps] = useState<string[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [newAllowedEmail, setNewAllowedEmail] = useState('');

  // Check authorization and pending request
  useEffect(() => {
    if (!user) {
      setIsAuthorized(null);
      setIsAdmin(false);
      setHasPendingRequest(false);
      return;
    }

    const checkStatus = async () => {
      // Super Admin check
      if (user.email === ADMIN_EMAIL) {
        setIsAuthorized(true);
        setIsAdmin(true);
        return;
      }

      try {
        const allowedRef = doc(db, 'allowed_users', user.email || '');
        const allowedSnap = await getDoc(allowedRef);
        
        if (allowedSnap.exists()) {
          setIsAuthorized(true);
          const data = allowedSnap.data();
          setIsAdmin(data.role === 'admin');
          setAuthorizedApps(data.authorizedApps || []);
          return;
        }

        setIsAuthorized(false);
        const requestRef = doc(db, 'access_requests', user.email || '');
        const requestSnap = await getDoc(requestRef);
        setHasPendingRequest(requestSnap.exists());
      } catch (error) {
        console.error('Status check error:', error);
        setIsAuthorized(false);
      }
    };

    checkStatus();
  }, [user]);

  // Listen to dynamic apps
  useEffect(() => {
    const q = query(collection(db, 'apps'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EcosystemApp[];
      setEcosystemApps(apps);
      
      if (apps.length === 0 && user?.email === ADMIN_EMAIL) {
        const initialApps = [
          {
            name: 'VocabFlow',
            description: 'AI-powered English vocabulary builder with smart analysis.',
            icon: 'GraduationCap',
            color: 'indigo'
          },
          {
            name: 'QuickChat',
            description: 'Fast, secure AI assistant for daily tasks (Coming Soon).',
            icon: 'MessageSquare',
            color: 'emerald'
          }
        ];
        
        initialApps.forEach(app => {
          addDoc(collection(db, 'apps'), {
            ...app,
            createdAt: serverTimestamp()
          });
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    const qAllowed = query(collection(db, 'allowed_users'), orderBy('addedAt', 'desc'));
    const unsubAllowed = onSnapshot(qAllowed, (snapshot) => {
      setAllowedUsers(snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() })) as AllowedUser[]);
    });

    const qRequests = query(collection(db, 'access_requests'), orderBy('requestedAt', 'desc'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setPendingRequests(snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() })) as AccessRequest[]);
    });

    return () => {
      unsubAllowed();
      unsubRequests();
    };
  }, [isAdmin]);

  const handleRequestAccess = async () => {
    if (!user?.email) return;
    setIsRequesting(true);
    try {
      await writeBatch(db).set(doc(db, 'access_requests', user.email), {
        status: 'pending',
        requestedAt: serverTimestamp()
      }).commit();
      setHasPendingRequest(true);
      toast.success('Yêu cầu đã được gửi! Vui lòng chờ quản trị viên duyệt.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'access_requests');
      toast.error('Lỗi khi gửi yêu cầu');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleApproveRequest = async (email: string) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'allowed_users', email), {
        role: 'user',
        addedAt: serverTimestamp(),
        authorizedApps: ['vocab-flow']
      });
      batch.delete(doc(db, 'access_requests', email));
      await batch.commit();
      toast.success(`Đã duyệt quyền truy cập cho ${email}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'approval');
    }
  };

  const handleRejectRequest = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'access_requests', email));
      toast.success(`Đã từ chối yêu cầu của ${email}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `access_requests/${email}`);
    }
  };

  const handleAddAllowedUser = async () => {
    if (!newAllowedEmail.trim() || !newAllowedEmail.includes('@')) {
      toast.error('Email không hợp lệ');
      return;
    }
    const email = newAllowedEmail.trim().toLowerCase();
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'allowed_users', email), {
        role: 'user',
        addedAt: serverTimestamp(),
        authorizedApps: ['vocab-flow']
      });
      await batch.commit();
      toast.success('Đã thêm người dùng!');
      setNewAllowedEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'allowed_users');
      toast.error('Lỗi khi thêm người dùng');
    }
  };

  const handleRemoveAllowedUser = async (email: string) => {
    if (email === ADMIN_EMAIL) {
      toast.error('Không thể xóa quản trị viên cấp cao');
      return;
    }
    try {
      await deleteDoc(doc(db, 'allowed_users', email));
      toast.success('Đã xóa quyền truy cập');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `allowed_users/${email}`);
    }
  };

  const handleToggleAppAccess = async (email: string, appId: string) => {
    const targetUser = allowedUsers.find(u => u.email === email);
    if (!targetUser) return;
    let newApps = [...(targetUser.authorizedApps || [])];
    if (newApps.includes(appId)) {
      newApps = newApps.filter(id => id !== appId);
    } else {
      newApps.push(appId);
    }
    try {
      await updateDoc(doc(db, 'allowed_users', email), {
        authorizedApps: newApps
      });
      toast.success('Đã cập nhật quyền truy cập');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `allowed_users/${email}`);
    }
  };

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
    if (!user || isAuthorized === false) {
      setUnits([]);
      return;
    }
    const q = query(
      collection(db, 'vocab_lists'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VocabList[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vocab_lists');
    });
    return () => unsubscribe();
  }, [user, isAuthorized]);

  useEffect(() => {
    if (!user || isAuthorized === false) {
      if (!isLoading) setWords([]);
      setIsLoading(false);
      return;
    }
    let q = query(collection(db, 'words'), where('userId', '==', user.uid));
    if (selectedUnitId !== 'all') {
      q = query(q, where('listId', '==', selectedUnitId));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Word[];
      const sortedWords = [...wordsData].sort((a, b) => a.text.localeCompare(b.text, 'en', { sensitivity: 'base' }));
      setWords(sortedWords);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'words');
    });
    return () => unsubscribe();
  }, [user, selectedUnitId, isAuthorized]);

  useEffect(() => {
    if (!user || isAuthorized === false) return;
    const q = query(collection(db, 'quiz_sessions'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuizSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuizSession[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quiz_sessions');
    });
    return () => unsubscribe();
  }, [user, isAuthorized]);

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

  const handleProcessWords = async (inputWords: string[], name: string) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để bắt đầu');
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    const totalSteps = inputWords.length + 2;
    let currentStep = 0;
    const updateProgress = () => {
      currentStep++;
      setProgress(Math.round((currentStep / totalSteps) * 100));
    };
    try {
      const analysisToast = toast.loading('Đang phân tích nghĩa từ vựng...');
      const analyzed = await analyzeWords(inputWords);
      updateProgress();
      toast.dismiss(analysisToast);
      if (analyzed.length === 0) throw new Error('AI không thể xử lý danh sách này');
      const listRef = await addDoc(collection(db, 'vocab_lists'), {
        name,
        userId: user.uid,
        createdAt: serverTimestamp(),
        wordCount: analyzed.length
      });
      const batch = writeBatch(db);
      for (const item of analyzed) {
        batch.set(doc(collection(db, 'words')), {
          ...item,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(item.imagePrompt || item.text)}?width=1024&height=1024&nologo=true`,
          listId: listRef.id,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
        updateProgress();
      }
      await batch.commit();
      updateProgress();
      toast.success('Đã hoàn thành tạo thẻ từ vựng!');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message === 'QUOTA_EXHAUSTED' ? 'Giới hạn sử dụng AI tạm thời đã hết.' : 'Có lỗi xảy ra');
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

  const handleAddApp = async () => {
    if (!newApp.name.trim() || !newApp.description.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    try {
      await addDoc(collection(db, 'apps'), { ...newApp, createdAt: serverTimestamp() });
      toast.success('Đã thêm ứng dụng mới!');
      setIsAddingApp(false);
      setNewApp({ name: '', description: '', icon: 'Globe', color: 'indigo' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'apps');
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa ứng dụng này?')) return;
    try {
      await deleteDoc(doc(db, 'apps', id));
      toast.success('Đã xóa ứng dụng');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `apps/${id}`);
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

  const AdminPanel = () => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
      <div className="flex items-center justify-between">
        <button onClick={() => setActiveTab('library')} className="flex items-center gap-2 text-sm font-black text-gray-400 hover:text-indigo-600 transition-all group">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Quay lại
        </button>
      </div>
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100"><Users size={32} /></div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Hệ thống Quản trị</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">manhbnc2026 Ecosystem Management</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-amber-100 p-2.5 rounded-2xl"><Clock className="text-amber-600" size={20} /></div>
                <h3 className="font-black text-xl text-gray-900 tracking-tight">Yêu cầu chờ duyệt</h3>
              </div>
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.email} className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-amber-600 border border-amber-100">?</div>
                      <div className="max-w-[150px]">
                        <p className="font-bold text-gray-900 leading-none mb-1 truncate text-sm">{req.email}</p>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">{new Date(req.requestedAt?.toDate()).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveRequest(req.email)} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100"><Check size={16} /></button>
                      <button onClick={() => handleRejectRequest(req.email)} className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl"><X size={16} /></button>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && <div className="py-6 text-center text-gray-400 italic text-sm">Không có yêu cầu chờ.</div>}
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2.5 rounded-2xl"><Users className="text-indigo-600" size={20} /></div>
                <h3 className="font-black text-xl text-gray-900 tracking-tight">Người dùng</h3>
              </div>
              <div className="flex gap-2 mb-6">
                <input type="email" placeholder="Email..." value={newAllowedEmail} onChange={(e) => setNewAllowedEmail(e.target.value)} className="flex-1 bg-gray-50 border border-transparent focus:border-indigo-200 focus:bg-white px-5 py-3 rounded-2xl outline-none transition-all font-medium text-sm" />
                <button onClick={handleAddAllowedUser} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all hover:scale-105"><Plus size={18} /></button>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {allowedUsers.map(u => (
                  <div key={u.email} className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black text-indigo-400 border border-gray-100 text-xs">{u.email[0].toUpperCase()}</div>
                        <p className="font-bold text-gray-900 text-sm">{u.email}</p>
                      </div>
                      {u.email !== ADMIN_EMAIL && <button onClick={() => handleRemoveAllowedUser(u.email)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn("text-[8px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border mb-1", u.role === 'admin' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-indigo-50 text-indigo-600 border-indigo-100")}>{u.role === 'admin' ? 'ADMIN' : 'USER'}</span>
                      {u.role !== 'admin' && ecosystemApps.map(app => (
                        <button key={app.id} onClick={() => handleToggleAppAccess(u.email, app.id)} className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all", u.authorizedApps?.includes(app.id) ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-200 text-gray-400 hover:bg-gray-300")}>{app.name}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2.5 rounded-2xl"><LayoutTemplate className="text-emerald-600" size={20} /></div>
                  <h3 className="font-black text-xl text-gray-900 tracking-tight">Hệ sinh thái Apps</h3>
                </div>
                <button onClick={() => setIsAddingApp(!isAddingApp)} className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-100 transition-all"><Plus size={20} /></button>
              </div>
              {isAddingApp && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-4">
                  <div className="space-y-3">
                    <input type="text" placeholder="Tên app" value={newApp.name} onChange={e => setNewApp({...newApp, name: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-white border border-transparent focus:border-indigo-600 font-bold outline-none shadow-sm" />
                    <select value={newApp.icon} onChange={e => setNewApp({...newApp, icon: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-white border border-transparent focus:border-indigo-600 font-bold outline-none shadow-sm">
                      <option value="GraduationCap">Học tập</option>
                      <option value="MessageSquare">AI / Chat</option>
                      <option value="Globe">Web / Khác</option>
                      <option value="Sparkles">Sáng tạo</option>
                    </select>
                    <textarea placeholder="Mô tả..." value={newApp.description} onChange={e => setNewApp({...newApp, description: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-white border border-transparent focus:border-indigo-600 font-bold outline-none h-20 resize-none shadow-sm" />
                    <div className="flex gap-2 justify-center">
                      {['indigo', 'emerald', 'amber', 'rose', 'violet'].map(c => (
                        <button key={c} onClick={() => setNewApp({...newApp, color: c})} className={cn("w-6 h-6 rounded-full border-2", newApp.color === c ? "border-slate-400 scale-110" : "border-transparent", c === 'indigo' ? "bg-indigo-600" : c === 'emerald' ? "bg-emerald-500" : c === 'amber' ? "bg-amber-500" : c === 'rose' ? "bg-rose-500" : "bg-violet-600")} />
                      ))}
                    </div>
                    <button onClick={handleAddApp} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Xác nhận thêm app</button>
                  </div>
                </motion.div>
              )}
              <div className="space-y-3">
                {ecosystemApps.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-[2rem] border border-gray-100 group transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", app.color === 'indigo' ? "bg-indigo-600 shadow-indigo-50" : app.color === 'emerald' ? "bg-emerald-500 shadow-emerald-50" : app.color === 'amber' ? "bg-amber-500 shadow-amber-50" : app.color === 'rose' ? "bg-rose-500 shadow-rose-50" : "bg-violet-600 shadow-violet-50")}>{getIcon(app.icon, 24)}</div>
                      <div className="max-w-[180px]">
                        <p className="font-extrabold text-gray-900 leading-none mb-1.5">{app.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">{app.id}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteApp(app.id)} className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFF] selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-right" />
      <Header currentAppId={currentAppId} onBack={() => setCurrentAppId(null)} />

      <main className="container mx-auto px-4 py-12">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-indigo-50 p-8 rounded-full mb-8 shadow-inner"><Sparkles size={64} className="text-indigo-600" /></motion.div>
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Hệ sinh thái manhbnc2026</h2>
            <p className="text-lg text-gray-500 max-w-lg mb-8 leading-relaxed">Truy cập vào các ứng dụng AI cá nhân hóa và các công cụ thông minh một cách an toàn. Đăng nhập để bắt đầu.</p>
          </div>
        ) : (isAdmin && activeTab === 'admin') ? (
          <AdminPanel />
        ) : !currentAppId ? (
          <div className="space-y-12">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Chào mừng quay lại, {user.displayName?.split(' ')[0]}</h2>
              <p className="text-gray-500 font-medium leading-relaxed">Chọn một ứng dụng từ hệ sinh thái để bắt đầu công việc của bạn.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {ecosystemApps.map(app => {
                const isAvailable = authorizedApps.includes(app.id) || isAdmin;
                return (
                  <motion.button key={app.id} whileHover={{ y: -8 }} onClick={() => isAvailable && setCurrentAppId(app.id)} className={cn("group relative text-left p-8 rounded-[2.5rem] border bg-white transition-all", isAvailable ? "border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-indigo-100" : "border-gray-50 opacity-60 cursor-not-allowed grayscale")}>
                    <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-lg", app.color === 'indigo' ? "bg-indigo-600 text-white shadow-indigo-100" : app.color === 'emerald' ? "bg-emerald-500 text-white shadow-emerald-100" : app.color === 'amber' ? "bg-amber-500 text-white shadow-amber-100" : app.color === 'rose' ? "bg-rose-500 text-white shadow-rose-100" : "bg-violet-600 text-white shadow-violet-100")}>{getIcon(app.icon, 32)}</div>
                    <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight flex items-center gap-2">{app.name}{!isAvailable && <Lock size={16} className="text-gray-400" />}</h3>
                    <p className="text-gray-500 font-medium text-sm leading-relaxed mb-8">{app.description}</p>
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-indigo-600 group-hover:gap-3 transition-all">{isAvailable ? 'Truy cập ngay' : 'Chưa được cấp quyền'}<ArrowRight size={16} /></div>
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"><Lock size={14} />Yêu cầu quyền</div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
              {isAdmin && (
                <button onClick={() => setActiveTab('admin')} className="p-8 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-white transition-colors"><Users className="text-gray-400 group-hover:text-indigo-600" size={32} /></div>
                  <h3 className="font-black text-gray-900 mb-1">Quản lý User</h3>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Thiết lập quyền hệ sinh thái</p>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {currentAppId === 'vocab-flow' && (
              <div className="space-y-12">
                <div className="flex items-center justify-center">
                  <div className="bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-gray-100 shadow-sm flex gap-1">
                    <button onClick={() => setActiveTab('library')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all", activeTab === 'library' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50")}><LayoutGrid size={18} />Thư viện</button>
                    <button onClick={() => setActiveTab('practice')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all", activeTab === 'practice' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50")}><GraduationCap size={18} />Luyện tập</button>
                    {isAdmin && <button onClick={() => setActiveTab('admin')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all", activeTab === 'admin' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-amber-500 hover:bg-gray-50")}><Users size={18} />Quản lý</button>}
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {isAuthorized === false ? (
                    <motion.div key="restricted" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto py-20 text-center">
                      <div className="bg-red-50 p-6 rounded-3xl mb-6 inline-block"><ShieldAlert size={48} className="text-red-500" /></div>
                      <h2 className="text-2xl font-black text-gray-900 mb-2">Truy cập bị hạn chế</h2>
                      <p className="text-gray-500 mb-8 leading-relaxed">Tài khoản <strong>{user?.email}</strong> chưa được cấp quyền truy cập.</p>
                      {hasPendingRequest ? (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3 mb-8">
                          <Clock size={20} className="text-amber-500 shrink-0" />
                          <p className="text-sm font-bold text-amber-700 text-left">Yêu cầu của bạn đang chờ xử lý.</p>
                        </div>
                      ) : (
                        <button onClick={handleRequestAccess} disabled={isRequesting} className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">{isRequesting ? <RefreshCw className="animate-spin" size={20} /> : <Check size={20} />}Gửi yêu cầu truy cập</button>
                      )}
                    </motion.div>
                  ) : activeTab === 'library' ? (
                    <motion.div key="library" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-20">
                      <section>
                        <div className="flex items-center gap-3 mb-8"><div className="h-1 w-12 bg-indigo-600 rounded-full" /><h2 className="text-2xl font-black text-gray-900 tracking-tight">Hôm nay bạn học gì?</h2></div>
                        <WordForm onSubmit={handleProcessWords} isProcessing={isProcessing} progressPercentage={progress} />
                      </section>
                      <section>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                          <div className="flex items-center gap-3"><div className="h-1 w-12 bg-indigo-600 rounded-full" /><h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">Thư viện từ vựng<span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">{words.length} từ</span></h2></div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                              <Filter size={14} className="text-indigo-400" />
                              {isEditingName ? (
                                <div className="flex items-center gap-2">
                                  <input type="text" autoFocus value={editingNameValue} onChange={(e) => setEditingNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveName()} className="text-xs font-bold bg-transparent outline-none text-gray-800 border-b border-indigo-200 min-w-[120px]" />
                                  <button onClick={handleSaveName} className="text-green-500"><Check size={14} /></button>
                                  <button onClick={() => setIsEditingName(false)} className="text-red-500"><X size={14} /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} className="text-xs font-bold bg-transparent outline-none text-gray-600 cursor-pointer pr-2">
                                    <option value="all">Tất cả Unit</option>
                                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                  </select>
                                  {selectedUnitId !== 'all' && <button onClick={handleStartEditingName} className="text-indigo-300 hover:text-indigo-600"><Edit2 size={12} /></button>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <WordList words={words} onDelete={handleDeleteWord} onEdit={setEditingWord} isLoading={isLoading} />
                      </section>
                    </motion.div>
                  ) : activeTab === 'practice' ? (
                    <motion.div key="practice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       {words.length < 5 ? (
                        <div className="max-w-md mx-auto py-20 text-center">
                          <div className="bg-amber-50 p-6 rounded-3xl mb-6 inline-block"><GraduationCap size={48} className="text-amber-500" /></div>
                          <h2 className="text-2xl font-black text-gray-900 mb-2">Chưa đủ từ vựng</h2>
                          <p className="text-gray-500 mb-8">Bạn cần ít nhất 5 từ để bắt đầu luyện tập.</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-indigo-50/20"><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Tổng lượt học</p><div className="flex items-end gap-2"><span className="text-5xl font-black text-indigo-600 leading-none">{quizSessions.length}</span><span className="text-sm font-bold text-gray-400 mb-1">phiên</span></div></div>
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-emerald-50/20"><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Tỷ lệ chính xác</p><div className="flex items-end gap-2"><span className="text-5xl font-black text-emerald-500 leading-none">{quizSessions.length > 0 ? Math.round((quizSessions.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / quizSessions.length) * 100) : 0}</span><span className="text-sm font-bold text-gray-400 mb-1">%</span></div></div>
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-amber-50/20"><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Kỷ lục điểm</p><div className="flex items-end gap-2"><span className="text-5xl font-black text-amber-500 leading-none">{quizSessions.length > 0 ? Math.max(...quizSessions.map(s => s.score)) : 0}</span><span className="text-sm font-bold text-gray-400 mb-1">từ</span></div></div>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden p-10 text-center">
                              <button onClick={() => setShowQuiz(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[2rem] font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"><GraduationCap size={24} />Bắt đầu luyện tập</button>
                            </div>
                            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-xl p-8">
                              <div className="flex items-center gap-3 mb-8"><div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600"><History size={24} /></div><h3 className="font-black text-xl text-gray-900 tracking-tight">Lịch sử luyện tập</h3></div>
                              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-4 custom-scrollbar">
                                {quizSessions.map(s => (
                                  <div key={s.id} className="flex items-center justify-between p-5 bg-gray-50/50 rounded-3xl border border-gray-100">
                                    <div className="flex items-center gap-4"><div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg", (s.score/s.total) >= 0.8 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{s.score}</div><div><p className="font-black text-gray-900 leading-none mb-1.5">Đúng {s.score} / {s.total}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(s.timestamp?.toDate()).toLocaleString('vi-VN')}</p></div></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      <AnimatePresence>{showQuiz && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#FDFDFF] flex flex-col p-8 overflow-y-auto"><Quiz words={words} onClose={() => setShowQuiz(false)} /></motion.div>}</AnimatePresence>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )}
            {currentAppId === 'ai-chat' && <div className="text-center py-20"><h3 className="text-2xl font-black text-gray-900">QuickChat đang được phát triển...</h3><p className="text-gray-500">Quay lại sau nhé!</p></div>}
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-2">&copy; 2026 manhbnc2026 Ecosystem</p>
          <p className="text-[10px] text-gray-400">Powered by Gemini 3 & manhbnc2026</p>
        </div>
      </footer>

      {editingWord && (
        <WordEditModal word={editingWord} isOpen={!!editingWord} onClose={() => setEditingWord(null)} onSave={handleUpdateWord} />
      )}
    </div>
  );
}

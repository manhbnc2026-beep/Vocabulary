import { BookOpen, User, LogOut, LogIn } from 'lucide-react';
import { auth, signInWithGoogle } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Header() {
  const [user] = useAuthState(auth);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="font-sans text-xl font-bold tracking-tight text-gray-900">VocabFlow</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-indigo-600/60">Daily Builder</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-xs font-semibold text-gray-900">{user.displayName}</p>
                <p className="text-[10px] text-gray-500">{user.email}</p>
              </div>
              <img 
                src={user.photoURL || ''} 
                alt="Avatar" 
                className="h-8 w-8 rounded-full border border-black/5"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => auth.signOut()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:shadow-lg active:scale-95"
            >
              <LogIn size={16} />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, isFirebaseConfigured } from "../services/firebase";
import { logActivity } from "../services/analytics";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Bypass for Demo Mode
    if (!isFirebaseConfigured) {
        setTimeout(() => {
            console.warn("Bypassing auth (Demo Mode)");
            onLoginSuccess({ uid: 'demo-user', email: email || 'demo@lumina.app' });
        }, 800);
        return;
    }

    if (!auth) {
        setError("Auth not initialized.");
        setLoading(false);
        return;
    }

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        await logActivity(userCredential.user.uid, 'LOGIN', { email });
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await logActivity(userCredential.user.uid, 'SIGNUP', { email });
      }
      onLoginSuccess(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
      // Log failed attempt (anonymous)
      logActivity(undefined, 'ERROR', { type: 'AUTH_FAIL', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-sm p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-mono font-bold text-white tracking-tighter mb-2">LUMINA</h1>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">Presentation Platform</p>
        </div>

        {!isFirebaseConfigured && (
           <div className="mb-6 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-sm text-center">
             <p className="text-yellow-500 text-xs font-mono">⚠ DEMO MODE: Beta</p>
             <p className="text-zinc-500 text-[10px] mt-1">Any email/password will work locally.</p>
           </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded-sm text-red-400 text-xs font-mono text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Email Access</label>
            <input 
              type="email" 
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-blue-600 focus:outline-none transition-colors"
              placeholder="operator@church.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Passcode</label>
            <input 
              type="password" 
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-4 py-3 text-white focus:border-blue-600 focus:outline-none transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide rounded-sm transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'AUTHENTICATING...' : (isLogin ? 'ENTER WORKSPACE' : 'CREATE ACCOUNT')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setError(''); setIsLogin(!isLogin); }}
            className="text-zinc-500 hover:text-white text-xs underline decoration-zinc-700 underline-offset-4 transition-colors"
          >
            {isLogin ? "No account? Initialize setup" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-4 text-[10px] text-zinc-700 font-mono">
        SECURE CONNECTION // V2.1.0
      </div>
    </div>
  );
};
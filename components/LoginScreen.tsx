import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured, signIn as signInWithGooglePopup } from '../services/firebase';
import { logActivity } from '../services/analytics';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#EA4335" d="M9 7.37v3.58h4.97C13.75 12.1 12.6 13 11 13c-2.31 0-4.19-1.91-4.19-4.26S8.69 4.48 11 4.48c1.23 0 2.33.46 3.17 1.2l2.45-2.5C15.1 1.8 13.15 1 11 1 6.58 1 3 4.59 3 9s3.58 8 8 8c4.62 0 7.67-3.25 7.67-7.83 0-.52-.05-.93-.14-1.3H9z" />
    <path fill="#4285F4" d="M17.67 9.17c0-.52-.05-.93-.14-1.3H9v3.58h4.97c-.22 1.15-1.37 2.05-2.97 2.05-1.8 0-3.31-1.2-3.83-2.84l-2.91 2.25C5.56 15.54 8.09 17 11 17c4.62 0 7.67-3.25 7.67-7.83z" />
    <path fill="#FBBC05" d="M7.17 10.66c-.13-.39-.2-.8-.2-1.22 0-.42.07-.83.2-1.22L4.26 5.97A8 8 0 003 9c0 1.28.3 2.5.84 3.57l3.33-1.91z" />
    <path fill="#34A853" d="M11 17c2.15 0 4.1-.8 5.62-2.18l-2.45-2.5c-.85.74-1.95 1.2-3.17 1.2-2.31 0-4.19-1.91-4.19-4.26 0-.42.07-.83.2-1.22L4.26 5.97A8 8 0 0011 17z" />
  </svg>
);

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

    // Demo mode fallback
    if (!isFirebaseConfigured()) {
      setTimeout(() => {
        onLoginSuccess({ uid: 'demo-user', email: email || 'demo@lumina.app' });
      }, 800);
      return;
    }

    if (!auth) {
      setError('Auth not initialized.');
      setLoading(false);
      return;
    }

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        await logActivity(userCredential.user.uid, 'LOGIN', { email, method: 'EMAIL' });
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await logActivity(userCredential.user.uid, 'SIGNUP', { email, method: 'EMAIL' });
      }
      onLoginSuccess(userCredential.user);
    } catch (err: any) {
      console.error(err);
      setError(err?.message?.replace('Firebase: ', '') || 'Authentication failed.');
      logActivity(undefined, 'ERROR', { type: 'AUTH_FAIL', message: err?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    if (!isFirebaseConfigured()) {
      setTimeout(() => {
        onLoginSuccess({ uid: 'demo-google-user', email: 'demo-google@lumina.app' });
      }, 400);
      return;
    }

    try {
      const credential = await signInWithGooglePopup();
      if (credential?.user) {
        await logActivity(credential.user.uid, 'LOGIN', { method: 'GOOGLE', email: credential.user.email || null });
        onLoginSuccess(credential.user);
      } else {
        setError('Google sign-in did not return a user.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message?.replace('Firebase: ', '') || 'Google sign-in failed.');
      logActivity(undefined, 'ERROR', { type: 'AUTH_GOOGLE_FAIL', message: err?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-sm p-8 relative z-10 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-mono font-bold text-white tracking-tighter mb-2">LUMINA</h1>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">Presentation Platform</p>
        </div>

        {!isFirebaseConfigured() && (
          <div className="mb-6 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-sm text-center">
            <p className="text-yellow-500 text-xs font-mono">DEMO MODE</p>
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
              placeholder="........"
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

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-white text-zinc-900 font-semibold text-sm tracking-wide rounded-sm hover:bg-zinc-100 transition-all border border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <GoogleMark />
            {isLogin ? 'CONTINUE WITH GOOGLE' : 'SIGN UP WITH GOOGLE'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setError('');
              setIsLogin(!isLogin);
            }}
            className="text-zinc-500 hover:text-white text-xs underline decoration-zinc-700 underline-offset-4 transition-colors"
          >
            {isLogin ? 'No account? Initialize setup' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 text-[10px] text-zinc-700 font-mono">SECURE CONNECTION // V2.1.0</div>
    </div>
  );
};

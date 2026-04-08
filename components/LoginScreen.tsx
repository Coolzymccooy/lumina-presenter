import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured, signIn as signInWithGooglePopup } from '../services/firebase';
import { logActivity } from '../services/analytics';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  onClose?: () => void;
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#EA4335" d="M9 7.37v3.58h4.97C13.75 12.1 12.6 13 11 13c-2.31 0-4.19-1.91-4.19-4.26S8.69 4.48 11 4.48c1.23 0 2.33.46 3.17 1.2l2.45-2.5C15.1 1.8 13.15 1 11 1 6.58 1 3 4.59 3 9s3.58 8 8 8c4.62 0 7.67-3.25 7.67-7.83 0-.52-.05-.93-.14-1.3H9z" />
    <path fill="#4285F4" d="M17.67 9.17c0-.52-.05-.93-.14-1.3H9v3.58h4.97c-.22 1.15-1.37 2.05-2.97 2.05-1.8 0-3.31-1.2-3.83-2.84l-2.91 2.25C5.56 15.54 8.09 17 11 17c4.62 0 7.67-3.25 7.67-7.83z" />
    <path fill="#FBBC05" d="M7.17 10.66c-.13-.39-.2-.8-.2-1.22 0-.42.07-.83.2-1.22L4.26 5.97A8 8 0 003 9c0 1.28.3 2.5.84 3.57l3.33-1.91z" />
    <path fill="#34A853" d="M11 17c2.15 0 4.1-.8 5.62-2.18l-2.45-2.5c-.85.74-1.95 1.2-3.17 1.2-2.31 0-4.19-1.91-4.19-4.26 0-.42.07-.83.2-1.22L4.26 5.97A8 8 0 0011 17z" />
  </svg>
);

function friendlyError(msg: string): string {
  if (!msg) return '';
  if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found'))
    return 'Incorrect email or password. Double-check and try again.';
  if (msg.includes('email-already-in-use'))
    return 'An account with this email already exists. Try signing in instead.';
  if (msg.includes('weak-password'))
    return 'Password must be at least 6 characters.';
  if (msg.includes('invalid-email'))
    return 'Please enter a valid email address.';
  if (msg.includes('too-many-requests'))
    return 'Too many failed attempts. Wait a moment before trying again.';
  if (msg.includes('network-request-failed'))
    return 'Network error — check your connection and try again.';
  if (msg.includes('popup-closed') || msg.includes('cancelled-popup'))
    return '';
  return msg.replace('Firebase: ', '').replace(/\s*\(auth\/[^)]+\)\.?/, '').trim();
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Enter your email address above first.'); return; }
    if (!isFirebaseConfigured() || !auth) {
      setResetSent(true);
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Demo mode fallback — DEV BUILDS ONLY.
    // In production builds, Firebase MUST be configured. Failing closed here
    // prevents cracked/redistributed builds from bypassing auth with any
    // arbitrary credentials.
    if (!isFirebaseConfigured()) {
      if (import.meta.env.PROD) {
        setError('This build is not licensed. Firebase authentication is required. Please contact support.');
        setLoading(false);
        logActivity(undefined, 'ERROR', { type: 'AUTH_UNLICENSED_BUILD' });
        return;
      }
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
      setError(err?.message || 'Authentication failed.');
      logActivity(undefined, 'ERROR', { type: 'AUTH_FAIL', message: err?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    if (!isFirebaseConfigured()) {
      if (import.meta.env.PROD) {
        setError('This build is not licensed. Firebase authentication is required. Please contact support.');
        setLoading(false);
        logActivity(undefined, 'ERROR', { type: 'AUTH_UNLICENSED_BUILD' });
        return;
      }
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
      setError(err?.message || 'Google sign-in failed.');
      logActivity(undefined, 'ERROR', { type: 'AUTH_GOOGLE_FAIL', message: err?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-purple-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-700/10 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] right-[-5%] w-[300px] h-[300px] bg-pink-700/8 rounded-full blur-[90px]" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm relative z-10">
        {/* Close button — outside card, top right */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
            Close
          </button>
        )}

        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/60">

          {/* Logo — matches desktop app: blue-600 → indigo-700, "L" mark */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
                <span className="text-white font-black text-sm leading-none">L</span>
              </div>
              <span className="text-white font-black text-lg tracking-[0.2em]">LUMINA</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              {isReset ? 'Reset password' : isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-zinc-500">
              {isReset ? 'We\'ll send a reset link to your email' : isLogin ? 'Sign in to your Lumina workspace' : 'Get started with Lumina for free'}
            </p>
          </div>

          {/* Demo mode banner */}
          {!isFirebaseConfigured() && (
            <div className="mb-5 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
              <p className="text-amber-400 text-xs font-semibold">Demo mode — any credentials work</p>
            </div>
          )}

          {/* Error */}
          {error && friendlyError(error) && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-rose-500/[0.08] border border-rose-500/20 rounded-xl">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="#fb7185" strokeWidth="1.25"/>
                <line x1="8" y1="4.5" x2="8" y2="8.5" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.8" fill="#fb7185"/>
              </svg>
              <p className="text-rose-300 text-xs leading-relaxed">{friendlyError(error)}</p>
            </div>
          )}

          {/* ── Password reset view ── */}
          {isReset ? (
            resetSent ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 mb-2">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-white font-semibold">Check your inbox</p>
                <p className="text-sm text-zinc-500">A reset link was sent to <span className="text-white">{email}</span></p>
                <button
                  onClick={() => { setIsReset(false); setResetSent(false); setError(''); }}
                  className="w-full py-2.5 bg-white/5 border border-white/10 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-all mt-2"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-blue-500/60 focus:outline-none transition-all"
                    placeholder="operator@church.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsReset(false); setError(''); }}
                  className="w-full py-2 text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
            <>
              {/* Google sign-in — primary */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                <GoogleMark />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[11px] text-zinc-600 font-medium">or use email</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Email/password form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-blue-500/60 focus:outline-none transition-all"
                    placeholder="operator@church.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-400">Password</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => { setError(''); setIsReset(true); }}
                        className="text-[11px] text-zinc-500 hover:text-blue-400 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-blue-500/60 focus:outline-none transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {loading ? 'Signing in…' : (isLogin ? 'Sign in' : 'Create account')}
                </button>
              </form>

              {/* Toggle sign in / sign up */}
              <div className="mt-5 text-center">
                <button
                  onClick={() => { setError(''); setIsLogin(!isLogin); }}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <span className="text-blue-400 font-semibold hover:text-blue-300">
                    {isLogin ? 'Sign up free' : 'Sign in'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-5">
          Protected by Firebase · Lumina Presenter
        </p>
      </div>
    </div>
  );
};

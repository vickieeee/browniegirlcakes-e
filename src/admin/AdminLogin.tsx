import React, { useState } from 'react';
import { Cake, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Users, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent, DEFAULT_ADMIN_PASSWORD } from '../context/ContentContext';

interface AdminLoginProps {
  onLoginSuccess: (adminEmail: string) => void;
  onBackToWebsite: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToWebsite }) => {
  const { signInWithGoogle } = useAuth();
  const { adminList, adminEmails, adminPassword, verifyAdminCredentials } = useContent();
  const [email, setEmail] = useState('preethipreethu712@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isUsingDefaultPassword = adminPassword === DEFAULT_ADMIN_PASSWORD;

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both your authorized admin email and password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const check = verifyAdminCredentials(cleanEmail, password);
      if (check.valid) {
        if (rememberMe) {
          localStorage.setItem('browinegirl_admin_token', 'session_' + Date.now());
          localStorage.setItem('browinegirl_admin_user', cleanEmail);
        } else {
          sessionStorage.setItem('browinegirl_admin_token', 'session_' + Date.now());
          sessionStorage.setItem('browinegirl_admin_user', cleanEmail);
        }
        setIsLoading(false);
        onLoginSuccess(cleanEmail);
      } else {
        setIsLoading(false);
        setError(check.message);
      }
    }, 300);
  };

  const handleGoogleAdminLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        const loggedEmail = (loggedUser.email || '').toLowerCase().trim();
        const isAuthorized =
          loggedEmail === 'preethipreethu712@gmail.com' ||
          loggedEmail === 'vigneshsivan2001@gmail.com' ||
          adminEmails.some((a) => a.toLowerCase() === loggedEmail);

        if (!isAuthorized) {
          setError(
            `Google account (${loggedEmail}) is not authorized as an admin yet. Sign in with an owner account first to add this email.`
          );
          return;
        }

        localStorage.setItem('browinegirl_admin_token', 'google_' + loggedUser.uid);
        localStorage.setItem('browinegirl_admin_user', loggedUser.email || 'preethipreethu712@gmail.com');
        onLoginSuccess(loggedUser.email || 'preethipreethu712@gmail.com');
      }
    } catch (err) {
      console.error(err);
      setError('Google Sign-In was cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1F0F0C] flex flex-col justify-center items-center px-4 py-8 sm:p-6 relative overflow-x-hidden font-sans">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-72 sm:w-80 h-72 sm:h-80 bg-[#C47B55]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 sm:w-80 h-72 sm:h-80 bg-[#E5A962]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-[#2A1612] border border-[#3B211B] rounded-3xl shadow-2xl p-5 sm:p-9 text-[#F8F0E5] space-y-5 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#C47B55] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#C47B55]/20">
            <Cake className="w-6 h-6 sm:w-8 sm:h-8 text-[#F8F0E5]" />
          </div>

          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#F8F0E5] pt-1">
            BROWNIEGIRLCAKES
          </h2>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#E5A962]">
            Artisan Bakery Management Console
          </p>
          <p className="text-xs text-[#E8D6C3]/70">
            Sign in with your authorized email and strong admin password.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-950/70 border border-red-700/70 rounded-xl text-red-200 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Quick Select Authorized Admin Accounts (Fills Email Only) */}
        <div className="p-3 rounded-2xl bg-[#1F0F0C]/80 border border-[#3B211B] space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-[#E5A962]">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Authorized Admin Emails ({adminList.length})
            </span>
            <span className="text-[#E8D6C3]/50">Tap to select email</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {adminList.map((adm) => (
              <button
                key={adm.email}
                type="button"
                onClick={() => {
                  setEmail(adm.email);
                  setError(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border truncate max-w-full ${
                  email.toLowerCase() === adm.email.toLowerCase()
                    ? 'bg-[#C47B55] text-white border-[#C47B55]'
                    : 'bg-[#2A1612] text-[#E8D6C3]/80 border-[#3B211B] hover:border-[#C47B55]/50 hover:text-white'
                }`}
              >
                {adm.email}
              </button>
            ))}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#E8D6C3] mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#C47B55]" />
              Authorized Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="preethipreethu712@gmail.com"
              required
              className="w-full min-h-[46px] p-3 bg-[#1F0F0C] border border-[#3B211B] rounded-xl text-sm text-[#F8F0E5] focus:outline-none focus:ring-2 focus:ring-[#C47B55] placeholder-[#E8D6C3]/40 transition-all font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E8D6C3] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C47B55]" />
                Admin Password
              </label>
              <span className="text-[10px] text-[#E5A962] flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3 h-3" />
                Strict Verification
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your strong admin password"
                required
                className="w-full min-h-[46px] p-3 pr-11 bg-[#1F0F0C] border border-[#3B211B] rounded-xl text-sm text-[#F8F0E5] focus:outline-none focus:ring-2 focus:ring-[#C47B55] placeholder-[#E8D6C3]/40 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#E8D6C3]/60 hover:text-white transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isUsingDefaultPassword && (
              <p className="text-[11px] text-[#E8D6C3]/60 mt-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3 h-3 text-[#E5A962] shrink-0" />
                <span>
                  Initial password is <code className="text-[#E5A962] font-mono">admin123</code> — change it to a strong password in <strong>Admin Team &amp; Access</strong>.
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#E8D6C3]/75 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#3B211B] text-[#C47B55] focus:ring-0 bg-[#1F0F0C]"
              />
              <span>Keep me signed in on this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#C47B55] hover:bg-[#D98B5F] text-white text-sm font-bold tracking-wide shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#3B211B] w-full" />
          <span className="bg-[#2A1612] px-3 text-[11px] uppercase tracking-wider text-[#E8D6C3]/50 font-semibold">
            Or Verified Google Sign-In
          </span>
        </div>

        {/* Google Admin Auth */}
        <button
          type="button"
          onClick={handleGoogleAdminLogin}
          disabled={isLoading}
          className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-[#3B211B] text-[#F8F0E5] text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.99]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Sign In with Authorized Google Account</span>
        </button>

        {/* Back to public website link */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="text-xs text-[#E8D6C3]/60 hover:text-white transition-colors cursor-pointer py-2 px-3"
          >
            &larr; Return to BROWNIEGIRLCAKES Storefront
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#E8D6C3]/40 mt-5 text-center px-4">
        BROWNIEGIRLCAKES Dedicated Dashboard &bull; Protected by Strong Password &amp; Role-Based Access
      </p>
    </div>
  );
};

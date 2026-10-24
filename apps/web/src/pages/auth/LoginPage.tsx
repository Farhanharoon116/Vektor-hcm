import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  User,
  Eye,
  EyeOff,
  HelpCircle,
  CheckCircle2,
  KeyRound,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState(true);

  // Forgot password & OTP verification state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const res = await api.get('/company/status');
      if (!res.initialized) {
        setIsSystemInitialized(false);
      }
    } catch {
      // ignore
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await api.post('/auth/login', { email, password });
      setAuth(data.token, data.user, data.company, data.employee);

      if (data.user.must_change_password) {
        navigate('/change-password');
        return;
      }

      // Redirect by role
      if (data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (data.user.role === 'hr') {
        navigate('/hr/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center px-4 py-12">
      {/* Setup notification banner if uninitialized */}
      {!isSystemInitialized && (
        <div className="mb-6 max-w-md w-full bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-800">Fresh System Detected</p>
            <p className="text-xs text-amber-600">Company has not been configured yet.</p>
          </div>
          <Link
            to="/setup"
            className="text-xs font-bold text-amber-800 bg-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
          >
            Run Setup →
          </Link>
        </div>
      )}

      {/* Main Login Card - Clean White Aesthetic */}
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200/90 shadow-sm p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto flex items-center justify-center text-white font-extrabold text-2xl shadow-sm mb-4">
            V
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Vektor <span className="text-brand-600">HCM</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">Manage people, not paperwork.</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">Password</label>
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-10 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full mt-2">
            Sign In to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        {/* Registration and setup links */}
        <div className="mt-4 text-center space-y-1">
          <p className="text-xs text-gray-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
              Create an Account
            </Link>
          </p>
          <p className="text-[11px] text-gray-400">
            First time setup?{' '}
            <Link to="/setup" className="font-semibold text-gray-600 hover:underline">
              Run Initial Setup Wizard
            </Link>
          </p>
        </div>

        {/* Quick fill demo chips for judges */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">
            Quick Fill Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('admin@vektor.local');
                setPassword('AdminPassword123!');
              }}
              className="p-2 border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 rounded-lg text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-purple-700">
                <ShieldCheck className="w-3 h-3" /> Admin
              </div>
              <p className="text-[10px] text-gray-500 truncate">admin@vektor.local</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail('hr@vektor.local');
                setPassword('HrPassword123!');
              }}
              className="p-2 border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 rounded-lg text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-blue-700">
                <UserCheck className="w-3 h-3" /> HR
              </div>
              <p className="text-[10px] text-gray-500 truncate">hr@vektor.local</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail('emp@vektor.local');
                setPassword('EmpPassword123!');
              }}
              className="p-2 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 rounded-lg text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <User className="w-3 h-3" /> Employee
              </div>
              <p className="text-[10px] text-gray-500 truncate">emp@vektor.local</p>
            </button>
          </div>
        </div>
      </div>

      {/* Email OTP Verification & Password Reset Modal */}
      <Modal
        isOpen={isForgotOpen}
        onClose={() => {
          setIsForgotOpen(false);
          setForgotStep('email');
          setForgotError(null);
          setOtpCode('');
          setResetNewPassword('');
        }}
        title="Email Verification & Password Reset"
      >
        <div className="space-y-4">
          {forgotError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotStep === 'email' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setForgotLoading(true);
                setForgotError(null);
                try {
                  const targetEmail = forgotEmail || email;
                  await api.post('/auth/otp/send', {
                    email: targetEmail,
                    purpose: 'password_reset',
                  });
                  setForgotStep('otp');
                } catch (err: any) {
                  setForgotError(err.message || 'Failed to send OTP code to email');
                } finally {
                  setForgotLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
                <Mail className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                <div className="text-xs text-brand-900 leading-relaxed">
                  <p className="font-semibold">Resend Email Verification</p>
                  <p className="text-brand-700 mt-0.5">
                    We will send a single-use 6-digit OTP verification code to your registered email address.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Registered Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={forgotEmail || email}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={forgotLoading}>
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Send Verification Code
                </Button>
              </div>
            </form>
          )}

          {forgotStep === 'otp' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (otpCode.length !== 6) {
                  setForgotError('Please enter the full 6-digit OTP code');
                  return;
                }
                if (resetNewPassword.length < 8) {
                  setForgotError('New password must be at least 8 characters');
                  return;
                }

                setForgotLoading(true);
                setForgotError(null);

                try {
                  const targetEmail = forgotEmail || email;
                  await api.post('/auth/otp/reset-password', {
                    email: targetEmail,
                    otp: otpCode,
                    new_password: resetNewPassword,
                  });
                  setForgotStep('success');
                } catch (err: any) {
                  setForgotError(err.message || 'Invalid or expired OTP code');
                } finally {
                  setForgotLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-700" /> Check Your Email
                </p>
                <p className="text-purple-700 mt-1">
                  A 6-digit verification code has been dispatched to <strong>{forgotEmail || email}</strong> via Resend.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  6-Digit Verification Code (OTP)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[8px] font-mono font-bold text-lg bg-gray-50 border border-gray-300 rounded-lg py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-10 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors p-0.5 cursor-pointer"
                    title={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotStep('email')}
                >
                  Back
                </Button>
                <Button type="submit" isLoading={forgotLoading}>
                  Verify OTP & Reset Password
                </Button>
              </div>
            </form>
          )}

          {forgotStep === 'success' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Password Reset Verified!</h4>
              <p className="text-xs text-gray-600">
                Your email identity was verified via OTP, and your new password has been set. You can now sign in.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  if (forgotEmail) setEmail(forgotEmail);
                  setIsForgotOpen(false);
                  setForgotStep('email');
                }}
                className="mt-4 w-full"
              >
                Sign In Now
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <p className="text-xs text-gray-400 mt-6">
        Saylani Hackathon 2026 · Zaitoon Ashraf IT Park
      </p>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  Building,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

export const SignupPage: React.FC = () => {
  const [mode, setMode] = useState<'company' | 'request'>('company');
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email OTP verification state
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);

  // Forgot password OTP modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotDevOtp, setForgotDevOtp] = useState<string | null>(null);

  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  // When email changes, reset verified status
  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    if (isEmailVerified) {
      setIsEmailVerified(false);
    }
  };

  // Trigger sending OTP to email
  const handleSendVerificationOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid work email address first.');
      return;
    }
    setError(null);
    setOtpError(null);
    setOtpLoading(true);

    try {
      const res = await api.post('/auth/otp/send', {
        email: email.trim(),
        purpose: 'signup_verification',
      });
      if (res.testOtp) {
        setDevOtpPreview(res.testOtp);
      }
      setOtpCooldown(60);
      setIsOtpModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please check your email.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify the entered 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter the complete 6-digit code');
      return;
    }
    setOtpError(null);
    setOtpLoading(true);

    try {
      await api.post('/auth/otp/verify', {
        email: email.trim(),
        otp: otpCode.trim(),
        purpose: 'signup_verification',
      });
      setIsEmailVerified(true);
      setIsOtpModalOpen(false);
      setOtpCode('');
      setError(null);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired OTP code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If email is not yet verified, prompt OTP verification
    if (!isEmailVerified) {
      await handleSendVerificationOtp();
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'company') {
        const res = await api.post('/company/setup', {
          company_name: companyName,
          admin_email: email,
          admin_password: password,
          city: 'Karachi',
          office_start: '09:00',
          grace_minutes: 15,
          half_day_hours: 5.0,
          office_latitude: 24.8607,
          office_longitude: 67.0011,
          office_radius_meters: 150,
        });

        setAuth(res.token, res.user, res.company);
        navigate('/admin/dashboard');
      } else {
        // Employee account request
        alert('Your registration request has been submitted to HR. You will receive an invitation once approved.');
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. If company is already initialized, please sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password OTP handlers
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      const res = await api.post('/auth/otp/send', {
        email: (forgotEmail || email).trim(),
        purpose: 'password_reset',
      });
      if (res.testOtp) {
        setForgotDevOtp(res.testOtp);
      }
      setForgotStep('otp');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to dispatch reset code');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtpCode || forgotOtpCode.trim().length !== 6) {
      setForgotError('Please enter the 6-digit OTP code sent to your email');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters');
      return;
    }
    setForgotError(null);
    setForgotLoading(true);
    try {
      await api.post('/auth/otp/reset-password', {
        email: (forgotEmail || email).trim(),
        otp: forgotOtpCode.trim(),
        new_password: forgotNewPassword,
      });
      setForgotStep('success');
    } catch (err: any) {
      setForgotError(err.message || 'Reset failed. Code may be invalid or expired.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200/90 shadow-sm p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto flex items-center justify-center text-white font-extrabold text-2xl shadow-sm mb-4">
            V
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Create your <span className="text-brand-600">Vektor</span> Account
          </h1>
          <p className="text-xs text-gray-500 mt-1">Get started with AI-assisted Human Capital Management</p>
        </div>

        {/* Tab switcher: New Organization vs Employee Sign-in request */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('company')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'company' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            New Organization
          </button>
          <button
            type="button"
            onClick={() => setMode('request')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              mode === 'request' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Employee Access
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          {mode === 'company' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Company / Organization Name</label>
              <div className="relative">
                <Building className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Innovations"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Muhammad Ali"
                  className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">Work Email</label>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Email Verified
                </span>
              ) : email.includes('@') ? (
                <button
                  type="button"
                  onClick={handleSendVerificationOtp}
                  disabled={otpLoading}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                >
                  {otpLoading ? 'Sending OTP...' : 'Verify Email with OTP'}
                </button>
              ) : null}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="name@company.com"
                className={`w-full bg-white border rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                  isEmailVerified
                    ? 'border-emerald-300 focus:ring-emerald-400 bg-emerald-50/20'
                    : 'border-gray-200 focus:ring-brand-500'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setIsForgotOpen(true);
                  setForgotStep('email');
                  setForgotError(null);
                }}
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
                placeholder="Minimum 8 characters"
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
            {!isEmailVerified ? (
              <>
                Verify Email & Register <ArrowRight className="w-4 h-4 ml-1" />
              </>
            ) : mode === 'company' ? (
              <>
                Register Organization <ArrowRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                Submit Access Request <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign In
          </Link>
        </div>
      </div>

      {/* Email Verification OTP Modal */}
      <Modal
        isOpen={isOtpModalOpen}
        onClose={() => {
          setIsOtpModalOpen(false);
          setOtpError(null);
        }}
        title="Email Verification"
      >
        <div className="space-y-4">
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
            <Mail className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
            <div className="text-xs text-brand-900 leading-relaxed">
              <p className="font-semibold">Resend OTP Verification</p>
              <p className="text-brand-700 mt-0.5">
                We sent a 6-digit verification code to <strong>{email}</strong>. Please check your inbox or spam folder.
              </p>
            </div>
          </div>

          {devOtpPreview && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 font-medium">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Dev Preview Code: <strong className="font-mono text-amber-950 font-bold">{devOtpPreview}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setOtpCode(devOtpPreview)}
                className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Auto-fill
              </button>
            </div>
          )}

          {otpError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={otpCooldown > 0 || otpLoading}
                onClick={handleSendVerificationOtp}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${otpLoading ? 'animate-spin' : ''}`} />
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOtpModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={otpLoading}>
                  Verify Email
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* Forgot Password OTP Modal */}
      <Modal
        isOpen={isForgotOpen}
        onClose={() => {
          setIsForgotOpen(false);
          setForgotStep('email');
          setForgotError(null);
          setForgotOtpCode('');
          setForgotNewPassword('');
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
            <form onSubmit={handleForgotSendOtp} className="space-y-4">
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                <div className="text-xs text-brand-900 leading-relaxed">
                  <p className="font-semibold">Resend Email OTP Reset</p>
                  <p className="text-brand-700 mt-0.5">
                    We will send a 6-digit security code to your registered email address to verify your identity.
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
                  Send 6-Digit Code
                </Button>
              </div>
            </form>
          )}

          {forgotStep === 'otp' && (
            <form onSubmit={handleForgotResetSubmit} className="space-y-4">
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl flex items-start gap-3">
                <Mail className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                <div className="text-xs text-brand-900 leading-relaxed">
                  <p className="font-semibold">Enter Verification Code</p>
                  <p className="text-brand-700 mt-0.5">
                    A 6-digit code was sent to <strong>{forgotEmail || email}</strong>.
                  </p>
                </div>
              </div>

              {forgotDevOtp && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-amber-800 font-medium">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Dev Preview Code: <strong className="font-mono text-amber-950">{forgotDevOtp}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotOtpCode(forgotDevOtp)}
                    className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={forgotOtpCode}
                  onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-10 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  Verify & Reset Password
                </Button>
              </div>
            </form>
          )}

          {forgotStep === 'success' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Password Reset Successful!</h4>
              <p className="text-xs text-gray-600">
                Your password has been updated. You can now proceed to sign in with your new credentials.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setIsForgotOpen(false);
                  navigate('/login');
                }}
                className="w-full mt-2"
              >
                Go to Sign In
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

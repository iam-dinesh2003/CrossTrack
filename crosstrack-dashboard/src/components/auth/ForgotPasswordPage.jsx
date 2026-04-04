import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, KeyRound, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as authService from '../../services/authService';

const STEPS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'otp', label: 'Verify OTP', icon: ShieldCheck },
  { id: 'reset', label: 'New Password', icon: KeyRound },
];

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0); // 0 = email, 1 = otp, 2 = new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // Auto-focus first OTP input on step change
  useEffect(() => {
    if (step === 1) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return toast.error('Enter your email');
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email.trim());
      toast.success(data.message || 'OTP sent to your email!');
      setStep(1);
      setResendTimer(60);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste — spread digits across boxes
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    // Auto-advance to next box
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) return toast.error('Enter the 6-digit code');
    setLoading(true);
    try {
      await authService.verifyOtp(email.trim(), otpString);
      toast.success('Code verified!');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e?.preventDefault();
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const otpString = otp.join('');
      const data = await authService.resetPassword(email.trim(), otpString, newPassword);
      toast.success(data.message || 'Password reset successfully!');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  return (
    <div className="min-h-screen flex animated-gradient relative overflow-hidden">
      {/* Floating orbs */}
      <div className="orb w-72 h-72 bg-indigo-500/30 top-20 left-20" style={{ animation: 'float-up 20s linear infinite' }} />
      <div className="orb w-96 h-96 bg-purple-500/20 bottom-20 right-10" style={{ animation: 'float-up 25s linear infinite 5s' }} />

      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative z-10">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CrossTrack</h1>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Reset your password<br />
            <span className="text-indigo-300">in 3 simple steps.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            We'll send a 6-digit verification code to your email.
            Enter it to verify your identity and set a new password.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-[440px] border border-white/10 relative overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          {/* Back link */}
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition mb-6 font-medium">
            <ArrowLeft size={16} /> Back to Sign In
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50' :
                  'bg-gray-100 text-gray-400'
                )}>
                  {i < step ? <CheckCircle2 size={16} /> : <s.icon size={14} />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx('flex-1 h-0.5 rounded-full transition-all', i < step ? 'bg-emerald-400' : 'bg-gray-100')} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Enter Email */}
          {step === 0 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Forgot Password?</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send you a verification code.</p>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={16} />}
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 1: Enter OTP */}
          {step === 1 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Enter Verification Code</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We sent a 6-digit code to <span className="font-semibold text-indigo-600">{email}</span>
                </p>
              </div>

              {/* OTP Input Boxes */}
              <div className="flex gap-2.5 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={clsx(
                      'w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all',
                      digit
                        ? 'border-indigo-400 bg-indigo-50/50 text-indigo-700'
                        : 'border-gray-200 bg-gray-50 text-gray-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                    )}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={16} />}
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className={clsx(
                    'text-sm font-medium transition',
                    resendTimer > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-700'
                  )}
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: New Password */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
                <p className="text-sm text-gray-500 mt-1">Choose a strong password for your account.</p>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className={clsx(
                    'w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm outline-none transition-all',
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-rose-300 focus:ring-2 focus:ring-rose-100 focus:border-rose-400'
                      : 'border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  )}
                  placeholder="Confirm your password"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-rose-500 mt-1 font-medium">Passwords do not match</p>
                )}
              </div>

              {/* Password strength indicator */}
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={clsx(
                        'h-1.5 flex-1 rounded-full transition-all',
                        newPassword.length >= level * 3
                          ? level <= 1 ? 'bg-rose-400' : level <= 2 ? 'bg-amber-400' : level <= 3 ? 'bg-emerald-400' : 'bg-emerald-500'
                          : 'bg-gray-100'
                      )}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">
                  {newPassword.length === 0 ? '' :
                   newPassword.length < 6 ? 'Too short' :
                   newPassword.length < 8 ? 'Fair' :
                   newPassword.length < 12 ? 'Good' : 'Strong'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={16} />}
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Sparkles, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as authService from '../../services/authService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Admin 2FA state
  const [step, setStep] = useState(0); // 0 = login form, 1 = admin OTP
  const [pendingAdminEmail, setPendingAdminEmail] = useState('');
  const [adminOtp, setAdminOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const { loginWithData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (step === 1) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      if (data.adminOtpRequired) {
        // Admin detected — show OTP step
        setPendingAdminEmail(data.pendingEmail);
        setStep(1);
        toast.success('Verification code sent to your email');
      } else {
        loginWithData(data);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminOtpChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...adminOtp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setAdminOtp(newOtp);
      otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    const newOtp = [...adminOtp];
    newOtp[index] = value.replace(/\D/g, '');
    setAdminOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleAdminOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !adminOtp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleAdminOtpSubmit = async (e) => {
    e.preventDefault();
    const otpString = adminOtp.join('');
    if (otpString.length !== 6) return toast.error('Enter the 6-digit code');
    setLoading(true);
    try {
      const data = await authService.adminVerifyOtp(pendingAdminEmail, otpString);
      loginWithData(data);
      toast.success('Admin access granted');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex animated-gradient relative overflow-hidden">
      {/* Floating orbs */}
      <div className="orb w-72 h-72 bg-indigo-500/30 top-20 left-20" style={{ animation: 'float-up 20s linear infinite' }} />
      <div className="orb w-96 h-96 bg-purple-500/20 bottom-20 right-10" style={{ animation: 'float-up 25s linear infinite 5s' }} />
      <div className="orb w-48 h-48 bg-cyan-500/20 top-1/2 left-1/3" style={{ animation: 'float-up 18s linear infinite 8s' }} />

      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 relative z-10">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CrossTrack</h1>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Track every application.<br />
            <span className="text-indigo-300">Land your dream job.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Auto-detect applications across LinkedIn, Indeed, and Handshake.
            Smart duplicate detection. Ghost job tracking. All in one place.
          </p>

          <div className="mt-10 flex items-center gap-6">
            <div className="flex -space-x-2">
              {['#6366F1', '#8B5CF6', '#06B6D4', '#10B981'].map((color, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-navy-700 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: color }}>{String.fromCharCode(65 + i)}</div>
              ))}
            </div>
            <p className="text-sm text-slate-500">Trusted by 500+ job seekers</p>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-[420px] border border-white/10 relative overflow-hidden">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

          {/* Step 0: Email + Password */}
          {step === 0 && (
            <>
              <div className="text-center mb-8">
                <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">CrossTrack</h1>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
                <p className="text-gray-500 mt-1 text-sm">Sign in to continue tracking</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all"
                    placeholder="you@example.com" />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all pr-11"
                      placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <Link to="/forgot-password" className="text-xs text-indigo-600 font-medium hover:text-indigo-700 transition">
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group btn-press">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-8">
                Don't have an account?{' '}
                <Link to="/register" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">
                  Create account
                </Link>
              </p>
            </>
          )}

          {/* Step 1: Admin OTP Verification */}
          {step === 1 && (
            <form onSubmit={handleAdminOtpSubmit} className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                  <ShieldCheck size={28} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Verification</h2>
                <p className="text-sm text-gray-500 mt-1">
                  A 6-digit code was sent to{' '}
                  <span className="font-semibold text-indigo-600">{pendingAdminEmail}</span>
                </p>
              </div>

              <div className="flex gap-2.5 justify-center">
                {adminOtp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleAdminOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleAdminOtpKeyDown(i, e)}
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
                disabled={loading || adminOtp.join('').length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={16} />}
                {loading ? 'Verifying...' : 'Verify & Access Admin'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(0); setAdminOtp(['', '', '', '', '', '']); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

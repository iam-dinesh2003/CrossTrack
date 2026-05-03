import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Sparkles, Eye, EyeOff, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const checks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'Passwords match', valid: password && confirm && password === confirm },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center animated-gradient relative overflow-hidden px-4">
      {/* Floating orbs */}
      <div className="orb w-72 h-72 bg-purple-500/30 top-10 right-20" style={{ animation: 'float-up 22s linear infinite' }} />
      <div className="orb w-64 h-64 bg-indigo-500/20 bottom-10 left-20" style={{ animation: 'float-up 26s linear infinite 3s' }} />

      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-[460px] border border-white/10 relative z-10 overflow-hidden">
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CrossTrack</h1>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
          <p className="text-gray-500 mt-1 text-sm">Start tracking your job applications</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Display Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all"
              placeholder="Your name" />
          </div>
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
                placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm input-glow outline-none transition-all"
              placeholder="Repeat password" />
          </div>

          {/* Password strength checks */}
          {password && (
            <div className="flex gap-4">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium">
                  {c.valid ? <Check size={12} className="text-emerald-500" /> : <X size={12} className="text-gray-300" />}
                  <span className={c.valid ? 'text-emerald-600' : 'text-gray-400'}>{c.label}</span>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group mt-2 btn-press">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Create Account <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
            )}
          </button>
        </form>

        {/* Gmail sync notice */}
        <div className="mt-5 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200/80 rounded-xl">
          <span className="text-amber-500 text-[15px] flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-[12px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Gmail sync requires access approval.</span> After signing up, go to{' '}
            <span className="font-medium">Settings → Gmail Sync</span> and click{' '}
            <span className="font-medium">"Request Gmail Access"</span> — you'll be added within 24 hours.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

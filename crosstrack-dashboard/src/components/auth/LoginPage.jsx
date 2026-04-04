import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
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
        </div>
      </div>
    </div>
  );
}

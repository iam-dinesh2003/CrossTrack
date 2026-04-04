import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Brain, Globe, Loader2, Gauge } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import coachService from '../../services/coachService';
import aiService from '../../services/aiService';
import toast from 'react-hot-toast';

const CATEGORY_COLORS = {
  SKILL: 'bg-blue-50 text-blue-700 border-blue-200',
  PREFERENCE: 'bg-purple-50 text-purple-700 border-purple-200',
  EXPERIENCE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  GOAL: 'bg-amber-50 text-amber-700 border-amber-200',
  FEEDBACK: 'bg-rose-50 text-rose-700 border-rose-200',
  STRENGTH: 'bg-teal-50 text-teal-700 border-teal-200',
  WEAKNESS: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function CoachPage() {
  const [message, setMessage] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [showMemory, setShowMemory] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: memories = [] } = useQuery({
    queryKey: ['memories'],
    queryFn: () => coachService.getMemories(),
  });

  const { data: usage } = useQuery({
    queryKey: ['aiUsage'],
    queryFn: () => aiService.getUsage(),
    refetchInterval: 60000,
  });

  const chatMutation = useMutation({
    mutationFn: (msg) => coachService.sendMessage(msg, sessionId, webSearchEnabled),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['aiUsage'] });
    },
    onError: (err) => {
      if (err.response?.status === 429) {
        toast.error('Daily chat limit reached! Resets at midnight.');
      } else {
        toast.error('Failed to get response');
      }
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => coachService.clearHistory(),
    onSuccess: () => { setMessages([]); toast.success('Chat history cleared'); },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (id) => coachService.deleteMemory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['memories'] }); toast.success('Memory removed'); },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    chatMutation.mutate(message);
    setMessage('');
    inputRef.current?.focus();
  };

  const chatRemaining = usage?.chat?.remaining ?? '—';
  const searchRemaining = usage?.search?.remaining ?? '—';
  const aiConfigured = usage?.aiConfigured !== false;

  return (
    <div className="flex gap-6 h-[calc(100vh-130px)]">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* AI Not Configured Banner */}
        {!aiConfigured && (
          <div className="px-6 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center gap-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800">AI not configured yet</p>
              <p className="text-[11px] text-amber-600">
                Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">aistudio.google.com</a>,
                then restart with: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono">AI_API_KEY=your-key ./mvnw spring-boot:run</code>
              </p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">CrossTrack AI Coach</h2>
              <p className="text-[11px] text-slate-400">Your personal career advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Usage Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-slate-400 bg-slate-50 rounded-lg border border-slate-100"
                 title="Daily limits reset at midnight">
              <Gauge size={12} /> {chatRemaining} chats · {searchRemaining} searches left
            </div>
            {/* Web Search Toggle */}
            <button onClick={() => setWebSearchEnabled(!webSearchEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                webSearchEnabled
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50'
                  : 'text-slate-400 bg-slate-50 border border-slate-200 hover:border-indigo-300'
              }`} title={webSearchEnabled ? 'Web search ON — coach can search the internet' : 'Web search OFF — coach uses only your data'}>
              <Globe size={14} /> {webSearchEnabled ? 'Web ON' : 'Web OFF'}
            </button>
            {/* Memory Toggle */}
            <button onClick={() => setShowMemory(!showMemory)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
              <Brain size={14} /> Memory {memories.length > 0 && `(${memories.length})`}
            </button>
            <button onClick={() => clearMutation.mutate()}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
              title="Clear chat history">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Hi! I'm your Career Coach</h3>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                I know your applications, resume, and career goals. Ask me anything about your job search!
                {webSearchEnabled && <span className="block mt-1 text-indigo-400">🌐 Web search is ON — I can look up salaries, company info, and market trends.</span>}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'What should I focus on?',
                  'Help me with my resume',
                  ...(webSearchEnabled ? ['What\'s the avg SWE salary at Google?', 'Research Stripe\'s culture'] : ['How are my applications doing?', 'Prepare me for an interview'])
                ].map(q => (
                  <button key={q} onClick={() => { setMessage(q); }}
                    className="px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition border border-indigo-100">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-fade-in`}>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-br-md'
                  : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex justify-start message-fade-in">
              <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="typing-dot"></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  {webSearchEnabled && <span className="text-[10px] text-indigo-400 ml-1">Searching web...</span>}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition">
            {webSearchEnabled && <Globe size={14} className="text-indigo-400 flex-shrink-0" />}
            <input
              ref={inputRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={webSearchEnabled ? "Ask anything — I can search the web..." : "Ask your career coach anything..."}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
            />
            <button onClick={handleSend} disabled={chatMutation.isPending || !message.trim()}
              className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {chatMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Memory Sidebar */}
      {showMemory && (
        <div className="w-80 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Brain size={16} className="text-indigo-500" /> Career Memory
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Facts I've learned about you</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {memories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">No memories yet</p>
                <p className="text-xs text-slate-300 mt-1">Chat with me to build your career profile!</p>
              </div>
            ) : (
              memories.map(m => (
                <div key={m.id} className="group p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-600 leading-relaxed">{m.fact}</p>
                    <button onClick={() => deleteMemoryMutation.mutate(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded-full border ${CATEGORY_COLORS[m.category] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {m.category}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

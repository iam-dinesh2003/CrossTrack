import { useState, useRef } from 'react';
import { FileText, Upload, Star, Trash2, Eye, Loader2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import resumeService from '../../services/resumeService';
import toast from 'react-hot-toast';

export default function ResumesPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: resumes = [], isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumeService.list(),
  });

  const uploadMutation = useMutation({
    mutationFn: () => resumeService.upload(selectedFile, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setShowUpload(false); setName(''); setSelectedFile(null);
      toast.success('Resume uploaded! Text extracted automatically.');
    },
    onError: () => toast.error('Upload failed'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id) => resumeService.setDefault(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resumes'] }); toast.success('Default resume updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => resumeService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resumes'] }); toast.success('Resume deleted'); },
  });

  const handlePreview = async (id) => {
    if (previewId === id) { setPreviewId(null); return; }
    try {
      const data = await resumeService.getText(id);
      setPreviewText(data.text || 'No parsed text available');
      setPreviewId(id);
    } catch { toast.error('Failed to load resume text'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Resume Variants</h2>
            <p className="text-[11px] text-slate-400">Manage multiple resume versions for different roles</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:shadow-lg hover:shadow-indigo-200/50 transition-all">
          <Upload size={16} /> Upload Resume
        </button>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Upload Resume</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Resume Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., SWE Resume, ML Resume"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Resume File</label>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={e => setSelectedFile(e.target.files[0])} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3.5 py-6 text-sm text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition text-center">
                  {selectedFile ? <span className="text-slate-600">{selectedFile.name}</span> : 'Click to select file (PDF, DOC, DOCX)'}
                </button>
              </div>
              <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-500" />
                  <span className="font-medium">Text is auto-extracted</span> — upload a PDF or DOCX and we'll read the text automatically for AI features.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => { setShowUpload(false); setSelectedFile(null); setName(''); }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">Cancel</button>
              <button onClick={() => uploadMutation.mutate()} disabled={!name.trim() || !selectedFile || uploadMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:shadow-lg disabled:opacity-50 transition-all">
                {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
      ) : resumes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
            <FileText size={24} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No resumes uploaded</h3>
          <p className="text-sm text-slate-400">Upload your resume to unlock AI-powered match scoring and cover letter generation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {resumes.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      r.isDefault ? 'bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200/50' : 'bg-slate-100'
                    }`}>
                      <FileText size={18} className={r.isDefault ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700">{r.name}</h4>
                      <p className="text-[11px] text-slate-400">{r.fileName} · {new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {r.isDefault && (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-full border border-indigo-200">Default</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  {!r.isDefault && (
                    <button onClick={() => setDefaultMutation.mutate(r.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">
                      <Star size={12} /> Set Default
                    </button>
                  )}
                  <button onClick={() => handlePreview(r.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                    <Eye size={12} /> {previewId === r.id ? 'Hide' : 'Preview'}
                  </button>
                  <button onClick={() => deleteMutation.mutate(r.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition ml-auto">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              {previewId === r.id && (
                <div className="px-5 pb-5">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-60 overflow-y-auto">
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{previewText}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

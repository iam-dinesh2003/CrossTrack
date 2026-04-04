import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Briefcase, Building2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as applicationService from '../../services/applicationService';

export default function AddApplicationModal({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    company: '', role: '', platform: 'LINKEDIN', url: '', location: '', salary: '', notes: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => applicationService.createApplication(data),
    onSuccess: async (data) => {
      // Upload files if selected
      try {
        if (resumeFile) await applicationService.uploadResume(data.id, resumeFile);
        if (coverLetterFile) await applicationService.uploadCoverLetter(data.id, coverLetterFile);
      } catch (err) {
        toast.error('Application added but file upload failed');
      }
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application added!');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add application'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      toast.error('Company and role are required');
      return;
    }
    mutation.mutate(form);
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100/50 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <Briefcase size={16} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Add Application</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company *</label>
              <input value={form.company} onChange={update('company')} placeholder="e.g. Google"
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition placeholder:text-gray-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role *</label>
              <input value={form.role} onChange={update('role')} placeholder="e.g. Software Engineer"
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition placeholder:text-gray-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Platform</label>
              <select value={form.platform} onChange={update('platform')}
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition cursor-pointer">
                <option value="LINKEDIN">LinkedIn</option>
                <option value="INDEED">Indeed</option>
                <option value="HANDSHAKE">Handshake</option>
                <option value="GREENHOUSE">Greenhouse</option>
                <option value="LEVER">Lever</option>
                <option value="WORKDAY">Workday</option>
                <option value="COMPANY_DIRECT">Company Website</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
              <input value={form.location} onChange={update('location')} placeholder="e.g. San Francisco, CA"
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition placeholder:text-gray-300" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Job URL</label>
            <input value={form.url} onChange={update('url')} placeholder="https://..."
              className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition placeholder:text-gray-300" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Salary Range</label>
            <input value={form.salary} onChange={update('salary')} placeholder="e.g. $120k - $150k"
              className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition placeholder:text-gray-300" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={update('notes')} rows={2} placeholder="Any notes about this application..."
              className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition resize-none placeholder:text-gray-300" />
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Resume (optional)</label>
              <label className={clsx(
                'flex items-center justify-center gap-2 w-full px-3 py-3.5 border-2 border-dashed rounded-xl text-sm cursor-pointer transition-all',
                resumeFile
                  ? 'border-indigo-300 bg-indigo-50/50 text-indigo-600'
                  : 'border-gray-200/80 bg-gray-50/30 text-gray-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/30'
              )}>
                <Upload size={16} />
                <span className="truncate font-medium">{resumeFile ? resumeFile.name : 'Choose PDF/DOC'}</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files[0] || null)} />
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cover Letter (optional)</label>
              <label className={clsx(
                'flex items-center justify-center gap-2 w-full px-3 py-3.5 border-2 border-dashed rounded-xl text-sm cursor-pointer transition-all',
                coverLetterFile
                  ? 'border-emerald-300 bg-emerald-50/50 text-emerald-600'
                  : 'border-gray-200/80 bg-gray-50/30 text-gray-400 hover:border-emerald-200 hover:text-emerald-500 hover:bg-emerald-50/30'
              )}>
                <Upload size={16} />
                <span className="truncate font-medium">{coverLetterFile ? coverLetterFile.name : 'Choose PDF/DOC'}</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx"
                  onChange={(e) => setCoverLetterFile(e.target.files[0] || null)} />
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200/80 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200/50 transition-all disabled:opacity-50">
              {mutation.isPending ? 'Adding...' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

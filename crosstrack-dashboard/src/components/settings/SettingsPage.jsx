import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { User, Bell, Shield, Palette, Save, Check, Mail, RefreshCw, Unlink, Loader2, Plus, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as gmailService from '../../services/gmailService';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelValue, setLabelValue] = useState('');

  // Listen for OAuth callback from popup window
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'GMAIL_AUTH_CODE' && event.data?.code) {
        try {
          await gmailService.sendAuthCode(event.data.code);
          toast.success('Gmail account connected!');
          queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
          setActiveTab('gmail');
        } catch (err) {
          toast.error('Failed to connect Gmail');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    ghostAlerts: true,
    weeklyDigest: false,
    browserNotifications: true,
  });

  const [preferences, setPreferences] = useState({
    ghostThreshold: 21,
    defaultPlatform: 'LINKEDIN',
    autoDetect: true,
  });

  // Gmail status query
  const { data: gmailStatus, isLoading: gmailLoading } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: gmailService.getGmailStatus,
    retry: false,
  });

  const accounts = gmailStatus?.accounts || [];
  const connectedAccounts = accounts.filter(a => a.connected);

  // Connect Gmail mutation (opens OAuth popup)
  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      const data = await gmailService.getAuthUrl();
      const popup = window.open(data.url, 'gmail-oauth', 'width=600,height=700,left=200,top=100');

      return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(timer);
            queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
            resolve();
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(timer);
          reject(new Error('OAuth timed out'));
        }, 300000);
      });
    },
    onSuccess: () => {
      toast.success('Gmail account connected!');
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: (err) => {
      if (err.message !== 'OAuth timed out') {
        toast.error('Failed to connect Gmail');
      }
    },
  });

  // Scan emails mutation
  const scanMutation = useMutation({
    mutationFn: gmailService.scanEmails,
    onSuccess: (data) => {
      toast.success(`Scan complete: ${data.created} new, ${data.updated} updated out of ${data.totalScanned} emails`);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      const hint = err.response?.data?.hint || '';
      toast.error(`Scan failed: ${msg}${hint ? '\n' + hint : ''}`);
    },
  });

  // Disconnect specific account
  const disconnectAccountMutation = useMutation({
    mutationFn: (accountId) => gmailService.disconnectAccount(accountId),
    onSuccess: () => {
      toast.success('Gmail account disconnected');
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  // Disconnect all
  const disconnectAllMutation = useMutation({
    mutationFn: gmailService.disconnectGmail,
    onSuccess: () => {
      toast.success('All Gmail accounts disconnected');
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  // Update label
  const updateLabelMutation = useMutation({
    mutationFn: ({ accountId, label }) => gmailService.updateAccountLabel(accountId, label),
    onSuccess: () => {
      toast.success('Label updated');
      setEditingLabel(null);
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  const handleSave = () => {
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'gmail', label: 'Gmail Sync', icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="max-w-4xl">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 border border-gray-100/80 shadow-sm mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            )}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-gray-900">Profile Settings</h3>
            <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100/50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-indigo-200/50">
                {(profile.displayName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-900">{profile.displayName || 'User'}</p>
                <p className="text-sm text-gray-500">{profile.email}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Display Name</label>
              <input value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
              <input value={profile.email} disabled
                className="w-full px-4 py-2.5 bg-gray-100/50 border border-gray-200/80 rounded-xl text-sm text-gray-400 cursor-not-allowed" />
              <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed</p>
            </div>
          </div>
        )}

        {/* Gmail Sync Tab */}
        {activeTab === 'gmail' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Gmail Integration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Connect multiple Gmail accounts to catch job emails from all your inboxes.
                </p>
              </div>
              {connectedAccounts.length > 0 && (
                <button
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-200/50 transition-all disabled:opacity-50"
                >
                  {scanMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Scanning All...</>
                  ) : (
                    <><RefreshCw size={16} /> Scan All</>
                  )}
                </button>
              )}
            </div>

            {/* Connected Accounts List */}
            {gmailLoading ? (
              <div className="flex items-center gap-3 p-5">
                <Loader2 size={20} className="animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Loading accounts...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedAccounts.map(account => (
                  <div key={account.id} className="p-4 rounded-2xl border-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/30 border-emerald-200/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                          <Mail size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-emerald-800">{account.email}</p>
                            {account.label && (
                              <span className="text-xs bg-emerald-200/80 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                {account.label}
                              </span>
                            )}
                          </div>
                          {account.lastSync && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Last synced: {new Date(account.lastSync).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingLabel === account.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={labelValue}
                              onChange={e => setLabelValue(e.target.value)}
                              placeholder="e.g. Personal, College"
                              className="px-2.5 py-1.5 text-xs border border-gray-200/80 rounded-xl w-32 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  updateLabelMutation.mutate({ accountId: account.id, label: labelValue });
                                }
                                if (e.key === 'Escape') setEditingLabel(null);
                              }}
                            />
                            <button
                              onClick={() => updateLabelMutation.mutate({ accountId: account.id, label: labelValue })}
                              className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-md transition font-medium"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingLabel(account.id); setLabelValue(account.label || ''); }}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100/50 transition font-medium"
                            title="Add label"
                          >
                            <Tag size={12} /> {account.label ? 'Edit' : 'Label'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Disconnect ${account.email}?`)) {
                              disconnectAccountMutation.mutate(account.id);
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 transition font-medium"
                        >
                          <Unlink size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Another Account Button */}
                <button
                  onClick={() => connectGmailMutation.mutate()}
                  disabled={connectGmailMutation.isPending}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 text-sm font-semibold text-gray-400 hover:text-indigo-600"
                >
                  {connectGmailMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                  ) : (
                    <><Plus size={16} /> {connectedAccounts.length === 0 ? 'Connect Gmail Account' : 'Add Another Gmail Account'}</>
                  )}
                </button>
              </div>
            )}

            {/* How It Works */}
            <div className="p-5 bg-gradient-to-br from-indigo-50/80 to-purple-50/30 rounded-2xl border border-indigo-100/80">
              <h4 className="font-bold text-indigo-800 mb-3">How Multi-Account Scanning Works</h4>
              <div className="space-y-2.5">
                {[
                  { icon: '1', text: 'Connect your personal Gmail, college email, or any Gmail where you receive job emails' },
                  { icon: '2', text: 'LinkedIn uses a different email? No problem — add that Gmail too and we\'ll scan both' },
                  { icon: '3', text: '"Scan All" checks every connected account in one click — finds applications from all inboxes' },
                  { icon: '4', text: 'Add labels (Personal, College, Work) to keep track of which account is which' },
                  { icon: '5', text: 'We only read emails — we never send, delete, or modify anything in your inbox' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      {item.icon}
                    </span>
                    <p className="text-sm text-indigo-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scan Results */}
            {scanMutation.data && (
              <div className="p-5 bg-gradient-to-r from-emerald-50/80 to-teal-50/30 rounded-2xl border border-emerald-200/80">
                <h4 className="font-bold text-emerald-800 mb-3">Last Scan Results</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-extrabold text-emerald-600">{scanMutation.data.totalScanned}</p>
                    <p className="text-xs text-emerald-500 font-medium">Emails Scanned</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-blue-600">{scanMutation.data.created}</p>
                    <p className="text-xs text-blue-500 font-medium">New Applications</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-orange-600">{scanMutation.data.updated}</p>
                    <p className="text-xs text-orange-500 font-medium">Status Updated</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-gray-900">Notification Settings</h3>
            {[
              { key: 'browserNotifications', label: 'Browser Notifications', desc: 'Get desktop notifications for status changes' },
              { key: 'ghostAlerts', label: 'Ghost Job Alerts', desc: 'Alert when applications have no response after threshold' },
              { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive email notifications for important updates' },
              { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Get a weekly summary of your application activity' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100/50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                  className={clsx('w-12 h-7 rounded-full transition-all relative',
                    notifications[item.key] ? 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200/50' : 'bg-gray-300'
                  )}>
                  <span className={clsx('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                    notifications[item.key] ? 'left-[22px]' : 'left-0.5'
                  )} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-gray-900">Application Preferences</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Default Platform</label>
              <select value={preferences.defaultPlatform}
                onChange={e => setPreferences({ ...preferences, defaultPlatform: e.target.value })}
                className="w-48 px-4 py-2.5 bg-gray-50/50 border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition cursor-pointer">
                <option value="LINKEDIN">LinkedIn</option>
                <option value="INDEED">Indeed</option>
                <option value="HANDSHAKE">Handshake</option>
                <option value="COMPANY_DIRECT">Company Website</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold text-gray-900">Security</h3>
            <div className="p-5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100/50">
              <p className="text-sm font-bold text-gray-800">Change Password</p>
              <p className="text-xs text-gray-500 mb-4">Update your account password</p>
              <div className="space-y-3 max-w-sm">
                <input type="password" placeholder="Current password"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
                <input type="password" placeholder="New password"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
                <input type="password" placeholder="Confirm new password"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
              </div>
            </div>
            <div className="p-5 bg-gradient-to-r from-rose-50/80 to-red-50/30 rounded-2xl border-2 border-rose-200/80">
              <p className="text-sm font-bold text-rose-700">Danger Zone</p>
              <p className="text-xs text-rose-500 mb-4">These actions cannot be undone</p>
              <div className="flex gap-3">
                <button onClick={logout}
                  className="text-xs px-4 py-2.5 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition font-semibold">
                  Logout
                </button>
                <button className="text-xs px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-xl hover:shadow-lg hover:shadow-rose-200/50 transition-all font-semibold">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Button (not for Gmail tab) */}
        {activeTab !== 'gmail' && (
          <div className="mt-6 pt-5 border-t border-gray-100/80 flex justify-end">
            <button onClick={handleSave}
              className={clsx(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all',
                saved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200/50'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-200/50'
              )}>
              {saved ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

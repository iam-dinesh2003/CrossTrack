import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as gmailService from '../services/gmailService';

/**
 * Gmail OAuth Callback Page
 * Handles the case where OAuth redirect comes to the frontend (non-popup flow).
 * Reads the ?code= parameter and sends it to the backend.
 */
export default function GmailCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Connecting Gmail...');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setMessage('No authorization code received from Google.');
      return;
    }

    gmailService.sendAuthCode(code)
      .then(() => {
        setStatus('success');
        setMessage('Gmail connected successfully! Redirecting...');
        setTimeout(() => navigate('/settings'), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage('Failed to connect Gmail. Please try again.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
        {status === 'processing' && (
          <>
            <Loader2 size={48} className="mx-auto mb-4 text-primary-500 animate-spin" />
            <p className="text-gray-600 font-medium">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
            <p className="text-emerald-600 font-medium">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-500" />
            <p className="text-red-600 font-medium">{message}</p>
            <button onClick={() => navigate('/settings')}
              className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition">
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}

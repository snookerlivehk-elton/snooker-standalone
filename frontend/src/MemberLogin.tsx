import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import { loginMember, requestPasswordResetCode, resetPasswordWithCode } from './lib/api';

interface MemberLoginProps {
  mode?: 'member' | 'operator';
}

const MemberLogin: React.FC<MemberLoginProps> = ({ mode = 'member' }) => {
  const [view, setView] = useState<'login' | 'forgot-request' | 'forgot-reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot password states
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginMember(API_URL, { email: email.trim().toLowerCase(), password });
      const id = result?.id || result?.member?.id;
      const role = result?.role || result?.member?.role;
      
      if (!id) throw new Error('登入失敗');
      
      localStorage.setItem('memberSession', JSON.stringify({ email: email.trim().toLowerCase(), id, role }));
      
      if (mode === 'operator') {
        navigate('/operator/dashboard');
      } else {
        navigate(`/member/${id}`);
      }
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const onRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordResetCode(API_URL, email.trim().toLowerCase());
      setView('forgot-reset');
      setSuccessMsg('驗證碼已發送至您的 Email，請查收');
    } catch (err: any) {
      setError(err.message || '發送驗證碼失敗');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (newPassword !== confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithCode(API_URL, {
        email: email.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword
      });
      setView('login');
      setSuccessMsg('密碼重設成功，請使用新密碼登入');
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || '重設密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="text-center mb-6">
          <div className="text-xl font-bold text-yellow-400 uppercase tracking-wider">Snooker Live HK</div>
          <h2 className="text-2xl font-bold mt-1">
            {view === 'login' && (mode === 'operator' ? '操作員登入' : '會員登入')}
            {view === 'forgot-request' && '忘記密碼'}
            {view === 'forgot-reset' && '重設密碼'}
          </h2>
        </div>

        {view === 'login' && (
          <form onSubmit={onLogin} className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 lowercase"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 font-bold"
            >
              {loading ? '登入中...' : '登入'}
            </button>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <button type="button" onClick={() => {
                setView('forgot-request');
                setError(null);
                setSuccessMsg(null);
              }} className="hover:text-white underline">
                忘記密碼？
              </button>
              <button type="button" onClick={() => navigate('/members/register')} className="hover:text-white underline">
                註冊新帳號
              </button>
            </div>
          </form>
        )}

        {view === 'forgot-request' && (
          <form onSubmit={onRequestCode} className="grid gap-4">
            <p className="text-sm text-gray-300">請輸入您的註冊 Email，我們將發送驗證碼給您。</p>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 lowercase"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '發送中...' : '發送驗證碼'}
              </button>
            </div>
          </form>
        )}

        {view === 'forgot-reset' && (
          <form onSubmit={onResetPassword} className="grid gap-4">
            <div className="bg-gray-700 p-3 rounded text-sm mb-2">
              驗證碼已發送至 <span className="text-yellow-400 font-mono">{email}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">驗證碼</label>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
                placeholder="6位數字"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">新密碼</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
                placeholder="至少8位，含英數"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">確認新密碼</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('forgot-request')}
                className="flex-1 px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
              >
                上一步
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '重設中...' : '重設密碼'}
              </button>
            </div>
          </form>
        )}

        {error && <div className="text-red-400 mt-4 text-center p-2 bg-red-900/30 rounded border border-red-800/50">{error}</div>}
        {successMsg && <div className="text-green-400 mt-4 text-center p-2 bg-green-900/30 rounded border border-green-800/50">{successMsg}</div>}
      </div>
    </div>
  );
};

export default MemberLogin;

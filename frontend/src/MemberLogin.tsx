import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import { getMember } from './lib/api';

async function hashText(t: string): Promise<string> {
  const enc = new TextEncoder().encode(t);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

const MemberLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const storeRaw = localStorage.getItem('memberPasswords');
      const store = storeRaw ? JSON.parse(storeRaw) : {};
      const h = await hashText(password);
      const ok = store[email] && store[email] === h;
      if (!ok) throw new Error('帳號或密碼不正確');
      localStorage.setItem('memberSession', JSON.stringify({ email }));
      try {
        const data = await getMember(API_URL, email);
        if (data?.member?.id) {
          localStorage.setItem('memberSession', JSON.stringify({ email, id: data.member.id }));
          navigate(`/member/${data.member.id}`);
          return;
        }
      } catch {}
      navigate(`/member/${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-800 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">會員登入</h2>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
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
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        {error && <div className="text-red-400 mt-3 text-center">{error}</div>}
        <div className="text-xs text-gray-400 mt-3 text-center">
          忘記密碼？稍後可於會員頁面重設。
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={async () => {
              try {
                const h = await hashText(password);
                const storeRaw = localStorage.getItem('memberPasswords');
                const store = storeRaw ? JSON.parse(storeRaw) : {};
                store[email] = h;
                localStorage.setItem('memberPasswords', JSON.stringify(store));
                alert('已重設本地密碼，請再嘗試登入');
              } catch {}
            }}
            className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
          >
            重設本地密碼
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberLogin;

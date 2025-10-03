import React, { useEffect, useState } from 'react';
import { API_URL } from './config';

const AdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  // Auto-auth with saved token if present
  useEffect(() => {
    const saved = localStorage.getItem('adminToken') || '';
    if (!saved) return;
    fetch(`${API_URL}/admin/overview`, { headers: { 'x-admin-token': saved } })
      .then(res => { if (res.ok) setIsAuthenticated(true); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/overview`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error('驗證失敗：請確認管理員密鑰');
      localStorage.setItem('adminToken', token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || '登入失敗');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Admin Login</h1>
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium text-gray-300 mb-2">Admin Token</label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
            Enter
          </button>
          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          <p className="text-gray-400 text-xs mt-4 text-center">提示：後端需設定環境變數 ADMIN_TOKEN；本地未設定時可直接通過。</p>
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;
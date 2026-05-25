import React, { useState } from 'react';
import { API_URL } from './config';

const MemberRegisterSimple: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; memberCode: string | null } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!email.trim() || !name.trim()) {
        throw new Error('請輸入 Email 與 姓名');
      }
      const payload = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
      };
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/members/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `註冊失敗 (${res.status})`);
      }
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setError(e?.message || '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brand-page text-white p-8">
      <div className="max-w-xl mx-auto glass rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4 accent-yellow">簡化會員註冊</h1>
        <p className="text-sm text-gray-300/80 mb-4">直連後端 /api/members/register，不需驗證碼。</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600" required/>
          </div>
          <div>
            <label className="block text-sm mb-1">姓名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600" required/>
          </div>
          <div>
              <label className="block text-sm mb-1">電話（選填）</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"/>
            </div>
          <div>
              <label className="block text-sm mb-1">出生日期（選填）</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"/>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="px-4 py-2 rounded brand-button text-black disabled:opacity-50">{loading ? '提交中...' : '註冊'}</button>
          </div>
        </form>
        {error && <div className="text-red-400 mt-3">{error}</div>}
        {result && (
          <div className="mt-4 bg-black/40 border border-white/10 rounded p-3">
            <div>註冊成功！會員ID：{result.id}</div>
            <div>會員編碼：{result.memberCode || '-'}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberRegisterSimple;

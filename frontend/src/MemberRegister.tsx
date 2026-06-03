import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { API_URL } from './config';
import { loginGoogle, loginMember, registerMember } from './lib/api';
import Tabs from './components/Tabs';

const MemberRegister: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'email' | 'google'>('email');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const tabs = useMemo(() => {
    return [
      { key: 'email', label: 'Email 註冊' },
      { key: 'google', label: 'Google 登入' },
    ];
  }, []);

  const onGoogleSuccess = async (credentialResponse: any) => {
    setError(null);
    setLoading(true);
    try {
      const { credential } = credentialResponse;
      if (!credential) throw new Error('Google Login Failed');

      const result = await loginGoogle(API_URL, credential);
      const id = result?.id || result?.member?.id;
      const role = result?.role || result?.member?.role;
      const email = result?.member?.email;

      if (!id) throw new Error('登入失敗');

      localStorage.setItem('memberSession', JSON.stringify({ email: String(email || '').trim().toLowerCase(), id, role }));
      navigate(`/member/${id}`);
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const onEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }
    setLoading(true);
    try {
      const em = email.trim().toLowerCase();
      await registerMember(API_URL, {
        name: name.trim(),
        email: em,
        password,
        phone: phone.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
      });

      const result = await loginMember(API_URL, { email: em, password });
      const id = result?.id || result?.member?.id;
      const role = result?.role || result?.member?.role;
      if (!id) throw new Error('登入失敗');
      localStorage.setItem('memberSession', JSON.stringify({ email: em, id, role }));
      navigate(`/member/${id}`);
    } catch (err: any) {
      setError(err?.message || '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brand-page p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md glass rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="text-xl font-bold accent-yellow uppercase tracking-wider">Cue Aim System</div>
          <h2 className="text-2xl font-bold mt-1">會員註冊</h2>
          <div className="mt-2 text-sm cue-muted">支援 Email 註冊，亦可使用 Google。</div>
        </div>

        <Tabs items={tabs} activeKey={activeTab} onChange={(k) => setActiveTab(k as any)} />

        {activeTab === 'email' && (
          <form onSubmit={onEmailRegister} className="mt-5 grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 rounded cue-input lowercase"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
                required
              />
              <div className="mt-1 text-xs cue-muted">至少 8 字元，需含英文字母與數字</div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">確認密碼</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">電話（選填）</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">出生日期（選填）</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded cue-button disabled:opacity-50 font-bold"
            >
              {loading ? '提交中...' : '註冊並登入'}
            </button>
          </form>
        )}

        {activeTab === 'google' && (
          <div className="mt-5">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => setError('Google Login Failed')}
                theme="outline"
                text="signin_with"
                shape="pill"
              />
            </div>
          </div>
        )}

        {loading && <div className="mt-4 text-sm cue-muted text-center">處理中...</div>}
        {error && <div className="mt-4 text-sm text-red-500 text-center">{error}</div>}

        <div className="mt-6 flex flex-col gap-2 text-sm">
          <button
            type="button"
            onClick={() => navigate('/members/login')}
            className="rounded-md cue-surface-strong hover:brightness-95 px-3 py-2 transition-colors"
          >
            已有帳號？去登入
          </button>
          <button
            type="button"
            onClick={() => navigate('/venue/login')}
            className="rounded-md cue-surface-strong hover:brightness-95 px-3 py-2 transition-colors"
          >
            我是場館/球會管理員
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberRegister;

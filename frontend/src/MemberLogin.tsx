import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import { GoogleLogin } from '@react-oauth/google';
import { loginMember, loginGoogle, requestPasswordResetCode, resetPasswordWithCode } from './lib/api';
import Tabs from './components/Tabs';

interface MemberLoginProps {
  mode?: 'member' | 'venue';
}

const MemberLogin: React.FC<MemberLoginProps> = ({ mode = 'member' }) => {
  const [view, setView] = useState<'login' | 'forgot-request' | 'forgot-reset'>('login');
  const [method, setMethod] = useState<'email' | 'phone' | 'google'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+852');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Forgot password states
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      const v = sp.get('next') || '';
      return v.startsWith('/') ? v : '';
    } catch {
      return '';
    }
  }, [location.search]);

  const phoneOptions = useMemo(() => {
    return [
      { value: '+852', label: '香港 +852' },
      { value: '+853', label: '澳門 +853' },
      { value: '+86', label: '中國 +86' },
    ];
  }, []);

  const normalizePhoneE164 = useMemo(() => {
    return (country: string, number: string) => {
      const c = String(country || '').trim();
      const n = String(number || '').trim().replace(/[()\s\-\.]/g, '');
      const raw = `${c}${n}`.replace(/[()\s\-\.]/g, '').replace(/^00/, '+');
      const out = raw.startsWith('+') ? raw : `+${raw}`;
      if (!/^\+\d{6,20}$/.test(out)) return '';
      return out;
    };
  }, []);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const em = email.trim().toLowerCase();
      const phoneE164 = normalizePhoneE164(phoneCountry, phoneNumber);
      const result = await loginMember(API_URL, method === 'phone'
        ? { identifier: phoneE164, password }
        : { email: em, password }
      );
      const id = result?.id || result?.member?.id;
      const role = result?.role || result?.member?.role;
      
      if (!id) throw new Error('登入失敗');
      
      localStorage.setItem('memberSession', JSON.stringify({
        email: method === 'email' ? em : '',
        phone: method === 'phone' ? phoneE164 : '',
        id,
        role,
      }));
      
      if (mode === 'venue') {
        navigate('/venue/dashboard');
      } else {
        navigate(nextPath || `/member/${id}`);
      }
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

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

      if (mode === 'venue') {
        navigate('/venue/dashboard');
      } else {
        navigate(nextPath || `/member/${id}`);
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
    <div className="brand-page p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md glass rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="text-xl font-bold accent-yellow uppercase tracking-wider">Cue Aim System</div>
          <h2 className="text-2xl font-bold mt-1">
            {view === 'login' && (mode === 'venue' ? '場館/球會登入' : '會員登入')}
            {view === 'forgot-request' && '忘記密碼'}
            {view === 'forgot-reset' && '重設密碼'}
          </h2>
        </div>

        {view === 'login' && (
          <>
            <Tabs
              items={[
                { key: 'email', label: 'Email' },
                { key: 'phone', label: '手機' },
                { key: 'google', label: 'Google' },
              ]}
              activeKey={method}
              onChange={(k) => {
                setMethod(k as any);
                setError(null);
                setSuccessMsg(null);
              }}
            />

            {method !== 'google' && (
              <form onSubmit={onLogin} className="mt-5 grid gap-4">
                {method === 'email' && (
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
                )}

                {method === 'phone' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-sm font-medium mb-1">地區</label>
                      <select
                        value={phoneCountry}
                        onChange={(e) => setPhoneCountry(e.target.value)}
                        className="w-full px-3 py-2 rounded cue-input"
                      >
                        {phoneOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">手機號碼</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded cue-input"
                        placeholder="例如 91234567"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">密碼</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded cue-input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded cue-button disabled:opacity-50 font-bold"
                >
                  {loading ? '登入中...' : '登入'}
                </button>

                <div className="flex justify-between mt-2 text-sm cue-muted">
                  {method === 'email' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot-request');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="hover:brightness-95 underline"
                    >
                      忘記密碼？
                    </button>
                  ) : (
                    <div />
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/members/register')}
                    className="hover:brightness-95 underline"
                  >
                    首次使用？註冊
                  </button>
                </div>
              </form>
            )}

            {method === 'google' && (
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
                <div className="mt-3 text-center text-sm cue-muted">
                  <button type="button" onClick={() => navigate('/members/register')} className="hover:brightness-95 underline">
                    首次使用？註冊
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 text-center border-t pt-3" style={{ borderColor: 'var(--brand-border)' }}>
              {mode === 'member' ? (
                <button type="button" onClick={() => navigate('/venue/login')} className="text-sm accent-yellow hover:brightness-95">
                  我是場館/球會管理員？在此登入
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/members/login')} className="text-sm accent-yellow hover:brightness-95">
                  我是普通會員？在此登入
                </button>
              )}
            </div>
          </>
        )}

        {view === 'forgot-request' && (
          <form onSubmit={onRequestCode} className="grid gap-4">
            <p className="text-sm cue-muted">請輸入您的註冊 Email，我們將發送驗證碼給您。</p>
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="flex-1 px-4 py-2 rounded cue-surface-strong hover:brightness-95"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded cue-button disabled:opacity-50"
              >
                {loading ? '發送中...' : '發送驗證碼'}
              </button>
            </div>
          </form>
        )}

        {view === 'forgot-reset' && (
          <form onSubmit={onResetPassword} className="grid gap-4">
            <div className="cue-surface rounded p-3 text-sm mb-2">
              驗證碼已發送至 <span className="text-yellow-400 font-mono">{email}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">驗證碼</label>
              <input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
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
                className="w-full px-3 py-2 rounded cue-input"
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
                className="w-full px-3 py-2 rounded cue-input"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('forgot-request')}
                className="flex-1 px-4 py-2 rounded cue-surface-strong hover:brightness-95"
              >
                上一步
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 rounded cue-button disabled:opacity-50"
              >
                {loading ? '重設中...' : '重設密碼'}
              </button>
            </div>
          </form>
        )}

        {error && <div className="text-red-500 mt-4 text-center p-2 cue-surface rounded">{error}</div>}
        {successMsg && <div className="text-emerald-600 mt-4 text-center p-2 cue-surface rounded">{successMsg}</div>}
      </div>
    </div>
  );
};

export default MemberLogin;

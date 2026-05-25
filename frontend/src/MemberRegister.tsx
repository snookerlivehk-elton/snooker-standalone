import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { API_URL } from './config';
import { loginGoogle } from './lib/api';

const MemberRegister: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="brand-page p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md glass rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="text-xl font-bold accent-yellow uppercase tracking-wider">Cue Aim System</div>
          <h2 className="text-2xl font-bold mt-1">會員註冊 / 登入</h2>
          <div className="mt-2 text-sm cue-muted">推薦使用 Google 登入，無需 Email 驗證碼。</div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={() => setError('Google Login Failed')}
            theme="outline"
            text="signin_with"
            shape="pill"
          />
        </div>

        {loading && <div className="mt-4 text-sm cue-muted text-center">登入中...</div>}
        {error && <div className="mt-4 text-sm text-red-500 text-center">{error}</div>}

        <div className="mt-6 flex flex-col gap-2 text-sm">
          <button
            type="button"
            onClick={() => navigate('/members/login')}
            className="rounded-md cue-surface-strong hover:brightness-95 px-3 py-2 transition-colors"
          >
            使用 Email/密碼登入（備用）
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

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import { registerMember, resendVerificationEmail } from './lib/api';
import { DISTRICT_TABLE } from './districts';

const MemberRegister: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberCode, setMemberCode] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const navigate = useNavigate();

  const [region, setRegion] = useState<string>('');
  const regionOptions = [
    { key: 'H', label: '香港島 (H)' },
    { key: 'K', label: '九龍 (K)' },
    { key: 'N', label: '新界 (N)' },
    { key: 'I', label: '離島 (I)' },
  ];
  const regionDistricts = region ? (DISTRICT_TABLE as any)[region] || [] : [];
  const [usedBackend, setUsedBackend] = useState<string>(API_URL);
  const preferFallback = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('preferFallback') === '1')
    : false;
  const [attemptLog, setAttemptLog] = useState<string>('');

  const passwordHint = (() => {
    const v = password;
    const okLen = v.length >= 8;
    const hasNum = /\d/.test(v);
    const hasAlpha = /[A-Za-z]/.test(v);
    const match = v && v === confirmPassword;
    return {
      ok: okLen && hasNum && hasAlpha && match,
      okLen, hasNum, hasAlpha, match,
    };
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!passwordHint.ok) {
        throw new Error('密碼不符合規則（至少8字元，需含英文字母與數字，且兩次一致）');
      }
      const payload = {
        email: email.trim(),
        name: name.trim(),
        districtCode: district.trim(),
        phone: phone.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
      };
      let result: any;
      const primaryApi = API_URL;
      const fallbackApi = 'https://snooker-standalone-backend-production.up.railway.app';
      if (preferFallback) {
        setAttemptLog(`使用後備端點提交：${fallbackApi}`);
        result = await registerMember(fallbackApi, payload);
        setUsedBackend(fallbackApi);
      } else {
        try {
          setAttemptLog(`嘗試主要端點提交：${primaryApi}`);
          result = await registerMember(primaryApi, payload);
          setUsedBackend(primaryApi);
        } catch (primaryErr: any) {
          try {
            setAttemptLog((s) => (s ? s + '\n' : '') + `主要端點失敗（${primaryErr?.message || primaryErr}），改用後備端點：${fallbackApi}`);
            result = await registerMember(fallbackApi, payload);
            setUsedBackend(fallbackApi);
          } catch (fallbackErr: any) {
            setAttemptLog((s) => (s ? s + '\n' : '') + `後備端點也失敗（${fallbackErr?.message || fallbackErr}）`);
            throw primaryErr;
          }
        }
      }
      setMemberId(result.id);
      setMemberCode(result.memberCode || null);
      try {
        await resendVerificationEmail(usedBackend, email.trim());
        setInfoToast('已寄出驗證／確認信至你的 Email');
        setTimeout(() => setInfoToast(null), 4000);
      } catch {}
      try {
        const dirRaw = localStorage.getItem('memberDirectory');
        const dir = dirRaw ? JSON.parse(dirRaw) : {};
        dir[email.trim()] = {
          name: name.trim(),
          memberCode: result?.memberCode || null,
          districtCode: district.trim(),
        };
        localStorage.setItem('memberDirectory', JSON.stringify(dir));
      } catch {}
      try {
        const storeRaw = localStorage.getItem('memberPasswords');
        const store = storeRaw ? JSON.parse(storeRaw) : {};
        const enc = new TextEncoder().encode(password);
        const digest = await crypto.subtle.digest('SHA-256', enc);
        const arr = Array.from(new Uint8Array(digest));
        const h = arr.map(b => b.toString(16).padStart(2, '0')).join('');
        store[email.trim()] = h;
        localStorage.setItem('memberPasswords', JSON.stringify(store));
      } catch {}
    } catch (err: any) {
      try {
        const tmpId = (crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : String(Date.now());
        const tmpCode = `${district.trim() || 'TMP'}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
        const entry = { id: `local-${tmpId}`, email: email.trim(), name: name.trim(), districtCode: district.trim(), phone: phone.trim() || undefined, birthDate: birthDate.trim() || undefined, memberCode: tmpCode, createdAt: Date.now() };
        const prevRaw = localStorage.getItem('pendingRegistrations');
        const prev = prevRaw ? JSON.parse(prevRaw) : [];
        prev.push(entry);
        localStorage.setItem('pendingRegistrations', JSON.stringify(prev));
        try {
          const dirRaw2 = localStorage.getItem('memberDirectory');
          const dir2 = dirRaw2 ? JSON.parse(dirRaw2) : {};
          dir2[email.trim()] = {
            name: name.trim(),
            memberCode: tmpCode,
            districtCode: district.trim(),
          };
          localStorage.setItem('memberDirectory', JSON.stringify(dir2));
        } catch {}
        setMemberId(entry.id);
        setMemberCode(entry.memberCode);
        setError('目前後端不可用，已暫存本地等待同步');
        try {
          const storeRaw = localStorage.getItem('memberPasswords');
          const store = storeRaw ? JSON.parse(storeRaw) : {};
          const enc = new TextEncoder().encode(password);
          const digest = await crypto.subtle.digest('SHA-256', enc);
          const arr = Array.from(new Uint8Array(digest));
          const h = arr.map(b => b.toString(16).padStart(2, '0')).join('');
          store[email.trim()] = h;
          localStorage.setItem('memberPasswords', JSON.stringify(store));
        } catch {}
      } catch {
        setError(err.message || '註冊失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-3xl mx-auto bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">會員註冊</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              required
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">姓名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Chan Tai Man"
              required
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">地區（大區域）</label>
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); setDistrict(''); }}
              required
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            >
              <option value="">請選擇</option>
              {regionOptions.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">分區代碼</label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
              disabled={!region}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 disabled:opacity-50"
            >
              <option value="">{region ? '請選擇分區' : '請先選擇地區'}</option>
              {regionDistricts.map((d: any) => (
                <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
              ))}
            </select>
            {district && region && (
              <div className="text-xs text-gray-400 mt-1">
                已選分區：{district} — {regionDistricts.find((d: any) => d.code === district)?.name}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">電話（選填）</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9123 4567"
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">出生日期（選填）</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 字元，需包含英文字母與數字"
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
            <div className="text-xs mt-1">
              <span className={passwordHint.okLen ? 'text-green-400' : 'text-red-400'}>長度≥8</span>
              <span className="mx-2">•</span>
              <span className={passwordHint.hasAlpha ? 'text-green-400' : 'text-red-400'}>含字母</span>
              <span className="mx-2">•</span>
              <span className={passwordHint.hasNum ? 'text-green-400' : 'text-red-400'}>含數字</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">確認密碼</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600"
            />
            <div className={`text-xs mt-1 ${passwordHint.match ? 'text-green-400' : 'text-red-400'}`}>
              {passwordHint.match ? '兩次一致' : '兩次不一致'}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end mt-2">
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50">
              {loading ? '提交中...' : '註冊'}
            </button>
          </div>
        </form>
        {error && <div className="text-red-400 mt-3">{error}</div>}
        {infoToast && <div className="text-green-400 mt-3">{infoToast}</div>}
        {attemptLog && <pre className="mt-3 text-xs text-gray-400 whitespace-pre-wrap">{attemptLog}</pre>}
        {memberId && (
          <div className="mt-4 bg-gray-700 rounded p-3">
            <div>註冊成功！會員ID：{memberId}</div>
            {memberCode && <div>會員編碼：{memberCode}</div>}
            <div className="text-xs text-gray-300 mt-1">使用後端：{usedBackend}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => navigate(`/member/${memberId}`)} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">
                前往會員頁面
              </button>
              <a
                href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('會員註冊確認')}&body=${encodeURIComponent(`親愛的 ${name}：\n\n已成功註冊。會員編碼：${memberCode || ''}\nEmail：${email}\n分區：${district}\n電話：${phone || '-'}\n生日：${birthDate || '-'}\n\n如資料有誤請回覆本郵件更正。`)}`}
                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
              >
                以 Email 核對資料
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberRegister;

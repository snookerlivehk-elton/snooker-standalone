export function getMemberRegisterPageHtml() {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <title>Member Registration – Fixed</title>
      <style>
        :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; color-scheme: light dark; }
        body { margin: 0; background: #0f172a; color: #e2e8f0; }
        .wrap { max-width: 520px; margin: 0 auto; padding: 16px; }
        .card { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:16px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        .row { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
        label { font-size:12px; color:#9ca3af; }
        input, select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #374151; background: #0b1220; color: #e5e7eb; }
        input::placeholder { color:#6b7280; }
        button { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #1f2937; background: #2563eb; color: #e5e7eb; cursor: pointer; font-weight: 600; }
        .muted { color:#94a3b8; font-size:12px; }
        .log { background:#0b1220; border:1px solid #1f2937; border-radius:12px; padding:12px; white-space:pre-wrap; overflow:auto; max-height:240px; }
        .ok { color:#10b981; }
        .err { color:#ef4444; }
        .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 480px) { .grid-2 { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>會員註冊（已修復）</h1>
          <p class="muted">此頁由後端提供，所有請求為同源，適配手機排版。</p>

          <div class="row">
            <label>Email（必填）</label>
            <input id="email" type="email" placeholder="example@domain.com" />
          </div>
          <div class="row">
            <label>姓名（必填）</label>
            <input id="name" type="text" placeholder="您的姓名" />
          </div>
          <div class="row">
            <label>地區（必填，香港區份代碼）</label>
            <select id="district"></select>
            <p class="muted">示例：元朗區 → NYL</p>
          </div>
          <div class="grid-2">
            <div class="row">
              <label>電話（選填）</label>
              <input id="phone" type="tel" placeholder="9123 4567" />
            </div>
            <div class="row">
              <label>出生日期（選填）</label>
              <input id="birthDate" type="date" />
            </div>
          </div>

          <div class="row">
            <button id="btnRegister">提交註冊</button>
          </div>

          <div class="row">
            <div id="log" class="log"></div>
          </div>
        </div>
      </div>

      <script>
        const logEl = document.getElementById('log');
        function log(msg, cls) {
          const time = new Date().toLocaleTimeString();
          const div = document.createElement('div');
          div.className = cls || '';
          div.textContent = '[' + time + '] ' + msg;
          logEl.appendChild(div);
          logEl.scrollTop = logEl.scrollHeight;
        }

        async function loadDistricts() {
          try {
            const res = await fetch('/api/district-codes');
            const data = await res.json();
            const sel = document.getElementById('district');
            sel.innerHTML = '';
            for (const d of data.districts) {
              const opt = document.createElement('option');
              opt.value = d.code; opt.textContent = d.code + ' — ' + d.name;
              sel.appendChild(opt);
            }
          } catch (err) {
            log('載入地區失敗：' + (err?.message || err), 'err');
          }
        }

        async function register() {
          const emailEl = document.getElementById('email');
          const email = emailEl.value.trim().normalize('NFKC').toLowerCase();
          if (emailEl && typeof emailEl.value === 'string') {
            emailEl.value = email;
          }
          const name = document.getElementById('name').value.trim();
          const districtCode = document.getElementById('district').value.trim();
          const phone = document.getElementById('phone').value.trim();
          const birthDate = document.getElementById('birthDate').value.trim();

          if (!email || !name || !districtCode) {
            log('請填寫 email、姓名與地區。', 'err');
            return;
          }
          if (emailEl && typeof emailEl.checkValidity === 'function' && !emailEl.checkValidity()) {
            emailEl.reportValidity?.();
            log('email 格式不正確。', 'err');
            return;
          }

          try {
            const res = await fetch('/api/members/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ email, name, districtCode, phone: phone || undefined, birthDate: birthDate || undefined })
            });
            const ct = res.headers.get('content-type') || '';
            const isJson = ct.toLowerCase().includes('application/json');
            const data = isJson ? await res.json() : { errorText: await res.text() };
            if (!res.ok) {
              const msg = (data && (data.error || data.errorText)) ? (data.error || data.errorText) : res.statusText;
              log('註冊失敗：' + msg, 'err');
              return;
            }
            log('註冊成功！會員號：' + data.memberCode, 'ok');
          } catch (err) {
            log('註冊異常：' + (err?.message || err), 'err');
          }
        }

        document.getElementById('btnRegister').addEventListener('click', register);
        loadDistricts();
      </script>
    </body>
  </html>`;
}

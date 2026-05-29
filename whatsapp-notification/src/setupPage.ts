import type { NotifySample } from './testSamples.js';

export function setupPageHtml(
  qrDataUrl: string | null,
  status: { state: string; connected: boolean; linkedUser: string | null },
  samples: NotifySample[],
): string {
  const connected = status.connected;
  const qrBlock = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="WhatsApp QR" width="280" height="280" class="qr" />`
    : '<p class="muted">No QR yet — wait a few seconds and refresh.</p>';

  const sampleCards = samples
    .map(
      (s) => `
    <article class="card" data-id="${s.id}">
      <div class="card-top">
        <span class="badge">${s.page}</span>
        <h3>${s.label}</h3>
        <p class="muted">${s.payload.event}</p>
      </div>
      <button type="button" class="btn-send" data-id="${s.id}">Send test →</button>
    </article>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CLB WhatsApp — Setup &amp; Test</title>
  ${connected ? '' : '<meta http-equiv="refresh" content="8" />'}
  <style>
    :root {
      --bg: #faf8f3;
      --surface: #ffffff;
      --ink: #111827;
      --muted: #6b7280;
      --gold: #f5c518;
      --gold-dark: #d4a017;
      --green: #059669;
      --red: #dc2626;
      --border: #e8e4da;
      --shadow: 0 8px 30px rgba(17,24,39,.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 32px 20px 64px; }
    .hero {
      background: linear-gradient(135deg, #fff 0%, #fff9e6 100%);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 1.6rem; }
    .hero p { margin: 0; color: var(--muted); line-height: 1.6; }
    .status-ok { color: var(--green); font-weight: 700; margin-top: 12px; }
    .status-warn { color: #b45309; font-weight: 600; margin-top: 12px; }
    .qr { border-radius: 16px; border: 1px solid var(--border); margin-top: 16px; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }
    .panel h2 { margin: 0 0 6px; font-size: 1.2rem; }
    .panel > p { margin: 0 0 20px; color: var(--muted); font-size: .95rem; }
    .secret-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
    input[type="password"], input[type="text"] {
      flex: 1;
      min-width: 220px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      font: inherit;
    }
    .btn {
      border: 0;
      border-radius: 12px;
      padding: 12px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: transform .15s, opacity .15s;
    }
    .btn:active { transform: scale(.98); }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-gold { background: var(--gold); color: var(--ink); }
    .btn-gold:hover { background: var(--gold-dark); }
    .btn-outline { background: #fff; border: 1px solid var(--border); color: var(--ink); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 14px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-top h3 { margin: 8px 0 4px; font-size: 1rem; }
    .badge {
      display: inline-block;
      font-size: .72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      background: #fff8dc;
      color: #92400e;
      padding: 4px 8px;
      border-radius: 999px;
    }
    .muted { color: var(--muted); font-size: .85rem; margin: 0; }
    .btn-send {
      margin-top: auto;
      width: 100%;
      padding: 10px;
      border: 0;
      border-radius: 10px;
      background: var(--ink);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-send:hover { background: #000; }
    .btn-send.loading { opacity: .6; pointer-events: none; }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      max-width: 360px;
      padding: 14px 18px;
      border-radius: 14px;
      background: var(--ink);
      color: #fff;
      font-size: .9rem;
      box-shadow: var(--shadow);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity .25s, transform .25s;
      pointer-events: none;
      z-index: 99;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.err { background: var(--red); }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    ol { line-height: 1.7; color: var(--muted); padding-left: 20px; }
    footer { text-align: center; color: var(--muted); font-size: .82rem; margin-top: 32px; }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>CLB WhatsApp notifications</h1>
      <p>Admin alerts for deposits, withdrawals, users, payments &amp; loans.</p>
      ${
        connected
          ? `<p class="status-ok">✓ WhatsApp linked${status.linkedUser ? ` (${status.linkedUser})` : ''}</p>`
          : `<p class="status-warn">Scan QR with WhatsApp → Linked devices → Link a device</p>
             ${qrBlock}
             <ol>
               <li>Open WhatsApp on your phone</li>
               <li>Settings → Linked devices → Link a device</li>
               <li>Scan the QR above (auto-refreshes every 8s)</li>
             </ol>`
      }
      <p class="muted" style="margin-top:12px">Status: <strong>${status.state}</strong> · <a href="/health">/health</a></p>
    </section>

    ${
      connected
        ? `<section class="panel">
      <h2>Test notifications</h2>
      <p>Send sample alerts one-by-one — each uses a unique WhatsApp template for its admin page.</p>
      <div class="secret-row">
        <input type="password" id="secret" placeholder="WHATSAPP_NOTIFY_SECRET" autocomplete="off" />
        <button type="button" class="btn btn-outline" id="saveSecret">Save</button>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-gold" id="sendAll">Send all ${samples.length} tests (spaced 3s)</button>
      </div>
      <div class="grid" id="grid">${sampleCards}</div>
    </section>`
        : ''
    }
  </div>
  <div class="toast" id="toast"></div>
  ${
    connected
      ? `<script>
    const toast = document.getElementById('toast');
    const secretInput = document.getElementById('secret');
    secretInput.value = localStorage.getItem('clb_notify_secret') || '';
    document.getElementById('saveSecret').onclick = () => {
      localStorage.setItem('clb_notify_secret', secretInput.value.trim());
      showToast('Secret saved locally');
    };
    function showToast(msg, err) {
      toast.textContent = msg;
      toast.className = 'toast show' + (err ? ' err' : '');
      setTimeout(() => toast.classList.remove('show'), 3500);
    }
    function secret() {
      const v = secretInput.value.trim() || localStorage.getItem('clb_notify_secret') || '';
      if (!v) throw new Error('Enter WHATSAPP_NOTIFY_SECRET first');
      return v;
    }
    async function sendSample(id, btn) {
      try {
        if (btn) { btn.classList.add('loading'); btn.textContent = 'Sending…'; }
        const res = await fetch('/api/notify/sample/' + id, {
          method: 'POST',
          headers: { 'X-Notify-Secret': secret() },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Send failed');
        showToast('Sent: ' + id.replace(/_/g, ' '));
      } catch (e) {
        showToast(e.message || 'Failed', true);
      } finally {
        if (btn) { btn.classList.remove('loading'); btn.textContent = 'Send test →'; }
      }
    }
    document.querySelectorAll('.btn-send').forEach((btn) => {
      btn.onclick = () => sendSample(btn.dataset.id, btn);
    });
    document.getElementById('sendAll').onclick = async function() {
      this.disabled = true;
      this.textContent = 'Sending all…';
      try {
        const res = await fetch('/api/notify/test-all', {
          method: 'POST',
          headers: { 'X-Notify-Secret': secret() },
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Batch failed');
        showToast('Sent ' + data.sent + ' notifications');
      } catch (e) {
        showToast(e.message || 'Batch failed', true);
      } finally {
        this.disabled = false;
        this.textContent = 'Send all ${samples.length} tests (spaced 3s)';
      }
    };
  </script>`
      : ''
  }
  <footer>CLB Admin · WhatsApp notification service</footer>
</body>
</html>`;
}

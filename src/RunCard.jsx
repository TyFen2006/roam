import { useEffect, useRef, useState } from 'react';
import './RunCard.css';

// Story-format card (9:16) so it drops straight into a Snap/IG story.
const W = 1080, H = 1920;

const MOOD_TINT = { Together: '#e8a33d', Explore: '#7fb0b6', Scenic: '#3f8f6d', Chill: '#33a08f', Imported: '#8f9db4' };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Project a [lng,lat][] route into a pixel box, preserving shape (cos-lat
// correction) and flipping Y so north is up.
function fitRoute(route, box) {
  const latAvg = route.reduce((a, p) => a + p[1], 0) / route.length;
  const k = Math.cos(latAvg * Math.PI / 180) || 1;
  const pts = route.map(([lng, lat]) => [lng * k, lat]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const w = (maxX - minX) || 1e-6, h = (maxY - minY) || 1e-6;
  const scale = Math.min(box.w / w, box.h / h);
  const drawW = w * scale, drawH = h * scale;
  const offX = box.x + (box.w - drawW) / 2;
  const offY = box.y + (box.h - drawH) / 2;
  return pts.map(([x, y]) => [offX + (x - minX) * scale, offY + (maxY - y) * scale]);
}

export function drawCard(ctx, data) {
  const { route, miles, pts, streets, mood } = data;
  const tint = MOOD_TINT[mood] || '#e8a33d';

  // ---- background ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1017'); bg.addColorStop(1, '#0a0e13');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, 120, 0, W * 0.8, 120, 720);
  glow.addColorStop(0, 'rgba(232,163,61,0.16)'); glow.addColorStop(1, 'rgba(232,163,61,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // ---- header ----
  ctx.fillStyle = '#eef1f8';
  ctx.font = '900 88px ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ROAM', W / 2, 190);
  ctx.fillStyle = tint;
  ctx.font = '600 30px ui-monospace, "Cascadia Code", Consolas, monospace';
  ctx.fillText('SCORED ON FUN, NOT PACE', W / 2, 244);

  // ---- trail artwork panel ----
  const panel = { x: 80, y: 300, w: 920, h: 820 };
  ctx.fillStyle = '#131a22';
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 44); ctx.fill();
  ctx.strokeStyle = '#243040'; ctx.lineWidth = 2; ctx.stroke();

  if (Array.isArray(route) && route.length > 1) {
    const line = fitRoute(route, { x: panel.x + 90, y: panel.y + 90, w: panel.w - 180, h: panel.h - 180 });
    // glow
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = tint; ctx.shadowBlur = 34;
    ctx.strokeStyle = tint; ctx.globalAlpha = 0.55; ctx.lineWidth = 22;
    ctx.beginPath(); line.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    // core
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.strokeStyle = '#f8d489'; ctx.lineWidth = 8;
    ctx.beginPath(); line.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    // start / end dots
    const a = line[0], b = line[line.length - 1];
    ctx.fillStyle = '#33a08f'; ctx.beginPath(); ctx.arc(a[0], a[1], 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#f4c877'; ctx.beginPath(); ctx.arc(b[0], b[1], 15, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(244,200,119,0.4)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(b[0], b[1], 26, 0, 7); ctx.stroke();
  } else {
    ctx.fillStyle = '#5f6b79';
    ctx.font = '500 34px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('a fresh run', W / 2, panel.y + panel.h / 2);
  }

  // ---- fun points hero ----
  ctx.fillStyle = '#f4c877';
  ctx.font = '900 220px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(pts), W / 2, 1420);
  ctx.fillStyle = '#8f9db4';
  ctx.font = '600 36px ui-monospace, monospace';
  ctx.fillText('FUN POINTS', W / 2, 1478);

  // ---- stat row ----
  const stats = [
    { n: miles < 10 ? miles.toFixed(2) : miles.toFixed(1), l: 'MILES' },
    { n: String(streets), l: streets === 1 ? 'NEW STREET' : 'NEW STREETS' },
    { n: mood, l: 'MOOD', tint },
  ];
  const colW = W / 3;
  stats.forEach((s, i) => {
    const cx = colW * i + colW / 2;
    ctx.fillStyle = s.tint || '#eef1f8';
    ctx.font = '800 66px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(String(s.n), cx, 1660);
    ctx.fillStyle = '#8f9db4';
    ctx.font = '600 26px ui-monospace, monospace';
    ctx.fillText(s.l, cx, 1706);
  });

  // ---- footer ----
  ctx.fillStyle = '#5f6b79';
  ctx.font = '600 32px ui-monospace, monospace';
  ctx.fillText('run-roam.netlify.app', W / 2, 1836);
}

export default function RunCard({ run, onClose }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('');

  const unit = (() => { try { return localStorage.getItem('roam.unit') || 'mi'; } catch { return 'mi'; } })();
  const miles = (run.dist || 0) * 0.621371;
  const data = {
    route: run.route,
    miles: unit === 'km' ? (run.dist || 0) : miles, // number shown; label says MILES either way — keep mi for shareability
    pts: run.pts || 0,
    streets: run.cells || 0,
    mood: run.mood || 'Explore',
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W; c.height = H;
    drawCard(c.getContext('2d'), { ...data, miles });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function share() {
    const c = canvasRef.current;
    if (!c) return;
    setStatus('preparing');
    c.toBlob(async (blob) => {
      if (!blob) { setStatus('error'); return; }
      const file = new File([blob], 'roam-run.png', { type: 'image/png' });
      const text = `Scored ${data.pts} fun points on Roam 🏃 running scored on fun, not pace.`;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          setStatus('shared');
          return;
        }
      } catch (e) { if (e?.name === 'AbortError') { setStatus(''); return; } }
      // Fallback: hand off a download (desktop / share unsupported)
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'roam-run.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setStatus('saved');
      } catch { setStatus('error'); }
    }, 'image/png');
  }

  return (
    <div className="runcard-sheet" onClick={onClose}>
      <div className="runcard-inner" onClick={e => e.stopPropagation()}>
        <div className="rc-head">Nice run! 🎉</div>
        <canvas ref={canvasRef} className="rc-canvas" />
        <div className="rc-actions">
          <button className="rc-share" onClick={share}>
            {status === 'preparing' ? 'Preparing…'
              : status === 'shared' ? 'Shared ✓'
                : status === 'saved' ? 'Saved ✓'
                  : status === 'error' ? 'Try again'
                    : 'Share your run'}
          </button>
          <button className="rc-close" onClick={onClose}>Done</button>
        </div>
        {status === 'saved' && <div className="rc-note">Saved to your device — post it to your story 📲</div>}
      </div>
    </div>
  );
}

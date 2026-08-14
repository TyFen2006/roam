import { PATCHES, PATCH_ORDER } from './lib/levels.js';
import './Patches.css';

function patchIcon(k) {
  switch (k) {
    case 'trailblazer': // map / route
      return <><path d="M15 14l7-3 7 3v16l-7-3-7 3z" fill="none" stroke="var(--pc)" strokeWidth="2" strokeLinejoin="round" /><path d="M22 11v16" stroke="var(--pc)" strokeWidth="1.4" /><path d="M17 22c3 0 4-3 7-3s4 3 7 3" stroke="var(--pc)" strokeWidth="1.8" fill="none" strokeLinecap="round" /></>;
    case 'roadrunner': // lightning
      return <path d="M24 10l-8 12h6l-2 10 8-13h-6z" fill="none" stroke="var(--pc)" strokeWidth="2" strokeLinejoin="round" />;
    case 'streak': // flame
      return <path d="M22 10c-5 7-7 10-7 14a7 7 0 0 0 14 0c0-4-3-7-7-14z" fill="none" stroke="var(--pc)" strokeWidth="2" strokeLinejoin="round" />;
    case 'sunrise': // sun + rays
      return <><path d="M14 27a8 8 0 0 1 16 0" fill="none" stroke="var(--pc)" strokeWidth="2" /><path d="M22 11v5M13 15l3 3M31 15l-3 3M10 27h24" stroke="var(--pc)" strokeWidth="2" strokeLinecap="round" /></>;
    default: // star (weekend)
      return <path d="M22 11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3L22 28.6l-6.5 3.4 1.3-7.3L11.5 18.6l7.3-1z" fill="none" stroke="var(--pc)" strokeWidth="2" strokeLinejoin="round" />;
  }
}

export function Patch({ k, earned }) {
  const p = PATCHES[k];
  return (
    <div className={`patch ${earned ? 'earned' : 'locked'}`} title={p.label} style={{ '--pc': p.color }}>
      <svg viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill="rgba(255,255,255,.02)" stroke="var(--pc)" strokeWidth="1.6" />
        <circle cx="22" cy="22" r="20" fill="none" stroke="var(--pc)" strokeWidth="1" strokeDasharray="2 4" opacity=".6" />
        {earned ? patchIcon(k) : <text x="22" y="28" textAnchor="middle" fill="var(--mut)" fontSize="16" fontWeight="800">?</text>}
      </svg>
      <span>{p.label}</span>
    </div>
  );
}

export default function PatchesGallery({ earned }) {
  const set = new Set(earned || []);
  const count = PATCH_ORDER.filter(k => set.has(k)).length;
  return (
    <div className="patches">
      <div className="patches-head">Patches <span>{count}/{PATCH_ORDER.length}</span></div>
      <div className="patches-grid">
        {PATCH_ORDER.map(k => <Patch key={k} k={k} earned={set.has(k)} />)}
      </div>
    </div>
  );
}

import { ImageResponse } from 'next/og';
export const alt = 'SwordWeave — A TTRPG for your table';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: '#071c22', color: '#e4c77c', padding: '72px', flexDirection: 'column', justifyContent: 'center', border: '14px solid #49656a' }}>
    <div style={{ fontSize: 28, letterSpacing: 6, color: '#b9cccc', marginBottom: 28 }}>FREE MODULAR TABLETOP RPG</div>
    <div style={{ fontSize: 104, letterSpacing: -4 }}>SwordWeave</div>
    <div style={{ fontSize: 43, color: '#e0e8e5', marginTop: 22 }}>A TTRPG for your table.</div>
    <div style={{ display: 'flex', fontSize: 25, color: '#b9cccc', marginTop: 56 }}>v0.1 alpha · swordweave.quest</div>
  </div>, size);
}

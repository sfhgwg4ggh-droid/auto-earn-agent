/**
 * 收益仪表盘 — 手机优先，真实数据驱动
 * 用文章数 × 行业基准 保守估算收入
 */

import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const BENCHMARKS = { avgCTR: 0.03, avgConversion: 0.05, avgOrderValue: 45, avgCommission: 0.05, pvPerArticle: 8 };

export async function generateDashboard() {
  const revenue = await storage.readJSON('revenue.json', { monthly: [], totals: {} });
  const inventory = (await storage.readJSON('content-inventory.json', [])) || [];
  const links = (await storage.readJSON('affiliate-links.json', [])) || [];
  const keywords = (await storage.readJSON('keywords.json', [])) || [];

  const monthly = revenue.monthly || [];
  const published = inventory.filter(c => c._status === 'published' || c.publishedAt || c._published);
  const today = new Date().toISOString().split('T')[0];
  const todayRecord = monthly.find(r => r.date === today) || monthly[monthly.length - 1] || {};

  const articleCount = published.length;
  const estDailyPV = articleCount * BENCHMARKS.pvPerArticle;
  const estDailyClicks = Math.round(estDailyPV * BENCHMARKS.avgCTR);
  const estDailyRevenue = parseFloat((estDailyClicks * BENCHMARKS.avgConversion * BENCHMARKS.avgOrderValue * BENCHMARKS.avgCommission).toFixed(2));

  const daysRunning = todayRecord.daysSinceStart || Math.max(1, Math.ceil((Date.now() - new Date(revenue.startDate || today).getTime()) / 86400000));
  const totalEstRevenue = parseFloat(((revenue.totals?.affiliate || 0) + estDailyRevenue).toFixed(2));

  const catStats = CONFIG.content.categories.map(cat => {
    const count = published.filter(a => a.category === cat.slug).length;
    return { ...cat, count };
  }).filter(c => c.count > 0);

  // 文章列表
  const latestArticles = [...published].sort((a, b) =>
    (b._published || b._generated || '').localeCompare(a._published || a._generated || '')
  ).slice(0, 8);

  const contentHTML = `<div style="max-width:900px;margin:0 auto;padding:16px">

<div style="background:linear-gradient(135deg,#1e3a5f,#1a56db);color:#fff;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center">
  <h1 style="font-size:1.5rem;margin-bottom:4px;color:#fff">📊 Revenue Dashboard</h1>
  <p style="font-size:.8rem;opacity:.8;margin-bottom:0">Auto-updated · Day ${daysRunning} · ${new Date().toISOString().slice(0,10)}</p>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
  <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:2rem;font-weight:800;color:#1a56db">${articleCount}</div>
    <div style="font-size:.75rem;color:#6b7280">Articles Live</div>
  </div>
  <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:2rem;font-weight:800;color:#059669">${estDailyPV}</div>
    <div style="font-size:.75rem;color:#6b7280">Est. Views/Day</div>
  </div>
  <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:2rem;font-weight:800;color:#d97706">${links.length}</div>
    <div style="font-size:.75rem;color:#6b7280">Affiliate Links</div>
  </div>
  <div style="background:#fff;border-radius:10px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-size:2rem;font-weight:800;color:#${estDailyRevenue > 0 ? '059669' : '6b7280'}">$${estDailyRevenue}</div>
    <div style="font-size:.75rem;color:#6b7280">Est. Rev/Day</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
  <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-weight:700;margin-bottom:8px">💰 Revenue Breakdown</div>
    <table style="width:100%;font-size:.8rem">
      <tr><td style="padding:4px 0;color:#6b7280">Est. Daily Clicks</td><td style="text-align:right;font-weight:600">${estDailyClicks}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">CTR (industry avg)</td><td style="text-align:right;font-weight:600">3%</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Conversion Rate</td><td style="text-align:right;font-weight:600">5%</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Avg Order Value</td><td style="text-align:right;font-weight:600">$45</td></tr>
      <tr style="border-top:1px solid #e5e7eb"><td style="padding:4px 0;font-weight:700">Est. Total Revenue</td><td style="text-align:right;font-weight:800;color:#059669">$${totalEstRevenue}</td></tr>
    </table>
  </div>
  <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <div style="font-weight:700;margin-bottom:8px">📈 Site Growth</div>
    <table style="width:100%;font-size:.8rem">
      <tr><td style="padding:4px 0;color:#6b7280">Days Running</td><td style="text-align:right;font-weight:600">${daysRunning}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Keywords Left</td><td style="text-align:right;font-weight:600">${keywords.filter(k => k.status === 'pending').length}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Categories</td><td style="text-align:right;font-weight:600">${catStats.length}</td></tr>
      <tr style="border-top:1px solid #e5e7eb"><td style="padding:4px 0;font-weight:700">Next Milestone</td><td style="text-align:right;font-weight:600">${articleCount < 10 ? '10 articles' : articleCount < 30 ? '30 articles' : articleCount < 50 ? '50 articles' : '100 articles 🚀'}</td></tr>
    </table>
  </div>
</div>

${catStats.length ? `<div style="margin-bottom:24px">
  <div style="font-weight:700;margin-bottom:12px">📂 Articles by Category</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
    ${catStats.map(c => `<div style="background:#fff;border-radius:8px;padding:12px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.04)">
      <div style="font-size:1.5rem">${c.emoji}</div>
      <div style="font-weight:700;font-size:.9rem">${c.count}</div>
      <div style="font-size:.65rem;color:#6b7280">${c.name}</div>
    </div>`).join('')}
  </div>
</div>` : ''}

<div style="margin-bottom:24px">
  <div style="font-weight:700;margin-bottom:12px">📝 Latest Articles</div>
  ${latestArticles.length ? latestArticles.map(a => `<div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.04)">
    <a href="/blog/${(a._generated||a._published||'2026').slice(0,4)}/${(a._generated||a._published||'2026-06').slice(5,7)}/${a.slug}/" style="font-weight:600;font-size:.85rem;display:block;margin-bottom:4px">${esc(a.title)}</a>
    <span style="font-size:.7rem;color:#9ca3af">${a.category || ''} · ${(a._published||a._generated||'').slice(0,10)}</span>
  </div>`).join('') : '<p style="color:#9ca3af;text-align:center;padding:24px">Articles coming soon. Pipeline runs daily.</p>'}
</div>

<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin-bottom:24px;font-size:.8rem">
  <strong>⚡ Revenue Forecast</strong><br>
  At ${articleCount} articles: <strong>~$${estDailyRevenue}/day</strong> estimated<br>
  At 30 articles: <strong>~$${parseFloat((30*BENCHMARKS.pvPerArticle*BENCHMARKS.avgCTR*BENCHMARKS.avgConversion*BENCHMARKS.avgOrderValue*BENCHMARKS.avgCommission).toFixed(2))}/day</strong> projected<br>
  At 100 articles: <strong>~$${parseFloat((100*BENCHMARKS.pvPerArticle*BENCHMARKS.avgCTR*BENCHMARKS.avgConversion*BENCHMARKS.avgOrderValue*BENCHMARKS.avgCommission).toFixed(2))}/day</strong> projected
</div>

<div style="margin-bottom:24px">
  <div style="font-weight:700;margin-bottom:12px">💰 Monetization Status</div>
  <div style="background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.06);font-size:.8rem">
    <table style="width:100%">
      <tr><td style="padding:4px 0;color:#6b7280">Amazon Tag</td><td style="text-align:right;font-weight:600">${CONFIG.affiliates.amazon.tag}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Site</td><td style="text-align:right;font-weight:600"><a href="${CONFIG.baseUrl}" style="font-size:.75rem">${CONFIG.domain}</a></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Pipeline</td><td style="text-align:right;font-weight:600">Daily · 08:00 + 16:00 CST</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Source</td><td style="text-align:right;font-weight:600"><a href="https://github.com/sfhgwg4ggh-droid/auto-earn-agent" style="font-size:.75rem">GitHub →</a></td></tr>
    </table>
  </div>
</div>

<div style="text-align:center;padding:24px;background:#eef2ff;border-radius:10px;margin-bottom:24px">
  <div style="font-weight:700;margin-bottom:4px">🔍 Google Not Seeing Your Site?</div>
  <p style="font-size:.8rem;color:#4b5563;margin-bottom:12px">New sites take 1-4 weeks to appear in Google. The pipeline auto-generates sitemaps. Check Google Search Console for indexing status.</p>
  <a href="https://search.google.com/search-console" target="_blank" rel="noopener" style="display:inline-block;background:#1a56db;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:.85rem">Open Search Console</a>
</div>

</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>💰 Revenue — Smart Picks</title>
<meta name="description" content="Live revenue dashboard">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;background:#f3f4f6;color:#111827;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:#1a56db;text-decoration:none}
</style>
</head>
<body style="padding-bottom:40px">${contentHTML}
<div style="text-align:center;padding:20px;color:#9ca3af;font-size:.7rem">
  Auto-Earn Agent · Updated ${new Date().toISOString().slice(0,10)} · <a href="${CONFIG.baseUrl}">Home</a>
</div>
</body>
</html>`;

  const dir = resolve(CONFIG.publicDir, 'dashboard');
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html, 'utf-8');
  console.log('[Dashboard] ✅ Generated mobile-first dashboard');
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// CLI
if (import.meta.url.startsWith('file://') && process.argv[1]?.includes('dashboard-gen')) {
  generateDashboard().then(() => process.exit(0));
}

export default { generateDashboard };

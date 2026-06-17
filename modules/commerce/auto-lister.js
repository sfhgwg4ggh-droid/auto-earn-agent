/**
 * 自动上架 — 从 products.json 生成产品页面
 */

import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import { wrapHTML } from '../shared/theme-engine.js';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export async function generateProductPages() {
  const products = (await storage.readJSON('products.json', [])) || [];
  if (!products.length) { console.log('[Auto-Lister] No products to list'); return 0; }

  const dir = CONFIG.productsDir;
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  // Generate individual product pages (top 20)
  const top = products.sort((a,b) => (b.estimatedProfitMargin||0) - (a.estimatedProfitMargin||0)).slice(0, 20);
  for (const p of top) {
    const slug = (p.title || 'product').toLowerCase().replace(/[^a-z0-9]+/g,'-').substring(0,60);
    const affiliateUrl = `https://www.amazon.com/s?k=${encodeURIComponent(p.keyword||p.title)}&tag=${CONFIG.affiliates.amazon.tag}`;

    const html = wrapHTML({
      title: `${p.title} — Best Price & Review`,
      description: `Shop ${p.title}. Wholesale from ${p.priceCNY} CNY. Estimated retail $${p.estimatedRetailUSD}.`,
      content: `<div class="container" style="padding:48px 0">
        <h1>${esc(p.title)}</h1>
        <div class="card" style="margin-bottom:24px">
          <p><strong>Wholesale Price:</strong> ¥${p.priceCNY} CNY</p>
          <p><strong>Est. Retail:</strong> $${p.estimatedRetailUSD} USD</p>
          <p><strong>Source:</strong> ${esc(p.source||'1688.com')} · ${esc(p.company||'')}</p>
          <a href="${affiliateUrl}" class="btn btn-accent" target="_blank" rel="nofollow sponsored">🔍 Check Amazon Price</a>
        </div>
      </div>`,
      canonical: `${CONFIG.baseUrl}/products/${slug}/`,
    });

    await writeFile(resolve(dir, `${slug}.html`), html, 'utf-8');
  }

  // Generate index page
  const grid = top.map((p,i) => {
    const slug = (p.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').substring(0,60);
    return `<div class="card" style="text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">${['🥇','🥈','🥉','🏅','📦'][i]||'📦'}</div>
      <h3><a href="/products/${slug}/">${esc(p.title)}</a></h3>
      <p style="color:var(--text-muted)">¥${p.priceCNY} → ~$${p.estimatedRetailUSD}</p>
    </div>`;
  }).join('');

  const indexHTML = wrapHTML({
    title: '🏆 Best Picks — Curated Product Deals',
    description: 'Top products with the best profit margins for dropshipping and affiliate. Updated weekly.',
    content: `<div class="container" style="padding:48px 0">
      <h1>🏆 Best Picks</h1>
      <p style="margin-bottom:32px">Curated products with great margins. Click through to check latest prices.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">${grid}</div>
    </div>`,
    canonical: `${CONFIG.baseUrl}/products/`,
  });

  await writeFile(resolve(dir, 'index.html'), indexHTML, 'utf-8');
  console.log(`[Auto-Lister] ✅ ${top.length} product pages + index`);
  return top.length;
}

// CLI
if (import.meta.url.startsWith('file://') && process.argv[1]?.includes('auto-lister')) {
  generateProductPages().then(n => { console.log(`✅ ${n} pages`); process.exit(0); });
}

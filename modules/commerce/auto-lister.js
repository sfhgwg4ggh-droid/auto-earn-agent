/**
 * 自动上架器 — 将产品数据生成为 public/products/ 下的 HTML 页面
 */
import CONFIG from '../shared/config.js';
import theme from '../shared/theme-engine.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

export async function generateProductPages() {
  const products = await storage.readJSON('products.json', []);
  if (products.length === 0) {
    console.log('[Auto-List] No products to list.');
    return 0;
  }

  const dir = path.join(CONFIG.publicDir, 'products');
  await fs.mkdir(dir, { recursive: true });

  const byCategory = {};
  for (const p of products) {
    const cat = p.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }

  let count = 0;
  const tag = CONFIG.affiliates.amazon.tag || 'smartpicks-20';

  for (const [category, items] of Object.entries(byCategory)) {
    const productCards = items.slice(0, 20).map((p, i) => {
      const searchTerm = encodeURIComponent(p.title || p.keyword || category);
      return `
      <div class="product-card">
        <div class="rank">${i + 1}</div>
        <div class="info">
          <h3>${p.title || p.keyword || 'Product ' + (i+1)}</h3>
          <p>Wholesale: ¥${p.priceCNY || 'N/A'} | Est. Retail: $${p.estimatedRetailUSD || 'N/A'} | Margin: ${p.estimatedProfitMargin || 'N/A'}%</p>
          <p>Source: ${p.source || '1688.com'} | Scraped: ${p.scrapedAt ? new Date(p.scrapedAt).toLocaleDateString() : 'N/A'}</p>
          <a href="https://www.amazon.com/s?k=${searchTerm}&tag=${tag}" rel="nofollow sponsored" class="btn btn-accent" target="_blank">Check Price on Amazon</a>
        </div>
      </div>`;
    }).join('');

    const content = `
    <div class="container" style="padding:48px 0">
      <h1>${category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — Best Picks</h1>
      <p class="affiliate-disclosure">We may earn a commission at no cost to you.</p>
      ${productCards}
    </div>`;

    const html = theme.wrapHTML({
      title: `Best ${category} Products — ${CONFIG.seo.siteName}`,
      description: `Compare top ${category} products with prices and honest reviews.`,
      content,
      canonical: `${CONFIG.domain}/products/${category}/`,
    });

    const catDir = path.join(dir, category);
    await fs.mkdir(catDir, { recursive: true });
    await fs.writeFile(path.join(catDir, 'index.html'), html, 'utf-8');
    count++;
  }

  // Overview page
  const overview = `
  <div class="container" style="padding:48px 0">
    <h1>All Best Picks</h1>
    <p>Curated across ${Object.keys(byCategory).length} categories.</p>
    ${Object.entries(byCategory).map(([cat, items]) => `
    <div class="card" style="margin:16px 0">
      <h3><a href="/products/${cat}/">${cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</a></h3>
      <p style="color:var(--text-muted)">${items.length} products</p>
    </div>`).join('')}
  </div>`;

  await fs.writeFile(path.join(dir, 'index.html'), theme.wrapHTML({
    title: `Best Picks — ${CONFIG.seo.siteName}`,
    description: 'Curated product recommendations.',
    content: overview,
    canonical: `${CONFIG.domain}/products/`,
  }), 'utf-8');
  count++;

  console.log(`[Auto-List] Generated ${count} pages`);
  return count;
}

export default { generateProductPages };

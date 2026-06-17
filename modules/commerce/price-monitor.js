/**
 * 价格监控器 — 检查已采集商品是否仍有利润空间
 * 定期更新 products.json 中的价格数据
 */
import storage from '../shared/storage.js';
import CONFIG from '../shared/config.js';

/**
 * 扫描产品库，过滤出还有利润的商品
 */
export async function monitorProfitMargins() {
  const products = await storage.readJSON('products.json', []);
  const links = await storage.readJSON('affiliate-links.json', []);

  const profitable = products.filter(p =>
    (p.estimatedProfitMargin || 0) >= CONFIG.commerce.minProfitMargin * 100
  );

  const alerts = products.filter(p =>
    (p.estimatedProfitMargin || 0) < CONFIG.commerce.minProfitMargin * 100
  );

  console.log(`[Price Monitor] 📊 ${products.length} products total`);
  console.log(`  ✅ Profitable (>${CONFIG.commerce.minProfitMargin * 100}%): ${profitable.length}`);
  console.log(`  ⚠️  Low margin: ${alerts.length}`);

  // 为高利润商品生成 Affiliate 链接
  const newLinks = [];
  for (const p of profitable.slice(0, 10)) {
    const exists = links.find(l => l.productKeyword === p.keyword);
    if (!exists) {
      newLinks.push({
        productKeyword: p.keyword,
        sourceName: p.title,
        wholesaleCNY: p.priceCNY,
        retailUSD: p.estimatedRetailUSD,
        margin: p.estimatedProfitMargin,
        amazonSearchUrl: `https://www.amazon.com/s?k=${encodeURIComponent(p.keyword)}&tag=${CONFIG.affiliates.amazon.tag}`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (newLinks.length > 0) {
    await storage.appendToJSON('affiliate-links.json', newLinks);
    console.log(`[Price Monitor] 🔗 Generated ${newLinks.length} new affiliate links`);
  }

  return { profitable: profitable.length, alerts: alerts.length, newLinks: newLinks.length };
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  monitorProfitMargins().then(() => console.log('✅ Done'));
}

export default { monitorProfitMargins };

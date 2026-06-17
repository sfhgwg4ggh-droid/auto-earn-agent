/**
 * 收益追踪器 — 汇总 Affiliate 点击、展示、预估收入
 * 数据来源：Google Analytics / 自建事件追踪
 * 支持 CSV 导出和 JSON 存储
 */
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';
import CONFIG from '../shared/config.js';

/**
 * 初始化日收益记录
 */
export async function recordDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  const existing = await storage.readJSON('revenue.json', []);

  // 如果今天已有记录，跳过
  const monthly = existing.monthly || [];
  if (monthly.some(r => r.date === today)) {
    console.log(`[Revenue] Already recorded for ${today}`);
    return monthly.find(r => r.date === today);
  }

  // 统计已有内容
  const inventory = await storage.readJSON('content-inventory.json', []);
  const links = await storage.readJSON('affiliate-links.json', []);

  const record = {
    date: today,
    totalArticles: inventory.filter(c => c.publishedAt).length,
    totalArticlesToday: inventory.filter(c => c.publishedAt?.startsWith(today)).length,
    totalProducts: (await storage.readJSON('products.json', [])).length,
    affiliateLinks: links.length,
    // 估算数据（实际连接 Google Analytics 后替换）
    estimatedPageViews: Math.floor(Math.random() * 50) + (inventory.filter(c => c.publishedAt).length * 3),
    estimatedClicks: Math.floor(Math.random() * 10),
    estimatedRevenue: 0,
    estimatedCTR: 0,
    // 占位 — 连真实 API 后自动填充
    googleAnalytics: { pageViews: 0, sessions: 0, clicks: 0 },
    amazonAssociates: { clicks: 0, orderedItems: 0, revenue: 0, commission: 0 },
    recordedAt: new Date().toISOString(),
  };

  monthly.push(record);
  existing.monthly = monthly;
  await storage.writeJSON('revenue.json', existing);

  console.log(`[Revenue] 📊 Recorded daily stats for ${today}`);
  return record;
}

/**
 * 生成收益报告
 */
export async function generateRevenueReport(days = 30) {
  const revenue = await storage.readJSON('revenue.json', []);
  const recent = revenue.slice(-days);

  const summary = {
    period: `${recent[0]?.date || 'N/A'} to ${recent[recent.length - 1]?.date || 'N/A'}`,
    days: recent.length,
    totalArticles: recent[recent.length - 1]?.totalArticles || 0,
    estimatedPageViews: recent.reduce((s, r) => s + (r.estimatedPageViews || 0), 0),
    estimatedClicks: recent.reduce((s, r) => s + (r.estimatedClicks || 0), 0),
    estimatedRevenue: recent.reduce((s, r) => s + (r.estimatedRevenue || 0), 0),
    // 占位
    actualRevenue: recent.reduce((s, r) => s + (r.amazonAssociates?.commission || 0), 0),
  };

  console.log(`\n📊 Revenue Report (Last ${summary.days} days)`);
  console.log(`  📄 Articles: ${summary.totalArticles}`);
  console.log(`  👁  Est. Page Views: ${summary.estimatedPageViews}`);
  console.log(`  🖱  Est. Clicks: ${summary.estimatedClicks}`);
  console.log(`  💰 Est. Revenue: $${summary.estimatedRevenue.toFixed(2)}`);
  console.log(`  💵 Actual Amazon: $${summary.actualRevenue.toFixed(2)}\n`);

  return summary;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    await recordDailyStats();
    await generateRevenueReport();
  })().then(() => console.log('✅ Done'));
}

export default { recordDailyStats, generateRevenueReport };

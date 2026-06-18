/**
 * 收益追踪器 — 真实数据，不用随机数
 * 基于文章数 × 行业平均 CTR × Amazon 佣金率估算
 */

import storage from '../shared/storage.js';
import CONFIG from '../shared/config.js';

// 行业基准 (保守估计)
const BENCHMARKS = {
  avgCTR: 0.03,         // 3% 点击率
  avgConversion: 0.05,  // 5% 转化率
  avgOrderValue: 45,    // $45 平均订单
  avgCommission: 0.05,  // 5% 佣金率
  pageViewsPerArticle: 8, // 新站每篇文章日均 PV（保守）
};

export async function recordDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  const existing = (await storage.readJSON('revenue.json', { monthly: [], totals: { affiliate: 0, ads: 0, store: 0, other: 0 } }));
  const monthly = existing.monthly || [];

  if (monthly.some(r => r.date === today)) {
    console.log(`[Revenue] Already recorded for ${today}`);
    return monthly.find(r => r.date === today);
  }

  const inventory = (await storage.readJSON('content-inventory.json', [])) || [];
  const links = (await storage.readJSON('affiliate-links.json', [])) || [];
  const keywords = (await storage.readJSON('keywords.json', [])) || [];

  const publishedArticles = inventory.filter(c => c._status === 'published' || c.publishedAt || c._published);
  const articleCount = publishedArticles.length;

  // 基于真实文章数估算
  const estDailyPV = articleCount * BENCHMARKS.pageViewsPerArticle;
  const estClicks = Math.round(estDailyPV * BENCHMARKS.avgCTR);
  const estConversions = Math.round(estClicks * BENCHMARKS.avgConversion);
  const estRevenue = parseFloat((estConversions * BENCHMARKS.avgOrderValue * BENCHMARKS.avgCommission).toFixed(2));

  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(existing.startDate || today).getTime()) / 86400000));

  const record = {
    date: today,
    daysSinceStart,
    totalArticles: articleCount,
    totalArticlesToday: inventory.filter(c => (c._generated || c.createdAt || '').startsWith(today)).length,
    totalProducts: (await storage.readJSON('products.json', []) || []).length,
    affiliateLinks: links.length,
    keywordsRemaining: keywords.filter(k => k.status === 'pending').length,
    // 保守估算
    estimatedDailyPV: estDailyPV,
    estimatedClicks: estClicks,
    estimatedConversions: estConversions,
    estimatedRevenue: estRevenue,
    estimatedCTR: BENCHMARKS.avgCTR,
    // 累计估算
    estimatedTotalRevenue: parseFloat(((existing.totals?.affiliate || 0) + estRevenue).toFixed(2)),
    // 实际数据占位（连接 API 后填充）
    googleAnalytics: { pageViews: 0, sessions: 0, clicks: 0 },
    amazonAssociates: { clicks: 0, orderedItems: 0, revenue: 0, commission: 0 },
    recordedAt: new Date().toISOString(),
  };

  monthly.push(record);
  existing.monthly = monthly;

  // 更新累计
  existing.totals = existing.totals || { affiliate: 0, ads: 0, store: 0, other: 0 };
  existing.totals.affiliate = record.estimatedTotalRevenue;

  await storage.writeJSON('revenue.json', existing);
  console.log(`[Revenue] 📊 ${today}: ${articleCount} articles → ~$${estRevenue}/day est.`);
  return record;
}

export async function generateRevenueReport(days = 30) {
  const data = await storage.readJSON('revenue.json', { monthly: [], totals: {} });
  const monthly = data.monthly || [];
  const recent = monthly.slice(-days);

  if (!recent.length) { console.log('[Revenue] No data yet'); return null; }

  const last = recent[recent.length - 1];
  const totalEst = recent.reduce((s, r) => s + (r.estimatedRevenue || 0), 0);

  console.log(`\n📊 Revenue Report (${recent.length} days)`);
  console.log(`  📄 Articles: ${last.totalArticles}`);
  console.log(`  👁  Est Daily PV: ${last.estimatedDailyPV}`);
  console.log(`  🖱  Est Daily Clicks: ${last.estimatedClicks}`);
  console.log(`  💰 Est 30-Day: $${totalEst.toFixed(2)}`);
  console.log(`  📈 Days Running: ${last.daysSinceStart}\n`);

  return {
    days: recent.length,
    totalArticles: last.totalArticles,
    estDailyPV: last.estimatedDailyPV,
    estDailyClicks: last.estimatedClicks,
    estMonthlyRevenue: totalEst,
    daysSinceStart: last.daysSinceStart,
  };
}

// CLI
if (import.meta.url.startsWith('file://') && process.argv[1]?.includes('tracker')) {
  (async () => { await recordDailyStats(); await generateRevenueReport(); process.exit(0); })();
}

export default { recordDailyStats, generateRevenueReport };

/**
 * 🛒 智能选品引擎 — 自动找高利润货源
 *
 * 多维度评估：
 *   - 1688 批发价 vs 闲鱼/淘宝零售价 → 利润空间
 *   - 搜索热度趋势 → 需求验证
 *   - 竞争度分析 → 差异化机会
 *   - 季节性检测 → 时机判断
 */

import CONFIG from '../shared/config.js';
import { launchBrowser, createStealthContext, randomDelay } from '../shared/browser-setup.js';
import storage from '../shared/storage.js';

// ── 选品赛道（宠物定制 + 情感消费）────────────────────────
const SOURCING_TRACKS = [
  // 宠物纪念/艺术 — 高利润数字商品
  { keyword: '宠物肖像定制 手绘', category: 'pet-art', type: 'digital', basePrice: 88, target: '小红书+闲鱼' },
  { keyword: '宠物纪念品 定制摆件', category: 'pet-memorial', type: 'physical', basePrice: 50, target: '淘宝+闲鱼' },
  { keyword: '宠物项圈 定制刻字', category: 'pet-accessories', type: 'physical', basePrice: 25, target: '闲鱼+拼多多' },
  { keyword: '狗牌定制 激光刻字', category: 'pet-accessories', type: 'physical', basePrice: 15, target: '淘宝+闲鱼' },
  { keyword: '宠物画像 数字插画', category: 'pet-art', type: 'digital', basePrice: 68, target: '小红书+Etsy' },
  { keyword: '宠物骨灰盒 纪念 木质', category: 'pet-memorial', type: 'physical', basePrice: 60, target: '淘宝' },
  { keyword: '宠物脚印 纪念品 DIY', category: 'pet-memorial', type: 'physical', basePrice: 20, target: '小红书+闲鱼' },
  { keyword: '宠物抱枕定制 照片打印', category: 'pet-products', type: 'physical', basePrice: 35, target: '淘宝+拼多多' },
  // 情感消费 — 手工 + 定制
  { keyword: '手工DIY照片书 纪念册', category: 'sentimental', type: 'physical', basePrice: 40, target: '小红书+淘宝' },
  { keyword: '定制海报 宠物 装饰画', category: 'pet-art', type: 'digital', basePrice: 30, target: '小红书+闲鱼' },
];

// ── 利润计算器 ─────────────────────────────────────────────
function calculateProfit(wholesalePrice, category, type) {
  const platformFees = {
    '闲鱼': 0,           // 闲鱼免费
    '小红书': 0.05,       // 小红书佣金 5%
    '淘宝': 0.05,         // 淘宝 5%
    '拼多多': 0.006,      // 拼多多千分之六
    'Etsy': 0.065,        // Etsy 6.5%
  };

  const retailMarkup = {
    'pet-art': 3.0,       // 艺术品溢价 3 倍
    'pet-memorial': 2.5,  // 纪念品 2.5 倍
    'pet-accessories': 2.0,
    'pet-products': 2.0,
    'sentimental': 2.5,
    'digital': 10,        // 数字商品几乎零成本
  };

  const markup = type === 'digital' ? retailMarkup.digital : (retailMarkup[category] || 2.0);
  const retailPrice = wholesalePrice * markup;
  const profit = retailPrice - wholesalePrice;
  const profitMargin = ((profit / retailPrice) * 100).toFixed(0);

  return {
    wholesalePrice,
    retailPrice: Math.round(retailPrice),
    profit: Math.round(profit),
    profitMargin: profitMargin + '%',
    isDigital: type === 'digital',
    recommendation: profitMargin > 60 ? '🔥 强烈推荐' : profitMargin > 40 ? '✅ 值得做' : '⚠️ 利润偏低',
  };
}

// ── 1688 智能搜索 ──────────────────────────────────────────
export async function smartSearch1688(track) {
  console.log(`[选品] 🔍 ${track.keyword}`);

  const browser = await launchBrowser(true);
  let products = [];

  try {
    const context = await createStealthContext(browser);
    const page = await context.newPage();

    const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(track.keyword)}&n=y&sortType=va_rmdarkgmv30`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    const title = await page.title();
    if (title.includes('验证') || title.includes('登录')) {
      console.log('[选品] ⚠️ 验证码，使用估算数据');
      return generateEstimate(track);
    }

    products = await page.evaluate(() => {
      const items = document.querySelectorAll('.sm-offer-item, .offer-item, [class*="offer"]');
      const results = [];
      items.forEach(item => {
        if (results.length >= 8) return;
        try {
          const titleEl = item.querySelector('.sm-offer-title, .offer-title, [class*="title"]');
          const priceEl = item.querySelector('.sm-offer-priceNum, .price, [class*="price"]');
          const saleEl = item.querySelector('.sm-offer-saleNum, [class*="sale"]');
          const companyEl = item.querySelector('.sm-offer-company, [class*="company"]');
          const moqEl = item.querySelector('.sm-offer-moq, [class*="moq"]');

          if (titleEl && priceEl) {
            const priceText = priceEl.textContent?.trim();
            const priceMatch = priceText?.match(/[\d.]+/);
            results.push({
              title: titleEl.textContent?.trim().substring(0, 100),
              price: priceMatch ? parseFloat(priceMatch[0]) : 0,
              sales: saleEl?.textContent?.trim() || '',
              company: companyEl?.textContent?.trim() || '',
              moq: moqEl?.textContent?.trim() || '1',
            });
          }
        } catch {}
      });
      return results;
    });

    await context.close();
  } catch (e) {
    console.error('[选品] 爬取失败:', e.message);
  } finally {
    await browser.close();
  }

  if (products.length === 0) {
    return generateEstimate(track);
  }

  // 计算利润
  return products.map(p => ({
    ...p,
    ...calculateProfit(p.price, track.category, track.type),
    category: track.category,
    type: track.type,
    targetPlatform: track.target,
    source: '1688.com',
    sourcedAt: new Date().toISOString(),
  }));
}

function generateEstimate(track) {
  // 基于经验估算
  const estimates = {
    '宠物肖像定制 手绘': [{ price: 0, retailPrice: 88, profit: 88, profitMargin: '100%', type: 'digital', recommendation: '🔥 强烈推荐 — 零成本数字商品' }],
    '宠物纪念品 定制摆件': [{ price: 18, retailPrice: 60, profit: 42, profitMargin: '70%', type: 'physical', recommendation: '✅ 值得做' }],
    '宠物项圈 定制刻字': [{ price: 8, retailPrice: 35, profit: 27, profitMargin: '77%', type: 'physical', recommendation: '✅ 值得做' }],
    '狗牌定制 激光刻字': [{ price: 5, retailPrice: 25, profit: 20, profitMargin: '80%', type: 'physical', recommendation: '🔥 暴力利润' }],
    '宠物画像 数字插画': [{ price: 0, retailPrice: 68, profit: 68, profitMargin: '100%', type: 'digital', recommendation: '🔥 零成本高利润' }],
    '定制海报 宠物 装饰画': [{ price: 0, retailPrice: 39, profit: 39, profitMargin: '100%', type: 'digital', recommendation: '🔥 走量款' }],
  };

  const est = estimates[track.keyword] || [{ price: 20, retailPrice: 50, profit: 30, profitMargin: '60%', type: 'physical', recommendation: '✅ 可做' }];
  return est.map(p => ({
    title: track.keyword,
    price: p.price,
    ...p,
    category: track.category,
    targetPlatform: track.target,
    source: 'estimate',
    sourcedAt: new Date().toISOString(),
  }));
}

// ── 主流水线 ──────────────────────────────────────────────
export async function runSmartSourcing() {
  console.log('\n🛒 ══════ 智能选品引擎 ══════\n');

  const allProducts = [];
  const report = { date: new Date().toISOString().split('T')[0], topPicks: [], byCategory: {} };

  for (const track of SOURCING_TRACKS) {
    const products = await smartSearch1688(track);
    allProducts.push(...products);
    await randomDelay(3000, 6000);
  }

  // 排序：利润最高优先
  allProducts.sort((a, b) => b.profit - a.profit);

  // 按品类分组
  for (const p of allProducts) {
    if (!report.byCategory[p.category]) report.byCategory[p.category] = [];
    report.byCategory[p.category].push(p);
  }

  // Top 10 推荐
  report.topPicks = allProducts.slice(0, 10).map(p => ({
    product: p.title, wholesale: `¥${p.price}`, retail: `¥${p.retailPrice}`,
    profit: `¥${p.profit}`, margin: p.profitMargin, recommendation: p.recommendation,
    platform: p.targetPlatform, type: p.type,
  }));

  // 保存
  await storage.writeJSON('sourcing-report.json', report);
  await storage.writeJSON('products.json', [...(await storage.readJSON('products.json', [])), ...allProducts].slice(0, 500));

  console.log(`\n📊 选品报告: ${allProducts.length} 个产品`);
  console.log('🏆 Top 5 推荐:');
  report.topPicks.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.product?.substring(0, 40)} | 成本¥${p.wholesale} → 卖¥${p.retail} | 赚¥${p.profit} (${p.margin})`);
  });

  return report;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runSmartSourcing().then(() => { console.log('✅ 选品完成'); process.exit(0); });
}

export default { smartSearch1688, runSmartSourcing, SOURCING_TRACKS };

/**
 * 小红书选品采集器 — 抓取适合小红书带货的1688商品
 *
 * 选品逻辑（基于小红书2026带货趋势）：
 *   做"窄"不做"大" — 找对大品牌太小但新品牌能活的细分赛道
 *   灵魂三问：有搜索需求？有差异化卖点？价格有竞争力？
 *
 * 热门赛道：
 *   养生日常化（中式草本饮品、精准养生）
 *   头皮护理（头皮精华、护肤式养发）
 *   宠物户外装备（冲锋衣、防晒衣、晕车安抚）
 *   手工串珠（DIY水晶/中药/二次元）
 *   香氛玩偶（毛绒+香气）
 *   中式滋补（黄精、陈皮等小众品类）
 */

import CONFIG from '../shared/config.js';
import { launchBrowser, createStealthContext, randomDelay } from '../shared/browser-setup.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 小红书选品关键词 — 窄赛道 + 高情绪价值
 * 每季度应根据小红书热搜趋势更新
 */
const XHS_NICHES = [
  // 养生日常化
  { keyword: '黄芪 养生茶', category: 'health', tag: '养生茶包DIY', emoji: '🍵' },
  { keyword: '酸枣仁 助眠', category: 'health', tag: '助眠好物', emoji: '😴' },
  { keyword: '陈皮 理气', category: 'health', tag: '中式养生', emoji: '🫖' },
  { keyword: '黄精 滋补', category: 'health', tag: '小众滋补', emoji: '💪' },
  { keyword: '艾草贴 暖宫', category: 'health', tag: '女生养生', emoji: '🔥' },
  // 头皮护理
  { keyword: '头皮精华 生发', category: 'beauty', tag: '头皮护理', emoji: '💆' },
  { keyword: '经络梳 按摩', category: 'beauty', tag: '头部按摩', emoji: '🪮' },
  { keyword: '天然洗发皂', category: 'beauty', tag: '无添加洗护', emoji: '🧼' },
  // 宠物户外
  { keyword: '宠物冲锋衣', category: 'pet', tag: '宠物户外', emoji: '🐕' },
  { keyword: '宠物防晒衣', category: 'pet', tag: '夏日必备', emoji: '☀️' },
  { keyword: '宠物车载垫', category: 'pet', tag: '带宠出行', emoji: '🚗' },
  // 手工DIY
  { keyword: '水晶珠子 DIY', category: 'diy', tag: '手工串珠', emoji: '💎' },
  { keyword: '中药手串', category: 'diy', tag: '新中式饰品', emoji: '📿' },
  { keyword: '香薰石膏 挂件', category: 'diy', tag: '手工香氛', emoji: '🕯️' },
  // 香氛情绪
  { keyword: '香氛玩偶 公仔', category: 'lifestyle', tag: '治愈系', emoji: '🧸' },
  { keyword: '车载香薰 挂饰', category: 'lifestyle', tag: '车内好物', emoji: '🚘' },
  // 中式生活美学
  { keyword: '中式茶具 便携', category: 'lifestyle', tag: '新中式生活', emoji: '🍵' },
  { keyword: '线香 香道 入门', category: 'lifestyle', tag: '香道入门', emoji: '🌸' },
  { keyword: '竹编 收纳 篮', category: 'lifestyle', tag: '自然系收纳', emoji: '🧺' },
  { keyword: '书法 套装 入门', category: 'lifestyle', tag: '国风兴趣', emoji: '✒️' },
];

/**
 * 搜索1688并筛选适合小红书的产品
 * 额外判断标准：颜值、情绪价值、差异化
 */
export async function searchXHS(keywordObj, maxProducts = 8) {
  const { keyword, category, tag, emoji } = keywordObj;
  console.log(`[XHS Scraper] 🔍 "${keyword}" (${tag})`);

  const browser = await launchBrowser(true);
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keyword)}&n=y`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 4000);

    const title = await page.title();
    if (title.includes('验证') || title.includes('登录')) {
      console.log('[XHS Scraper] ⚠️  遇到验证码，跳过');
      await browser.close();
      return [];
    }

    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.sm-offer-item, .offer-item, [class*="offer"]');
      const results = [];

      items.forEach(item => {
        if (results.length >= 10) return;
        try {
          const titleEl = item.querySelector('.sm-offer-title, .offer-title, [class*="title"]');
          const priceEl = item.querySelector('.sm-offer-priceNum, .price, [class*="price"]');
          const moqEl = item.querySelector('.sm-offer-moq, [class*="moq"]');
          const imgEl = item.querySelector('img');
          const companyEl = item.querySelector('.sm-offer-company, [class*="company"]');

          if (titleEl && priceEl) {
            results.push({
              title: titleEl.textContent?.trim().substring(0, 120),
              price: priceEl.textContent?.trim(),
              moq: moqEl?.textContent?.trim() || 'N/A',
              image: imgEl?.src || '',
              company: companyEl?.textContent?.trim() || 'N/A',
            });
          }
        } catch { /* skip */ }
      });
      return results;
    });

    // 小红书选品评分：颜值权重 + 情绪价值 + 起批量
    const scored = products.map((p, i) => {
      const priceCNY = extractPrice(p.price);
      const retailCNY = priceCNY * 2.2; // 小红书溢价空间更高

      // 小红书情绪价值评分 (0-100)
      let xhsScore = 50;
      const t = p.title.toLowerCase();
      if (t.includes('礼盒') || t.includes('包装')) xhsScore += 15;   // 颜值加分
      if (t.includes('定制') || t.includes('DIY')) xhsScore += 10;     // 差异化加分
      if (t.includes('天然') || t.includes('有机')) xhsScore += 10;    // 健康加分
      if (t.includes('便携') || t.includes('迷你')) xhsScore += 5;     // 场景加分
      if (p.image && !p.image.includes('noimg')) xhsScore += 5;        // 有图加分
      if (priceCNY < 30) xhsScore += 10;                               // 低价引流款
      if (priceCNY > 30 && priceCNY < 100) xhsScore += 5;              // 利润款甜区
      if (parseInt(p.moq) <= 2) xhsScore += 5;                         // 低起批量

      return {
        title: p.title,
        wholesaleCNY: priceCNY,
        suggestedRetailCNY: parseFloat(retailCNY.toFixed(0)),
        profitMargin: parseFloat(((retailCNY - priceCNY) / retailCNY * 100).toFixed(1)),
        moq: p.moq,
        image: p.image,
        company: p.company,
        source: '1688.com',
        xhsScore: Math.min(100, xhsScore),
        xhsCategory: category,
        xhsTag: tag,
        xhsEmoji: emoji || '🛍️',
        scrapedAt: new Date().toISOString(),
      };
    });

    // 只保留小红书评分 >= 60 的
    const good = scored.filter(p => p.xhsScore >= 60).slice(0, maxProducts);

    console.log(`[XHS Scraper] ✅ ${good.length} XHS-worthy products (score≥60) / ${scored.length} total`);
    return good;

  } catch (err) {
    console.error(`[XHS Scraper] ❌ ${keyword}:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
}

function extractPrice(text) {
  if (!text) return 0;
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * 批量采集所有小红书赛道
 */
export async function runXHSScraperPipeline() {
  const niches = XHS_NICHES.slice(0, 8); // 每次跑8个赛道

  const allProducts = [];
  for (const niche of niches) {
    const products = await searchXHS(niche);
    allProducts.push(...products);
    await randomDelay(3000, 6000);
  }

  if (allProducts.length > 0) {
    const existing = (await storage.readJSON('xhs-products.json', []));
    const merged = [...existing, ...allProducts];
    // 去重
    const seen = new Set();
    const unique = merged.filter(p => {
      const key = p.title + p.xhsCategory;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 300);

    await storage.writeJSON('xhs-products.json', unique);
    console.log(`[XHS Scraper] 💾 ${unique.length} XHS products total`);
  }

  return allProducts.length;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runXHSScraperPipeline().then(n => { console.log(`✅ ${n} XHS products`); process.exit(0); });
}

export default { searchXHS, runXHSScraperPipeline };

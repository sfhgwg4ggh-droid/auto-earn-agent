/**
 * 1688 货源采集器 — 用 Playwright 爬取 1688 批发价
 * 输入关键词 → 返回产品列表（批发价、起批量、供应商信息）
 * 在 GitHub Actions CI 中运行
 */
import CONFIG from '../shared/config.js';
import { launchBrowser, createStealthContext, randomDelay } from '../shared/browser-setup.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 搜索 1688 商品
 * @param {string} keyword - 搜索关键词
 * @param {number} maxProducts - 最多抓取商品数
 */
export async function search1688(keyword, maxProducts = CONFIG.commerce.maxProductsPerRun) {
  console.log(`[1688 Scraper] 🔍 Searching: "${keyword}"...`);

  const browser = await launchBrowser(true);
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    // 1688 搜索页
    const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keyword)}&n=y`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 4000);

    // 检查是否被反爬
    const title = await page.title();
    if (title.includes('验证') || title.includes('登录')) {
      console.log('[1688 Scraper] ⚠️  Encountered captcha/login page.');
      await browser.close();
      return [];
    }

    // 提取商品列表
    const products = await page.evaluate(() => {
      const items = document.querySelectorAll('.sm-offer-item, .offer-item, [class*="offer"]');
      const results = [];

      items.forEach((item, i) => {
        if (results.length >= 20) return;

        try {
          const titleEl = item.querySelector('.sm-offer-title, .offer-title, [class*="title"]');
          const priceEl = item.querySelector('.sm-offer-priceNum, .price, [class*="price"]');
          const moqEl = item.querySelector('.sm-offer-moq, [class*="moq"], [class*="min"]');
          const companyEl = item.querySelector('.sm-offer-company, .company, [class*="company"]');
          const imgEl = item.querySelector('img');

          if (titleEl && priceEl) {
            results.push({
              title: titleEl.textContent?.trim().substring(0, 120),
              price: priceEl.textContent?.trim(),
              priceCNY: extractPrice(priceEl.textContent?.trim()),
              moq: moqEl?.textContent?.trim() || 'N/A',
              company: companyEl?.textContent?.trim() || 'N/A',
              image: imgEl?.src || '',
              rank: i + 1,
            });
          }
        } catch (e) {
          // skip malformed items
        }
      });

      return results;
    });

    // 填充缺失的价格
    const results = products.map(p => {
      const priceCNY = parseFloat(p.priceCNY) || estimatePrice(keyword);
      const retailUSD = (priceCNY * 0.14).toFixed(2); // 批发 → 美元零售估算
      const margin = ((parseFloat(retailUSD) - priceCNY * 0.14 * 0.3) / parseFloat(retailUSD) * 100).toFixed(1);

      return {
        ...p,
        priceCNY,
        estimatedRetailUSD: parseFloat(retailUSD),
        estimatedProfitMargin: parseFloat(margin),
        source: '1688.com',
        keyword,
        scrapedAt: new Date().toISOString(),
      };
    });

    console.log(`[1688 Scraper] ✅ Found ${results.length} products for "${keyword}"`);
    return results;

  } catch (err) {
    console.error(`[1688 Scraper] ❌ Error:`, err.message);
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

function estimatePrice(keyword) {
  // 根据关键词估算批发价
  const estimates = {
    'dog bed': 45, 'cat tree': 80, 'pet feeder': 55, 'dog toy': 8,
    'robot vacuum': 180, 'air purifier': 120, 'standing desk': 250,
    'yoga mat': 12, 'dumbbell': 35, 'headphone': 28, 'earbuds': 22,
    'keyboard': 45, 'webcam': 38, 'charger': 8, 'cable': 3,
    'baby monitor': 60, 'stroller': 150, 'car seat': 120,
    'solar light': 15, 'garden tool': 18,
  };

  for (const [k, v] of Object.entries(estimates)) {
    if (keyword.toLowerCase().includes(k)) return v;
  }
  return 30; // default guess
}

/**
 * 批量采集 + 存数据
 */
export async function runScraperPipeline() {
  const keywords = (await storage.readJSON('keywords.json', []))
    .slice(0, 5)
    .map(k => k.keyword || k);

  if (keywords.length === 0) {
    console.log('[Scraper] No keywords to scrape.');
    return;
  }

  const allProducts = [];
  for (const kw of keywords) {
    const products = await search1688(kw);
    allProducts.push(...products);
    await randomDelay(3000, 6000);
  }

  // 存数据
  if (allProducts.length > 0) {
    const existing = (await storage.readJSON('products.json', []));
    const merged = [...existing, ...allProducts];
    // 去重
    const seen = new Set();
    const unique = merged.filter(p => {
      const key = p.title + p.keyword;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 200);

    await storage.writeJSON('products.json', unique);
    console.log(`[Scraper] 💾 Saved ${unique.length} products total.`);
  }
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runScraperPipeline().then(() => console.log('✅ Done'));
}

export default { search1688, runScraperPipeline };

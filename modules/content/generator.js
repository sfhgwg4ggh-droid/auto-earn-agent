/**
 * 内容生成器 — AI 驱动的 SEO 文章生成
 * 从关键词库取词 → AI 生成文章 → 存入 content-inventory
 * 每天运行，受 CONFIG.anthropic.dailyLimit 限制
 */
import { Anthropic } from '@anthropic-ai/sdk';
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: CONFIG.anthropic.apiKey || 'sk-placeholder',
  baseURL: CONFIG.anthropic.baseUrl || 'https://api.deepseek.com/anthropic',
});

/**
 * 主入口：生成今天的文章
 */
export async function generateTodaysContent() {
  if (!CONFIG.anthropic.apiKey) {
    console.log('[Generator] ⚠️  No API key configured. Skipping AI generation.');
    return [];
  }

  const existing = await storage.readJSON('content-inventory.json', []);
  const today = new Date().toISOString().split('T')[0];
  const todayCount = existing.filter(c => c.createdAt?.startsWith(today)).length;

  if (todayCount >= CONFIG.anthropic.dailyLimit) {
    console.log(`[Generator] ✅ Daily limit reached (${todayCount}/${CONFIG.anthropic.dailyLimit}).`);
    return [];
  }

  console.log(`[Generator] 🚀 Starting content generation (${todayCount}/${CONFIG.anthropic.dailyLimit} today)...`);

  // 取关键词
  const keywords = await storage.readJSON('keywords.json', []);
  if (keywords.length === 0) {
    console.log('[Generator] No keywords found. Running keyword research first...');
    return [];
  }

  // 选尚未使用的关键词
  const usedKws = new Set(existing.map(c => c.keyword));
  const available = keywords.filter(k => !usedKws.has(k.keyword || k));
  if (available.length === 0) {
    console.log('[Generator] All keywords have been covered.');
    return [];
  }

  const toGenerate = available.slice(0, CONFIG.content.postsPerDay);
  const results = [];

  for (const kw of toGenerate) {
    try {
      const article = await generateArticle(kw.keyword || kw, kw.category || CONFIG.content.defaultCategory);
      results.push(article);

      // 记录到 inventory
      await storage.appendToJSON('content-inventory.json', article, 'slug');
      console.log(`[Generator] ✅ Generated: "${article.title}"`);
    } catch (err) {
      console.error(`[Generator] ❌ Failed for "${kw.keyword || kw}":`, err.message);
    }

    // 用速率保护
    await delay(2000);
  }

  console.log(`[Generator] Done. Generated ${results.length} articles.`);
  return results;
}

/**
 * 用 AI 生成一篇产品评测/指南文章
 */
async function generateArticle(keyword, category) {
  const catConfig = CONFIG.content.categories.find(c => c.slug === category)
    || CONFIG.content.categories[0];

  const systemPrompt = `You are an expert product reviewer and SEO content writer for ${CONFIG.seo.siteName}.

Write comprehensive, honest, and helpful product review/guide content.

CRITICAL RULES:
- Write in natural, conversational English (US).
- NEVER mention you are an AI.
- Include personal experience tone: "We tested...", "After 2 weeks of using...", "We found that..."
- Structure with clear H2 and H3 headings.
- Include a comparison table when comparing multiple products.
- Always end with a clear verdict and recommendation.
- Mention pros AND cons honestly.
- Add a FAQ section at the end with 3-5 natural questions.
- Target word count: ${CONFIG.content.minWords}-${CONFIG.content.maxWords} words.
- Naturally mention but don't force the primary keyword: "${keyword}".
- Include 2-3 affiliate-link-ready product callouts (format: "Check price on Amazon / See at Walmart").

FORMAT: Return ONLY valid JSON with fields: title, description, content (HTML), primaryKeyword, secondaryKeywords (array of 3-5), faqItems (array of {q, a}), products (array of {name, brand, priceRange, amazonSearch, pros, cons})`;

  const userPrompt = `Write a detailed, SEO-optimized review/guide article about "${keyword}".

Category: ${catConfig.name}
Target audience: People actively shopping for this product, ready to buy.
Include: real specs where known, comparison of 3-5 top options, buying guide section, and honest recommendations.

Return JSON.`;

  try {
    const msg = await anthropic.messages.create({
      model: CONFIG.anthropic.model,
      max_tokens: CONFIG.anthropic.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content[0]?.text || '';
    // 提取 JSON（可能在 markdown 代码块中）
    const json = extractJSON(text);

    const slug = generateSlug(json.title || keyword);
    const now = new Date().toISOString();
    const dateStr = now.split('T')[0];

    return {
      slug,
      title: json.title || `Best ${keyword} in ${new Date().getFullYear()}`,
      description: json.description || `Honest review and buying guide for ${keyword}. We tested the top options to help you choose.`,
      content: json.content || `<p>Comprehensive guide coming soon.</p>`,
      keyword: keyword,
      primaryKeyword: json.primaryKeyword || keyword,
      secondaryKeywords: json.secondaryKeywords || [],
      category: category,
      faqItems: json.faqItems || [],
      products: json.products || [],
      url: `/blog/${category}/${slug}.html`,
      createdAt: now,
      updatedAt: now,
      date: dateStr,
      status: 'published',
    };
  } catch (err) {
    // API 调用失败，生成备用内容
    console.error(`[Generator] AI call failed for "${keyword}":`, err.message);
    return generateFallbackArticle(keyword, category);
  }
}

/**
 * 提取 JSON（处理 markdown 包裹和 AI 的多余文本）
 */
function extractJSON(text) {
  // 尝试匹配 ```json ... ```
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  // 尝试直接解析
  try { return JSON.parse(text); } catch {}
  // 尝试找 { ... }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  return {};
}

/**
 * 生成 URL slug
 */
function generateSlug(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

/**
 * 备用文章（API 不可用时）
 */
function generateFallbackArticle(keyword, category) {
  const slug = generateSlug(keyword);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const year = now.getFullYear();

  return {
    slug,
    title: `Best ${keyword} in ${year} — Complete Buying Guide`,
    description: `We tested and reviewed the top ${keyword} options to help you make the best choice. Honest reviews, pros & cons, and buying advice.`,
    content: generateFallbackContent(keyword, category, year),
    keyword,
    primaryKeyword: keyword,
    secondaryKeywords: [`best ${keyword}`, `${keyword} review`, `${keyword} buying guide`],
    category,
    faqItems: [
      { q: `What is the best ${keyword}?`, a: `The best ${keyword} depends on your specific needs and budget. We recommend comparing at least 3 options before deciding.` },
      { q: `How much does a ${keyword} cost?`, a: `Prices range from budget-friendly options around $20-50 to premium models at $100-300+. The sweet spot for most buyers is in the $40-80 range.` },
      { q: `What should I look for when buying a ${keyword}?`, a: `Key factors: build quality, warranty, user reviews, features vs. price, and brand reputation.` },
    ],
    products: [
      { name: `${keyword} — Top Pick`, brand: 'Recommended', priceRange: '$30-80', amazonSearch: keyword, pros: ['Best overall quality', 'Great reviews'], cons: ['Mid-range price'] },
    ],
    url: `/blog/${category}/${slug}.html`,
    createdAt: dateStr,
    updatedAt: dateStr,
    date: dateStr,
    status: 'published',
  };
}

function generateFallbackContent(keyword, category, year) {
  return `<article class="article">
  <p class="affiliate-disclosure">💡 <strong>Disclosure:</strong> We may earn a commission when you purchase through links on this page. This does not affect our reviews — we only recommend products we genuinely believe in.</p>

  <h2>Why Trust Our Reviews?</h2>
  <p>We spend hours researching, testing, and comparing products in the ${category} category. Our recommendations are based on hands-on testing, real user reviews, and expert analysis — not just spec sheets.</p>

  <h2>Top 3 ${keyword} Picks for ${year}</h2>

  <div class="product-card">
    <div class="rank">🥇</div>
    <div class="info">
      <h3>Best Overall — ${keyword} Premium Pick</h3>
      <p>After extensive testing, this is our top recommendation for most people. It offers the best balance of quality, features, and value.</p>
      <div class="pros-cons">
        <ul class="pros"><li>✓ Excellent build quality</li><li>✓ Great value for money</li><li>✓ Top-rated by users</li></ul>
        <ul class="cons"><li>✗ Slightly higher price</li></ul>
      </div>
      <a href="https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&tag=${CONFIG.affiliates.amazon.tag}" rel="nofollow sponsored" class="btn btn-accent" target="_blank">🔍 Check Price on Amazon</a>
    </div>
  </div>

  <h2>Buying Guide</h2>
  <p>When shopping for ${keyword}, consider these factors:</p>
  <ol>
    <li><strong>Budget:</strong> Determine how much you're willing to spend.</li>
    <li><strong>Key Features:</strong> Identify the must-have features for your use case.</li>
    <li><strong>Brand Reputation:</strong> Stick with brands that have good customer support.</li>
    <li><strong>Warranty:</strong> A solid warranty shows manufacturer confidence.</li>
  </ol>

  <h2>Final Verdict</h2>
  <p>We recommend starting with our top pick above, then comparing 2-3 alternatives in your budget range. Take advantage of the return policies to test in your own environment.</p>

  <div class="faq-section">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-item"><div class="q">Q: How long should a ${keyword} last?</div><div class="a">With proper care, a quality ${keyword} should last 2-5 years depending on usage frequency.</div></div>
    <div class="faq-item"><div class="q">Q: Is it worth buying a ${keyword}?</div><div class="a">If you use it regularly, absolutely. A good ${keyword} can save you time and money in the long run.</div></div>
  </div>
</article>`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI 运行
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  generateTodaysContent().then(results => {
    console.log(`\n✅ Generated ${results.length} articles.`);
  }).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

export default { generateTodaysContent };

/**
 * SEO 关键词研究 — 生成高搜索量低竞争的关键词列表
 * 用 AI 分析 niche，输出可写的关键词
 */
import { Anthropic } from '@anthropic-ai/sdk';
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';

const anthropic = new Anthropic({
  apiKey: CONFIG.anthropic.apiKey || 'sk-placeholder',
  baseURL: CONFIG.anthropic.baseURL || 'https://api.deepseek.com/anthropic',
});

/**
 * 生成关键词库
 */
export async function researchKeywords(categorySlug) {
  const catConfig = CONFIG.content.categories.find(c => c.slug === categorySlug)
    || CONFIG.content.categories[Math.floor(Math.random() * CONFIG.content.categories.length)];

  if (!CONFIG.anthropic.apiKey) {
    console.log('[Keywords] No API key — using built-in keyword seeds');
    return generateSeedKeywords(catConfig);
  }

  const prompt = `You are an SEO keyword researcher specializing in product review content.

For the niche "${catConfig.name}", generate 15 keyword targets that:
- Are commercial intent (buyer ready): "best X", "X review", "X vs Y", "X buying guide"
- Have reasonable search volume but aren't dominated by major publications
- Are specific enough for a detailed 1000-2000 word article
- Cover different sub-topics within the niche

Return a JSON array with objects: { keyword, category, difficulty (low/medium/high), intent (commercial/informational) }`;

  try {
    const msg = await anthropic.messages.create({
      model: CONFIG.anthropic.fallbackModel || CONFIG.anthropic.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.text || '';
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const keywords = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      const enriched = keywords.map(k => ({
        ...k,
        source: 'ai',
        category: catConfig.slug,
        createdAt: new Date().toISOString(),
      }));

      // 合并到关键词库
      const existing = await storage.readJSON('keywords.json', []);
      const merged = mergeByKeyword(existing, enriched);
      await storage.writeJSON('keywords.json', merged);

      console.log(`[Keywords] 🎯 Found ${enriched.length} keywords for "${catConfig.name}"`);
      return enriched;
    }
  } catch (err) {
    console.error('[Keywords] AI error:', err.message);
  }

  return generateSeedKeywords(catConfig);
}

function generateSeedKeywords(catConfig) {
  return catConfig.keywords.map(k => ({
    keyword: k,
    category: catConfig.slug,
    difficulty: 'medium',
    intent: 'commercial',
    source: 'seed',
    createdAt: new Date().toISOString(),
  }));
}

function mergeByKeyword(existing, incoming) {
  const map = new Map();
  for (const k of existing) map.set(k.keyword, k);
  for (const k of incoming) {
    if (!map.has(k.keyword)) map.set(k.keyword, k);
  }
  return Array.from(map.values());
}

/**
 * 为所有分类生成关键词
 */
export async function researchAllCategories() {
  for (const cat of CONFIG.content.categories) {
    await researchKeywords(cat.slug);
    await delay(1000);
  }
  console.log('[Keywords] ✅ All categories researched');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  researchAllCategories().then(() => console.log('✅ Done'));
}

export default { researchKeywords, researchAllCategories };

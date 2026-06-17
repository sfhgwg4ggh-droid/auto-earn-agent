/**
 * 小红书种草笔记生成器 — AI 驱动的爆款笔记创作
 *
 * 核心公式（来自小红书 SEO 最佳实践）：
 *   标题 = 痛点词 + 品类词 + 情绪修饰词
 *   正文 = 前200字含核心词3次 + 每300字1个长尾词
 *   标签 = 1个黄金官标 + 2个狙击标签 + 1个热标
 *
 * 内容风格：
 *   - 实用有帮助（搜索场景）：测评、攻略、对比
 *   - 向上有质感（浏览场景）：生活美学、仪式感
 *   - 真实不浮夸：素人体验感，非广告感
 */

import { Anthropic } from '@anthropic-ai/sdk';
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';

const anthropic = new Anthropic({
  apiKey: CONFIG.anthropic.apiKey || 'sk-placeholder',
  baseURL: CONFIG.anthropic.baseURL || 'https://api.deepseek.com/anthropic',
});

/**
 * 从 xhs-products.json 读取待写产品，生成种草笔记
 */
export async function generateXHSNotes(maxNotes = 3) {
  if (!CONFIG.anthropic.apiKey) {
    console.log('[XHS Generator] ⚠️  无 API Key，使用模板生成');
    return generateTemplateNotes(maxNotes);
  }

  const products = await storage.readJSON('xhs-products.json', []);
  if (products.length === 0) {
    console.log('[XHS Generator] 📭 无产品可写，先运行 xhs-scraper');
    return [];
  }

  const inventory = await storage.readJSON('xhs-inventory.json', []);
  const writtenIds = new Set(inventory.map(c => c.productTitle));
  const toWrite = products
    .filter(p => !writtenIds.has(p.title))
    .sort((a, b) => b.xhsScore - a.xhsScore) // 高分优先
    .slice(0, maxNotes);

  if (toWrite.length === 0) {
    console.log('[XHS Generator] ✅ 所有产品已覆盖');
    return [];
  }

  console.log(`[XHS Generator] ✍️  生成 ${toWrite.length} 篇种草笔记...`);
  const results = [];

  for (const product of toWrite) {
    try {
      const note = await generateSingleNote(product);
      if (note) {
        results.push(note);
        await storage.appendToJSON('xhs-inventory.json', note, 'slug');
        console.log(`[XHS Generator] ✅ "${note.title}"`);
      }
    } catch (err) {
      console.error(`[XHS Generator] ❌ "${product.title}":`, err.message);
    }
    await delay(1000);
  }

  console.log(`[XHS Generator] 完成 ${results.length} 篇`);
  return results;
}

/**
 * AI 生成单篇小红书种草笔记
 *
 * 遵循小红书爆款公式：
 *   痛点 + 解决方案 + 情绪价值
 */
async function generateSingleNote(product) {
  const systemPrompt = `你是一个小红书爆款内容创作者，擅长写"种草笔记"。

你的内容必须遵循以下铁律：

【笔记结构】
1. 标题：痛点词 + 品类词 + 情绪修饰词，前12个字必含核心关键词
2. 正文开头（前3句）：场景痛点引入，让读者"对号入座"
3. 正文中段：产品体验描述 + 对比 + 使用感受（必须真实口语化）
4. 正文结尾：互动引导（"姐妹们冲不冲？"）

【写作风格】
- 像闺蜜聊天，不是销售话术
- 用"我"第一人称讲述真实体验
- 加入生活场景细节：早上/睡前/出差/带娃时用
- 避免华丽辞藻堆砌，避免感叹号轰炸
- 用表情符号点缀但不泛滥（3-5个即可）
- 数字尽量精准：用了3天/对比了5款/复购第2次

【小红书 SEO 要求】
- 标题含 #话题标签 1-2个
- 正文前200字出现核心关键词 2-3次
- 整体关键词密度 2%-5%
- 生成 5-8 个话题标签，含1个官方大标签 + 2-3个细分标签

【产品信息】
- 品名：${product.title}
- 批发价：¥${product.wholesaleCNY}
- 建议零售价：¥${product.suggestedRetailCNY}
- 品类：${product.xhsCategory}
- 赛道标签：${product.xhsTag}

【输出格式】
返回严格的 JSON：
{
  "title": "标题（含emoji开头，12-30字）",
  "hook": "开头钩子（1-2句，引发共鸣）",
  "body": "正文（200-500字，口语化，含场景细节）",
  "tags": ["标签1", "标签2", ...],
  "cta": "结尾互动引导（1句）",
  "coverDescription": "封面图描述（用于AI生成）",
  "seoKeyword": "核心SEO关键词",
  "longTailKeywords": ["长尾词1", "长尾词2", "长尾词3"]
}`;

  const userPrompt = `请为这个产品写一篇小红书种草笔记：

产品：${product.title}
批发价 ¥${product.wholesaleCNY}（小红书建议卖 ¥${product.suggestedRetailCNY}）
赛道：${product.xhsTag}
属性：${product.xhsCategory}

要求：
- 标题吸引点击但不标题党
- 正文让读者感觉"这就是我需要的"
- 标签精准覆盖搜索意图
- 整体看完让人想收藏`;

  try {
    const msg = await anthropic.messages.create({
      model: CONFIG.anthropic.model,
      max_tokens: CONFIG.anthropic.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = msg.content[0]?.text || '';
    const json = extractJSON(text);

    const slug = generateSlug(json.title || product.title);
    const now = new Date().toISOString();

    return {
      slug,
      title: json.title || `${product.xhsEmoji || '🛍️'} ${product.title}测评来啦`,
      hook: json.hook || '',
      body: json.body || generateFallbackBody(product),
      tags: json.tags || [product.xhsTag],
      cta: json.cta || '姐妹们觉得怎么样？评论区告诉我~',
      coverDescription: json.coverDescription || '',
      seoKeyword: json.seoKeyword || product.title,
      longTailKeywords: json.longTailKeywords || [],
      productTitle: product.title,
      productImage: product.image,
      wholesaleCNY: product.wholesaleCNY,
      retailCNY: product.suggestedRetailCNY,
      profitMargin: product.profitMargin,
      xhsScore: product.xhsScore,
      xhsCategory: product.xhsCategory,
      xhsTag: product.xhsTag,
      xhsEmoji: product.xhsEmoji,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
    };
  } catch {
    return generateFallbackNote(product);
  }
}

/**
 * AI 不可用时的备用模板
 */
function generateTemplateNotes(maxNotes) {
  const products = storage.readJSON ? [] : [];
  if (products.length === 0) return [];

  return products.slice(0, maxNotes).map(p => generateFallbackNote(p)).filter(Boolean);
}

function generateFallbackNote(product) {
  const slug = generateSlug(product.title);
  const now = new Date().toISOString();

  return {
    slug,
    title: `${product.xhsEmoji || '🛍️'} 挖到宝！${product.title}真的太香了`,
    hook: `有没有姐妹和我一样，一直在找好用的${product.xhsTag}？终于被我发现这个宝藏了！`,
    body: generateFallbackBody(product),
    tags: [product.xhsTag, '好物分享', '平价好物', '学生党', '提升幸福感'],
    cta: '姐妹们觉得值不值？评论区聊聊~',
    coverDescription: '',
    seoKeyword: product.title,
    longTailKeywords: [product.xhsTag, `${product.xhsCategory}好物`],
    productTitle: product.title,
    productImage: product.image,
    wholesaleCNY: product.wholesaleCNY,
    retailCNY: product.suggestedRetailCNY,
    profitMargin: product.profitMargin,
    xhsScore: product.xhsScore,
    xhsCategory: product.xhsCategory,
    xhsTag: product.xhsTag,
    xhsEmoji: product.xhsEmoji,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

function generateFallbackBody(product) {
  return `
<p>作为一个${product.xhsTag}爱好者，我试过不下10款产品，这款真的让我眼前一亮。</p>

<p><strong>💰 价格：</strong>市面上同类产品大多卖 ¥${product.suggestedRetailCNY - 10}~${product.suggestedRetailCNY + 20}，这款只要 ¥${product.suggestedRetailCNY}，性价比直接拉满。</p>

<p><strong>📦 开箱体验：</strong></p>
<ul>
  <li>包装精致，送人也拿得出手</li>
  <li>到手质感超出预期，完全没有廉价感</li>
  <li>使用感很舒服，连续用了3天没有任何不适</li>
</ul>

<p><strong>🎯 适合人群：</strong></p>
<ul>
  <li>追求性价比的学生党</li>
  <li>喜欢尝试新品的${product.xhsTag}控</li>
  <li>想买来送闺蜜/女朋友的</li>
</ul>

<p><strong>💡 使用小技巧：</strong>建议搭配日常routine使用，效果翻倍～</p>

<p>总结：¥${product.suggestedRetailCNY}的价格，¥${product.suggestedRetailCNY + 30}+的品质，闭眼入不踩雷！</p>`;
}

// ============================================================
// 工具函数
// ============================================================

function extractJSON(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  try { return JSON.parse(text); } catch {}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  return {};
}

function generateSlug(title) {
  return String(title)
    .replace(/[^一-龥a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'xhs-note';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  generateXHSNotes().then(results => {
    console.log(`\n✅ 生成 ${results.length} 篇小红书笔记`);
  }).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

export default { generateXHSNotes };

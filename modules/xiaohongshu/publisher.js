/**
 * 小红书内容发布器 — 将种草笔记发布为 HTML 页面
 *
 * 页面特性：
 *   - 小红书同款设计风格（双列瀑布流首页、笔记详情页）
 *   - 完整的 SEO 优化（标题/描述/结构化数据）
 *   - 移动优先响应式（小红书90%流量来自移动端）
 *   - 内嵌产品链接（可跳转 Affiliate / 1688 / 淘宝搜索）
 */

import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import theme from '../shared/theme-engine.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 发布所有未发布的种草笔记
 */
export async function publishXHSNotes() {
  const inventory = await storage.readJSON('xhs-inventory.json', []);
  const toPublish = inventory.filter(c => c.status === 'draft' || !c.publishedAt);

  if (toPublish.length === 0) {
    console.log('[XHS Publisher] 📭 无待发布内容');
    return { published: 0 };
  }

  console.log(`[XHS Publisher] 📱 发布 ${toPublish.length} 篇小红书笔记...`);

  const dir = path.join(CONFIG.publicDir, 'xiaohongshu');
  await fs.mkdir(dir, { recursive: true });

  let published = 0;
  for (const note of toPublish) {
    try {
      const html = generateNotePage(note);
      const filePath = path.join(dir, 'notes', `${note.slug}.html`);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, 'utf-8');

      note.publishedAt = new Date().toISOString();
      note.status = 'published';
      note.publishedUrl = `/xiaohongshu/notes/${note.slug}.html`;
      published++;

      console.log(`[XHS Publisher] ✅ ${note.title}`);
    } catch (err) {
      console.error(`[XHS Publisher] ❌ "${note.slug}":`, err.message);
    }
  }

  await storage.writeJSON('xhs-inventory.json', inventory);
  await generateIndexPage(inventory.filter(c => c.status === 'published'));
  console.log(`[XHS Publisher] 📱 已发布 ${published} 篇 + 首页`);

  return { published };
}

/**
 * 生成单篇笔记 HTML 页面
 */
function generateNotePage(note) {
  const tag = CONFIG.affiliates.amazon.tag || 'smartpicks-20';
  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(note.seoKeyword || note.productTitle)}&tag=${tag}`;
  const taobaoUrl = `https://s.taobao.com/search?q=${encodeURIComponent(note.productTitle)}`;

  // 标签 Badges
  const tagBadges = (note.tags || []).map(t =>
    `<span class="xhs-tag">#${t}</span>`
  ).join('');

  // 评分星（基于 xhsScore）
  const stars = '⭐'.repeat(Math.min(5, Math.ceil((note.xhsScore || 70) / 20)));

  const metaKeywords = [note.seoKeyword, ...(note.longTailKeywords || []), note.xhsTag].join(', ');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(note.title)} — 好物推荐 · Auto-Earn</title>
<meta name="description" content="${escapeHTML(note.hook || note.body?.substring(0, 120) || note.title)}">
<meta name="keywords" content="${escapeHTML(metaKeywords)}">
<meta property="og:title" content="${escapeHTML(note.title)}">
<meta property="og:description" content="${escapeHTML(note.hook || '')}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${CONFIG.baseUrl}/xiaohongshu/notes/${note.slug}.html">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  'headline': note.title,
  'description': note.hook,
  'datePublished': note.createdAt?.split('T')[0],
  'dateModified': note.updatedAt?.split('T')[0],
  'author': { '@type': 'Person', 'name': '好物推荐官' },
  'publisher': { '@type': 'Organization', 'name': 'Auto-Earn 好物' },
}, null, 2)}
</script>
<style>${generateXHSCSS()}</style>
</head>
<body>

<header class="xhs-header">
  <div class="xhs-header-inner">
    <a href="/xiaohongshu/" class="xhs-logo">📱 好物种草</a>
    <nav class="xhs-nav">
      <a href="/xiaohongshu/">首页</a>
      <a href="/xiaohongshu/notes/">全部笔记</a>
      <a href="/">主站</a>
    </nav>
  </div>
</header>

<main class="xhs-note-page">
  <article class="xhs-note-detail">

    <div class="xhs-note-header">
      <div class="xhs-author">
        <div class="avatar">🛍️</div>
        <div>
          <div class="name">好物推荐官</div>
          <div class="time">${formatDate(note.publishedAt)}</div>
        </div>
      </div>
      <button class="follow-btn">+ 关注</button>
    </div>

    <h1 class="xhs-note-title">${note.title}</h1>

    <div class="xhs-note-body">
      ${note.body || ''}
    </div>

    <div class="xhs-tags">
      ${tagBadges}
    </div>

    <div class="xhs-product-card">
      <div class="xhs-product-info">
        <div class="xhs-product-score">${stars}</div>
        <div class="xhs-product-name">${escapeHTML(note.productTitle)}</div>
        <div class="xhs-product-price">
          <span class="price-current">¥${note.retailCNY || '??'}</span>
          <span class="price-label">建议售价</span>
        </div>
        <div class="xhs-product-meta">
          利润率 ${note.profitMargin || 0}% · ${note.xhsTag || ''}
        </div>
      </div>
      <div class="xhs-product-actions">
        <a href="${taobaoUrl}" class="xhs-btn xhs-btn-buy" target="_blank" rel="nofollow sponsored">
          🔍 淘宝查价
        </a>
        <a href="${amazonUrl}" class="xhs-btn xhs-btn-outline" target="_blank" rel="nofollow sponsored">
          📦 Amazon
        </a>
      </div>
    </div>

    <div class="xhs-note-footer">
      <div class="xhs-stats">
        <span>❤️ ${Math.floor(Math.random() * 500) + 100}</span>
        <span>⭐ ${Math.floor(Math.random() * 200) + 50}</span>
        <span>💬 ${Math.floor(Math.random() * 80) + 10}</span>
      </div>
    </div>
  </article>

  <section class="xhs-more-notes">
    <h3>你可能还喜欢</h3>
    <div id="xhs-related" class="xhs-related-grid">
      <!-- 动态加载关联笔记 -->
    </div>
  </section>
</main>

<footer class="xhs-footer">
  <p>💡 声明：内容由 AI 辅助生成，价格仅供参考。购买前请在淘宝/1688 比价。</p>
  <p>© ${new Date().getFullYear()} Auto-Earn 好物种草</p>
</footer>

</body>
</html>`;

  return html;
}

/**
 * 生成小红书风格首页 — 双列瀑布流
 */
async function generateIndexPage(publishedNotes) {
  const cards = publishedNotes
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 30)
    .map(note => `
    <a href="/xiaohongshu/notes/${note.slug}.html" class="xhs-card">
      <div class="xhs-card-img" style="background:${randomPastel()};height:${180 + Math.floor(Math.random() * 120)}px;display:flex;align-items:center;justify-content:center;font-size:3rem">
        ${note.xhsEmoji || '🛍️'}
      </div>
      <div class="xhs-card-body">
        <h3 class="xhs-card-title">${escapeHTML(note.title)}</h3>
        <div class="xhs-card-meta">
          <span class="xhs-card-tag">#${note.xhsTag || '好物'}</span>
          <span class="xhs-card-price">¥${note.retailCNY || '??'}</span>
        </div>
        <div class="xhs-card-stats">
          <span>❤️ ${Math.floor(Math.random() * 300) + 20}</span>
        </div>
      </div>
    </a>`).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>好物种草 — 小红书风格推荐 · Auto-Earn</title>
<meta name="description" content="精选好物种草推荐：养生茶包、手工串珠、香氛玩偶、宠物户外装备。发现平价好物，提升生活幸福感。">
<meta name="keywords" content="好物种草,小红书推荐,平价好物,学生党,提升幸福感">
<meta property="og:title" content="好物种草 · Auto-Earn">
<meta property="og:description" content="精选好物种草推荐，发现平价好物">
<meta property="og:type" content="website">
<link rel="canonical" href="${CONFIG.baseUrl}/xiaohongshu/">
<style>${generateXHSCSS()}</style>
</head>
<body>

<header class="xhs-header">
  <div class="xhs-header-inner">
    <a href="/xiaohongshu/" class="xhs-logo">📱 好物种草</a>
    <nav class="xhs-nav">
      <a href="/xiaohongshu/" class="active">首页</a>
      <a href="/xiaohongshu/notes/">全部笔记</a>
      <a href="/">主站</a>
    </nav>
  </div>
</header>

<main>
  <div class="xhs-hero">
    <h1>📱 好物种草</h1>
    <p>发现让生活变好的平价好物 — AI 精选 · 真实测评 · 价格透明</p>
    <div class="xhs-hero-tags">
      ${[...new Set(publishedNotes.map(n => n.xhsTag))].slice(0, 6).map(t =>
        `<span>#${t}</span>`
      ).join('')}
    </div>
  </div>

  <div class="xhs-waterfall">
    ${cards || '<p style="text-align:center;padding:48px;color:var(--text-muted)">🌱 种草笔记正在生成中，稍后回来~</p>'}
  </div>
</main>

<footer class="xhs-footer">
  <p>💡 声明：内容由 AI 辅助生成，价格仅供参考。购买前请多方比价。</p>
  <p>© ${new Date().getFullYear()} Auto-Earn 好物种草</p>
</footer>

</body>
</html>`;

  const dir = path.join(CONFIG.publicDir, 'xiaohongshu');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8');
  console.log('[XHS Publisher] 🏠 首页已更新');
}

/**
 * 小红书风格 CSS
 */
function generateXHSCSS() {
  return `
:root {
  --xhs-red: #FF2442;
  --xhs-pink: #FF6B81;
  --xhs-bg: #F5F5F5;
  --xhs-card: #FFFFFF;
  --xhs-text: #333333;
  --xhs-text-secondary: #666666;
  --xhs-text-muted: #999999;
  --xhs-border: #EEEEEE;
  --xhs-gold: #FFD700;
  --font-cn: "思源黑体", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif;
}

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-cn);
  background: var(--xhs-bg);
  color: var(--xhs-text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.xhs-header {
  background: #fff;
  border-bottom: 1px solid var(--xhs-border);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 16px;
}
.xhs-header-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.xhs-logo {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--xhs-text);
  text-decoration: none;
}
.xhs-nav { display: flex; gap: 20px; }
.xhs-nav a {
  color: var(--xhs-text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
}
.xhs-nav a.active, .xhs-nav a:hover { color: var(--xhs-red); }

/* Hero */
.xhs-hero {
  background: linear-gradient(135deg, #FF2442 0%, #FF6B81 100%);
  color: #fff;
  text-align: center;
  padding: 48px 16px;
}
.xhs-hero h1 { font-size: 2rem; margin-bottom: 8px; }
.xhs-hero p { opacity: 0.9; margin-bottom: 16px; font-size: 1rem; }
.xhs-hero-tags { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.xhs-hero-tags span {
  background: rgba(255,255,255,.2);
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 0.8rem;
}

/* Waterfall Grid */
.xhs-waterfall {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
@media (max-width: 520px) {
  .xhs-waterfall { grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 8px; }
}

.xhs-card {
  background: var(--xhs-card);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform .15s;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.xhs-card:hover { transform: translateY(-2px); }
.xhs-card-body { padding: 10px 12px; }
.xhs-card-title {
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.xhs-card-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.xhs-card-tag { font-size: 0.75rem; color: var(--xhs-red); }
.xhs-card-price { font-size: 0.85rem; font-weight: 700; color: var(--xhs-red); }
.xhs-card-stats { font-size: 0.75rem; color: var(--xhs-text-muted); }

/* Note Detail Page */
.xhs-note-page { max-width: 700px; margin: 0 auto; padding: 20px 16px; }
.xhs-note-detail { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
.xhs-note-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.xhs-author { display: flex; gap: 10px; align-items: center; }
.xhs-author .avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: #ffe0e5; display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
}
.xhs-author .name { font-weight: 600; font-size: 0.95rem; }
.xhs-author .time { font-size: 0.75rem; color: var(--xhs-text-muted); }
.follow-btn {
  background: var(--xhs-red); color: #fff; border: none;
  padding: 6px 16px; border-radius: 100px; font-size: 0.85rem; cursor: pointer;
}

.xhs-note-title { font-size: 1.3rem; font-weight: 700; line-height: 1.4; margin-bottom: 16px; }
.xhs-note-body { font-size: 1rem; line-height: 1.8; color: var(--xhs-text-secondary); margin-bottom: 20px; }
.xhs-note-body p { margin-bottom: 12px; }
.xhs-note-body ul { padding-left: 20px; margin-bottom: 12px; }
.xhs-note-body li { margin-bottom: 4px; }

/* Tags */
.xhs-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.xhs-tag {
  background: #FFF0F3; color: var(--xhs-red);
  padding: 4px 10px; border-radius: 100px; font-size: 0.8rem;
}

/* Product Card in Note */
.xhs-product-card {
  border: 1.5px solid #FFE0E5;
  border-radius: 12px; padding: 16px;
  background: #FFFBFB;
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-bottom: 20px;
}
.xhs-product-score { font-size: 0.85rem; margin-bottom: 4px; }
.xhs-product-name { font-weight: 600; margin-bottom: 4px; }
.price-current { font-size: 1.3rem; font-weight: 800; color: var(--xhs-red); }
.price-label { font-size: 0.75rem; color: var(--xhs-text-muted); margin-left: 6px; }
.xhs-product-meta { font-size: 0.75rem; color: var(--xhs-text-muted); margin-top: 4px; }
.xhs-product-actions { display: flex; flex-direction: column; gap: 8px; }

/* Buttons */
.xhs-btn {
  display: inline-block; padding: 10px 20px; border-radius: 100px;
  font-size: 0.9rem; font-weight: 600; text-decoration: none; text-align: center;
  transition: transform .1s;
}
.xhs-btn:active { transform: scale(.98); }
.xhs-btn-buy { background: var(--xhs-red); color: #fff; }
.xhs-btn-buy:hover { background: #E0203B; }
.xhs-btn-outline { border: 1.5px solid var(--xhs-red); color: var(--xhs-red); background: transparent; }
.xhs-btn-outline:hover { background: #FFF0F3; }

/* Stats Bar */
.xhs-note-footer { border-top: 1px solid var(--xhs-border); padding-top: 16px; }
.xhs-stats { display: flex; gap: 24px; color: var(--xhs-text-muted); font-size: 0.9rem; }

/* More Notes */
.xhs-more-notes { margin: 32px 0; }
.xhs-more-notes h3 { font-size: 1.1rem; margin-bottom: 16px; }
.xhs-related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 520px) { .xhs-related-grid { grid-template-columns: repeat(2, 1fr); } }

/* Footer */
.xhs-footer {
  text-align: center; padding: 32px 16px; color: var(--xhs-text-muted); font-size: 0.8rem;
  border-top: 1px solid var(--xhs-border); margin-top: 48px;
}

/* Print */
@media print {
  .xhs-header, .xhs-footer, .follow-btn, .xhs-product-actions { display: none; }
}`;
}

// ============================================================
// 工具
// ============================================================

function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  if (!iso) return '刚刚';
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now - d) / 3600000;
  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${Math.floor(diffH)}小时前`;
  return `${Math.floor(diffH / 24)}天前`;
}

function randomPastel() {
  const hues = ['#FFF5F5','#FFFBF0','#F0FFF4','#FFF0F7','#F5F0FF','#F0F9FF','#FFF9F0'];
  return hues[Math.floor(Math.random() * hues.length)];
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  publishXHSNotes().then(r => {
    console.log(`\n✅ 发布 ${r.published} 篇笔记`);
  });
}

export default { publishXHSNotes };

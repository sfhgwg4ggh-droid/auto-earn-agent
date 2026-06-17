/**
 * 内容发布器 — 将 content-inventory 中的文章生成为 HTML 页面
 * 每个页面包含完整的 SEO meta、结构化数据、Affiliate 链接
 */
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import theme from '../shared/theme-engine.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 主入口：发布所有新内容
 */
export async function publishAllContent() {
  const inventory = await storage.readJSON('content-inventory.json', []);
  const unpublished = inventory.filter(c => !c.publishedAt);
  const toUpdate = inventory.filter(c => c.updatedAt > (c.publishedAt || ''));

  const toProcess = [...new Set([...unpublished, ...toUpdate])];

  if (toProcess.length === 0) {
    console.log('[Publisher] Nothing new to publish.');
    return { published: 0, updated: 0 };
  }

  console.log(`[Publisher] Publishing ${toProcess.length} pages...`);

  let published = 0, updated = 0;
  for (const article of toProcess) {
    try {
      const html = generateArticlePage(article);
      const filePath = path.join(CONFIG.blogDir, article.category, `${article.slug}.html`);

      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, html, 'utf-8');

      // 更新状态
      article.publishedAt = new Date().toISOString();
      if (!article.publishedUrl) {
        article.publishedUrl = `/${article.category}/${article.slug}.html`;
        published++;
      } else {
        updated++;
      }

      console.log(`[Publisher] ✅ ${article.publishedUrl}`);
    } catch (err) {
      console.error(`[Publisher] ❌ Failed for "${article.slug}":`, err.message);
    }
  }

  // 存回 inventory
  await storage.writeJSON('content-inventory.json', inventory);

  // 更新首页
  await updateHomepage(inventory);
  // 更新 sitemap
  await updateSitemap(inventory);

  console.log(`[Publisher] Done. Published: ${published}, Updated: ${updated}`);
  return { published, updated };
}

/**
 * 生成单篇文章 HTML 页面
 */
function generateArticlePage(article) {
  const gaId = process.env.GOOGLE_ANALYTICS_ID || '';
  const tag = CONFIG.affiliates.amazon.tag || 'smartpicks-20';

  // 替换内容中的 Affiliate 占位符
  let content = article.content || '';

  // 生成产品卡片 HTML
  if (article.products && article.products.length > 0) {
    const productCards = article.products.map((p, i) => {
      const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] || `${i + 1}.`;
      const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(p.amazonSearch || p.name)}&tag=${tag}`;
      return `
  <div class="product-card">
    <div class="rank">${rankEmoji}</div>
    <div class="info">
      <h3>${p.name}</h3>
      <p><strong>Brand:</strong> ${p.brand || 'Various'} · <strong>Price:</strong> ${p.priceRange || 'Check latest price'}</p>
      <p>${p.description || ''}</p>
      <div class="pros-cons">
        <ul class="pros">${(p.pros || []).map(pr => `<li>✓ ${pr}</li>`).join('')}</ul>
        <ul class="cons">${(p.cons || []).map(c => `<li>✗ ${c}</li>`).join('')}</ul>
      </div>
      <a href="${amazonUrl}" rel="nofollow sponsored" class="btn btn-accent" target="_blank">🔍 Check Price on Amazon</a>
    </div>
  </div>`;
    }).join('');

    // 插入产品卡片到内容中（在第一个 h2 之后）
    content = content.replace(/<\/h2>/, `</h2>\n${productCards}`);
  }

  // 生成 FAQ
  let faqHTML = '';
  if (article.faqItems && article.faqItems.length > 0) {
    faqHTML = `
  <div class="faq-section">
    <h2>Frequently Asked Questions</h2>
    ${article.faqItems.map(f => `
    <div class="faq-item">
      <div class="q"><strong>Q: ${f.q}</strong></div>
      <div class="a">${f.a}</div>
    </div>`).join('')}
  </div>`;
  }

  // Schema.org 结构化数据
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': article.title,
    'description': article.description,
    'datePublished': article.createdAt,
    'dateModified': article.updatedAt,
    'author': { '@type': 'Organization', 'name': CONFIG.seo.defaultAuthor },
    'publisher': { '@type': 'Organization', 'name': CONFIG.seo.siteName },
    'mainEntityOfPage': { '@type': 'WebPage', '@id': `${CONFIG.domain}${article.publishedUrl || ''}` },
  };

  const breadcrumb = [
    { label: 'Blog', url: '/blog/' },
    { label: article.category, url: `/blog/${article.category}/` },
    { label: article.title, url: null },
  ];

  const fullContent = `
  <div class="affiliate-disclosure">
    <span>💡 As an Amazon Associate we earn from qualifying purchases. This does not affect our reviews.</span>
  </div>
  <article class="article">
    ${content}
    ${faqHTML}
    <div style="margin-top:48px;padding:24px;background:var(--primary-light);border-radius:12px;text-align:center">
      <h3>Still not sure what to buy?</h3>
      <p>Check our <a href="/products/">Best Picks</a> page for curated recommendations updated monthly.</p>
    </div>
  </article>`;

  return theme.wrapHTML({
    title: article.title,
    description: article.description,
    content: fullContent,
    canonical: `${CONFIG.domain}${article.publishedUrl || ''}`,
    schema,
    breadcrumb,
  });
}

/**
 * 更新首页文章列表
 */
async function updateHomepage(inventory) {
  const recent = inventory
    .filter(c => c.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 10);

  const articlesHTML = recent.map(a => {
    const catConfig = CONFIG.content.categories.find(c => c.slug === a.category);
    const catName = catConfig?.name || a.category;
    return `
    <div class="article-item">
      <span class="date">${new Date(a.date || a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      <div>
        <a class="title" href="${a.publishedUrl || `/blog/${a.category}/${a.slug}.html`}">${a.title}</a>
        <div style="margin-top:var(--space-1)">
          <span class="cat">${catName}</span>
        </div>
      </div>
    </div>`;
  }).join('\n');

  // 生成首页
  // 注意：首页 URL 为根路径
  const mainCSS = theme.generateCSS();
  const gaId = process.env.GOOGLE_ANALYTICS_ID || '';

  const gaTag = gaId ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>` : '';

  const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${CONFIG.seo.siteName} — Honest Product Reviews</title>
<meta name="description" content="${CONFIG.seo.tagline}">
<meta property="og:title" content="${CONFIG.seo.siteName}">
<meta property="og:description" content="${CONFIG.seo.tagline}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${CONFIG.domain}/">
${gaTag}
<style>${mainCSS}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"${CONFIG.seo.siteName}","url":"${CONFIG.domain}","description":"${CONFIG.seo.tagline}","inLanguage":"en-US"}</script>
</head>
<body>

<nav class="navbar">
  <div class="container">
    <a href="/" class="brand">🔍 ${CONFIG.seo.siteName}</a>
    <ul class="nav-links">
      ${CONFIG.content.categories.map(c => `<li><a href="/blog/${c.slug}/">${c.emoji} ${c.name}</a></li>`).join('')}
      <li><a href="/products/">🏆 Best Picks</a></li>
    </ul>
  </div>
</nav>

<section class="hero">
  <div class="container">
    <h1>${CONFIG.seo.siteName}</h1>
    <p>${CONFIG.seo.tagline}</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a href="/blog/" class="btn btn-primary">📝 Read Reviews</a>
      <a href="/products/" class="btn btn-outline">🏆 Best Picks</a>
    </div>
  </div>
</section>

<main class="container">
  <div style="padding:48px 0 16px">
    <h2>📂 Categories</h2>
  </div>
  <div class="category-grid">
    ${CONFIG.content.categories.map(c => `
    <a href="/blog/${c.slug}/" class="cat-card">
      <div class="icon">${c.emoji}</div>
      <h3>${c.name}</h3>
      <p>${c.keywords.slice(0,2).join(', ')}...</p>
    </a>`).join('')}
  </div>

  <div style="padding:48px 0 16px">
    <h2>📝 Latest Reviews</h2>
  </div>
  <div class="article-list">
    ${articlesHTML || '<p style="color:var(--text-muted)">Coming soon — our first reviews are being written!</p>'}
  </div>
</main>

<footer class="footer">
  <div class="container">
    <div><h4>About</h4><p>We research, test, and review products to help you buy smarter. Some links earn us a commission.</p></div>
    <div><h4>Links</h4><p><a href="/blog/">Reviews</a></p><p><a href="/products/">Best Picks</a></p><p><a href="/sitemap.xml">Sitemap</a></p></div>
    <div><h4>Disclosure</h4><p>As an Amazon Associate we earn from qualifying purchases at no cost to you.</p></div>
  </div>
  <div style="text-align:center;padding-top:24px;opacity:.5">
    <p>&copy; ${new Date().getFullYear()} ${CONFIG.seo.siteName}</p>
  </div>
</footer>

</body>
</html>`;

  await fs.writeFile(path.join(CONFIG.publicDir, 'index.html'), html, 'utf-8');
  console.log('[Publisher] ✅ Homepage updated');
}

/**
 * 更新 sitemap.xml
 */
async function updateSitemap(inventory) {
  const urls = [
    { loc: `${CONFIG.domain}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${CONFIG.domain}/blog/`, priority: '0.8', changefreq: 'daily' },
    { loc: `${CONFIG.domain}/products/`, priority: '0.7', changefreq: 'weekly' },
  ];

  for (const article of inventory) {
    if (article.publishedUrl) {
      urls.push({
        loc: `${CONFIG.domain}${article.publishedUrl}`,
        priority: '0.6',
        changefreq: 'monthly',
        lastmod: (article.updatedAt || article.createdAt || '').split('T')[0],
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  await fs.writeFile(path.join(CONFIG.publicDir, 'sitemap.xml'), xml, 'utf-8');
  console.log(`[Publisher] ✅ Sitemap updated (${urls.length} URLs)`);
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  publishAllContent().then(r => {
    console.log(`\n✅ Published: ${r.published}, Updated: ${r.updated}`);
  });
}

export default { publishAllContent };

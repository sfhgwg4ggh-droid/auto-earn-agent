/**
 * Sitemap 生成器 — 为搜索引擎提供完整的站点结构
 */
import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

export async function generateSitemaps() {
  const inventory = await storage.readJSON('content-inventory.json', []);

  const urls = [
    { loc: `${CONFIG.domain}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${CONFIG.domain}/blog/`, priority: '0.8', changefreq: 'daily' },
    { loc: `${CONFIG.domain}/products/`, priority: '0.7', changefreq: 'weekly' },
  ];

  // 分类页
  for (const cat of CONFIG.content.categories) {
    urls.push({
      loc: `${CONFIG.domain}/blog/${cat.slug}/`,
      priority: '0.6',
      changefreq: 'weekly',
    });
  }

  // 文章页
  for (const article of inventory) {
    if (article.publishedUrl) {
      urls.push({
        loc: `${CONFIG.domain}${article.publishedUrl}`,
        priority: '0.5',
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
  console.log(`[Sitemap] ✅ Generated with ${urls.length} URLs`);
}

// robots.txt
export async function generateRobotsTxt() {
  const txt = `User-agent: *
Allow: /
Sitemap: ${CONFIG.domain}/sitemap.xml

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /
`;
  await fs.writeFile(path.join(CONFIG.publicDir, 'robots.txt'), txt, 'utf-8');
  console.log('[Sitemap] ✅ robots.txt updated');
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => { await generateSitemaps(); await generateRobotsTxt(); })();
}

export default { generateSitemaps, generateSitemap: generateSitemaps, generateRobotsTxt };

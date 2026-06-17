/**
 * 仪表盘生成器 — 生成 /dashboard/ 下的 HTML 收益仪表盘
 * 公开透明展示项目收益数据
 */
import CONFIG from '../shared/config.js';
import theme from '../shared/theme-engine.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

export async function generateDashboard() {
  const revenue = await storage.readJSON('revenue.json', []);
  const inventory = await storage.readJSON('content-inventory.json', []);
  const links = await storage.readJSON('affiliate-links.json', []);
  const products = await storage.readJSON('products.json', []);

  const published = inventory.filter(c => c.publishedAt);
  const today = new Date().toISOString().split('T')[0];
  const todayRevenue = revenue.find(r => r.date === today);

  // 收入图表数据（最近 30 天）
  const chartData = revenue.slice(-30).map(r => ({
    date: r.date,
    views: r.estimatedPageViews || 0,
    clicks: r.estimatedClicks || 0,
    revenue: r.estimatedRevenue || 0,
  }));

  const content = `
  <div class="container" style="padding:48px 0">
    <h1>📊 Revenue Dashboard</h1>
    <p style="color:var(--text-muted);margin-bottom:32px">
      Auto-generated report. Last updated: ${new Date().toISOString()}.
      This page tracks the growth and revenue of our automated affiliate content site.
    </p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:40px">
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:800;color:var(--primary)">${published.length}</div>
        <div style="color:var(--text-muted)">Published Articles</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:800;color:var(--accent)">${links.length}</div>
        <div style="color:var(--text-muted)">Affiliate Links</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:800;color:var(--warning)">${products.length}</div>
        <div style="color:var(--text-muted)">Products Tracked</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:800;color:${todayRevenue?.estimatedRevenue > 0 ? 'var(--success)' : 'var(--text-muted)'}">$${(todayRevenue?.estimatedRevenue || 0).toFixed(2)}</div>
        <div style="color:var(--text-muted)">Today's Est. Revenue</div>
      </div>
    </div>

    <h2>📈 30-Day Trend</h2>
    <div style="overflow-x:auto;margin-bottom:40px">
      <table>
        <thead>
          <tr><th>Date</th><th>Articles</th><th>Est. Views</th><th>Est. Clicks</th><th>Est. Revenue</th></tr>
        </thead>
        <tbody>
          ${[...revenue].reverse().slice(0, 30).map(r => `
          <tr>
            <td>${r.date}</td>
            <td>${r.totalArticles || 0}</td>
            <td>${r.estimatedPageViews || 0}</td>
            <td>${r.estimatedClicks || 0}</td>
            <td><strong>$${(r.estimatedRevenue || 0).toFixed(2)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h2>📝 Recent Articles</h2>
    <div style="margin-bottom:40px">
      ${published.slice(-10).reverse().map(a => `
      <div class="card" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <a href="${a.publishedUrl || '#'}" style="font-weight:600">${a.title}</a>
          <div style="font-size:12px;color:var(--text-muted)">${a.category} · ${new Date(a.publishedAt).toLocaleDateString()}</div>
        </div>
        <span class="badge badge-new">Published</span>
      </div>`).join('')}
      ${published.length === 0 ? '<p style="color:var(--text-muted)">No articles published yet. The pipeline runs daily.</p>' : ''}
    </div>

    <h2>💰 Monetization Status</h2>
    <div class="card" style="margin-bottom:40px">
      <table>
        <tr><td><strong>Amazon Associates Tag</strong></td><td>${CONFIG.affiliates.amazon.tag || 'Not configured'}</td></tr>
        <tr><td><strong>Google AdSense ID</strong></td><td>${CONFIG.seo.googleAdSenseId || 'Not configured'}</td></tr>
        <tr><td><strong>Google Analytics ID</strong></td><td>${CONFIG.seo.googleAnalyticsId || 'Not configured'}</td></tr>
        <tr><td><strong>Domain</strong></td><td>${CONFIG.domain}</td></tr>
        <tr><td><strong>Content Language</strong></td><td>${CONFIG.content.language.toUpperCase()}</td></tr>
        <tr><td><strong>Articles/Day</strong></td><td>${CONFIG.content.postsPerDay}</td></tr>
      </table>
    </div>

    <div class="cta-box">
      <h3>🚀 Getting Started</h3>
      <p>To start earning real revenue: (1) Add your Amazon Associates tag to .env, (2) Connect Google Analytics, (3) Let the pipeline run daily for 2-3 months to build SEO traffic.</p>
    </div>
  </div>`;

  const html = theme.wrapHTML({
    title: '📊 Revenue Dashboard — Auto-Earn Agent',
    description: 'Live revenue tracking dashboard for our automated affiliate content site.',
    content,
    canonical: `${CONFIG.domain}/dashboard/`,
  });

  const dir = path.join(CONFIG.publicDir, 'dashboard');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8');
  console.log('[Dashboard] ✅ Generated');
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  generateDashboard().then(() => console.log('✅ Done'));
}

export default { generateDashboard };

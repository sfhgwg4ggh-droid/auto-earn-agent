/**
 * 🎯 客源漏斗引擎
 *
 * 三层漏斗：
 *   Layer 1: SEO 内容 → 百度/Google 搜索流量
 *   Layer 2: Landing Page → 展示产品 + 收集联系方式
 *   Layer 3: 变现 — 闲鱼链接 / 微信二维码 / 数字下载
 *
 * 内容策略（百度SEO）:
 *   - "XX多少钱" — 价格查询类（高转化）
 *   - "XX怎么选" — 购买指南类（中转化）
 *   - "XX推荐" — 好物推荐类（高转化）
 */

import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

// ── 百度SEO关键词（中文长尾，低竞争高转化）───────────────
const SEO_KEYWORDS = [
  // 购买意向 — 马上要掏钱
  { kw: '宠物肖像定制多少钱', intent: 'buy', volume: 1800, difficulty: 'low' },
  { kw: '手绘宠物画像价格', intent: 'buy', volume: 1200, difficulty: 'low' },
  { kw: '狗狗画像定制哪家好', intent: 'buy', volume: 900, difficulty: 'low' },
  { kw: '宠物纪念品定制推荐', intent: 'buy', volume: 800, difficulty: 'low' },
  { kw: '把狗狗照片画成画', intent: 'buy', volume: 2500, difficulty: 'medium' },
  // 信息查询 — 潜在客户
  { kw: '宠物去世了怎么纪念', intent: 'info', volume: 3200, difficulty: 'medium' },
  { kw: '宠物纪念方式有哪些', intent: 'info', volume: 1500, difficulty: 'low' },
  { kw: '如何保存宠物的照片', intent: 'info', volume: 1200, difficulty: 'low' },
  { kw: '宠物手绘和照片的区别', intent: 'compare', volume: 600, difficulty: 'low' },
  { kw: 'rainbow bridge 宠物纪念', intent: 'buy', volume: 800, difficulty: 'low' },
  // 礼物场景
  { kw: '送养狗的朋友什么礼物', intent: 'buy', volume: 2200, difficulty: 'medium' },
  { kw: '闺蜜宠物死了送什么', intent: 'buy', volume: 1100, difficulty: 'low' },
  { kw: '宠物主题生日礼物', intent: 'buy', volume: 1500, difficulty: 'low' },
  { kw: '父亲节送狗爸什么礼物', intent: 'buy', volume: 900, difficulty: 'low' },
  { kw: '狗妈生日礼物推荐', intent: 'buy', volume: 700, difficulty: 'low' },
];

// ── Landing Page 模板 ────────────────────────────────────
function buildLandingPage(kw, products) {
  const title = buildSEOTitle(kw);
  const desc = buildSEODesc(kw);

  const productCards = (products || []).slice(0, 3).map((p, i) => `
    <div class="product-card">
      <div class="rank">${['🥇','🥈','🥉'][i]}</div>
      <div class="info">
        <h3>${p.name || p.title || kw.kw + ' — 推荐款'}</h3>
        <p class="price"><span class="current">¥${p.retailPrice || p.price || 88}</span></p>
        <p class="desc">${p.description || '纯手绘定制，发照片即可。2-3天出稿，改到满意为止。'}</p>
        <a href="${p.link || '#'}" class="buy-btn" rel="nofollow" target="_blank">🛒 立即定制</a>
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="keywords" content="${kw.kw.replace(/多少钱|怎么|哪家|推荐/g, '')},宠物定制,宠物肖像,手绘宠物">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<link rel="canonical" href="${CONFIG.domain}/guide/${slug(kw.kw)}.html">
${buildSchema(title, desc)}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif;color:#333;line-height:1.8;background:#faf8f4;max-width:800px;margin:0 auto;padding:20px}
.header{text-align:center;padding:48px 0 32px;background:linear-gradient(135deg,#fff7ed,#fef3c7);margin:-20px -20px 32px;border-radius:0 0 24px 24px}
.header h1{font-size:26px;color:#8b6914;margin-bottom:8px}
.header p{color:#a0846c;font-size:14px}
.content{background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:24px}
.content h2{font-size:20px;color:#5c4033;margin:24px 0 12px;padding-left:12px;border-left:4px solid #d4a853}
.content p{margin-bottom:12px;font-size:15px;color:#555}
.content ul{margin:12px 0;padding-left:24px}
.content li{margin-bottom:8px;font-size:15px}
.price-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
.price-table th{background:#f5f0eb;padding:12px;text-align:left;font-weight:600}
.price-table td{padding:12px;border-bottom:1px solid #f0ebe0}
.product-card{display:flex;gap:16px;align-items:flex-start;padding:16px;border:1px solid #f0ebe0;border-radius:12px;margin-bottom:12px;background:#fefdfb}
.product-card .rank{font-size:32px;min-width:48px;text-align:center}
.product-card .info{flex:1}
.product-card h3{font-size:17px;margin-bottom:6px}
.product-card .price{margin-bottom:6px}
.product-card .current{font-size:24px;font-weight:800;color:#c0392b}
.product-card .desc{font-size:13px;color:#888;margin-bottom:10px}
.buy-btn{display:inline-block;background:#4A7C59;color:#fff!important;padding:8px 20px;border-radius:20px;text-decoration:none;font-weight:600;font-size:14px}
.buy-btn:hover{background:#3a6348}
.cta-box{background:linear-gradient(135deg,#fff7ed,#fef3c7);padding:24px;border-radius:12px;text-align:center;margin:24px 0}
.cta-box h3{margin-bottom:8px}
.cta-box .cta-btn{display:inline-block;background:#f97316;color:#fff!important;padding:10px 28px;border-radius:24px;font-size:16px;font-weight:700;text-decoration:none;margin-top:8px}
.faq{margin-top:24px}
.faq-item{border:1px solid #f0ebe0;border-radius:8px;padding:14px;margin-bottom:8px}
.faq-item .q{font-weight:600;margin-bottom:4px}
.faq-item .a{color:#666;font-size:14px}
.footer{text-align:center;padding:32px;color:#999;font-size:12px}
@media(max-width:600px){body{padding:12px}.header{margin:-12px -12px 20px}}
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${desc}</p>
</div>

<div class="content">
  <h2>${kw.intent === 'buy' ? '💰 价格一览' : '📖 详细介绍'}</h2>
  <p>${generateOpening(kw)}</p>
  ${productCards}
</div>

<div class="content">
  <h2>📊 价格对比</h2>
  <table class="price-table">
    <tr><th>类型</th><th>价格范围</th><th>特点</th><th>推荐指数</th></tr>
    <tr><td>电子版数字文件</td><td>¥29-88</td><td>自己打印，最实惠</td><td>⭐⭐⭐⭐⭐</td></tr>
    <tr><td>印刷版+邮寄</td><td>¥108-198</td><td>专业打印+装裱</td><td>⭐⭐⭐⭐</td></tr>
    <tr><td>手绘原作</td><td>¥298-688</td><td>收藏级真画</td><td>⭐⭐⭐</td></tr>
  </table>

  <h2>🎨 如何选择适合自己的</h2>
  <ul>
    <li><b>预算有限：</b>选电子版（¥29-88），自己打印装裱不到¥20搞定</li>
    <li><b>送礼物：</b>选印刷版（¥108-198），专业有面子</li>
    <li><b>永久珍藏：</b>选手绘原作（¥298+），独一无二</li>
    <li><b>纪念用途：</b>Rainbow Bridge 纪念画（¥29），温柔纪念</li>
  </ul>

  <h2>❓ 常见问题</h2>
  <div class="faq">
    <div class="faq-item"><div class="q">Q: 需要提供什么样的照片？</div><div class="a">正面光线好的照片最佳。手机拍的就够，不用专业相机。多张照片可选最好。</div></div>
    <div class="faq-item"><div class="q">Q: 多久能出稿？</div><div class="a">一般2-3天。急单可24小时加急（+¥30）。</div></div>
    <div class="faq-item"><div class="q">Q: 不满意可以改吗？</div><div class="a">可以！改到满意为止，不限次数。</div></div>
    <div class="faq-item"><div class="q">Q: 电子版怎么打印？</div><div class="a">淘宝搜"照片打印"，8x10寸只要¥5。建议用哑光相纸。</div></div>
  </div>
</div>

<div class="cta-box">
  <h3>🛒 准备定制你家毛孩子的肖像？</h3>
  <p style="margin-bottom:12px">专业的宠物肖像定制服务 · 纯手绘 · 改到满意为止</p>
  <a href="#" class="cta-btn">🎨 立即开始定制</a>
  <p style="font-size:12px;color:#999;margin-top:8px">💰 最低¥29起 · 📥 电子版即时交付 · 🔄 无限修改</p>
</div>

<div class="footer">
  <p>© ${new Date().getFullYear()} 宠物肖像定制指南 · 专业手绘宠物画像</p>
  <p style="margin-top:4px">本站为独立产品指南，旨在帮您做出最好的选择。</p>
</div>
</body>
</html>`;

  return { title, desc, html, kw: kw.kw, intent: kw.intent };
}

function buildSEOTitle(kw) {
  const templates = {
    buy: `${kw.kw}_宠物肖像定制价格|手绘狗狗画像多少钱`,
    info: `${kw.kw}_最全宠物纪念方式推荐|让爱延续`,
    compare: `${kw.kw}_手绘vs照片哪个好|宠物画像选购指南`,
  };
  return templates[kw.intent] || `${kw.kw} — 宠物肖像定制指南`;
}

function buildSEODesc(kw) {
  return `2026年最新${kw.kw}全攻略。专业的宠物肖像定制服务推荐，手绘/电子版/印刷版价格对比。`;
}

function buildSchema(title, desc) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': title,
    'description': desc,
    'author': { '@type': 'Person', 'name': '宠物肖像定制指南' },
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

function slug(text) {
  return text.replace(/[^一-龥a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

function generateOpening(kw) {
  if (kw.intent === 'buy') {
    return `想了解<b>${kw.kw}</b>？我们整理了2026年最新的市场价格和推荐服务。看完能省至少100块！`;
  }
  if (kw.intent === 'info') {
    return `宠物的离开是最难过的时刻。如何纪念它们，让回忆永远保存？这里有${kw.kw}的完整介绍。`;
  }
  return `关于<b>${kw.kw}</b>，很多宠物家长都在问。这里详细说说。`;
}

// ── 主流水线 ──────────────────────────────────────────────
export async function runCustomerFunnel() {
  console.log('\n🎯 ══════ 客源漏斗引擎 ══════\n');

  const sourcing = await storage.readJSON('sourcing-report.json', { topPicks: [] });
  const products = sourcing.topPicks || [];

  // 确保输出目录
  const dir = path.join(CONFIG.publicDir, 'guide');
  await fs.mkdir(dir, { recursive: true });

  // 按转化率排序：buy > compare > info
  const sorted = [...SEO_KEYWORDS].sort((a, b) => {
    const order = { buy: 0, compare: 1, info: 2 };
    return (order[a.intent] || 0) - (order[b.intent] || 0);
  });

  let generated = 0;
  const indexPages = [];

  for (const kw of sorted.slice(0, 10)) {
    const page = buildLandingPage(kw, products.slice(0, 3));
    const filePath = path.join(dir, slug(kw.kw) + '.html');
    await fs.writeFile(filePath, page.html, 'utf-8');
    generated++;
    indexPages.push({ title: page.title, url: `/guide/${slug(kw.kw)}.html`, intent: kw.intent, volume: kw.volume });
    console.log(`[漏斗] ✅ ${kw.kw} → /guide/${slug(kw.kw)}.html`);
  }

  // 生成索引页
  const indexHTML = buildIndexPage(indexPages);
  await fs.writeFile(path.join(dir, 'index.html'), indexHTML, 'utf-8');

  // 生成 sitemap 追加
  await storage.writeJSON('funnel-pages.json', {
    updatedAt: new Date().toISOString(),
    totalPages: generated,
    pages: indexPages,
    estimatedMonthlyTraffic: indexPages.reduce((s, p) => s + (p.volume || 0), 0),
    estimatedMonthlyRevenue: Math.round(indexPages.length * 500),
  });

  console.log(`\n📊 客源漏斗: ${generated} 个 Landing Page`);
  console.log(`   预估月搜索量: ${indexPages.reduce((s, p) => s + (p.volume || 0), 0)}`);
  console.log(`   预估月收入: ¥${indexPages.length * 500}+`);

  return { generated, pages: indexPages };
}

function buildIndexPage(pages) {
  const links = pages.map(p => `<li><a href="${p.url}">${p.title}</a> <span style="color:#999;font-size:12px">${p.intent === 'buy' ? '🛒' : '📖'} 月搜索${p.volume}+</span></li>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>宠物肖像定制指南 — 所有文章</title>
<meta name="description" content="宠物肖像定制、手绘宠物画像、宠物纪念品定制全攻略。价格对比、选购指南、避坑建议。">
<style>
body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.8;background:#faf8f4}
h1{color:#5c4033;margin-bottom:24px}
ul{list-style:none;padding:0}
li{padding:12px 0;border-bottom:1px solid #f0ebe0}
li a{color:#4a7c59;text-decoration:none;font-size:16px;font-weight:500}
li a:hover{color:#d4a853}
</style></head>
<body>
<h1>📖 宠物肖像定制全指南</h1>
<p style="color:#888;margin-bottom:24px">全面的宠物肖像定制知识库。帮助你做出最好的选择。</p>
<ul>${links}</ul>
</body></html>`;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runCustomerFunnel().then(() => { console.log('✅ 客源漏斗完成'); process.exit(0); });
}

export default { runCustomerFunnel, SEO_KEYWORDS };

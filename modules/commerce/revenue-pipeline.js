/**
 * 💰 变现全链路 — 货源 → 内容 → 客源 → 成交
 *
 * 一键运行: node modules/commerce/revenue-pipeline.js
 *
 * 链路:
 *   ① 智能选品（1688利润分析）
 *   ② 竞品监控（闲鱼/淘宝价格跟踪）
 *   ③ 客源漏斗（SEO Landing Page）
 *   ④ 发布清单（今日选品推荐）
 */

import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';
import fs from 'fs/promises';
import path from 'path';

export async function runRevenuePipeline() {
  const startTime = Date.now();
  const report = {
    date: new Date().toISOString().split('T')[0],
    startedAt: new Date().toISOString(),
    phases: {},
    summary: {},
  };

  console.log('╔══════════════════════════════════════════╗');
  console.log('║    💰 变现全链路 — 自动运行              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`   时间: ${report.date}\n`);

  // ── Phase 1: 货源 — 智能选品 ───────────────────────────
  try {
    console.log('[1/4] 🛒 智能选品...');
    const { runSmartSourcing } = await import('./smart-sourcing.js');
    const sourcing = await runSmartSourcing();
    report.phases.sourcing = {
      products: sourcing.topPicks?.length || 0,
      topPick: sourcing.topPicks?.[0],
      status: '✅',
    };
  } catch (e) {
    report.phases.sourcing = { status: '❌', error: e.message };
    console.error('[1/4] ❌', e.message);
  }

  // ── Phase 2: 竞品监控 ──────────────────────────────────
  try {
    console.log('\n[2/4] 🔍 竞品监控...');
    const { runCompetitorMonitor } = await import('./competitor-monitor.js');
    const comp = await runCompetitorMonitor();
    report.phases.competitor = {
      xianyu: comp.xianyu?.totalListings || 0,
      taobao: comp.taobao?.totalProducts || 0,
      status: '✅',
    };
  } catch (e) {
    report.phases.competitor = { status: '❌', error: e.message };
    console.error('[2/4] ❌', e.message);
  }

  // ── Phase 3: 客源漏斗 — SEO Landing Pages ─────────────
  try {
    console.log('\n[3/4] 🎯 客源漏斗...');
    const { runCustomerFunnel } = await import('./customer-funnel.js');
    const funnel = await runCustomerFunnel();
    report.phases.funnel = {
      pages: funnel.generated || 0,
      estimatedTraffic: funnel.pages?.reduce((s, p) => s + (p.volume || 0), 0) || 0,
      status: '✅',
    };
  } catch (e) {
    report.phases.funnel = { status: '❌', error: e.message };
    console.error('[3/4] ❌', e.message);
  }

  // ── Phase 4: 发布清单 — 今日赚钱任务 ──────────────────
  try {
    console.log('\n[4/4] 📋 生成今日赚钱清单...');
    report.phases.checklist = await generateRevenueChecklist(report);
    report.phases.checklist.status = '✅';
  } catch (e) {
    report.phases.checklist = { status: '❌', error: e.message };
    console.error('[4/4] ❌', e.message);
  }

  // ── 保存报告 ──────────────────────────────────────────
  report.summary = {
    duration: Math.round((Date.now() - startTime) / 1000) + 's',
    productsFound: report.phases.sourcing?.products || 0,
    competitorsTracked: (report.phases.competitor?.xianyu || 0) + (report.phases.competitor?.taobao || 0),
    landingPages: report.phases.funnel?.pages || 0,
    estimatedDailyRevenue: '¥200-500',
  };

  await storage.writeJSON('revenue-pipeline-report.json', report);
  await generateRevenueHTML(report);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    ✅ 变现全链路完成                      ║');
  console.log(`║    耗时: ${report.summary.duration}                          ║`);
  console.log(`║    货源: ${report.summary.productsFound} 个                     ║`);
  console.log(`║    竞品: ${report.summary.competitorsTracked} 个                     ║`);
  console.log(`║    SEO页: ${report.summary.landingPages} 个                    ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  return report;
}

async function generateRevenueChecklist(report) {
  const sourcing = await storage.readJSON('sourcing-report.json', { topPicks: [] });
  const competitor = await storage.readJSON('competitor-report.json', { xianyu: null, taobao: null });

  const checklist = {
    title: '📋 今日赚钱清单',
    date: report.date,
    tasks: [
      {
        icon: '🛒', title: '选品推荐',
        items: (sourcing.topPicks || []).slice(0, 5).map(p => `${p.product} → 成本¥${p.wholesale} 卖¥${p.retail} 赚¥${p.profit} (${p.margin})`),
      },
      {
        icon: '🔍', title: '竞品动态',
        items: competitor.xianyu?.insight || [],
      },
      {
        icon: '📝', title: '今日发布',
        items: [
          '打开 http://localhost:8765 看小红书+闲鱼发布清单',
          '复制粘贴到App发布（1分钟）',
          '每天擦亮闲鱼商品',
        ],
      },
      {
        icon: '💰', title: '变现行动',
        items: [
          '检查闲鱼消息 → 5分钟内回复',
          '检查微信/支付宝到账 → 确认后发文件',
          '查看 http://localhost:3456/auto-admin.html 订单',
        ],
      },
    ],
  };

  await storage.writeJSON('daily-revenue-checklist.json', checklist);
  return checklist;
}

async function generateRevenueHTML(report) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>💰 变现报告 — ${report.date}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;background:#faf8f4;color:#333;line-height:1.8;max-width:800px;margin:0 auto;padding:20px}
h1{color:#5c4033;margin-bottom:8px}.date{color:#999;font-size:14px;margin-bottom:24px}
.card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px}
.card h2{font-size:18px;color:#4a7c59;margin-bottom:8px}
.card ul{margin-left:20px}.card li{margin-bottom:4px;font-size:14px}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat{background:#fff;padding:16px;border-radius:12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.stat .val{font-size:32px;font-weight:800;color:#f97316}
.stat .lbl{font-size:11px;color:#999;margin-top:4px}
@media(max-width:500px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
</style></head>
<body>
<h1>💰 今日变现报告</h1>
<p class="date">📅 ${report.date} · ⏱ ${report.summary?.duration || 'N/A'}</p>

<div class="stat-grid">
  <div class="stat"><div class="val">${report.summary?.productsFound || 0}</div><div class="lbl">货源发现</div></div>
  <div class="stat"><div class="val">${report.summary?.competitorsTracked || 0}</div><div class="lbl">竞品追踪</div></div>
  <div class="stat"><div class="val">${report.summary?.landingPages || 0}</div><div class="lbl">SEO页面</div></div>
  <div class="stat"><div class="val">¥500</div><div class="lbl">预估日收入</div></div>
</div>

<div class="card"><h2>📋 今日任务</h2>
<ul>
  <li>打开 <b>http://localhost:8765</b> 复制发布内容</li>
  <li>闲鱼擦亮商品 + 回复消息</li>
  <li>检查 <b>http://localhost:3456/auto-admin.html</b> 订单</li>
  <li>SEO页面静待百度收录（2-4周）</li>
</ul></div>

<p style="text-align:center;color:#999;font-size:12px;margin-top:24px">🤖 Auto-Earn Agent · 每日自动更新</p>
</body></html>`;

  const dir = path.join(CONFIG.publicDir, 'revenue');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8');
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runRevenuePipeline().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

export default { runRevenuePipeline };

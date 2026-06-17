/**
 * 🤖 Auto-Earn Agent — 自主调度器
 *
 * 这是 auto-earn-agent 的中心大脑。它能独立运行，自主决定：
 * - 何时采集 1688 货源
 * - 何时生成 AI 内容
 * - 何时发布 HTML 页面
 * - 何时监控价格和利润
 * - 是否需要暂停（API 限流、错误过多）
 *
 * 运行方式：
 *   node agent.js              # 单次运行，执行当前需要的任务
 *   node agent.js --daemon     # 守护模式，持续循环运行
 *   node agent.js --report     # 仅生成状态报告
 *   node agent.js --dry-run    # 预演模式，只输出计划不执行
 *
 * 设计原则：
 *   - 每个决策都有明确依据，不做无用功
 *   - 失败不崩溃，记录后继续
 *   - 尊重 API 速率限制，不烧钱
 *   - 状态透明，每次运行输出摘要
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const DATA_DIR = resolve(ROOT, 'data');
const STATE_FILE = resolve(DATA_DIR, 'agent-state.json');

// ============================================================
// 状态管理
// ============================================================

/** 加载 Agent 状态 */
async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      startedAt: new Date().toISOString(),
      totalRuns: 0,
      totalErrors: 0,
      lastScrapeAt: null,
      lastGenerateAt: null,
      lastPublishAt: null,
      lastMonitorAt: null,
      lastKeywordsAt: null,
      lastSitemapAt: null,
      lastRevenueAt: null,
      lastAutoListAt: null,
      lastErrorAt: null,
      consecutiveErrors: 0,
      apiCallsToday: 0,
      apiCallDate: new Date().toISOString().split('T')[0],
    };
  }
}

/** 保存 Agent 状态 */
async function saveState(state) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) {
    const { mkdir } = await import('fs/promises');
    await mkdir(dir, { recursive: true });
  }
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// ============================================================
// 决策引擎
// ============================================================

/**
 * 分析当前状态，决定下一步做什么
 * 返回按优先级排列的动作列表
 */
async function decide(state, config) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const actions = [];

  // 重置每日 API 计数
  if (state.apiCallDate !== today) {
    state.apiCallsToday = 0;
    state.apiCallDate = today;
  }

  // 熔断：连续错误太多
  if (state.consecutiveErrors >= 5) {
    console.log('[Agent] ⚠️  Circuit breaker: too many consecutive errors. Skipping all actions.');
    console.log('[Agent]     Run with --reset to clear error state.');
    return [];
  }

  // 加载数据文件，了解当前库存
  const { readJSON } = await import('./modules/shared/storage.js');
  const keywords = await readJSON('keywords.json', []);
  const products = await readJSON('products.json', []);
  const inventory = await readJSON('content-inventory.json', []);

  // ----------------------------------------
  // 优先级 1: 有未发布内容 → 发布
  // ----------------------------------------
  const unpublished = inventory.filter(c => !c.publishedAt);
  const stalePublished = inventory.filter(c =>
    c.publishedAt && c.updatedAt > c.publishedAt
  );
  if (unpublished.length > 0 || stalePublished.length > 0) {
    actions.push({
      priority: 1,
      action: 'publish',
      reason: `${unpublished.length} unpublished, ${stalePublished.length} stale — publishing now`,
      data: { unpublished: unpublished.length, stale: stalePublished.length },
    });
  }

  // ----------------------------------------
  // 优先级 2: 有产品但没内容 → 生成
  // ----------------------------------------
  const coveredKeywords = new Set(inventory.map(c => c.keyword));
  const productsNeedingContent = products.filter(p => !coveredKeywords.has(p.keyword));
  const apiRemaining = config.anthropic.dailyLimit - state.apiCallsToday;

  if (productsNeedingContent.length > 0 && apiRemaining > 0) {
    actions.push({
      priority: 2,
      action: 'generate',
      reason: `${productsNeedingContent.length} products need content, ${apiRemaining} API calls remaining today`,
      data: { productsCount: productsNeedingContent.length, apiRemaining },
    });
  } else if (productsNeedingContent.length > 0 && apiRemaining <= 0) {
    console.log(`[Agent] ⏸️  ${productsNeedingContent.length} products need content but daily API limit reached.`);
  }

  // ----------------------------------------
  // 优先级 3: 有关键词但没产品 → 采集
  // ----------------------------------------
  const scrapedKeywords = new Set(products.map(p => p.keyword));
  const keywordsNeedingScrape = keywords.filter(k => {
    const kw = k.keyword || k;
    return !scrapedKeywords.has(kw);
  });

  const hoursSinceScrape = state.lastScrapeAt
    ? (now - new Date(state.lastScrapeAt)) / 3600000
    : Infinity;

  if (keywordsNeedingScrape.length > 0 && hoursSinceScrape > 6) {
    actions.push({
      priority: 3,
      action: 'scrape',
      reason: `${keywordsNeedingScrape.length} keywords need scraping (last scrape: ${hoursSinceScrape.toFixed(1)}h ago)`,
      data: { keywordsCount: keywordsNeedingScrape.length, hoursSinceScrape },
    });
  }

  // ----------------------------------------
  // 优先级 4: 定期价格监控 (>12h)
  // ----------------------------------------
  const hoursSinceMonitor = state.lastMonitorAt
    ? (now - new Date(state.lastMonitorAt)) / 3600000
    : Infinity;

  if (products.length > 0 && hoursSinceMonitor > 12) {
    actions.push({
      priority: 4,
      action: 'monitor',
      reason: `${products.length} products in DB, last monitored ${hoursSinceMonitor.toFixed(1)}h ago`,
      data: { productsCount: products.length, hoursSinceMonitor },
    });
  }

  // ----------------------------------------
  // 优先级 5: 有产品 → 生成产品页面 (每 24h)
  // ----------------------------------------
  const hoursSinceAutoList = state.lastAutoListAt
    ? (now - new Date(state.lastAutoListAt)) / 3600000
    : Infinity;

  if (products.length > 0 && hoursSinceAutoList > 24) {
    actions.push({
      priority: 5,
      action: 'auto-list',
      reason: `${products.length} products in DB — generating product pages (last: ${hoursSinceAutoList.toFixed(1)}h ago)`,
      data: { productsCount: products.length },
    });
  }

  // ----------------------------------------
  // 优先级 6: SEO 关键词研究 (每周)
  // ----------------------------------------
  const hoursSinceKeywords = state.lastKeywordsAt
    ? (now - new Date(state.lastKeywordsAt)) / 3600000
    : Infinity;

  if (hoursSinceKeywords > 168) { // 7 days
    actions.push({
      priority: 6,
      action: 'keywords',
      reason: `Weekly SEO keyword research due (last: ${Math.floor(hoursSinceKeywords / 24)}d ago)`,
      data: { hoursSinceKeywords },
    });
  }

  // ----------------------------------------
  // 优先级 7: Sitemap 更新 (内容变更后或每 24h)
  // ----------------------------------------
  const hoursSinceSitemap = state.lastSitemapAt
    ? (now - new Date(state.lastSitemapAt)) / 3600000
    : Infinity;

  if (hoursSinceSitemap > 24) {
    actions.push({
      priority: 7,
      action: 'sitemap',
      reason: `Sitemap needs refresh (last: ${hoursSinceSitemap.toFixed(1)}h ago)`,
      data: { hoursSinceSitemap },
    });
  }

  // ----------------------------------------
  // 优先级 8: 每日收益记录
  // ----------------------------------------
  const hoursSinceRevenue = state.lastRevenueAt
    ? (now - new Date(state.lastRevenueAt)) / 3600000
    : Infinity;

  if (hoursSinceRevenue > 24) {
    actions.push({
      priority: 8,
      action: 'revenue',
      reason: 'Daily revenue tracking due',
      data: { hoursSinceRevenue },
    });
  }

  // ----------------------------------------
  // 优先级 9: 内容库存不足 → 建议补充关键词
  // ----------------------------------------
  if (keywords.length === 0 || products.length === 0) {
    actions.push({
      priority: 9,
      action: 'suggest',
      reason: 'No keywords or products in database — seed initial data',
      data: { keywordsCount: keywords.length, productsCount: products.length },
    });
  }

  return actions;
}

// ============================================================
// 动作执行器
// ============================================================

async function executeScrape(state) {
  console.log('\n📦 [Scrape] Starting 1688 product scraping...');
  try {
    const { runScraperPipeline } = await import('./modules/commerce/scraper-1688.js');
    await runScraperPipeline();
    state.lastScrapeAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log('[Scrape] ✅ Done');
  } catch (err) {
    console.error('[Scrape] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeGenerate(state, config) {
  console.log('\n✍️  [Generate] Starting AI content generation...');
  try {
    const { generateTodaysContent } = await import('./modules/content/generator.js');
    const results = await generateTodaysContent();
    state.lastGenerateAt = new Date().toISOString();
    state.apiCallsToday += results.length;
    state.consecutiveErrors = 0;
    console.log(`[Generate] ✅ Generated ${results.length} articles (API calls today: ${state.apiCallsToday}/${config.anthropic.dailyLimit})`);
  } catch (err) {
    console.error('[Generate] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executePublish(state) {
  console.log('\n📰 [Publish] Publishing content...');
  try {
    const { publishAllContent } = await import('./modules/content/publisher.js');
    const result = await publishAllContent();
    state.lastPublishAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log(`[Publish] ✅ New: ${result.published}, Updated: ${result.updated}`);
  } catch (err) {
    console.error('[Publish] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeMonitor(state) {
  console.log('\n📊 [Monitor] Checking price margins...');
  try {
    const { monitorProfitMargins } = await import('./modules/commerce/price-monitor.js');
    const result = await monitorProfitMargins();
    state.lastMonitorAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log(`[Monitor] ✅ Profitable: ${result.profitable}, Alerts: ${result.alerts}, New links: ${result.newLinks}`);
  } catch (err) {
    console.error('[Monitor] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeSuggest() {
  console.log('\n💡 [Suggest] Seeding initial data...');
  const { writeJSON, readJSON } = await import('./modules/shared/storage.js');

  // 检查 keywords.json 是否存在
  const existingKeywords = await readJSON('keywords.json', []);
  if (existingKeywords.length === 0) {
    // 从 config 中提取所有关键词
    const { CONFIG } = await import('./modules/shared/config.js');
    const allKeywords = [];
    for (const cat of CONFIG.content.categories) {
      for (const kw of cat.keywords) {
        allKeywords.push({ keyword: kw, category: cat.slug, addedAt: new Date().toISOString() });
      }
    }
    await writeJSON('keywords.json', allKeywords);
    console.log(`[Suggest] ✅ Seeded ${allKeywords.length} keywords from config categories.`);
  } else {
    console.log(`[Suggest] ℹ️  ${existingKeywords.length} keywords already exist.`);
  }
}

async function executeAutoList(state) {
  console.log('\n🛒 [Auto-List] Generating product pages...');
  try {
    const { generateProductPages } = await import('./modules/commerce/auto-lister.js');
    const count = await generateProductPages();
    state.lastAutoListAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log(`[Auto-List] ✅ Generated ${count} product pages`);
  } catch (err) {
    console.error('[Auto-List] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeKeywords(state) {
  console.log('\n🔑 [SEO Keywords] Researching keywords...');
  try {
    const { researchAllCategories } = await import('./modules/seo/keywords.js');
    await researchAllCategories();
    state.lastKeywordsAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log('[SEO Keywords] ✅ Done');
  } catch (err) {
    console.error('[SEO Keywords] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeSitemap(state) {
  console.log('\n🗺  [Sitemap] Regenerating sitemap...');
  try {
    // sitemap 模块从 content-inventory 读取并写入 public/sitemap.xml
    const { default: sitemapModule } = await import('./modules/seo/sitemap.js');
    if (sitemapModule.generateSitemap) {
      await sitemapModule.generateSitemap();
    } else {
      // 兼容不同导出
      console.log('[Sitemap] ⚠️  Module has no generateSitemap export, sitemap is updated by publisher');
    }
    state.lastSitemapAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log('[Sitemap] ✅ Done');
  } catch (err) {
    console.error('[Sitemap] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

async function executeRevenue(state) {
  console.log('\n💰 [Revenue] Recording daily stats...');
  try {
    const { recordDailyStats, generateRevenueReport } = await import('./modules/revenue/tracker.js');
    await recordDailyStats();
    await generateRevenueReport();
    state.lastRevenueAt = new Date().toISOString();
    state.consecutiveErrors = 0;
    console.log('[Revenue] ✅ Done');
  } catch (err) {
    console.error('[Revenue] ❌ Failed:', err.message);
    state.consecutiveErrors++;
    state.lastErrorAt = new Date().toISOString();
  }
}

// ============================================================
// 报告生成
// ============================================================

async function generateReport(state, config) {
  const { readJSON } = await import('./modules/shared/storage.js');
  const keywords = await readJSON('keywords.json', []);
  const products = await readJSON('products.json', []);
  const inventory = await readJSON('content-inventory.json', []);
  const links = await readJSON('affiliate-links.json', []);
  const revenue = await readJSON('revenue.json', { transactions: [] });
  const txCount = Array.isArray(revenue?.transactions) ? revenue.transactions.length : 0;

  const published = inventory.filter(c => c.publishedAt);
  const unpublished = inventory.filter(c => !c.publishedAt);
  const profitable = products.filter(p => (p.estimatedProfitMargin || 0) >= 30);

  const report = `
╔══════════════════════════════════════════════════╗
║       🤖 Auto-Earn Agent — Status Report        ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  📋 Keywords:      ${String(keywords.length).padStart(5)} total                 ║
║  📦 Products:      ${String(products.length).padStart(5)} scraped               ║
║  💰 Profitable:    ${String(profitable.length).padStart(5)} (margin ≥ 30%)       ║
║  ✍️  Articles:      ${String(published.length).padStart(5)} published             ║
║  📝 Unpublished:   ${String(unpublished.length).padStart(5)} pending              ║
║  🔗 Affiliate:     ${String(links.length).padStart(5)} links generated          ║
║  💵 Revenue:       ${String(txCount).padStart(5)} records                 ║
║                                                  ║
║  ⏱️  Uptime:        ${formatUptime(state.startedAt)}                     ║
║  🔄 Total Runs:    ${String(state.totalRuns).padStart(5)}                        ║
║  ❌ Errors:        ${String(state.totalErrors).padStart(5)} (consecutive: ${state.consecutiveErrors})      ║
║  📞 API Calls:     ${String(state.apiCallsToday).padStart(5)} / ${config.anthropic.dailyLimit} today             ║
║                                                  ║
║  Last Scrape:      ${formatTime(state.lastScrapeAt)}           ║
║  Last Generate:    ${formatTime(state.lastGenerateAt)}           ║
║  Last Publish:     ${formatTime(state.lastPublishAt)}           ║
║  Last Monitor:     ${formatTime(state.lastMonitorAt)}           ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`;

  console.log(report);
}

function formatTime(iso) {
  if (!iso) return 'Never'.padEnd(20);
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'Just now'.padEnd(20);
  if (diffMin < 60) return `${diffMin}m ago`.padEnd(20);
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`.padEnd(20);
  return `${Math.floor(diffH / 24)}d ago`.padEnd(20);
}

function formatUptime(iso) {
  if (!iso) return 'Unknown';
  const diff = new Date() - new Date(iso);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ============================================================
// CI 自动提交 (GitHub Actions 中运行时自动 push 变更)
// ============================================================

async function ciAutoCommit() {
  if (!process.env.CI && !process.env.GITHUB_ACTIONS) return;

  const { execSync } = await import('child_process');
  try {
    // 配置 git
    execSync('git config user.name "Auto-Earn Agent 🤖"', { cwd: ROOT, stdio: 'pipe' });
    execSync('git config user.email "agent@zhushishunsui.cloud"', { cwd: ROOT, stdio: 'pipe' });

    // 检查是否有变更
    const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
    if (!status.trim()) {
      console.log('[CI] 📭 No changes to commit.');
      return false;
    }

    // 统计变更
    const lines = status.trim().split('\n');
    const added = lines.filter(l => l.startsWith('??') || l.startsWith('A ')).length;
    const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('MM')).length;

    // 添加 data/ 和 public/ 目录
    execSync('git add data/ public/', { cwd: ROOT, stdio: 'pipe' });

    const dateStr = new Date().toISOString().split('T')[0];
    const msg = `📝 自动更新: ${dateStr}

- 新增 ${added} 个文件
- 更新 ${modified} 个文件

🤖 Generated with Auto-Earn Agent`;

    execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { cwd: ROOT, stdio: 'pipe' });
    execSync('git push', { cwd: ROOT, stdio: 'pipe' });

    console.log(`[CI] ✅ Committed & pushed — ${added} new, ${modified} modified`);
    return true;
  } catch (err) {
    // git 操作失败不 crash，记录后继续
    console.error('[CI] ⚠️  Auto-commit failed:', err.message);
    return false;
  }
}

// ============================================================
// 主循环
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const isDaemon = args.includes('--daemon');
  const isReport = args.includes('--report');
  const isDryRun = args.includes('--dry-run');
  const isReset = args.includes('--reset');

  console.log('🤖 Auto-Earn Agent v1.0');
  console.log('═══════════════════════');

  // 加载配置
  const { CONFIG } = await import('./modules/shared/config.js');

  // 重置错误状态
  if (isReset) {
    const fresh = {
      startedAt: new Date().toISOString(),
      totalRuns: 0,
      totalErrors: 0,
      lastScrapeAt: null,
      lastGenerateAt: null,
      lastPublishAt: null,
      lastMonitorAt: null,
      lastKeywordsAt: null,
      lastSitemapAt: null,
      lastRevenueAt: null,
      lastAutoListAt: null,
      lastErrorAt: null,
      consecutiveErrors: 0,
      apiCallsToday: 0,
      apiCallDate: new Date().toISOString().split('T')[0],
    };
    await saveState(fresh);
    console.log('[Agent] 🔄 State reset.');
  }

  // 加载状态
  let state = await loadState();
  state.totalRuns++;

  // 仅报告模式
  if (isReport) {
    await generateReport(state, CONFIG);
    return;
  }

  // 决策：分析当前状态，决定做什么
  console.log(`\n[Agent] 🔍 Analyzing state (run #${state.totalRuns})...`);
  const actions = await decide(state, CONFIG);

  if (actions.length === 0) {
    console.log('[Agent] 😴 Nothing to do right now. All systems caught up.');
    await generateReport(state, CONFIG);
    await saveState(state);
    return;
  }

  // 按优先级排序
  actions.sort((a, b) => a.priority - b.priority);

  console.log(`\n[Agent] 📋 Plan (${actions.length} actions):`);
  for (const a of actions) {
    console.log(`  ${a.priority}. [${a.action}] ${a.reason}`);
  }

  // 预演模式：只输出计划，不执行
  if (isDryRun) {
    console.log('\n[Agent] 🏜️  Dry-run mode — no actions executed.');
    return;
  }

  // 执行动作
  console.log('\n[Agent] 🚀 Executing...');
  let anyActionSucceeded = false;
  for (const a of actions) {
    let ok = true;
    const prevErrors = state.consecutiveErrors;
    switch (a.action) {
      case 'scrape':       await executeScrape(state); break;
      case 'generate':     await executeGenerate(state, CONFIG); break;
      case 'publish':      await executePublish(state); break;
      case 'monitor':      await executeMonitor(state); break;
      case 'auto-list':    await executeAutoList(state); break;
      case 'keywords':     await executeKeywords(state); break;
      case 'sitemap':      await executeSitemap(state); break;
      case 'revenue':      await executeRevenue(state); break;
      case 'suggest':      await executeSuggest(); break;
      default:
        console.log(`[Agent] ⚠️  Unknown action: ${a.action}`);
    }
    if (state.consecutiveErrors === prevErrors) anyActionSucceeded = true;
  }

  // 更新状态
  state.totalErrors = state.consecutiveErrors;
  await saveState(state);

  // 最终报告
  console.log('\n[Agent] 🏁 Run complete.');
  await generateReport(state, CONFIG);

  // CI 模式下自动 commit + push
  if (anyActionSucceeded && (process.env.CI || process.env.GITHUB_ACTIONS)) {
    await ciAutoCommit();
  }

  // 守护模式：等待后继续循环
  if (isDaemon) {
    const intervalMinutes = 30;
    console.log(`\n[Agent] 💤 Daemon mode — sleeping ${intervalMinutes} min before next check...`);
    console.log('[Agent]     Press Ctrl+C to stop.\n');

    // 使用 setTimeout 递归，避免 setInterval 堆积
    setTimeout(() => {
      // 重新 import main 避免内存问题
      process.argv = [process.argv[0], process.argv[1], '--daemon'];
      main();
    }, intervalMinutes * 60 * 1000);
  }
}

// ============================================================
// CLI 入口
// ============================================================

// 显示帮助
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🤖 Auto-Earn Agent — 自主变现调度器

用法:
  node agent.js              单次运行，执行当前需要的任务
  node agent.js --daemon     守护模式，每 30 分钟循环一次
  node agent.js --report     仅生成状态报告，不执行任务
  node agent.js --dry-run    预演模式，只输出计划不执行
  node agent.js --reset      重置错误状态

流程:
  Keywords → Scrape(1688) → Products → Generate(AI) → Content → Publish(HTML) → Monitor(Prices)

环境变量:
  ANTHROPIC_API_KEY          AI API 密钥
  ANTHROPIC_BASE_URL         API 端点 (默认 DeepSeek proxy)
  DOMAIN                     部署域名
  GOOGLE_ANALYTICS_ID        GA4 测量 ID
  GOOGLE_ADSENSE_ID          AdSense 发布商 ID
  AMAZON_TAG                 Amazon Affiliate tag
`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n[Agent] 💥 Fatal error:', err);
  process.exit(1);
});

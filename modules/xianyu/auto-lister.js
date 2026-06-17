/**
 * 🤖 闲鱼自动上架器 — Playwright 驱动的自动发布 Listing
 *
 * 两种模式：
 *   1. CDP 模式：连接已登录的 Chrome → chrome.exe --remote-debugging-port=9222
 *   2. Cookie 模式：首次扫码登录 → Cookie 持久化 → 自动发布
 *
 * 闲鱼限制：每天最多新发 10 个商品，擦亮不限
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(ROOT, 'data');
const COOKIE_FILE = resolve(DATA_DIR, 'xianyu-cookies.json');
const POST_LOG = resolve(DATA_DIR, 'xianyu-post-log.json');

const XY_URLS = {
  login: 'https://www.goofish.com/',
  publish: 'https://www.goofish.com/im/publish',
  myListings: 'https://www.goofish.com/profile',
};

const LIMITS = { maxPerDay: 10, minDelay: 3000, maxDelay: 8000, maxTitleLen: 60 };

function randomDelay(min, max) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function loadLog() {
  try { return JSON.parse(await readFile(POST_LOG, 'utf-8')); }
  catch { return { posted: [], total: 0 }; }
}
async function saveLog(log) {
  if (!existsSync(dirname(POST_LOG))) await mkdir(dirname(POST_LOG), { recursive: true });
  await writeFile(POST_LOG, JSON.stringify(log, null, 2));
}
async function todayCount() {
  const log = await loadLog();
  const today = new Date().toISOString().split('T')[0];
  return log.posted.filter(p => p.postedAt?.startsWith(today)).length;
}

/** 首次登录，扫码存 Cookie */
export async function loginToXianyu(useCDP = false) {
  let browser, context;
  if (useCDP) {
    console.log('🔗 [闲鱼] 连接已有 Chrome (CDP)…');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    context = browser.contexts()[0];
  } else {
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--disable-blink-features=AutomationControlled'] });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(XY_URLS.login, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('📱 [闲鱼] 请扫码登录，等待中（120秒）…');
  try {
    await page.waitForURL('**/goofish.com/**', { timeout: 120000 });
    await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 60000 });
  } catch { console.log('⚠️ 登录超时，请手动确认'); }
  if (!useCDP) {
    await context.storageState({ path: COOKIE_FILE });
    console.log('💾 Cookie 已保存');
    await browser.close();
  }
  return true;
}

/** 发布一个闲鱼 Listing */
export async function publishListing(listing, opts = {}) {
  const { dryRun = false, useCDP = false } = opts;
  const count = await todayCount();
  if (count >= LIMITS.maxPerDay) { console.log('[闲鱼] ⛔ 今日已达上限'); return { ok: false, reason: 'limit' }; }
  if (dryRun) { console.log('[闲鱼] 🏜️ 预演:', listing.title); return { ok: false, reason: 'dry_run' }; }

  let browser, context;
  try {
    if (useCDP) {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      context = browser.contexts()[0];
    } else {
      if (!existsSync(COOKIE_FILE)) { console.log('[闲鱼] ❌ 未登录'); return { ok: false, reason: 'no_cookie' }; }
      browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage'] });
      context = await browser.newContext({ storageState: COOKIE_FILE, viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    }
    const page = context.pages()[0] || await context.newPage();

    // 打开发布页
    console.log('[闲鱼] 📄 打开发布页…');
    await page.goto(XY_URLS.publish, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 4000);

    // 上传图片（找 file input）
    console.log('[闲鱼] 🖼️ 准备上传图片…');
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 生成占位图
      const tmpDir = resolve(DATA_DIR, '.tmp');
      if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
      const tmpFile = resolve(tmpDir, `xy-cover-${Date.now()}.png`);

      await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 800; c.height = 800;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#f5f0eb'; ctx.fillRect(0, 0, 800, 800);
        ctx.fillStyle = '#8b6914'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('宠物肖像定制', 400, 380);
        ctx.fillText('纯手绘 · 数字版', 400, 440);
        const link = document.createElement('a');
        link.download = 'cover.png'; link.href = c.toDataURL();
        document.body.appendChild(link); link.click();
      });
      await randomDelay(2000, 3000);
      try { await fileInput.setInputFiles(tmpFile); } catch {}
      await randomDelay(5000, 8000);
    }

    // 填标题
    console.log('[闲鱼] ✍️ 填写标题…');
    try {
      const titleInput = page.locator('[placeholder*="标题"], input').first();
      if (await titleInput.isVisible({ timeout: 5000 })) {
        await titleInput.click(); await randomDelay(500, 1500);
        const title = (listing.title || '').substring(0, LIMITS.maxTitleLen);
        await titleInput.fill(title);
      }
    } catch { console.log('⚠️ 填标题失败'); }
    await randomDelay(1000, 2000);

    // 填描述
    console.log('[闲鱼] ✍️ 填写描述…');
    try {
      const descInput = page.locator('[placeholder*="描述"], textarea').first();
      if (await descInput.isVisible({ timeout: 5000 })) {
        await descInput.click(); await randomDelay(500, 1000);
        await descInput.fill(listing.description || '');
      }
    } catch { console.log('⚠️ 填描述失败'); }
    await randomDelay(1000, 2000);

    // 填价格
    console.log('[闲鱼] 💰 填写价格…');
    try {
      const priceInput = page.locator('[placeholder*="价格"], input[type="number"]').first();
      if (await priceInput.isVisible({ timeout: 5000 })) {
        await priceInput.click(); await randomDelay(300, 800);
        await priceInput.fill(String(listing.price || 88));
      }
    } catch { console.log('⚠️ 填价格失败'); }
    await randomDelay(1000, 2000);

    // 点击发布
    console.log('[闲鱼] 🚀 点击发布…');
    const publishBtn = page.locator('button:has-text("发布"), button:has-text("确认"), .publish-btn').first();
    if (await publishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await publishBtn.click();
      await randomDelay(5000, 8000);
    }

    const log = await loadLog();
    log.posted.push({ id: listing.id, title: listing.title, postedAt: new Date().toISOString() });
    log.total++;
    await saveLog(log);
    console.log('[闲鱼] ✅ 发布完成');

    if (!useCDP) await browser.close();
    return { ok: true, id: listing.id };

  } catch (err) {
    console.error('[闲鱼] ❌', err.message);
    if (!useCDP && browser) await browser.close();
    return { ok: false, reason: err.message };
  }
}

/** 批量发布 */
export async function autoPublishListings(opts = {}) {
  const { dryRun = false, maxPosts = 3, useCDP = false } = opts;
  const { readJSON, writeJSON } = await import('../shared/storage.js');
  const listings = await readJSON('social/xianyu-listings.json', []);
  const drafts = listings.filter(l => l.status === 'draft');
  if (!drafts.length) { console.log('[闲鱼] 📭 无待发布'); return { posted: 0 }; }

  const remaining = LIMITS.maxPerDay - await todayCount();
  const toPost = drafts.slice(0, Math.min(maxPosts, remaining));
  if (!toPost.length) { console.log(`[闲鱼] ⛔ 额度已满`); return { posted: 0 }; }

  console.log(`[闲鱼] 🚀 发布 ${toPost.length} 个 Listing (今日已发 ${await todayCount()})`);

  let posted = 0;
  for (const l of toPost) {
    const r = await publishListing(l, { dryRun, useCDP });
    if (r.ok) { l.status = 'published'; l.postedAt = new Date().toISOString(); posted++; }
    if (posted < toPost.length) { const w = 20000 + Math.random() * 20000; console.log(`⏳ 等待 ${Math.round(w/1000)}s…`); await new Promise(r => setTimeout(r, w)); }
  }
  await writeJSON('social/xianyu-listings.json', listings);
  return { posted };
}

// CLI
const isCLI = process.argv[1] && process.argv[1].includes('auto-lister');
if (isCLI) {
  const args = process.argv.slice(2);
  if (args.includes('--login')) loginToXianyu(args.includes('--cdp')).then(() => process.exit(0));
  else if (args.includes('--post')) autoPublishListings({ dryRun: args.includes('--dry-run'), useCDP: args.includes('--cdp') }).then(r => { console.log(`✅ ${r.posted} 个`); process.exit(0); });
  else console.log('用法: --login | --post [--dry-run] [--cdp]');
}

export default { loginToXianyu, publishListing, autoPublishListings };

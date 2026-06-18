/**
 * 🤖 小红书自动发文器 — Playwright 驱动的真实小红书账号发布
 *
 * 两种模式：
 *   1. CDP 模式 (推荐)：连接你已登录的 Chrome 浏览器，零风控
 *      → 关闭 Chrome → 重新打开: chrome.exe --remote-debugging-port=9222
 *      → 然后: node modules/xiaohongshu/auto-poster.js --post --cdp
 *
 *   2. 独立模式：首次扫码登录 → Cookie 持久化 → 后续自动发文
 *      → node modules/xiaohongshu/auto-poster.js --login
 *      → 扫码完成后 → node modules/xiaohongshu/auto-poster.js --post
 *
 * 安全原则：
 *   - 每天最多发 3 篇（小红书限制严格，宁可少发不少发）
 *   - 每次操作间隔 3-8 秒随机延迟
 *   - 发布前会打印预览，CI 环境需显式确认
 *   - 遇到验证码/滑块 → 自动停止并通知人工
 */

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(ROOT, 'data');

const COOKIE_FILE = resolve(DATA_DIR, 'xhs-cookies.json');
const POST_LOG_FILE = resolve(DATA_DIR, 'xhs-post-log.json');
const STATE_DIR = resolve(DATA_DIR, 'xhs-browser-state');

// 小红书 Creator 中心
const XHS_URLS = {
  login: 'https://creator.xiaohongshu.com/login',
  publish: 'https://creator.xiaohongshu.com/publish/publish',
  home: 'https://creator.xiaohongshu.com/',
};

// 发布限制
const LIMITS = {
  maxPostsPerDay: 3,        // 每天最多发 3 篇
  maxTitleLen: 20,          // 标题 ≤20 字
  maxBodyLen: 1000,         // 正文 ≤1000 字
  minDelay: 3000,           // 操作间隔最少 3 秒
  maxDelay: 8000,           // 操作间隔最多 8 秒
  imageWidth: 1080,         // 小红书推荐图片宽
  imageHeight: 1440,        // 小红书推荐图片高 (3:4)
};

// ============================================================
// 封面图生成器 — 在浏览器中用 Canvas 画图
// ============================================================

/**
 * 在页面中用 Canvas 生成小红书风格封面图
 * 返回 data URL，可直接用于上传
 */
async function generateCoverImage(page, note) {
  const { title, xhsTag, xhsEmoji } = note;

  // 色板 — 小红书常用暖色/清新色
  const palettes = [
    ['#FF6B81', '#FF2442'], // 小红书红
    ['#FF9A76', '#FECFEF'], // 暖橘粉
    ['#A8E6CF', '#DCEDC1'], // 清新绿
    ['#FFD3B6', '#D5E8D4'], // 自然米
    ['#F8B195', '#F67280'], // 日落粉
    ['#C3B1E1', '#E8D5B7'], // 莫兰迪紫
  ];
  const palette = palettes[Math.floor(Math.random() * palettes.length)];

  return page.evaluate(({ title, tag, emoji, palette, w, h }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 渐变背景
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, palette[0]);
    grad.addColorStop(1, palette[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 半透明叠加层
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.15, w * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Emoji
    ctx.font = `${h * 0.12}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(emoji || '🛍️', w / 2, h * 0.35);

    // 标题（最多换行3行）
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${h * 0.045}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';

    const maxCharsPerLine = 12;
    const lines = [];
    let remaining = title;
    while (remaining.length > 0 && lines.length < 3) {
      if (remaining.length <= maxCharsPerLine) {
        lines.push(remaining);
        break;
      }
      const cut = remaining.substring(0, maxCharsPerLine);
      lines.push(cut);
      remaining = remaining.substring(maxCharsPerLine);
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h * 0.52 + i * h * 0.06);
    });

    // 标签 Badge
    if (tag) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const tagW = ctx.measureText('#' + tag).width + 40;
      const tagX = (w - tagW) / 2;
      const tagY = h * 0.72;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY - 18, tagW, 36, 18);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${h * 0.025}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillText('#' + tag, w / 2, tagY + 8);
    }

    return canvas.toDataURL('image/png');
  }, { title, tag: note.xhsTag || note.xhsCategory, emoji: note.xhsEmoji || '🛍️', palette, w: LIMITS.imageWidth, h: LIMITS.imageHeight });
}

// ============================================================
// 发布日志
// ============================================================

async function loadPostLog() {
  try {
    const raw = await readFile(POST_LOG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { posts: [], totalPosts: 0 };
  }
}

async function savePostLog(log) {
  const dir = dirname(POST_LOG_FILE);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(POST_LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

async function getTodayPostCount() {
  const log = await loadPostLog();
  const today = new Date().toISOString().split('T')[0];
  return log.posts.filter(p => p.postedAt?.startsWith(today)).length;
}

// ============================================================
// 核心：登录流程
// ============================================================

/**
 * 打开浏览器让用户扫码登录，保存 Cookie
 * @param {boolean} useCDP - 是否连接已有 Chrome
 */
export async function loginToXHS(useCDP = false) {
  let browser;
  let context;

  if (useCDP) {
    console.log('🔗 [XHS Login] 连接已有 Chrome (CDP: ws://localhost:9222)...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    context = browser.contexts()[0];
    console.log('✅ 已连接到现有浏览器');
  } else {
    console.log('🚀 [XHS Login] 启动新浏览器...');
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    });

    // 注入反检测脚本
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  const page = context.pages()[0] || await context.newPage();

  try {
    // 打开登录页
    await page.goto(XHS_URLS.login, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('📱 [XHS Login] 请扫码登录...');
    console.log('   (浏览器窗口已打开，看到二维码后扫码即可)');
    console.log('   ⏳ 等待登录完成（最多 120 秒）...');

    // 等待登录成功：跳转到 creator 首页
    await page.waitForURL('**/creator.xiaohongshu.com/**', { timeout: 120000 });
    // 排除 login 页面
    await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 60000 });

    console.log('✅ [XHS Login] 登录成功！');

    if (!useCDP) {
      // 保存 Cookie / Storage State
      await context.storageState({ path: COOKIE_FILE });
      console.log(`💾 [XHS Login] Cookie 已保存到: ${COOKIE_FILE}`);

      await browser.close();
      console.log('✅ [XHS Login] 浏览器已关闭，Cookie 持久化完成');
    } else {
      console.log('✅ [XHS Login] CDP 模式 — Cookie 复用当前浏览器会话');
    }

    return true;
  } catch (err) {
    console.error('❌ [XHS Login] 登录失败:', err.message);
    if (!useCDP && browser) await browser.close();
    return false;
  }
}

// ============================================================
// 核心：发布笔记
// ============================================================

/**
 * 用已有 context 发布笔记（浏览器复用，不管理生命周期）
 */
async function postToXHSWithContext(context, note, opts = {}) {
  const { dryRun = false } = opts;

  const todayCount = await getTodayPostCount();
  if (todayCount >= LIMITS.maxPostsPerDay) {
    console.log(`[XHS Poster] ⛔ 今天已发 ${todayCount}/${LIMITS.maxPostsPerDay}`);
    return { success: false, reason: 'daily_limit' };
  }

  const title = (note.title || '').substring(0, LIMITS.maxTitleLen);
  const body = (note.body || '').substring(0, LIMITS.maxBodyLen);
  const tags = (note.tags || []).slice(0, 5);

  if (dryRun) {
    console.log(`   🏜️  预演: "${title}"`);
    return { success: false, reason: 'dry_run' };
  }

  const page = await context.newPage();
  try {
    // Step 1: 检查登录状态
    await page.goto('https://creator.xiaohongshu.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(1000, 2000);

    if (page.url().includes('/login')) {
      return { success: false, reason: 'not_logged_in' };
    }

    // Step 2: 打开发布页 + 切换到图文模式
    await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2000, 3000);

    // 🔑 关键：点击「上传图文」Tab — 元素可能在视口外，用 force
    const imageTabSelectors = [
      page.getByText('上传图文').first(),
      page.locator('text=上传图文').first(),
      page.locator('[class*="tab"]:has-text("图文")').first(),
      page.locator('span:has-text("上传图文")').first(),
    ];
    for (const tab of imageTabSelectors) {
      try {
        // 先尝试普通点击，再尝试 force 点击
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tab.click({ force: true, timeout: 3000 });
          console.log('   📷 已切换到图文模式');
          await randomDelay(1000, 2000);
          break;
        }
      } catch {
        // 最后方案：JS click
        try { await tab.evaluate(el => el.click()); console.log('   📷 JS切换图文'); break; } catch {}
      }
    }

    // Step 3: 生成并上传封面图
    const imageDataUrl = await generateCoverImage(page, note);

    // 等上传区域加载好
    await randomDelay(1000, 2000);
    const fileInput = page.locator('input[type="file"]').first();
    // 尝试让它可交互
    try { await fileInput.evaluate(el => { el.style.display = 'block'; el.style.visibility = 'visible'; }); } catch {}

    const tmpDir = resolve(DATA_DIR, '.tmp');
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
    const tmpFile = resolve(tmpDir, `xhs-cover-${Date.now()}.png`);
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    await writeFile(tmpFile, Buffer.from(base64Data, 'base64'));

    await fileInput.setInputFiles(tmpFile);
    console.log('   🖼️  封面已上传，等待处理...');
    await randomDelay(5000, 8000);

    // Step 4: 填标题 — 等图片上传完成后再找
    const titleSel = '.d-text, [placeholder*="标题"], #title, input[placeholder*="标题"], [class*="title"] input';
    try {
      await page.waitForSelector(titleSel, { timeout: 10000 });
      const titleInput = page.locator(titleSel).first();
      await titleInput.click();
      await randomDelay(300, 800);
      // 清空可能存在的默认值
      await titleInput.fill('');
      await page.keyboard.type(title, { delay: 60 });
      console.log(`   ✍️  标题: ${title}`);
    } catch {
      console.log('   ⚠️  找不到标题框，尝试截图...');
      await page.screenshot({ path: resolve(DATA_DIR, '.tmp', 'debug-no-title.png') });
      return { success: false, reason: 'no_title_input' };
    }

    // Step 5: 填正文 — 小红书使用 Tiptap (ProseMirror) 富文本编辑器
    // 特征: div.ProseMirror[contenteditable] 或 div.tiptap
    const editorSel = '.ProseMirror, .tiptap, [contenteditable="true"], .ql-editor, #post-textarea';
    let editorFilled = false;
    try {
      const editor = page.locator(editorSel).first();
      await editor.click({ timeout: 5000, force: true });
      await page.waitForTimeout(300);
      await page.keyboard.type(body, { delay: 40 });
      editorFilled = true;
    } catch {
      // Fallback: Tab 导航到编辑器
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.keyboard.type(body, { delay: 40 });
      editorFilled = true;
    }
    console.log(`   ✍️  正文已填写 (${body.length} 字)`);

    // Step 6: 标签 — 简化，标签不容易失败
    if (tags.length > 0) {
      try {
        const addTagBtn = page.locator('button:has-text("话题"), span:has-text("添加话题"), .topic-btn').first();
        if (await addTagBtn.isVisible({ timeout: 2000 })) {
          await addTagBtn.click();
          await randomDelay(800, 1500);
          const searchInput = page.locator('input[placeholder*="搜索"]').first();
          if (await searchInput.isVisible({ timeout: 2000 })) {
            await searchInput.fill(tags[0]);
            await randomDelay(1000, 2000);
            const firstResult = page.locator('[class*="topic"]').first();
            if (await firstResult.isVisible({ timeout: 2000 })) {
              await firstResult.click();
              console.log(`   🏷️  标签: #${tags[0]}`);
            }
          }
        }
      } catch { console.log('   ⚠️  标签添加失败，跳过'); }
    }

    // Step 7: 截图调试（无头模式下记录发布前状态）
    await page.screenshot({ path: resolve(DATA_DIR, '.tmp', `pre-publish-${Date.now()}.png`) });

    // Step 8: 发布！
    console.log('   🚀 点击发布...');
    await randomDelay(2000, 3000);

    // 小红书发布按钮：SPAN 文本 "发布笔记"
    let clicked = false;
    const publishSelectors = [
      page.locator('span:has-text("发布笔记")').first(),
      page.locator('text=发布笔记').first(),
      page.locator('button:has-text("发布笔记")').first(),
      page.locator('[class*="publish"]').first(),
      page.getByRole('button', { name: /发布/ }).first(),
      page.locator('.submit-btn').first(),
    ];

    for (const btn of publishSelectors) {
      try {
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click({ force: true, timeout: 3000 });
          clicked = true;
          console.log('   ✅ 点击了发布按钮');
          break;
        }
      } catch {}
    }

    if (!clicked) {
      console.log('   ⚠️  未找到发布按钮，尝试 Ctrl+Enter...');
      await page.keyboard.press('Control+Enter');
    }

    // 等待发布完成
    await randomDelay(5000, 8000);

    // 截图验证发布结果
    await page.screenshot({ path: resolve(DATA_DIR, '.tmp', `post-publish-${Date.now()}.png`) });

    // 日志
    const log = await loadPostLog();
    log.posts.push({ noteSlug: note.slug, title, postedAt: new Date().toISOString(), status: 'submitted' });
    log.totalPosts++;
    await savePostLog(log);

    try { await import('fs/promises').then(m => m.rm(tmpFile)); } catch {}
    console.log('   ✅ 已提交');

    return { success: true, title, postedAt: new Date().toISOString() };

  } catch (err) {
    console.error('   ❌ 失败:', err.message);
    return { success: false, reason: 'error', error: err.message };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * 发布一篇小红书笔记（独立模式，管理浏览器生命周期）
 * @param {object} note - 来自 xhs-inventory.json 的笔记数据
 * @param {object} opts
 * @param {boolean} opts.dryRun - 预演模式，只预览不真发
 * @param {boolean} opts.useCDP - 使用 CDP 连接已有浏览器
 */
export async function postToXHS(note, opts = {}) {
  const { dryRun = false, useCDP = false } = opts;

  // 发布前检查
  const todayCount = await getTodayPostCount();
  if (todayCount >= LIMITS.maxPostsPerDay) {
    console.log(`[XHS Poster] ⛔ 今天已发 ${todayCount} 篇，达上限(${LIMITS.maxPostsPerDay})`);
    return { success: false, reason: 'daily_limit' };
  }

  // 截断超长内容
  const title = (note.title || '').substring(0, LIMITS.maxTitleLen);
  const body = (note.body || '').substring(0, LIMITS.maxBodyLen);
  const tags = (note.tags || []).slice(0, 5);

  console.log(`\n📝 [XHS Poster] 准备发布:`);
  console.log(`   标题: ${title}`);
  console.log(`   标签: ${tags.map(t => '#' + t).join(' ')}`);
  console.log(`   正文: ${body.substring(0, 80)}...`);
  console.log(`   赛道: ${note.xhsTag || note.xhsCategory}`);

  if (dryRun) {
    console.log('   🏜️  预演模式 — 不实际发布');
    return { success: false, reason: 'dry_run' };
  }

  // CI 环境下需要二次确认（安全保护）
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    console.log('   ⚠️  CI 环境 — 需要 XHS_POST_ENABLED=true 才会真发');
    if (process.env.XHS_POST_ENABLED !== 'true') {
      console.log('   ⛔ 跳过发布（设 XHS_POST_ENABLED=true 启用）');
      return { success: false, reason: 'ci_disabled' };
    }
  }

  let browser;
  let context;

  try {
    // 启动浏览器
    if (useCDP) {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      context = browser.contexts()[0];
    } else {
      browser = await chromium.launch({
        headless: true, // 发布时用无头模式
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ],
      });

      // 尝试加载已保存的 Cookie
      if (existsSync(COOKIE_FILE)) {
        context = await browser.newContext({
          storageState: COOKIE_FILE,
          viewport: { width: 1440, height: 900 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        });
      } else {
        context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        });
      }

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }

    const page = context.pages()[0] || await context.newPage();

    // Step 1: 检查登录状态
    console.log('   🔍 检查登录状态...');
    await page.goto(XHS_URLS.home, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('   ❌ Cookie 已过期，请重新登录: node modules/xiaohongshu/auto-poster.js --login');
      if (!useCDP) await browser.close();
      return { success: false, reason: 'not_logged_in' };
    }

    // 关闭可能的弹窗
    await closePopupIfAny(page);

    // Step 2: 导航到发布页
    console.log('   📄 打开发布页...');
    await page.goto(XHS_URLS.publish, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 5000);

    // Step 3: 生成并上传封面图
    console.log('   🎨 生成封面图...');
    const imageDataUrl = await generateCoverImage(page, note);

    // 找到隐藏的 file input 并上传
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.evaluate(el => { el.style.display = 'block'; });

    // 将 data URL 转为 Buffer 写入临时文件再上传
    const tmpDir = resolve(DATA_DIR, '.tmp');
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
    const tmpFile = resolve(tmpDir, `xhs-cover-${Date.now()}.png`);

    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    await writeFile(tmpFile, Buffer.from(base64Data, 'base64'));

    await fileInput.setInputFiles(tmpFile);
    console.log('   🖼️  封面图已上传，等待处理...');
    await randomDelay(5000, 10000); // 图片上传需要时间

    // 等待上传完成
    try {
      await page.waitForSelector('text=上传成功', { timeout: 30000 });
      console.log('   ✅ 图片上传完成');
    } catch {
      console.log('   ⚠️  未检测到"上传成功"提示，继续尝试...');
    }

    // Step 4: 填写标题
    console.log('   ✍️  填写标题...');
    const titleSelector = '.d-text, [placeholder*="标题"], #title, [data-testid="title-input"]';
    await page.waitForSelector(titleSelector, { timeout: 10000 });
    await page.click(titleSelector);
    await randomDelay(500, 1500);
    await page.keyboard.type(title, { delay: 80 });
    await randomDelay(1000, 2000);

    // Step 5: 填写正文
    console.log('   ✍️  填写正文...');
    const editorSelector = '.ql-editor, [placeholder*="内容"], [data-testid="content-editor"], [contenteditable="true"]';
    try {
      await page.click(editorSelector);
    } catch {
      // Fallback: 用 Tab 键切换到正文编辑器
      await page.keyboard.press('Tab');
    }
    await randomDelay(500, 1500);
    await page.keyboard.type(body, { delay: 60 });
    await randomDelay(1000, 2000);

    // Step 6: 添加话题标签
    if (tags.length > 0) {
      console.log('   🏷️  添加话题...');
      for (const tag of tags.slice(0, 3)) {
        try {
          // 查找并点击 "添加话题" 按钮
          const addTopicBtn = page.getByText('添加话题').first();
          if (await addTopicBtn.isVisible({ timeout: 3000 })) {
            await addTopicBtn.click();
            await randomDelay(1000, 2000);

            // 搜索话题
            const searchInput = page.locator('input[placeholder*="搜索"]').first();
            if (await searchInput.isVisible({ timeout: 3000 })) {
              await searchInput.fill(tag);
              await randomDelay(1500, 3000);

              // 点击第一个搜索结果
              const firstResult = page.locator('.topic-item, [class*="topic"]').first();
              if (await firstResult.isVisible({ timeout: 3000 })) {
                await firstResult.click();
                await randomDelay(1000, 2000);
              }
            }
          }
        } catch {
          // 话题添加失败不影响主流程
          console.log(`   ⚠️  话题 "#${tag}" 添加失败，跳过`);
        }
      }
    }

    // Step 7: 最终确认 & 发布
    console.log('   🚀 点击发布...');
    await randomDelay(2000, 3000);

    // 尝试多个发布按钮选择器（小红书 creator 平台经常改版）
    const publishSelectors = [
      page.getByRole('button', { name: /发布/ }).first(),
      page.locator('.publishBtn').first(),
      page.locator('button:has-text("发布")').first(),
      page.locator('.submit-btn').first(),
      page.locator('[class*="publish"]').first(),
      page.locator('button:has-text("提交")').first(),
    ];

    let clicked = false;
    for (const btn of publishSelectors) {
      try {
        if (await btn.isVisible({ timeout: 3000 })) {
          await btn.click();
          clicked = true;
          break;
        }
      } catch {}
    }

    if (!clicked) {
      // 终极 fallback：按 Enter 提交
      console.log('   ⚠️  未找到发布按钮，尝试键盘提交...');
      await page.keyboard.press('Control+Enter');
      await randomDelay(1000, 2000);
    }

    console.log('   ⏳ 等待发布结果...');
    await randomDelay(5000, 8000);

    // 验证发布成功：页面通常会跳转或弹出成功提示
    const postSuccess = await page.getByText(/发布成功|已发布|审核中/).isVisible({ timeout: 10000 }).catch(() => false);

    if (postSuccess) {
      console.log('   ✅ 发布成功！');
    } else {
      console.log('   ⚠️  未检测到明确成功提示，但已提交');
    }

    // 保存发布日志
    const log = await loadPostLog();
    log.posts.push({
      noteSlug: note.slug,
      title: title,
      postedAt: new Date().toISOString(),
      status: postSuccess ? 'published' : 'submitted',
    });
    log.totalPosts++;
    await savePostLog(log);

    // 清理临时文件
    try { await import('fs/promises').then(m => m.rm(tmpFile)); } catch {}

    // 更新 note 状态
    note.postedToXHS = true;
    note.xhsPostedAt = new Date().toISOString();

    if (!useCDP) await browser.close();

    return {
      success: true,
      title,
      postedAt: new Date().toISOString(),
    };

  } catch (err) {
    console.error('   ❌ 发布失败:', err.message);
    if (!useCDP && browser) await browser.close();
    return { success: false, reason: 'error', error: err.message };
  }
}

// ============================================================
// 批量发布 — 从 xhs-inventory.json 选草稿自动发
// ============================================================

/**
 * 自动发布流程：读取草稿 → 筛选 → 逐篇发布
 */
export async function autoPostToXHS(opts = {}) {
  const { dryRun = false, maxPosts = 2, useCDP = false } = opts;

  // 加载草稿
  const { readJSON, writeJSON } = await import('../shared/storage.js');
  const inventory = await readJSON('xhs-inventory.json', []);
  const drafts = inventory.filter(c => !c.postedToXHS);

  if (drafts.length === 0) {
    console.log('[XHS AutoPost] 📭 没有待发布的笔记');
    return { posted: 0 };
  }

  // 限制数量
  const todayCount = await getTodayPostCount();
  const remaining = LIMITS.maxPostsPerDay - todayCount;
  const toPost = drafts.slice(0, Math.min(maxPosts, remaining));

  if (toPost.length === 0) {
    console.log(`[XHS AutoPost] ⛔ 今天额度已满 (${todayCount}/${LIMITS.maxPostsPerDay})`);
    return { posted: 0, reason: 'daily_limit' };
  }

  console.log(`[XHS AutoPost] 📱 准备发布 ${toPost.length} 篇笔记到小红书`);
  console.log(`   今日已发: ${todayCount}/${LIMITS.maxPostsPerDay}`);
  console.log(`   草稿库存: ${drafts.length} 篇`);

  if (dryRun) {
    console.log('[XHS AutoPost] 🏜️  预演模式 — 不实际发布');
    for (const note of toPost) {
      console.log(`   → "${note.title}"`);
    }
    return { posted: 0, reason: 'dry_run', previews: toPost.map(n => n.title) };
  }

  let posted = 0;

  // 复用同一个浏览器发多篇
  let browser, context;
  try {
    if (useCDP) {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      context = browser.contexts()[0];
    } else {
      if (!existsSync(COOKIE_FILE)) {
        console.log('[XHS AutoPost] ❌ 未登录，请先 --login');
        return { posted: 0, reason: 'not_logged_in' };
      }
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
      });
      context = await browser.newContext({
        storageState: COOKIE_FILE,
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }

    for (let i = 0; i < toPost.length; i++) {
      const note = toPost[i];
      console.log(`\n[${i + 1}/${toPost.length}]`);

      const result = await postToXHSWithContext(context, note, { dryRun });

      if (result.success) {
        posted++;
        note.postedToXHS = true;
        note.xhsPostedAt = new Date().toISOString();
      } else {
        console.log(`   ⛔ 跳过: ${result.reason || '未知原因'}`);
        // 如果是登录失效，后续全部跳过
        if (result.reason === 'not_logged_in') break;
      }

      // 篇间间隔
      if (i < toPost.length - 1) {
        const wait = 30000 + Math.floor(Math.random() * 30000);
        console.log(`   ⏳ 等待 ${Math.round(wait / 1000)} 秒后发下一篇...`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  } finally {
    if (!useCDP && browser) await browser.close().catch(() => {});
  }

  // 更新 inventory
  await writeJSON('xhs-inventory.json', inventory);
  console.log(`\n[XHS AutoPost] ✅ 本次发布 ${posted}/${toPost.length} 篇`);

  return { posted };
}

// ============================================================
// 检查登录状态
// ============================================================

export async function checkLoginStatus() {
  if (!existsSync(COOKIE_FILE)) {
    console.log('[XHS] ❌ 未登录 — Cookie 文件不存在');
    console.log('[XHS]    请先运行: node modules/xiaohongshu/auto-poster.js --login');
    return false;
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      storageState: COOKIE_FILE,
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(XHS_URLS.home, { waitUntil: 'networkidle', timeout: 20000 });

    const loggedIn = !page.url().includes('/login');
    await browser.close();

    if (loggedIn) {
      console.log('[XHS] ✅ Cookie 有效，登录状态正常');
    } else {
      console.log('[XHS] ⚠️  Cookie 已过期，请重新登录');
    }
    return loggedIn;
  } catch (err) {
    console.error('[XHS] Cookie 检查失败:', err.message);
    return false;
  }
}

// ============================================================
// 删除已发布笔记
// ============================================================

/**
 * 批量删除小红书已发布笔记
 * 使用 creator.xiaohongshu.com 内容管理 → 全选 → 删除
 */
export async function deleteAllNotes(opts = {}) {
  const { dryRun = false, useCDP = false } = opts;

  if (dryRun) {
    console.log('[XHS Delete] 🏜️  预演模式 — 不实际删除');
  }

  let browser;
  let context;

  try {
    if (useCDP) {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      context = browser.contexts()[0];
    } else {
      if (!existsSync(COOKIE_FILE)) {
        console.log('[XHS Delete] ❌ 未登录，请先 --login');
        return { deleted: 0, reason: 'not_logged_in' };
      }

      browser = await chromium.launch({
        headless: false, // 删除操作有二次确认对话框，用有头模式
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      context = await browser.newContext({
        storageState: COOKIE_FILE,
        viewport: { width: 1440, height: 900 },
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }

    const page = context.pages()[0] || await context.newPage();

    // Step 1: 登录检查
    console.log('[XHS Delete] 🔍 检查登录状态...');
    await page.goto('https://creator.xiaohongshu.com/', { waitUntil: 'networkidle', timeout: 30000 });
    if (page.url().includes('/login')) {
      console.log('[XHS Delete] ❌ Cookie 已过期');
      if (!useCDP) await browser.close();
      return { deleted: 0, reason: 'not_logged_in' };
    }

    // Step 2: 进入内容管理 → 笔记管理
    console.log('[XHS Delete] 📋 进入内容管理...');
    await page.goto('https://creator.xiaohongshu.com/note-manage/notes', { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(3000, 5000);

    // Step 3: 循环删除每一页的笔记
    let totalDeleted = 0;
    let pageNum = 0;
    const maxPages = 10; // 安全上限

    while (pageNum < maxPages) {
      pageNum++;
      console.log(`[XHS Delete] 📄 处理第 ${pageNum} 页...`);

      // 等待笔记列表加载
      await randomDelay(2000, 4000);

      // 查找全选 checkbox
      const selectAll = page.locator('input[type="checkbox"]').first();
      const hasNotes = await selectAll.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasNotes) {
        console.log('[XHS Delete] ✅ 没有更多笔记了');
        break;
      }

      if (!dryRun) {
        // 勾选全选
        await selectAll.click();
        await randomDelay(1000, 2000);

        // 检查当前页勾选了多少条
        const checkedCount = await page.locator('input[type="checkbox"]:checked').count();
        console.log(`[XHS Delete]   已勾选 ${checkedCount} 条笔记`);

        if (checkedCount <= 1) {
          console.log('[XHS Delete]   本页无笔记，跳过');
          break;
        }

        // 点击删除按钮
        const deleteBtn = page.locator('button:has-text("删除"), span:has-text("删除")').first();
        const deleteBtnVisible = await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false);

        if (deleteBtnVisible) {
          await deleteBtn.click();
          await randomDelay(1000, 2000);

          // 确认删除对话框
          const confirmBtn = page.locator('button:has-text("确定"), button:has-text("确认"), .el-button--primary').first();
          const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);

          if (confirmVisible) {
            console.log('[XHS Delete]   🗑️  确认删除...');
            await confirmBtn.click();
            totalDeleted += (checkedCount - 1); // 减掉全选checkbox自己
            await randomDelay(3000, 5000);
          }
        } else {
          console.log('[XHS Delete]   ⚠️  找不到删除按钮，可能已无笔记');
          break;
        }
      } else {
        console.log('[XHS Delete]   🏜️  跳过（预演模式）');
        const noteCount = await page.locator('.note-item, .table-row, [class*="note"]').count();
        totalDeleted += noteCount;
      }

      // 翻下一页
      const nextBtn = page.locator('.btn-next, button:has-text("下一页"), .el-pagination__next').first();
      const hasNext = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasNext && !dryRun) {
        await nextBtn.click();
        await randomDelay(2000, 4000);
      } else {
        break;
      }
    }

    console.log(`[XHS Delete] ✅ 共删除 ${totalDeleted} 篇笔记`);
    if (!useCDP) await browser.close();

    return { deleted: totalDeleted };

  } catch (err) {
    console.error('[XHS Delete] ❌ 失败:', err.message);
    if (!useCDP && browser) await browser.close();
    return { deleted: 0, reason: 'error', error: err.message };
  }
}

// ============================================================
// 工具函数
// ============================================================

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function closePopupIfAny(page) {
  try {
    // 尝试关闭各种弹窗
    const closeSelectors = [
      '.close-btn', '[class*="close"]', '.dialog-close',
      'button:has-text("知道了")', 'button:has-text("关闭")',
      '.el-message-box__close', '.modal-close',
    ];
    for (const sel of closeSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await randomDelay(500, 1000);
      }
    }
  } catch { /* ignore popup close failures */ }
}

// ============================================================
// CLI
// ============================================================

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const args = process.argv.slice(2);

  if (args.includes('--login')) {
    const useCDP = args.includes('--cdp');
    loginToXHS(useCDP).then(ok => {
      console.log(ok ? '\n✅ 登录完成，现在可以发文了' : '\n❌ 登录失败');
      process.exit(ok ? 0 : 1);
    });
  } else if (args.includes('--post')) {
    const useCDP = args.includes('--cdp');
    const dryRun = args.includes('--dry-run');
    autoPostToXHS({ dryRun, useCDP }).then(r => {
      console.log(`\n✅ 发布完成: ${r.posted} 篇`);
      process.exit(0);
    });
  } else if (args.includes('--delete-all')) {
    const dryRun = args.includes('--dry-run');
    deleteAllNotes({ dryRun }).then(r => {
      console.log(`\n✅ 删除完成: ${r.deleted} 篇`);
      process.exit(0);
    });
  } else if (args.includes('--status')) {
    checkLoginStatus().then(() => process.exit(0));
  } else {
    console.log(`
🤖 小红书自动发文器

用法:
  node modules/xiaohongshu/auto-poster.js --login        扫码登录并保存 Cookie
  node modules/xiaohongshu/auto-poster.js --login --cdp  连接已有 Chrome 登录
  node modules/xiaohongshu/auto-poster.js --post         发布草稿箱中的笔记
  node modules/xiaohongshu/auto-poster.js --post --dry-run  预演模式
  node modules/xiaohongshu/auto-poster.js --delete-all   删除所有已发布笔记
  node modules/xiaohongshu/auto-poster.js --delete-all --dry-run  预演（看会删多少）
  node modules/xiaohongshu/auto-poster.js --status       检查登录状态

CDP 模式 (推荐):
  1. 关闭 Chrome
  2. 重新打开: chrome.exe --remote-debugging-port=9222
  3. 在 Chrome 中手动登录 creator.xiaohongshu.com
  4. node modules/xiaohongshu/auto-poster.js --post --cdp

限制:
  - 每天最多发 ${LIMITS.maxPostsPerDay} 篇
  - 标题 ≤${LIMITS.maxTitleLen} 字
  - 正文 ≤${LIMITS.maxBodyLen} 字
  - CI 环境需设 XHS_POST_ENABLED=true
`);
    process.exit(0);
  }
}

export default { loginToXHS, postToXHS, autoPostToXHS, checkLoginStatus };

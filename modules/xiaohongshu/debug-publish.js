/**
 * 可视化调试 — 一步步展示小红书发布全过程并截图
 * 用法: node modules/xiaohongshu/debug-publish.js
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';

const TMP = resolve(import.meta.dirname, '..', '..', 'data', '.tmp');
await mkdir(TMP, { recursive: true });

async function snap(page, name) {
  await page.screenshot({ path: resolve(TMP, name), fullPage: true });
  console.log(`📸 ${name}`);
}

const browser = await chromium.launch({
  headless: false,
  args: ['--no-sandbox'],
  slowMo: 80
});

const ctx = await browser.newContext({
  storageState: resolve(import.meta.dirname, '..', '..', 'data', 'xhs-cookies.json'),
  viewport: { width: 1440, height: 900 },
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const page = await ctx.newPage();

// ============ Step 1: 验证登录 ============
console.log('🔐 Step 1: 验证登录状态...');
await page.goto('https://creator.xiaohongshu.com/', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(3000);

if (page.url().includes('/login')) {
  console.log('❌ Cookie 过期，需要重新登录！');
  console.log('   运行: node modules/xiaohongshu/auto-poster.js --login');
  await browser.close();
  process.exit(1);
}
console.log('✅ 已登录:', page.url());

// ============ Step 2: 打开发布页 ============
console.log('📄 Step 2: 打开发布页...');
await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(3000);
await snap(page, '01-publish-page.png');

// ============ Step 3: 切换图文 ============
console.log('📷 Step 3: 切换图文模式...');
let tabClicked = false;
for (const sel of ['text=上传图文', 'span:has-text("上传图文")', 'div:has-text("上传图文")', '[class*=upload]:has-text("图文")']) {
  try {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click();
      tabClicked = true;
      console.log('  ✅ 点击:', sel);
      break;
    }
  } catch {}
}
if (!tabClicked) console.log('  ⚠️ 没找到「上传图文」Tab');
await page.waitForTimeout(2000);
await snap(page, '02-after-tab.png');

// ============ Step 4: 上传封面 ============
console.log('🎨 Step 4: 生成并上传封面...');
const imgB64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1440;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1080, 1440);
  g.addColorStop(0, '#FF6B81'); g.addColorStop(1, '#FF2442');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.arc(800, 200, 400, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 42px "PingFang SC", "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('🧪 测试发帖', 540, 600);
  ctx.fillText('艾草暖宫贴 · ¥29', 540, 680);
  ctx.fillText('#女生养生 #好物推荐', 540, 760);
  return c.toDataURL();
});
const tmpImg = resolve(TMP, 'test-cover.png');
const b64 = imgB64.replace(/^data:image\/\w+;base64,/, '');
await writeFile(tmpImg, Buffer.from(b64, 'base64'));

const fileInput = page.locator('input[type=file]').first();
await fileInput.setInputFiles(tmpImg);
console.log('  ✅ 图片已设置');
await page.waitForTimeout(6000);
await snap(page, '03-after-upload.png');

// ============ Step 5: 列出所有可见输入元素 ============
console.log('🔍 Step 5: 扫描所有输入元素...');
const inputs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('input, textarea, [contenteditable], .ql-editor'))
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      tag: el.tagName,
      type: el.type || '',
      placeholder: el.placeholder || el.getAttribute('placeholder') || '',
      class: (el.className || '').toString().slice(0, 60),
      text: (el.textContent || '').slice(0, 40),
    }));
});
console.log(JSON.stringify(inputs, null, 2));

// ============ Step 6: 填标题 ============
console.log('✍️ Step 6: 填标题...');
let filled = false;
const titleSelectors = [
  'input[placeholder*="标题"]',
  '[placeholder*="标题"]',
  '[class*="d-text"]',
  '[class*="title"] input',
];
for (const sel of titleSelectors) {
  try {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click();
      await page.waitForTimeout(300);
      await el.fill('');
      await page.waitForTimeout(200);
      await page.keyboard.type('🧪 测试发帖 艾草暖宫贴 女生经期必备', { delay: 50 });
      filled = true;
      console.log('  ✅', sel);
      break;
    }
  } catch {}
}
if (!filled) {
  console.log('  ⚠️ 没找到标题框，手动 Tab 试试...');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  await page.keyboard.type('🧪 测试发帖 艾草暖宫贴 女生经期必备', { delay: 50 });
}
await page.waitForTimeout(1000);
await snap(page, '04-after-title.png');

// ============ Step 7: 填正文 ============
console.log('✍️ Step 7: 填正文...');
const bodyText = '姐妹们！这款艾草暖宫贴我真的回购了三次。学生党友好，一块多一片用着不心疼。冬天贴肚子上暖暖的，经期必备！相比市面上十几块一片的，这个性价比直接拉满。真心推荐给每个月那几天不舒服的姐妹～';

try {
  const editor = page.locator('[contenteditable], .ql-editor').first();
  await editor.click({ timeout: 3000 });
  console.log('  ✅ 点击编辑器');
} catch {
  console.log('  ⚠️ Tab 导航...');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
}
await page.waitForTimeout(500);
await page.keyboard.type(bodyText, { delay: 40 });
console.log('  ✅ 正文已填');
await page.waitForTimeout(1000);
await snap(page, '05-after-body.png');

// ============ Step 8: 列出所有按钮 ============
console.log('🔍 Step 8: 扫描所有按钮...');
const buttons = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button, [role=button], span[class*=btn], div[class*=btn]'))
    .filter(el => {
      const t = (el.textContent || '').trim();
      return t.length > 0 && t.length < 20;
    })
    .map(el => ({
      text: el.textContent.trim(),
      tag: el.tagName,
      class: (el.className || '').toString().slice(0, 60),
      visible: el.offsetParent !== null,
    }));
});
console.log(JSON.stringify(buttons, null, 2));

// ============ 截图最终状态 ============
await snap(page, '06-final-state.png');

console.log('');
console.log('═══════════════════════════════════');
console.log('🛑 浏览器开着，请查看以下截图:');
console.log('   01-publish-page.png  — 发布页初始状态');
console.log('   02-after-tab.png     — 切换图文后');
console.log('   03-after-upload.png  — 上传图片后');
console.log('   04-after-title.png   — 填标题后');
console.log('   05-after-body.png    — 填正文后');
console.log('   06-final-state.png   — 最终状态');
console.log('');
console.log('📋 可见输入元素和按钮已打印在上面');
console.log('   告诉我这些信息，我来判断为什么发不出去');

/**
 * 终极诊断 — 一步步检查发布流程并提取页面文字
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';

const TMP = resolve(import.meta.dirname, '..', '..', 'data', '.tmp');
await mkdir(TMP, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});

const ctx = await browser.newContext({
  storageState: resolve(import.meta.dirname, '..', '..', 'data', 'xhs-cookies.json'),
  viewport: { width: 1440, height: 900 },
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const page = await ctx.newPage();

// Step 1: Login check
await page.goto('https://creator.xiaohongshu.com/', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(2000);
if (page.url().includes('/login')) {
  console.log('❌ 需要重新登录');
  process.exit(1);
}
console.log('✅ 登录态有效');

// Step 2: Open publish page
await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(3000);

// Step 3: Click 上传图文 tab
console.log('📷 切换图文模式...');
const tabClicked = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('*'));
  const tab = els.find(el => el.textContent?.trim() === '上传图文' && el.children.length <= 1);
  if (tab) {
    tab.click();
    return true;
  }
  // 尝试找包含"图文"的可点击元素
  const alt = els.find(el => el.textContent?.includes('图文') && (el.tagName === 'BUTTON' || el.onclick || el.className?.includes('tab')));
  if (alt) { alt.click(); return true; }
  return false;
});
console.log('  结果:', tabClicked);
await page.waitForTimeout(2000);

// Step 4: Find and set file input
const imgB64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1440;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1080, 1440);
  g.addColorStop(0, '#FF6B81'); g.addColorStop(1, '#D4304B');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🧪 诊断测试 · 艾草暖宫贴', 540, 700);
  ctx.fillText('#女生养生', 540, 780);
  return c.toDataURL();
});
const imgFile = resolve(TMP, 'diag-cover.png');
const b64 = imgB64.replace(/^data:image\/\w+;base64,/, '');
await writeFile(imgFile, Buffer.from(b64, 'base64'));

const inputCount = await page.locator('input[type=file]').count();
console.log(`📁 找到 ${inputCount} 个 file input`);

if (inputCount > 0) {
  await page.locator('input[type=file]').first().setInputFiles(imgFile);
  console.log('✅ 图片已上传');
}
await page.waitForTimeout(6000);

// Step 5: Check what changed after upload
const afterUpload = await page.evaluate(() => {
  // 找所有可见输入框
  const inputs = Array.from(document.querySelectorAll('input:not([type=file]), textarea, [contenteditable]'))
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      tag: el.tagName,
      placeholder: el.placeholder || el.getAttribute('placeholder') || '',
      class: (el.className || '').toString().slice(0, 50),
    }));
  // 找所有按钮
  const btns = Array.from(document.querySelectorAll('button, [role=button]'))
    .filter(el => el.offsetParent !== null && el.textContent?.trim().length < 30)
    .map(el => ({ text: el.textContent.trim(), class: (el.className || '').toString().slice(0, 50) }));
  return { inputs, btns };
});

console.log('\n📋 可见输入框:');
afterUpload.inputs.forEach(i => console.log(`  - ${i.tag} placeholder="${i.placeholder}" class="${i.class}"`));
console.log('\n🔘 可见按钮:');
afterUpload.btns.forEach(b => console.log(`  - "${b.text}" | ${b.class}`));

// Step 6: Try to fill title
const title = '🧪 测试发帖 艾草暖宫贴测评';
console.log(`\n✍️ 尝试填标题: "${title}"`);
const titleEls = afterUpload.inputs.filter(i => i.placeholder?.includes('标题') || i.class?.includes('title'));
if (titleEls.length > 0) {
  const sel = titleEls[0].tag === 'INPUT' ? 'input[placeholder*="标题"]' : '[placeholder*="标题"]';
  await page.locator(sel).first().click();
  await page.waitForTimeout(200);
  await page.keyboard.type(title, { delay: 50 });
  console.log('✅ 已填写');
} else {
  console.log('❌ 找不到标题框！');
}

// Step 7: Try to fill body
console.log('✍️ 尝试填正文...');
const editorEls = afterUpload.inputs.filter(i => i.placeholder?.includes('内容') || i.tag === 'P' || i.class?.includes('editor'));
if (editorEls.length > 0 || afterUpload.inputs.some(i => i.tag === 'DIV' && i.class.includes('ql'))) {
  try {
    await page.locator('[contenteditable], .ql-editor').first().click({ timeout: 2000 });
    await page.keyboard.type('这是一条诊断测试笔记。验证发布流程是否正常。#好物推荐 #测试', { delay: 40 });
    console.log('✅ 已填写');
  } catch { console.log('❌ 填写失败'); }
} else {
  console.log('❌ 找不到正文框');
}

await page.waitForTimeout(2000);

// Step 8: Check what buttons are available now
const finalBtns = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button, [role=button], span[class*=btn]'))
    .filter(el => el.offsetParent !== null && el.textContent?.trim().length < 20)
    .map(el => ({ text: el.textContent.trim(), tag: el.tagName, class: (el.className || '').toString().slice(0, 50) }));
});
console.log('\n🔘 最终可见按钮:');
finalBtns.forEach(b => console.log(`  - "${b.text}" | ${b.tag} | ${b.class}`));

// Step 9: Extract full page text summary
const pageSummary = await page.evaluate(() => {
  // Get all text content visible on page
  const body = document.body.innerText || '';
  const lines = body.split('\n').filter(l => l.trim().length > 0).slice(0, 30);
  return lines;
});
console.log('\n📄 页面文字摘要:');
pageSummary.forEach(l => console.log(`  ${l.substring(0, 100)}`));

await page.screenshot({ path: resolve(TMP, 'final-diag.png'), fullPage: true });
console.log('\n📸 截图: final-diag.png');
console.log('═══════════════════════');
console.log('诊断完成。根据上面的信息判断发帖失败原因');

await browser.close();

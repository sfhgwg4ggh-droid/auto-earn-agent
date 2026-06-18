/**
 * CDP 模式发帖 — 通过 JS 层面调用 Vue 组件发布
 * 用法: node modules/xiaohongshu/cdp-post.js
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';

const TMP = resolve(import.meta.dirname, '..', '..', 'data', '.tmp');
await mkdir(TMP, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const page = await browser.contexts()[0].newPage();

// ===== 1. 打开发布页 =====
await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(3000);

// 切图文
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.trim() === '上传图文' && e.children.length <= 1);
  if (el) el.click();
});
await page.waitForTimeout(2000);

// 上传
const imgB64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1440;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FF6B81';
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JS Click', 540, 700);
  return c.toDataURL();
});
const tmpImg = resolve(TMP, 'jsclick.png');
await writeFile(tmpImg, Buffer.from(imgB64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
await page.locator('input[type=file]').first().setInputFiles(tmpImg);
await page.waitForTimeout(6000);

// 标题
await page.locator('input[placeholder*=标题]').first().click({ force: true });
await page.keyboard.type('头皮精华推荐合集学生党必入', { delay: 50 });
await page.waitForTimeout(300);

// 正文
await page.evaluate(() => {
  const ed = document.querySelector('.ProseMirror, [contenteditable=true]');
  if (ed) { ed.focus(); ed.click(); }
});
await page.keyboard.type('测评了5款头皮精华，这款性价比真的绝了！学生党放心冲，效果不输大牌。用了两周头皮明显不痒了。真心推荐给需要的姐妹！#头皮护理 #养发好物 #平价护肤', { delay: 40 });
await page.waitForTimeout(2000);

// ===== 2. JS 层面触发发布 =====
console.log('🔄 JS 层面触发发布...');

const result = await page.evaluate(async () => {
  const log = [];
  const btn = document.querySelector('XHS-PUBLISH-BTN');

  if (!btn) return 'XHS-PUBLISH-BTN not found';

  // Vue 3 组件实例
  const vnode = btn.__vueParentComponent;
  if (vnode) {
    const { setupState, props, emit, exposed } = vnode;
    log.push('setupState keys: ' + (setupState ? Object.keys(setupState).join(', ') : 'none'));
    log.push('props: ' + JSON.stringify(props || {}));

    // 找 submit/handleSubmit
    if (setupState) {
      for (const key of Object.keys(setupState)) {
        if (typeof setupState[key] === 'function') {
          log.push('  function: ' + key);
        }
      }
      // 调用找到的发布方法
      const publishFn = setupState.handleSubmit || setupState.handlePublish || setupState.submit ||
        setupState.onSubmit || setupState.onPublish || setupState.publish;
      if (publishFn) {
        log.push('calling: ' + (publishFn.name || 'anonymous'));
        try {
          await publishFn();
          log.push('publish function called successfully');
        } catch (e) {
          log.push('publish error: ' + e.message);
        }
      }
    }

    // exposed
    if (exposed) {
      log.push('exposed: ' + Object.keys(exposed).join(', '));
    }
  }

  // 方法B: 遍历父组件链找 handleSubmit
  let parent = vnode?.parent;
  let depth = 0;
  while (parent && depth < 10) {
    const ss = parent.setupState;
    if (ss) {
      const pubFns = Object.keys(ss).filter(k =>
        typeof ss[k] === 'function' &&
        (k.includes('submit') || k.includes('publish') || k.includes('post'))
      );
      if (pubFns.length) {
        log.push('parent[' + depth + '] has: ' + pubFns.join(', '));
        for (const fn of pubFns) {
          try {
            await ss[fn]();
            log.push('parent[' + depth + '].' + fn + '() called');
          } catch (e) {
            log.push('parent[' + depth + '].' + fn + '() error: ' + e.message);
          }
        }
      }
    }
    parent = parent.parent;
    depth++;
  }

  // 方法C: 原始 DOM 事件
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  log.push('btn coords: ' + Math.round(cx) + ', ' + Math.round(cy));

  ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
    const evt = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: cx,
      clientY: cy,
      button: 0,
      view: window,
    });
    btn.dispatchEvent(evt);
    document.elementFromPoint(cx, cy)?.dispatchEvent(evt);
  });
  log.push('DOM events dispatched');

  return log.join('\n');
});

console.log('结果:\n' + result);
await page.waitForTimeout(8000);
console.log('URL: ' + page.url());
console.log('⏸️ 浏览器保持打开');

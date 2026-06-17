/**
 * Playwright 浏览器启动器
 * 在 GitHub Actions 和本地环境都能正常工作
 */

import { chromium } from 'playwright';

/** @returns {Promise<import('playwright').Browser>} */
export async function launchBrowser(headless = true) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    // 模拟普通浏览器，降低被检测概率
    '--disable-blink-features=AutomationControlled',
  ];

  // GitHub Actions 额外参数
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    args.push('--disable-software-rasterizer');
    args.push('--disable-extensions');
  }

  return chromium.launch({
    headless,
    args,
    // 慢速模式，更像真人 (仅非 CI 环境)
    slowMo: process.env.CI ? 0 : 50,
  });
}

/**
 * 创建带反检测配置的浏览器上下文
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
export async function createStealthContext(browser) {
  return browser.newContext({
    userAgent: randomUA(),
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    // 伪装成普通 Chrome
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
    // 模拟真实浏览器的 navigator 属性
    javaScriptEnabled: true,
    bypassCSP: false,
  });
}

/** 随机 User-Agent 轮换 */
function randomUA() {
  const uaList = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ];
  return uaList[Math.floor(Math.random() * uaList.length)];
}

/**
 * 随机延迟，模拟人类操作节奏
 * @param {number} min - 最小毫秒
 * @param {number} max - 最大毫秒
 */
export function randomDelay(min = 2000, max = 6000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { launchBrowser, createStealthContext, randomDelay };

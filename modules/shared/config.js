/**
 * 全局配置 — Auto-Earn Agent
 * 全球 Affiliate 内容站，英文 SEO 为主
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

export const CONFIG = {
  // 路径
  rootDir: ROOT,
  dataDir: resolve(ROOT, 'data'),
  publicDir: resolve(ROOT, 'public'),
  blogDir: resolve(ROOT, 'public', 'blog'),
  productsDir: resolve(ROOT, 'public', 'products'),

  // 域名 (部署后替换为实际域名)
  domain: process.env.DOMAIN || 'sfhgwg4ggh-droid.github.io/auto-earn-agent',
  baseUrl: process.env.BASE_URL || 'https://sfhgwg4ggh-droid.github.io/auto-earn-agent',

  // AI — via DeepSeek proxy
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic',
    model: process.env.ANTHROPIC_MODEL || 'DeepSeek-V4-flash',
    fallbackModel: process.env.ANTHROPIC_FALLBACK_MODEL || 'DeepSeek-V4-pro[1m]',
    maxTokens: 8000,
    dailyLimit: 15,          // 每天最多生成 N 篇，防止 API 费用失控
  },

  // 内容策略
  content: {
    language: 'en',           // 主语言：英文（全球 SEO）
    postsPerDay: 2,
    minWords: 800,
    maxWords: 3000,
    defaultCategory: 'reviews',
    // 可配置的品类，换关键词就能切赛道
    categories: [
      { slug: 'pet-supplies', name: 'Pet Supplies', emoji: '🐾',
        keywords: ['best dog bed', 'cat tree review', 'automatic pet feeder', 'dog toys', 'pet grooming tools'] },
      { slug: 'home-garden', name: 'Home & Garden', emoji: '🏡',
        keywords: ['best robot vacuum', 'air purifier review', 'standing desk', 'garden tools', 'solar lights outdoor'] },
      { slug: 'tech-gadgets', name: 'Tech & Gadgets', emoji: '💻',
        keywords: ['wireless earbuds review', 'mechanical keyboard', 'usb-c hub', 'portable charger', 'webcam for streaming'] },
      { slug: 'fitness-sports', name: 'Fitness & Sports', emoji: '💪',
        keywords: ['yoga mat review', 'resistance bands set', 'adjustable dumbbells', 'running shoes', 'fitness tracker'] },
      { slug: 'baby-kids', name: 'Baby & Kids', emoji: '👶',
        keywords: ['baby monitor', 'stroller review', 'car seat safety', 'baby bottle warmer', 'kids learning toys'] },
    ],
  },

  // 电商
  commerce: {
    maxProductsPerRun: 10,
    minProfitMargin: 0.30,
    requestDelay: { min: 2000, max: 6000 },
  },

  // SEO
  seo: {
    siteName: 'Smart Picks & Honest Reviews',
    tagline: 'We test, compare, and recommend the best products for your home, pets, and life.',
    defaultAuthor: 'The Review Team',
    language: 'en-US',
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || '',
    googleAdSenseId: process.env.GOOGLE_ADSENSE_ID || '',
  },

  // Affiliate 平台
  affiliates: {
    amazon: {
      tag: process.env.AMAZON_TAG || 'smartpicks-20',
      regions: ['com', 'co.uk', 'ca', 'de', 'fr', 'it', 'es', 'jp'],
      defaultRegion: 'com',
    },
    shareasale: { merchantId: process.env.SHAREASALE_ID || '' },
    cj: { pid: process.env.CJ_PID || '' },
  },

  // 运行环境
  isCI: !!process.env.CI,
  isGitHubActions: !!process.env.GITHUB_ACTIONS,
};

export default CONFIG;

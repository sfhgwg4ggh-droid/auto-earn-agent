/**
 * 社交电商全自动流水线
 * 生成笔记 → 自动发帖 → 记录结果
 *
 * 两种模式:
 *   --generate  仅生成发布清单（CI 安全模式，默认）
 *   --post      生成 + 自动发帖（本机有 Cookie 时）
 *   --post --cdp 连接已登录 Chrome 发帖（最稳）
 */
import storage from '../shared/storage.js';

export async function runSocialPipeline(opts = {}) {
  const { autoPost = false, useCDP = false, dryRun = false } = opts;

  console.log('\n📱 ====== 社交电商全自动流水线 ======\n');

  // Phase 1: 生成内容
  console.log('[1/3] 📝 生成内容...');
  const xhs = await import('./xiaohongshu.js');
  await xhs.default.generateDailyPosts();

  const xy = await import('./xianyu.js');
  await xy.default.generateListings();
  await xy.default.generateSEOKeywords();

  // Phase 2: 生成今日清单
  console.log('[2/3] 📋 汇总清单...');
  const checklist = await generateTodayChecklist();

  // Phase 3: 自动发帖（需要本机登录）
  console.log(`[3/3] ${autoPost ? '🚀 自动发帖' : '📋 仅生成（加 --post 自动发）'}...`);
  let postResults = { xiaohongshu: { posted: 0 }, xianyu: { posted: 0 } };

  if (autoPost) {
    try {
      const { autoPostToXHS } = await import('../xiaohongshu/auto-poster.js');
      const xhsR = await autoPostToXHS({ dryRun, useCDP, maxPosts: 1 });
      postResults.xiaohongshu = xhsR;
    } catch (e) { console.error('[小红书发帖] ❌', e.message); }

    try {
      const { autoPublishListings } = await import('../xianyu/auto-lister.js');
      const xyR = await autoPublishListings({ dryRun, useCDP, maxPosts: 1 });
      postResults.xianyu = xyR;
    } catch (e) { console.error('[闲鱼发帖] ❌', e.message); }
  }

  console.log('\n📱 ====== 完成 ======');
  console.log(`   小红书: ${postResults.xiaohongshu.posted || checklist.platforms.xiaohongshu.postsGenerated} 篇`);
  console.log(`   闲鱼:   ${postResults.xianyu.posted || checklist.platforms.xianyu.listingsGenerated} 个`);
  console.log('');

  return { checklist, postResults };
}

async function generateTodayChecklist() {
  const today = new Date().toISOString().split('T')[0];
  const xhsPosts = await storage.readJSON('social/xhs-posts.json', []);
  const xyListings = await storage.readJSON('social/xianyu-listings.json', []);
  const todayXHS = xhsPosts.filter(p => p.createdAt?.startsWith(today));
  const todayXY = xyListings.filter(l => l.createdAt?.startsWith(today));

  return {
    date: today, generatedAt: new Date().toISOString(),
    platforms: {
      xiaohongshu: {
        postsGenerated: todayXHS.length,
        posts: todayXHS.map(p => ({
          title: p.title, type: p.contentType,
          body: p.body + '\n\n' + p.monetization,
          tags: p.tags?.map(t => '#' + t).join(' '),
          imageDirection: p.imageDirection,
        })),
      },
      xianyu: {
        listingsGenerated: todayXY.length,
        listings: todayXY.map(l => ({
          product: l.product, title: l.title, price: '¥' + l.price,
          description: l.description?.substring(0, 200),
          tags: l.tags, images: l.images,
        })),
      },
    },
    autoPostTip: autoPostInstruction(),
  };
}

function autoPostInstruction() {
  return `
┌──────────────────────────────────────────┐
│ 🤖 自动发帖配置（本机操作，5分钟搞定）   │
├──────────────────────────────────────────┤
│                                          │
│ 小红书：                                 │
│ ① node modules/xiaohongshu/auto-poster.js --login       │
│    → 扫码登录，Cookie 自动保存           │
│ ② node modules/social/social-pipeline.js --post         │
│    → 内容生成 + 自动发帖一气呵成         │
│                                          │
│ 闲鱼：                                   │
│ ① node modules/xianyu/auto-lister.js --login            │
│    → 扫码登录，Cookie 自动保存           │
│ ② 同上 --post 自动发                    │
│                                          │
│ CDP 模式（最稳，绕过反爬）：             │
│ chrome.exe --remote-debugging-port=9222  │
│ → 手动登录小红书/闲鱼                    │
│ → node ... --post --cdp                  │
└──────────────────────────────────────────┘`;
}

export async function getSocialStats() {
  const xhs = await storage.readJSON('social/xhs-posts.json', []);
  const xy = await storage.readJSON('social/xianyu-listings.json', []);
  return {
    xiaohongshu: { total: xhs.length, published: xhs.filter(p => p.status === 'published').length, drafts: xhs.filter(p => p.status === 'draft').length },
    xianyu: { total: xy.length, published: xy.filter(l => l.status === 'published').length, drafts: xy.filter(l => l.status === 'draft').length },
  };
}

// CLI
const isDirectRun = process.argv[1] && process.argv[1].includes('social-pipeline');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const autoPost = args.includes('--post');
  const useCDP = args.includes('--cdp');
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📱 社交电商全自动流水线

用法:
  node modules/social/social-pipeline.js              仅生成（CI安全模式）
  node modules/social/social-pipeline.js --post       生成+自动发帖（需已登录）
  node modules/social/social-pipeline.js --post --cdp 连接已登录Chrome发帖
  node modules/social/social-pipeline.js --post --dry-run  预演不真发

${autoPostInstruction()}
`);
    process.exit(0);
  }

  runSocialPipeline({ autoPost, useCDP, dryRun }).then(() => process.exit(0));
}

export default { runSocialPipeline, getSocialStats };

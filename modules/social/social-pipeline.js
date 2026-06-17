/**
 * 社交电商统一流水线
 * 小红书种草 → 闲鱼接单 → 数字交付
 */
import storage from '../shared/storage.js';

export async function runSocialPipeline() {
  console.log('\n📱 ====== 社交电商流水线 ======\n');
  console.log('[1/2] 📕 小红书...');
  const xhs = await import('./xiaohongshu.js');
  await xhs.default.generateDailyPosts();
  console.log('[2/2] 🐟 闲鱼...');
  const xy = await import('./xianyu.js');
  await xy.default.generateListings();
  await xy.default.generateSEOKeywords();
  const checklist = await generateTodayChecklist();
  console.log('\n📱 ====== 完成 ======\n');
  return checklist;
}

async function generateTodayChecklist() {
  const today = new Date().toISOString().split('T')[0];
  const xhsPosts = await storage.readJSON('social/xhs-posts.json', []);
  const xyListings = await storage.readJSON('social/xianyu-listings.json', []);
  const todayXHS = xhsPosts.filter(p => p.createdAt?.startsWith(today) && p.status === 'draft');
  const todayXY = xyListings.filter(l => l.createdAt?.startsWith(today) && l.status === 'draft');
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
    dailyRevenuePlan: {
      target: '¥200-500/天',
      strategy: '早9擦亮闲鱼 → 中午发小红书 → 晚8互动 → 睡前确认订单',
    },
  };
  await storage.writeJSON('social/today-checklist.json', checklist);
  return checklist;
}

export async function getSocialStats() {
  const xhs = await storage.readJSON('social/xhs-posts.json', []);
  const xy = await storage.readJSON('social/xianyu-listings.json', []);
  return {
    xiaohongshu: { total: xhs.length, published: xhs.filter(p => p.status === 'published').length, drafts: xhs.filter(p => p.status === 'draft').length },
    xianyu: { total: xy.length, published: xy.filter(l => l.status === 'published').length, drafts: xy.filter(l => l.status === 'draft').length },
  };
}

const isDirectRun = process.argv[1] && process.argv[1].includes('social-pipeline');
if (isDirectRun) {
  runSocialPipeline().then(r => {
    console.log('\n📊 今日清单: 小红书' + r.platforms.xiaohongshu.postsGenerated + '篇, 闲鱼' + r.platforms.xianyu.listingsGenerated + '个');
  });
}

export default { runSocialPipeline, getSocialStats };

/**
 * 社交电商统一流水线
 *
 * 整合小红书 + 闲鱼，生成每日发布清单
 * 变现模型: 小红书内容引流 → 闲鱼 Listing 接单 → 微信/支付宝成交 → 数字交付
 */

import storage from '../shared/storage.js';

/**
 * 主流水线：生成今日所有社交内容
 */
export async function runSocialPipeline() {
  console.log('\n📱 ====== 社交电商流水线 ======');

  // Phase 1: 小红书 — 内容种草
  console.log('\n[1/3] 📕 小红书种草内容...');
  const xhs = await import('./xiaohongshu.js');
  await xhs.default.generateDailyPosts();

  // Phase 2: 闲鱼 — 商品上架
  console.log('\n[2/3] 🐟 闲鱼 Listing...');
  const xy = await import('./xianyu.js');
  await xy.default.generateListings();

  // Phase 3: 生成今日运营清单
  console.log('\n[3/3] 📋 生成今日发布清单...');
  const checklist = await generateTodayChecklist();

  console.log('\n📱 ====== 社交电商流水线完成 ======\n');
  return checklist;
}

/**
 * 生成今日统一发布清单
 */
async function generateTodayChecklist() {
  const today = new Date().toISOString().split('T')[0];

  const xhsPosts = await storage.readJSON('social/xhs-posts.json', []);
  const xyListings = await storage.readJSON('social/xianyu-listings.json', []);

  const todayXHS = xhsPosts.filter(p => p.createdAt?.startsWith(today) && p.status === 'draft');
  const todayXY = xyListings.filter(l => l.createdAt?.startsWith(today) && l.status === 'draft');

  const checklist = {
    date: today,
    generatedAt: new Date().toISOString(),
    platforms: {
      xiaohongshu: {
        postsGenerated: todayXHS.length,
        scheduledTime: todayXHS[0]?.scheduledFor || '明天 7:30',
        posts: todayXHS.map(p => ({
          title: p.title,
          type: p.contentType,
          scenario: p.scenario,
          body: (p.body || '').substring(0, 120) + '...',
          tags: p.tags?.join(' | '),
          monetization: p.monetization,
          imageDirection: p.imageDirection,
          copyPaste: {
            title: p.title,
            body: p.body + '\n\n' + p.monetization,
            tags: p.tags?.map(t => '#' + t).join(' '),
          },
        })),
      },
      xianyu: {
        listingsGenerated: todayXY.length,
        listings: todayXY.map(l => ({
          product: l.product,
          title: l.title,
          price: `¥${l.price}`,
          description: l.description?.substring(0, 200) + '...',
          tags: l.tags,
          images: l.images,
          refreshTip: l.refreshSchedule,
        })),
      },
    },
    // 每日变现清单
    dailyRevenuePlan: {
      target: '¥200-500/天',
      strategy: '早9点擦亮闲鱼 → 中午发小红书 → 晚8点互动 → 睡前确认今日订单',
      products: [
        { product: '定制宠物肖像', price: '¥88', profit: '¥88', goal: '2-3单/天' },
        { product: '狗妈/狗爸定义画', price: '¥39', profit: '¥39', goal: '3-5单/天' },
        { product: '宠物纪念画', price: '¥29', profit: '¥29', goal: '2-3单/天' },
      ],
    },
    copyPasteReady: true,
  };

  await storage.writeJSON('social/today-checklist.json', checklist);
  return checklist;
}

/**
 * 获取发过的所有内容统计
 */
export async function getSocialStats() {
  const xhsPosts = await storage.readJSON('social/xhs-posts.json', []);
  const xyListings = await storage.readJSON('social/xianyu-listings.json', []);

  const published = {
    xiaohongshu: {
      total: xhsPosts.length,
      published: xhsPosts.filter(p => p.status === 'published').length,
      drafts: xhsPosts.filter(p => p.status === 'draft').length,
      byType: {},
    },
    xianyu: {
      total: xyListings.length,
      published: xyListings.filter(l => l.status === 'published').length,
      drafts: xyListings.filter(l => l.status === 'draft').length,
    },
  };

  // 统计小红书内容类型分布
  for (const p of xhsPosts) {
    published.xiaohongshu.byType[p.contentType] = (published.xiaohongshu.byType[p.contentType] || 0) + 1;
  }

  return published;
}

/**
 * 生成内容日历（未来 7 天）
 */
export async function generateContentCalendar() {
  const posts = await storage.readJSON('social/xhs-posts.json', []);
  const drafts = posts.filter(p => p.status === 'draft');

  // 按推荐发布时间排序
  const calendar = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    calendar[dateStr] = {
      dayOfWeek: dayNames[date.getDay()],
      xiaohongshu: i < drafts.length ? {
        title: drafts[i]?.title || '待生成',
        type: drafts[i]?.contentType || 'emotional',
        scheduledFor: drafts[i]?.scheduledFor || '7:30',
      } : { title: '待生成' },
      xianyu: '擦亮 + 刷新',
      note: i === 0 ? '今天！' : `还有 ${i} 天`,
    };
  }

  await storage.writeJSON('social/content-calendar.json', {
    generatedAt: new Date().toISOString(),
    calendar,
  });

  return calendar;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runSocialPipeline()
    .then(() => generateContentCalendar())
    .then(() => getSocialStats())
    .then(stats => {
      console.log('\n📊 社交电商统计:');
      console.log(`  小红书: ${stats.xiaohongshu.total} 篇 (${stats.xiaohongshu.published} 已发)`);
      console.log(`  闲鱼:   ${stats.xianyu.total} 个 Listing (${stats.xianyu.published} 已发)`);
    })
    .then(() => console.log('✅ 社交电商流水线完成'));
}

export default {
  runSocialPipeline,
  generateTodayChecklist,
  getSocialStats,
  generateContentCalendar,
};

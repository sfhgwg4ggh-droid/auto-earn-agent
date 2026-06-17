/**
 * 小红书内容引擎 — AI 生成种草笔记
 *
 * 策略:
 *   - 情感向(40%): 宠物故事、纪念、感人瞬间 → 高互动
 *   - 干货向(30%): 养宠知识、省钱技巧、DIY教程 → 长尾流量
 *   - 种草向(30%): 产品展示、效果对比、好物推荐 → 直接转化
 *
 * 变现路径: 小红书笔记 → 主页/私信 → 闲鱼链接 → 微信成交
 */

import CONFIG from '../shared/config.js';
import storage from '../shared/storage.js';

// ── 笔记模板库 ─────────────────────────────────────────────

const POST_TEMPLATES = {
  // 情感向 — 宠物纪念/肖像（最高转化）
  emotional_pet_portrait: {
    types: [
      {
        scenario: '宠物去世纪念',
        titles: [
          '😭 男朋友送了我家毛孩子的肖像画，哭了一整晚',
          '用了12年的陪伴，换成一幅永远的画',
          '它走了以后，我做了这件事…每次看到都会哭',
          '给回汪星的毛孩子画了幅肖像，好像它还在',
        ],
        body: `从宠物离开的那天起，手机里几千张照片再也不敢翻。

直到收到这幅手绘肖像——画师把我家{宠物名}最可爱的样子画了下来。每一个细节都对：耳朵的弧度、嘴角的弧度、还有那双永远看着我的眼睛。

现在这幅画挂在我书桌前。每天早上看到它，就像{宠物名}还在对我摇尾巴。

{emoji} 有时候，最好的纪念不是忘掉，而是好好记住。

#宠物纪念 #宠物肖像定制 #毛孩子回汪星 #宠物手绘 #感人故事`,
        tags: ['宠物纪念', '宠物肖像定制', '毛孩子', '感动瞬间', '宠物手绘', '治愈系'],
        imageDirection: '精美肖像画实物照（装在相框里）+ 原宠物照片对比，暖色调',
      },
      {
        scenario: '暖心礼物',
        titles: [
          '送闺蜜这幅画，她抱着我哭了一个小时',
          '养宠人收到这个礼物真的会哭',
          '朋友生日我送了这个，她说这是最好的礼物',
          '花100块给闺蜜定制了这个，她反手发了个大红包',
        ],
        body: `朋友家{宠物名}今年{年龄}岁了。想着送什么生日礼物给她…

突然想到——把她家毛孩子的照片画成肖像！

找画师定制了这幅{风格}风格的肖像。花了不到100块，但收到的时候她直接哭了。

"这是我这辈子收到最好的礼物。"她说。

{emoji} 有时候最好的礼物不是多贵，是有人记得你的毛孩子。

#宠物礼物 #闺蜜生日礼物 #宠物肖像 #感动礼物 #狗狗画像`,
        tags: ['宠物礼物', '闺蜜礼物', '宠物肖像定制', '生日惊喜', '宠物手绘'],
        imageDirection: '礼盒包装的肖像画 + 收礼人感动表情（可打码）+ 肖像细节',
      },
    ],
  },

  // 干货向 — 养宠知识（长尾搜索流量）
  knowledge_pet_care: {
    types: [
      {
        scenario: '宠物艺术科普',
        titles: [
          '如何把毛孩子照片变成艺术品？保姆级教程',
          '花不到100块，把宠物照片挂上墙的完整攻略',
          '养宠3年才发现！宠物照片还能这样处理',
          '宠物肖像定制避坑指南：这样选画师不踩雷',
        ],
        body: `很多姐妹问我怎么定制宠物肖像的！整理了一份超详细攻略👇

📸 **第一步：选照片**
- 光线好的正面照最佳
- 避免模糊/逆光/遮挡
- 最好选自然光下的照片

🎨 **第二步：选风格**
- 水彩风：温柔浪漫，适合女生
- 极简线条：现代简约，适合家居
- 波西米亚：复古文艺，适合装饰
- 卡通风：可爱有趣，适合送人

💰 **第三步：找画师**
- 闲鱼搜"宠物肖像定制"（性价比高）
- 看评价和作品集
- 问清楚包含几版修改
- 确认交付格式和时间

🖼️ **第四步：打印装裱**
- 淘宝打印8x10寸只要5块！
- 宜家/拼多多买相框15-30块
- 挂墙上or摆桌上都好看

总花费不到100块，得到的是一辈子的回忆！💝

#宠物肖像 #DIY教程 #花钱省时间 #养宠技能 #家居装饰`,
        tags: ['宠物肖像', 'DIY教程', '宠物定制', '省钱攻略', '家居装饰', '养宠必备'],
        imageDirection: '步骤图解：照片→画作→打印→装裱→挂墙，每步配图',
      },
    ],
  },

  // 种草向 — 产品展示（直接转化）
  product_showcase: {
    types: [
      {
        scenario: '宠物周边推荐',
        titles: [
          '养宠3年，这5件东西真的值得买！',
          '被我闺蜜追问3次的狗妈好物分享',
          '每个养宠人都该拥有的5件东西（最后一件事最珍贵）',
          '狗妈必备清单，有了这些幸福指数飙升',
        ],
        body: `养了{年限}年狗，踩过无数坑。这5件东西是我觉得真正值得的：

**1. 粘毛滚筒** 🧥
出门前的最后一步。养宠人必备，不解释。

**2. 耐咬玩具** 🦴
省下了换沙发的钱。推荐Kong的，用了2年还没坏。

**3. 宠物监控** 📸
上班摸鱼的时候看看毛孩子在干嘛。最重要的安全感。

**4. 宠物急救手册** 🏥
关键时刻救命。建议打印一份贴在冰箱上。

**5. 定制宠物肖像画** 🎨
这个是最惊喜的！把毛孩子的照片画成了画。比照片好看100倍，挂在客厅每天看到心情都会变好。朋友来家里第一眼就被吸引。而且超便宜，才几十块钱！

你们都有几件了？评论区告诉我👇

#好物推荐 #养宠必备 #宠物用品 #狗妈好物 #实用主义`,
        tags: ['好物推荐', '养宠必备', '宠物用品', '狗妈', '实用好物', '购物清单'],
        imageDirection: '5件产品的平铺合照（俯拍），每件单品特写，重点突出肖像画',
      },
    ],
  },
};

// ── 发布时间策略 ──────────────────────────────────────────

const POSTING_SCHEDULE = {
  // 小红书最佳发布时间（北京时间）
  bestTimes: [
    { day: '周一至周五', times: ['7:30-8:30', '12:00-13:00', '18:00-19:00', '21:00-22:00'] },
    { day: '周六周日', times: ['9:00-10:00', '14:00-15:00', '20:00-22:00'] },
  ],
  // 每天建议发布数
  postsPerDay: 1,
  // 内容轮换策略（避免重复）
  rotation: ['emotional_pet_portrait', 'knowledge_pet_care', 'product_showcase', 'emotional_pet_portrait'],
};

// ── 核心函数 ───────────────────────────────────────────────

/**
 * 为今天生成小红书笔记
 * @returns {Array} 生成的笔记列表
 */
export async function generateDailyPosts() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // 检查今天是否已生成
  const existing = await storage.readJSON('social/xhs-posts.json', []);
  const todayPosts = existing.filter(p => p.createdAt?.startsWith(today));
  if (todayPosts.length >= 1) {
    console.log(`[小红书] 今日已生成 ${todayPosts.length} 篇，跳过`);
    return todayPosts;
  }

  // 按轮换策略选择内容类型
  const idx = existing.length % POSTING_SCHEDULE.rotation.length;
  const contentType = POSTING_SCHEDULE.rotation[idx];

  const template = POST_TEMPLATES[contentType];
  if (!template) {
    console.log(`[小红书] 未知内容类型: ${contentType}`);
    return [];
  }

  // 随机选一个 scenario
  const scenarioTemplate = template.types[Math.floor(Math.random() * template.types.length)];

  // 生成笔记
  const post = {
    id: `xhs-${today}-${idx}`,
    contentType,
    scenario: scenarioTemplate.scenario,
    title: scenarioTemplate.titles[Math.floor(Math.random() * scenarioTemplate.titles.length)],
    body: scenarioTemplate.body,
    tags: scenarioTemplate.tags,
    imageDirection: scenarioTemplate.imageDirection,
    // 变现引导
    monetization: generateMonetization(contentType),
    platform: 'xiaohongshu',
    status: 'draft',
    createdAt: now.toISOString(),
    scheduledFor: getNextPostingTime(now),
  };

  // 保存
  existing.push(post);
  await storage.writeJSON('social/xhs-posts.json', existing);

  console.log(`[小红书] ✅ 生成笔记: "${post.title.substring(0, 40)}..." (${contentType})`);
  return [post];
}

/**
 * 根据内容类型生成变现引导语
 */
function generateMonetization(contentType) {
  const ctas = {
    emotional_pet_portrait: '💝 想要定制你家毛孩子的肖像？戳主页看详情～',
    knowledge_pet_care: '🎨 按这个攻略省了100块！戳主页可定制同款肖像',
    product_showcase: '🛒 最后一件肖像画：主页/私信可定制你家毛孩子！限时优惠中…',
  };
  return ctas[contentType] || '💝 戳主页了解更多～';
}

/**
 * 获取下一个最佳发布时间
 */
function getNextPostingTime(now) {
  const hour = now.getHours();
  const bestHours = [7, 12, 18, 21];
  for (const h of bestHours) {
    if (hour < h) {
      const t = new Date(now);
      t.setHours(h, Math.floor(Math.random() * 30), 0, 0);
      return t.toISOString();
    }
  }
  // 明天早上 7 点
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(7, Math.floor(Math.random() * 30), 0, 0);
  return t.toISOString();
}

/**
 * 批量生成本周所有笔记
 */
export async function generateWeeklyBatch() {
  const results = [];
  for (let i = 0; i < 7; i++) {
    const posts = await generateDailyPosts();
    results.push(...posts);
  }
  console.log(`[小红书] 📋 本周批量生成完成: ${results.length} 篇`);
  return results;
}

/**
 * 生成发布清单（供人工复制粘贴）
 */
export async function generatePublishChecklist() {
  const posts = await storage.readJSON('social/xhs-posts.json', []);
  const unpublished = posts.filter(p => p.status === 'draft');

  if (unpublished.length === 0) {
    console.log('[小红书] 没有待发布的笔记');
    return [];
  }

  const checklist = unpublished.map((p, i) => ({
    index: i + 1,
    title: `📝 ${p.title}`,
    contentType: p.contentType,
    scenario: p.scenario,
    imageDirection: p.imageDirection,
    body: p.body + '\n\n' + p.monetization,
    tags: p.tags,
    tagsFormatted: p.tags.map(t => '#' + t).join(' '),
    scheduledFor: p.scheduledFor,
    copyPasteReady: true,
  }));

  // 保存为今日待办
  await storage.writeJSON('social/today-checklist.json', {
    date: new Date().toISOString().split('T')[0],
    platform: 'xiaohongshu',
    items: checklist,
  });

  return checklist;
}

/**
 * 标记笔记为已发布
 */
export async function markAsPublished(postId) {
  const posts = await storage.readJSON('social/xhs-posts.json', []);
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.status = 'published';
    post.publishedAt = new Date().toISOString();
    await storage.writeJSON('social/xhs-posts.json', posts);
    console.log(`[小红书] ✅ 标记已发布: ${postId}`);
  }
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    await generateDailyPosts();
    await generatePublishChecklist();
    console.log('✅ 小红书内容生成完成');
  })();
}

export default {
  generateDailyPosts,
  generateWeeklyBatch,
  generatePublishChecklist,
  markAsPublished,
  POSTING_SCHEDULE,
  POST_TEMPLATES,
};

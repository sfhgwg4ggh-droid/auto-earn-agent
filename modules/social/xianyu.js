/**
 * 闲鱼 Listing 引擎 — AI 优化商品标题/描述/定价
 *
 * 闲鱼算法特点:
 *   - 标题关键词匹配是核心排名因素
 *   - 每天"擦亮"（刷新）可提升曝光
 *   - 高回复率+高成交率提升账号权重
 *   - 图片数量≥6张算法加权
 *   - "超赞"和"想要"数据影响排名
 *
 * 变现: 数字商品（宠物肖像/装饰画/模板）零成本高利润
 */

import storage from '../shared/storage.js';

// ── 商品模板库 ────────────────────────────────────────────

const PRODUCT_TEMPLATES = [
  // 核心产品: 定制宠物肖像
  {
    category: '定制设计',
    product: '宠物肖像手绘定制',
    priceRange: { min: 68, max: 168, recommended: 88 },
    titles: [
      '🎨 定制宠物肖像画 | 照片转手绘 | 电子版数字文件 | 纪念礼物',
      '定制你家毛孩子的手绘肖像画 电子版 打印装饰画 照片转插画',
      '宠物肖像定制 纯手绘 狗猫画像 纪念礼物 电子版发文件',
      '【纯手绘】宠物肖像定制 狗狗猫咪画像 照片转手绘 数字版',
    ],
    description: `🎨 纯手绘定制宠物肖像画 | 电子版数字文件

✨ 你发照片，我来画！
每张都是纯手绘，不是AI生成，不是滤镜！

──── 定制流程 ────
① 你发毛孩子最可爱的照片给我
② 告诉我想要什么风格/背景/颜色
③ 2-3天出稿，发给你确认
④ 满意后发高清文件（自己打印即可）

──── 包含内容 ────
📁 电子版文件（不是实物画！）：
• JPG高清原图（300DPI）
• PNG透明背景版
• PDF打印版
• 3个尺寸：8x10寸 / 11x14寸 / 16x20寸

──── 价格说明 ────
🐕 单人+单宠：¥88
🐕🐕 单人+双宠：¥128
👨‍👩‍👧‍👦 全家福+宠物：¥168

──── 为什么选我 ────
✅ 真手绘，可看绘画过程
✅ 改到满意为止（不限次数！）
✅ 2-3天出稿（急单可加急）
✅ 好评率99%，超500+订单

⚠️ 下单前请私信确认档期！
⚠️ 这是电子版文件，需自己打印
⚠️ 复杂背景/多人多宠请先沟通

──── 买家须知 ────
• 电子文件发微信/邮箱/网盘
• 淘宝打印8x10寸仅需¥5
• 相框推荐宜家/拼多多¥15-30
• 总成本不到¥100=永久的纪念💝

🏷️ #宠物肖像定制 #手绘宠物 #宠物纪念 #狗狗画像 #猫咪画像 #照片转手绘`,
    tags: ['宠物肖像', '定制手绘', '宠物纪念', '狗狗画像', '猫咪画像', '数字下载', '个性化礼物'],
    images: [
      '封面：精美肖像画成品 + 原照片对比',
      '细节特写：笔触/毛发细节',
      '风格展示：水彩/极简/波西米亚/卡通 4种',
      '尺寸对比：8x10 vs 11x14 vs 16x20',
      '客户评价截图',
      '装裱效果：相框+挂墙实拍',
    ],
    refreshKeywords: ['宠物肖像', '宠物定制', '狗狗画像', '猫咪手绘', '照片转手绘', '纪念礼物'],
  },

  // 高利润品: 狗妈/狗爸定义画
  {
    category: '装饰画',
    product: '狗妈/狗爸/猫妈 搞笑定义打印画',
    priceRange: { min: 29, max: 49, recommended: 39 },
    titles: [
      '😂 狗妈定义搞笑打印画 | 电子版 | 装饰画 | 养狗人必备',
      '狗爸定义装饰画 搞笑宠物周边 电子版 自打印 送养狗的朋友',
      '猫妈定义打印画 搞笑猫咪周边 铲屎官必备 数字文件',
    ],
    description: `😂 养宠人必备的搞笑定义画！

──── 可选款式 ────
🐕 狗妈定义：
"一个为了狗取消约会、手机里5000张狗照片、进门先喊狗名的人类"

🐕 狗爸定义：
"一个说过'绝对不能养狗'的男人，现在有47个狗的外号，睡前先给狗盖被子"

🐱 猫妈定义：
"被选中的人类。职责包括：凌晨3点铲屎、无限期供零食、接受自己是家具的事实"

──── 产品信息 ────
📁 电子版文件（非实物）：
• JPG高清 + PDF打印版
• 3个尺寸：8x10 / 11x14 / A3
• 4种风格可选

🎨 可选风格：
• 现代极简（百搭）
• 复古文艺（文艺范）
• 波西米亚（ins风）
• 趣味卡通（可爱）

💰 ¥39/款 | ¥69/任选3款
📥 下单秒发电子版
🖨️ 自己打印装裱，成本不到¥15

💡 建议：打印+相框=最走心的宠物主题礼物！`,
    tags: ['狗妈', '狗爸', '猫妈', '搞笑装饰画', '宠物周边', '数字下载', '个性化礼物'],
    images: ['风格对比拼图', '装裱效果实拍', '细节展示'],
    refreshKeywords: ['狗妈', '狗爸', '搞笑画', '宠物装饰', '宠物礼物', '装饰画'],
  },

  // 入门品: 宠物纪念品
  {
    category: '纪念品',
    product: 'Rainbow Bridge 宠物纪念打印画',
    priceRange: { min: 19, max: 39, recommended: 29 },
    titles: [
      '🌈 宠物纪念 Rainbow Bridge 打印画 | 电子版 | 悼念礼物',
      '宠物去世纪念画 彩虹桥 Rainbow Bridge 电子版 个性化定制',
    ],
    description: `🌈 彩虹桥宠物纪念打印画

温柔地纪念你最好的朋友。

──── 产品信息 ────
📁 电子版数字文件
🖨️ 3个尺寸可选
🎨 3种配色：日落 / 月光 / 花园
💝 包含配套悼念卡片
📥 下单秒发

──── 定制信息 ────
请告诉我：
• 你家毛孩子的名字
• 生卒年份（可选，有人更喜欢不写）
• 想要哪种配色

💰 ¥29
📥 电子版即时交付
💝 最温柔的纪念方式`,
    tags: ['宠物纪念', '彩虹桥', '宠物悼念', '纪念礼物', '数字下载'],
    images: ['成品展示', '3种配色对比', '装裱效果'],
    refreshKeywords: ['宠物纪念', '彩虹桥', '宠物去世纪念', '悼念礼物'],
  },
];

// ── 核心函数 ───────────────────────────────────────────────

/**
 * 生成闲鱼 Listing
 */
export async function generateListings() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const existing = await storage.readJSON('social/xianyu-listings.json', []);

  // 检查今天是否已生成
  const todayGenerated = existing.filter(l => l.createdAt?.startsWith(today));
  if (todayGenerated.length >= 1) {
    console.log(`[闲鱼] 今日已生成 ${todayGenerated.length} 个 Listing`);
    return todayGenerated;
  }

  // 轮换产品
  const idx = existing.length % PRODUCT_TEMPLATES.length;
  const template = PRODUCT_TEMPLATES[idx];

  const listing = {
    id: `xy-${today}-${idx}`,
    product: template.product,
    category: template.category,
    title: template.titles[Math.floor(Math.random() * template.titles.length)],
    price: template.priceRange.recommended,
    priceRange: template.priceRange,
    description: template.description,
    tags: template.tags,
    tagString: template.tags.map(t => '#' + t).join(' '),
    images: template.images,
    refreshKeywords: template.refreshKeywords,
    // 擦亮策略
    refreshSchedule: '每天上午9:00擦亮，提高曝光',
    platform: 'xianyu',
    status: 'draft',
    createdAt: now.toISOString(),
  };

  existing.push(listing);
  await storage.writeJSON('social/xianyu-listings.json', existing);

  console.log(`[闲鱼] ✅ 生成 Listing: "${listing.title.substring(0, 40)}..." ¥${listing.price}`);
  return [listing];
}

/**
 * 生成今日发布清单
 */
export async function generatePublishChecklist() {
  const listings = await storage.readJSON('social/xianyu-listings.json', []);
  const unpublished = listings.filter(l => l.status === 'draft');

  if (unpublished.length === 0) {
    console.log('[闲鱼] 没有待发布的 Listing');
    return [];
  }

  const checklist = unpublished.map((l, i) => ({
    index: i + 1,
    platform: '闲鱼',
    product: l.product,
    title: l.title,
    price: `¥${l.price}`,
    priceRange: `¥${l.priceRange.min}-${l.priceRange.max}`,
    category: l.category,
    description: l.description,
    tags: l.tagString,
    images: l.images,
    tips: [
      '📸 发布时上传6张以上图片（算法加权）',
      '🔄 每天擦亮一次（点"擦亮"按钮）',
      '💬 快速回复买家消息（回复速度影响权重）',
      '🏷️ 多放几个相关标签增加搜索曝光',
      `💡 建议定价 ¥${l.price}，可留 ¥10-20 砍价空间`,
    ],
  }));

  return checklist;
}

/**
 * 生成闲鱼 SEO 关键词（用于标题优化）
 */
export async function generateSEOKeywords() {
  // 闲鱼热搜词（宠物/设计类目）
  const hotKeywords = [
    // 高搜索量
    { keyword: '宠物肖像定制', volume: '高', competition: '中', season: '全年' },
    { keyword: '狗狗画像', volume: '高', competition: '高', season: '全年' },
    { keyword: '猫咪手绘', volume: '高', competition: '高', season: '全年' },
    { keyword: '照片转手绘', volume: '高', competition: '高', season: '全年' },
    { keyword: '定制画像', volume: '中', competition: '中', season: '全年' },
    // 节日高峰
    { keyword: '母亲节礼物', volume: '高', competition: '高', season: '5月' },
    { keyword: '父亲节礼物', volume: '高', competition: '高', season: '6月' },
    { keyword: '情人节礼物定制', volume: '高', competition: '高', season: '2月' },
    { keyword: '纪念日礼物', volume: '中', competition: '中', season: '全年' },
    { keyword: '闺蜜生日礼物', volume: '中', competition: '中', season: '全年' },
    // 装饰画类目
    { keyword: '装饰画', volume: '高', competition: '高', season: '全年' },
    { keyword: 'ins风装饰画', volume: '高', competition: '高', season: '全年' },
    { keyword: '搞笑装饰画', volume: '中', competition: '低', season: '全年' },
    { keyword: '宠物装饰画', volume: '中', competition: '低', season: '全年' },
    // 长尾词
    { keyword: '电子版打印', volume: '中', competition: '低', season: '全年' },
    { keyword: '数字下载', volume: '中', competition: '低', season: '全年' },
    { keyword: '宠物周边', volume: '中', competition: '中', season: '全年' },
    { keyword: '宠物礼物', volume: '中', competition: '中', season: '全年' },
  ];

  await storage.writeJSON('social/xianyu-keywords.json', {
    updatedAt: new Date().toISOString(),
    keywords: hotKeywords,
  });

  console.log(`[闲鱼] 🔑 ${hotKeywords.length} 个 SEO 关键词已更新`);
  return hotKeywords;
}

/**
 * 生成每日运营清单
 */
export async function generateDailyOpsChecklist() {
  const today = new Date().toISOString().split('T')[0];
  const checklist = {
    date: today,
    platform: '闲鱼',
    tasks: [
      { time: '09:00', task: '🔄 擦亮所有在线商品', done: false },
      { time: '09:30', task: '💬 回复昨晚消息（30分钟内回复）', done: false },
      { time: '12:00', task: '📊 查看今日曝光数据', done: false },
      { time: '15:00', task: '🔍 搜索竞品最新定价，调整价格', done: false },
      { time: '18:00', task: '📸 发布新商品或更新图片', done: false },
      { time: '21:00', task: '📈 查看今日成交数据，记录', done: false },
    ],
  };

  await storage.writeJSON('social/today-ops.json', checklist);
  return checklist;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  (async () => {
    await generateSEOKeywords();
    await generateListings();
    await generatePublishChecklist();
    await generateDailyOpsChecklist();
    console.log('✅ 闲鱼内容生成完成');
  })();
}

export default {
  generateListings,
  generatePublishChecklist,
  generateSEOKeywords,
  generateDailyOpsChecklist,
  PRODUCT_TEMPLATES,
};

/**
 * 闲鱼 Listing 引擎 — AI 优化商品标题/描述/定价
 * 变现: 数字商品（宠物肖像/装饰画/模板）零成本高利润
 */
import storage from '../shared/storage.js';

const PRODUCT_TEMPLATES = [{
  category: '定制设计', product: '宠物肖像手绘定制',
  priceRange: { min: 68, max: 168, recommended: 88 },
  titles: ['🎨 定制宠物肖像画 | 照片转手绘 | 电子版数字文件 | 纪念礼物','定制你家毛孩子的手绘肖像画 电子版 打印装饰画','宠物肖像定制 纯手绘 狗猫画像 纪念礼物 电子版发文件'],
  description: '🎨 纯手绘定制宠物肖像画 | 电子版数字文件\n\n✨ 你发照片，我来画！每张都是纯手绘，不是AI生成\n\n──── 定制流程 ────\n① 你发毛孩子最可爱的照片给我\n② 告诉我想要什么风格/背景\n③ 2-3天出稿，发给你确认\n④ 满意后发高清文件（自己打印即可）\n\n──── 价格 ────\n🐕 单人+单宠：¥88\n🐕🐕 单人+双宠：¥128\n👨‍👩‍👧‍👦 全家福+宠物：¥168\n\n⚠️ 下单前请私信确认档期！电子版文件，需自己打印',
  tags: ['宠物肖像','定制手绘','宠物纪念','狗狗画像','猫咪画像','数字下载','个性化礼物'],
  images: ['精美肖像画成品+原照片对比','细节特写','4种风格展示','尺寸对比','客户评价截图','装裱效果实拍'],
},{
  category: '装饰画', product: '狗妈/狗爸/猫妈 搞笑定义打印画',
  priceRange: { min: 29, max: 49, recommended: 39 },
  titles: ['😂 狗妈定义搞笑打印画 | 电子版 | 装饰画 | 养狗人必备','狗爸定义装饰画 搞笑宠物周边 电子版 自打印 送养狗的朋友'],
  description: '😂 养宠人必备的搞笑定义画！\n\n🐕 狗妈定义："一个为了狗取消约会、手机里5000张狗照片、进门先喊狗名的人类"\n🐕 狗爸定义："一个说过绝对不能养狗的男人，现在有47个狗的外号，睡前先给狗盖被子"\n🐱 猫妈定义："被选中的人类。职责包括：凌晨3点铲屎、无限期供零食、接受自己是家具的事实"\n\n📁 电子版文件：JPG高清+PDF打印版\n🎨 4种风格：现代极简/复古文艺/波西米亚/趣味卡通\n💰 ¥39/款 | ¥69/任选3款\n📥 下单秒发电子版',
  tags: ['狗妈','狗爸','猫妈','搞笑装饰画','宠物周边','数字下载'],
  images: ['风格对比拼图','装裱效果实拍','细节展示'],
},{
  category: '纪念品', product: 'Rainbow Bridge 宠物纪念打印画',
  priceRange: { min: 19, max: 39, recommended: 29 },
  titles: ['🌈 宠物纪念 Rainbow Bridge 打印画 | 电子版 | 悼念礼物','宠物去世纪念画 彩虹桥 Rainbow Bridge 电子版 个性化定制'],
  description: '🌈 彩虹桥宠物纪念打印画\n\n温柔地纪念你最好的朋友。\n\n📁 电子版数字文件\n🖨️ 3个尺寸可选\n🎨 3种配色：日落/月光/花园\n💝 包含配套悼念卡片\n📥 下单秒发\n\n💰 ¥29\n💝 最温柔的纪念方式',
  tags: ['宠物纪念','彩虹桥','宠物悼念','纪念礼物','数字下载'],
  images: ['成品展示','3种配色对比','装裱效果'],
}];

export async function generateListings() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const existing = await storage.readJSON('social/xianyu-listings.json', []);
  const todayGenerated = existing.filter(l => l.createdAt?.startsWith(today));
  if (todayGenerated.length >= 1) {
    console.log('[闲鱼] 今日已生成，跳过');
    return todayGenerated;
  }
  const idx = existing.length % PRODUCT_TEMPLATES.length;
  const t = PRODUCT_TEMPLATES[idx];
  const listing = {
    id: 'xy-' + today + '-' + idx, product: t.product, category: t.category,
    title: t.titles[Math.floor(Math.random() * t.titles.length)],
    price: t.priceRange.recommended, priceRange: t.priceRange,
    description: t.description, tags: t.tags,
    tagString: t.tags.map(x => '#' + x).join(' '),
    images: t.images, refreshSchedule: '每天上午9:00擦亮',
    platform: 'xianyu', status: 'draft',
    createdAt: now.toISOString(),
  };
  existing.push(listing);
  await storage.writeJSON('social/xianyu-listings.json', existing);
  console.log('[闲鱼] ✅ 生成Listing:', listing.title.substring(0,40), '¥' + listing.price);
  return [listing];
}

export async function generateSEOKeywords() {
  const keywords = [
    { keyword: '宠物肖像定制', volume: '高' },{ keyword: '狗狗画像', volume: '高' },
    { keyword: '猫咪手绘', volume: '高' },{ keyword: '照片转手绘', volume: '高' },
    { keyword: '定制画像', volume: '中' },{ keyword: '装饰画', volume: '高' },
    { keyword: 'ins风装饰画', volume: '高' },{ keyword: '搞笑装饰画', volume: '中' },
    { keyword: '宠物装饰画', volume: '中' },{ keyword: '电子版打印', volume: '中' },
    { keyword: '数字下载', volume: '中' },{ keyword: '宠物周边', volume: '中' },
    { keyword: '宠物礼物', volume: '中' },{ keyword: '闺蜜生日礼物', volume: '中' },
    { keyword: '宠物纪念', volume: '中' },
  ];
  await storage.writeJSON('social/xianyu-keywords.json', { updatedAt: new Date().toISOString(), keywords });
  return keywords;
}

export default { generateListings, generateSEOKeywords, PRODUCT_TEMPLATES };

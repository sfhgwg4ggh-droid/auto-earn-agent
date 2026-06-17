/**
 * 小红书内容引擎 — AI 生成种草笔记
 * 变现路径: 小红书笔记 → 主页/私信 → 闲鱼链接 → 微信成交
 */
import storage from '../shared/storage.js';

const POST_TEMPLATES = {
  emotional_pet_portrait: {
    types: [{
      scenario: '宠物去世纪念',
      titles: ['😭 男朋友送了我家毛孩子的肖像画，哭了一整晚','用了12年的陪伴，换成一幅永远的画','它走了以后，我做了这件事…每次看到都会哭'],
      body: '从宠物离开的那天起，手机里几千张照片再也不敢翻。\n\n直到收到这幅手绘肖像——画师把我家毛孩子最可爱的样子画了下来。每一个细节都对。\n\n现在这幅画挂在我书桌前。每天早上看到它，就像它还在对我摇尾巴。\n\n有时候，最好的纪念不是忘掉，而是好好记住。',
      tags: ['宠物纪念','宠物肖像定制','毛孩子','感动瞬间','宠物手绘','治愈系'],
      imageDirection: '精美肖像画实物照（装在相框里）+ 原宠物照片对比，暖色调',
    },{
      scenario: '暖心礼物',
      titles: ['送闺蜜这幅画，她抱着我哭了一个小时','养宠人收到这个礼物真的会哭','花100块给闺蜜定制了这个，她反手发了个大红包'],
      body: '朋友家毛孩子今年又老了一岁。想着送什么生日礼物给她…\n\n突然想到——把她家毛孩子的照片画成肖像！\n\n找画师定制了这幅水彩风格的肖像。花了不到100块，但收到的时候她直接哭了。\n\n"这是我这辈子收到最好的礼物。"她说。\n\n有时候最好的礼物不是多贵，是有人记得你的毛孩子。',
      tags: ['宠物礼物','闺蜜礼物','宠物肖像定制','生日惊喜','宠物手绘'],
      imageDirection: '礼盒包装的肖像画 + 收礼人感动表情（可打码）+ 肖像细节',
    }],
  },
  knowledge_pet_care: {
    types: [{
      scenario: '宠物艺术科普',
      titles: ['如何把毛孩子照片变成艺术品？保姆级教程','花不到100块，把宠物照片挂上墙的完整攻略','养宠3年才发现！宠物照片还能这样处理'],
      body: '很多姐妹问我怎么定制宠物肖像的！整理了一份超详细攻略👇\n\n📸 第一步：选照片 — 光线好的正面照最佳\n🎨 第二步：选风格 — 水彩/极简线条/波西米亚/卡通\n💰 第三步：找画师 — 闲鱼搜"宠物肖像定制"，看评价和作品集\n🖼️ 第四步：打印装裱 — 淘宝打印8x10寸只要5块！宜家/拼多多买相框15-30块\n\n总花费不到100块，得到的是一辈子的回忆！💝',
      tags: ['宠物肖像','DIY教程','宠物定制','省钱攻略','家居装饰','养宠必备'],
      imageDirection: '步骤图解：照片→画作→打印→装裱→挂墙，每步配图',
    }],
  },
  product_showcase: {
    types: [{
      scenario: '宠物周边推荐',
      titles: ['养宠3年，这5件东西真的值得买！','被我闺蜜追问3次的狗妈好物分享','每个养宠人都该拥有的5件东西'],
      body: '养了好几年狗，踩过无数坑。这5件东西是我觉得真正值得的：\n\n1. 粘毛滚筒 — 出门前的最后一步\n2. 耐咬玩具 — 省下了换沙发的钱\n3. 宠物监控 — 上班摸鱼看看毛孩子\n4. 宠物急救手册 — 关键时刻救命\n5. 定制宠物肖像画 — 这个是最惊喜的！把毛孩子的照片画成了画，挂在客厅每天看到心情都会变好\n\n你们都有几件了？评论区告诉我👇',
      tags: ['好物推荐','养宠必备','宠物用品','狗妈','实用好物','购物清单'],
      imageDirection: '5件产品的平铺合照（俯拍），每件单品特写，重点突出肖像画',
    }],
  },
};

function generateMonetization(contentType) {
  return {
    emotional_pet_portrait: '💝 想要定制你家毛孩子的肖像？戳主页看详情～',
    knowledge_pet_care: '🎨 按这个攻略省了100块！戳主页可定制同款肖像',
    product_showcase: '🛒 最后一件肖像画：主页/私信可定制你家毛孩子！',
  }[contentType] || '💝 戳主页了解更多～';
}

export async function generateDailyPosts() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const existing = await storage.readJSON('social/xhs-posts.json', []);
  const todayPosts = existing.filter(p => p.createdAt?.startsWith(today));
  if (todayPosts.length >= 1) {
    console.log('[小红书] 今日已生成，跳过');
    return todayPosts;
  }
  const rotation = ['emotional_pet_portrait','knowledge_pet_care','product_showcase','emotional_pet_portrait'];
  const contentType = rotation[existing.length % rotation.length];
  const template = POST_TEMPLATES[contentType];
  if (!template) return [];
  const s = template.types[Math.floor(Math.random() * template.types.length)];
  const post = {
    id: 'xhs-' + today + '-' + existing.length,
    contentType, scenario: s.scenario,
    title: s.titles[Math.floor(Math.random() * s.titles.length)],
    body: s.body, tags: s.tags, imageDirection: s.imageDirection,
    monetization: generateMonetization(contentType),
    platform: 'xiaohongshu', status: 'draft',
    createdAt: now.toISOString(),
  };
  existing.push(post);
  await storage.writeJSON('social/xhs-posts.json', existing);
  console.log('[小红书] ✅ 生成笔记:', post.title.substring(0,40));
  return [post];
}

export default { generateDailyPosts, POST_TEMPLATES };

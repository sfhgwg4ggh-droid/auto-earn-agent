/**
 * 📣 推广引擎 — 全渠道推广内容自动生成
 * 覆盖：知乎/百度SEO/抖音脚本/朋友圈/微信群/Pinterest
 * 运行: node modules/social/promotion-engine.js
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const TARGETS = {
  miniprogram: '微信小程序「PawsomeArt」',
  wxSearch: '微信搜索「PawsomeArt」',
  landingPage: 'https://activated-manual-synthetic-neutral.trycloudflare.com/shop.html',
  priceRange: '¥29-168',
  coreProduct: '定制宠物肖像',
  corePrice: '¥88',
  usp: '纯手绘·不是AI·改到满意',
};

// ═══════════════════════════════════════════════════════
// 1. 知乎回答 — 高权重，百度秒收
// ═══════════════════════════════════════════════════════
function generateZhihuAnswers() {
  return [
    {
      question: '有什么好的宠物纪念方式？',
      answer: `失去宠物的痛，只有养过的人才懂。

我试过好几种纪念方式，觉得最值得的是定制一幅宠物肖像画。

为什么要推荐这个：

1. 每天能看到——挂在客厅/卧室，抬头就是它的笑脸。不是压在手机相册深处慢慢遗忘。

2. 比照片有温度——照片是机器的，画是人一笔一笔画出来的。颜料里是有感情的。

3. 不贵——电子版${TARGETS.priceRange}，自己淘宝打印8x10寸才5块钱。装裱好不到100块。

4. 送人也超级走心——我一个朋友狗狗回汪星了，我送了她一幅定制肖像。她收到直接哭了。

我是通过${TARGETS.wxSearch}定制的。纯手绘，不是AI生成——这是关键。AI画得虽然快但总有一种廉价感，手绘的笔触你能看出来。

另外推荐彩虹桥纪念画（¥29），配上宠物的名字和日期，简简单单但特别温柔。

总的来说，$100以内给你的毛孩子一个永久的纪念，非常值。`,
      tags: ['宠物纪念', '宠物肖像', '定制画', '宠物去世', '纪念方式'],
    },
    {
      question: '送养宠物的人什么礼物比较好？',
      answer: `🐾 作为一个养狗5年+家里挂着狗狗肖像的过来人，说几个真正受欢迎的：\n\n🥇 定制宠物肖像画 — 送哭好几个朋友了\n\n我之前送了闺蜜一幅她家金毛的肖像。她打开盒子看到画的瞬间直接飙泪——不是夸张，是真的哭了。\n\n原因是：养宠的人手机里有几千张照片，但从来没想过把这些照片变\"真正的东西\"。照片是数字的，画是实体的，挂在墙上每天能看到。这个情绪价值，比任何礼物都高。\n\n价格也不贵，${TARGETS.priceRange}。相比送花（2天就谢了）、送吃的（吃完就没了），一幅画可以挂一辈子。\n\n去${TARGETS.wxSearch}就能找到，纯手绘，改到满意。\n\n🥈 宠物脚印纪念套件\n🥉 定制宠物抱枕\n\n关键原则：送\"有他宠物\"的东西，不要送\"通用宠物用品\"。`,
      tags: ['宠物礼物', '闺蜜礼物', '宠物肖像', '生日礼物', '走心礼物'],
    },
    {
      question: '有什么适合在家做的副业？门槛低一点的？',
      answer: `推荐一个几乎零门槛的：手绘宠物肖像定制。\n\n为什么适合副业：\n\n1. 完全不需要囤货——电子版数字商品，画好发文件就行\n2. 零成本——你只要会画画（手绘或iPad板绘都行），或者找画师合作\n3. 客单价不错——${TARGETS.priceRange}，一天接2-3单就是¥200+\n4. 需求爆发——养宠物的人越来越多了，纪念/送礼都是刚需\n5. 时间自由——晚上画，白天发\n\n起步建议：\n- 先在闲鱼/小红书发作品积累第一波客户\n- 注册${TARGETS.wxSearch}开小程序店\n- 定价策略：低价引流款¥29（纪念画）+ 利润款¥88（定制肖像）\n- 核心卖点：\"纯手绘，不是AI\" — 这年头AI泛滥，纯手绘反而是稀缺品\n\n我一个朋友做这个，第一个月就赚了3000+。\n\n关键是坚持发内容。每天小红书1篇+闲鱼新品1个，1-2个月流量就起来了。`,
      tags: ['副业推荐', '在家赚钱', '手绘宠物', '零成本创业', '数字商品'],
    },
  ];
}

// ═══════════════════════════════════════════════════════
// 2. 百度SEO文章 — 高转化搜索词
// ═══════════════════════════════════════════════════════
function generateSEOArticles() {
  const articles = [
    {
      file: '百度SEO-宠物肖像定制哪家好.html',
      title: '宠物肖像定制哪家好？2026年最全推荐（附真实评价对比）',
      desc: '对比5家宠物肖像定制服务商，从价格/质量/速度/售后4个维度测评。帮你选到最合适的。',
      keywords: ['宠物肖像定制哪家好', '狗狗画像推荐', '猫咪手绘定制', '宠物画师推荐'],
      sections: ['📊 5家对比横评', '💰 价格对比表', '⭐ 真实评价汇总', '🎯 最终推荐'],
      cta: '🎯 综合推荐：PawsomeArt — 纯手绘+价格适中+口碑好 → ',
    },
    {
      file: '百度SEO-把狗狗照片画成画.html',
      title: '怎么把狗狗照片画成画？2026最新教程（手机3步搞定）',
      desc: '用手机3步把狗狗照片变成精美手绘画像。选照片→找画师→收文件→打印装裱，全流程教程。',
      keywords: ['把狗狗照片画成画', '宠物照片转手绘', '狗狗定制画', '宠物AI画像'],
      sections: ['📸 第1步：选照片技巧', '🎨 第2步：选画师/风格', '🖨️ 第3步：打印装裱教程'],
      cta: '👉 不会选画师？直接',
    },
    {
      file: '百度SEO-宠物纪念最好的方式.html',
      title: '宠物去世了怎么纪念？7种最有意义的方式（第4种最推荐）',
      desc: '宠物离开后，这7种纪念方式能让它永远活在记忆里。从简单到深刻，总会找到适合你的。',
      keywords: ['宠物去世怎么纪念', '宠物纪念方式', '宠物离开的安慰', '狗狗去世怀念'],
      sections: ['1. 珍藏照片墙', '2. 保留心爱的玩具', '3. 种一棵纪念树', '4. 定制手绘肖像 ⭐', '5. 宠物骨灰纪念品', '6. 宠物纪念册', '7. 捐款给动物救助'],
      cta: '💝 最推荐第4种。定制一幅手绘肖像，',
    },
    {
      file: '百度SEO-狗妈生日礼物推荐.html',
      title: '送狗妈的礼物推荐：2026最走心TOP10（第3个会让她哭）',
      desc: '狗妈生日送什么？这10个礼物从¥29到¥168，每一件都是狗妈最想要的。',
      keywords: ['狗妈生日礼物', '送养狗的朋友什么礼物', '狗妈必备', '狗妈礼物推荐'],
      sections: ['TOP1：定制宠物肖像 ¥88', 'TOP2：狗妈定义装饰画 ¥39', 'TOP3：项链刻宠物名', 'TOP4-10...'],
      cta: '🐕 TOP1的定制肖像，',
    },
    {
      file: '百度SEO-宠物手绘和照片的区别.html',
      title: '宠物手绘vs照片：为什么越来越多人选择手绘？4个区别说清楚',
      desc: '照片和手绘到底有什么不同？为什么花几十块画一幅比几千张照片更有意义？4个核心区别。',
      keywords: ['宠物手绘和照片的区别', '手绘宠物有意义吗', '为什么定制宠物画', '肖像画vs照片'],
      sections: ['区别1：温度感', '区别2：艺术性', '区别3：持久性', '区别4：情感价值'],
      cta: '🖼️ 体验手绘的温暖，',
    },
  ];

  return articles.map(a => {
    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${a.title}</title>
<meta name="description" content="${a.desc}">
<meta name="keywords" content="${a.keywords.join(',')}">
</head>
<body style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:750px;margin:0 auto;padding:20px;line-height:1.8;color:#333;background:#faf8f4">
<article>
<h1 style="color:#5c4033;font-size:24px;border-bottom:3px solid #d4a853;padding-bottom:16px">${a.title}</h1>
<p style="color:#888;font-size:13px;margin-bottom:24px">${a.desc}</p>
${a.sections.map(s => {
  const id = s.substring(2, 8);
  return `<h2 style="color:#4a7c59;border-left:4px solid #4a7c59;padding-left:12px;margin:28px 0 12px" id="${id}">${s}</h2>
<p>很多宠物家长都会关注这个问题。在${new Date().getFullYear()}年，选择越来越丰富，但品质也参差不齐。</p>
<p>关键是找到适合自己的：预算、风格、用途都要考虑进去。综合来看，电子版数字文件是性价比最高的选择——价格适中，交付快，而且可以无限打印。</p>`;
}).join('\n')}
<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;margin:24px 0">
  <p style="margin:0;line-height:2">${a.cta}<strong>微信搜索「PawsomeArt」小程序</strong></p>
  <p style="font-size:13px;color:#92400e;margin:8px 0 0">🎨 纯手绘 · 不是AI · ${TARGETS.priceRange} · 改到满意 · 不满意退款</p>
</div>
<p style="color:#999;font-size:12px;text-align:center;margin-top:32px">© ${new Date().getFullYear()} 宠物肖像定制指南 · ${TARGETS.wxSearch}</p>
</article>
</body></html>`;
    return { file: a.file, title: a.title, html: content };
  });
}

// ═══════════════════════════════════════════════════════
// 3. 抖音/TikTok 文案
// ═══════════════════════════════════════════════════════
function generateDouyinScripts() {
  return [
    {
      type: 'before-after',
      title: '照片→手绘 反差',
      script: `开头(0-3s)：原照片 vs 手绘成品 左右对比 + 大字"这真的是手画的？！"
中间(3-20s)：画师画的过程加速播放(板绘/纸上都可以)
结尾(20-25s)：成品特写 + "你的毛孩子也可以" + 指向左下角小程序
文案：#宠物肖像 #手绘定制 #狗狗画像 微信搜PawsomeArt`,
    },
    {
      type: 'emotional',
      title: '宠物纪念·感动向',
      script: `开头(0-3s)：温柔音乐起 + 文字"12年的陪伴..."
中间(3-25s)：老照片→画师绘制过程→成品挂在墙上的温馨画面
结尾(25-30s)：主人看着画微笑的剪影 + "最好的纪念，是永远记住"
文案：它陪了你十几年，你给它一个永远的家。#宠物纪念 #彩虹桥 #狗狗#微信搜PawsomeArt`,
    },
    {
      type: 'tutorial',
      title: '科普教程',
      script: `开头(0-3s)："一张照片怎么变成一幅画？我来告诉你"
中间(3-25s)：步骤演示 ①选照片→②扫码下单→③2天出稿→④打印装裱
结尾(25-30s)："这么简单？对的"+"微信搜PawsomeArt三天后收到惊喜"
文案：把毛孩子画下来，只需要三步！#宠物 #手绘 #教程 #DIY`,
    },
  ];
}

// ═══════════════════════════════════════════════════════
// 4. 朋友圈/微信群文案
// ═══════════════════════════════════════════════════════
function generateWeChatCopy() {
  return [
    {
      scene: '开业公告',
      text: `🐾 官宣！我的宠物肖像定制小店开张啦！

✨ 纯手绘，不是AI生成
📸 你发照片，我来画
🔄 改到满意为止
📥 电子版即时交付

💰 开业特惠（限前20名）：
🎨 定制宠物肖像 原¥128 → ¥88
😂 狗妈/狗爸定义画 原¥59 → ¥39
🌈 彩虹桥纪念画 原¥49 → ¥29

📱 微信搜「PawsomeArt」小程序直接下单
或者私信我，帮你操作～

前5位下单的朋友，免费升级加急！`,
    },
    {
      scene: '作品展示',
      text: `🐕 新鲜出炉！今天给客户画的哈士奇～

你们看看这眼神，是不是一模一样？😆

画了12个小时，每一根毛都是手动画的。客户收到直接发了个朋友圈说"太值了"。

说实话，做这个最大的成就感不是赚钱，是每次客户收到画说"太像了"的时候那种开心。

💝 想给你家毛孩子也画一幅？
📱 微信搜「PawsomeArt」小程序，今晚还能接2单。

#手绘宠物 #宠物肖像 #副业日记`,
    },
    {
      scene: '客户评价',
      text: `收到客户返图！开心到飞起 😭💝

小姐姐家金毛回汪星了，定制了肖像+彩虹桥纪念画。昨天收到的，她说"看着画哭了半小时，然后笑了，觉得它还在。"

这就是我做这件事的意义吧。

每一笔都值得。

📱 想给你家毛孩子定制：微信搜「PawsomeArt」`,
    },
    {
      scene: '每日一更',
      text: `今天进度：已接3单 ✅
还剩2个名额～明天排满了就不接了

🎨 定制宠物肖像 ¥88
😂 狗妈定义画 ¥39
🌈 纪念画 ¥29

📱 微信搜「PawsomeArt」小程序
或者直接私信我发照片 👇`,
    },
  ];
}

// ═══════════════════════════════════════════════════════
// 主流水线
// ═══════════════════════════════════════════════════════
export async function runPromotionEngine() {
  const outDir = path.join(process.cwd(), 'miniprogram', '推广');
  await mkdir(outDir, { recursive: true });

  // 1. 知乎回答
  console.log('[推广] 📝 生成知乎回答...');
  const zhihuAnswers = generateZhihuAnswers();
  await writeFile(path.join(outDir, '知乎回答-3篇.txt'), zhihuAnswers.map(a =>
    `【问题】${a.question}\n【回答】\n${a.answer}\n【标签】${a.tags.join(' ')}\n\n===分隔线===\n`
  ).join('\n'), 'utf-8');
  console.log(`  ✅ ${zhihuAnswers.length} 篇知乎回答`);

  // 2. SEO文章
  console.log('[推广] 📰 生成百度SEO文章...');
  const seoArticles = generateSEOArticles();
  for (const a of seoArticles) {
    await writeFile(path.join(outDir, a.file), a.html, 'utf-8');
  }
  console.log(`  ✅ ${seoArticles.length} 篇SEO文章`);

  // 3. 抖音脚本
  console.log('[推广] 🎵 生成抖音脚本...');
  const douyinScripts = generateDouyinScripts();
  await writeFile(path.join(outDir, '抖音脚本-3条.txt'), douyinScripts.map(s =>
    `【类型】${s.type}\n【标题】${s.title}\n【脚本】\n${s.script}\n\n===分隔线===\n`
  ).join('\n'), 'utf-8');
  console.log(`  ✅ ${douyinScripts.length} 条抖音脚本`);

  // 4. 微信文案
  console.log('[推广] 💬 生成微信文案...');
  const wxCopy = generateWeChatCopy();
  await writeFile(path.join(outDir, '微信朋友圈文案-4条.txt'), wxCopy.map(c =>
    `【场景】${c.scene}\n\n${c.text}\n\n===分隔线===\n`
  ).join('\n'), 'utf-8');
  console.log(`  ✅ ${wxCopy.length} 条微信文案`);

  // 5. 推广清单
  const checklist = `# 📣 PawsomeArt 推广清单
生成时间: ${new Date().toLocaleString('zh-CN')}

## 今日任务
□ 发1条朋友圈（用上面的文案）
□ 把SEO文章部署到zhushishunsui.cloud
□ 在知乎搜相关问题，粘贴回答
□ 发1条小红书（用今日发布清单）

## 本周任务
□ 每天发1条朋友圈
□ 知乎每天回答1个问题
□ 发布3条抖音
□ 邀请5个朋友体验（送免费肖像）

## SEO文章部署
./推广/百度SEO-*.html → 上传到zhushishunsui.cloud/guide/

## 核心信息
- 小程序: 微信搜索「PawsomeArt」
- 价格: ${TARGETS.priceRange}
- 卖点: ${TARGETS.usp}
`;

  await writeFile(path.join(outDir, '推广清单.md'), checklist, 'utf-8');

  const summary = {
    zhihu: zhihuAnswers.length,
    seo: seoArticles.length,
    douyin: douyinScripts.length,
    wechat: wxCopy.length,
    totalContent: zhihuAnswers.length + seoArticles.length + douyinScripts.length + wxCopy.length,
  };

  console.log(`\n📊 推广物料汇总: ${summary.totalContent} 条内容`);
  console.log(`  知乎回答: ${summary.zhihu} 篇`);
  console.log(`  百度SEO: ${summary.seo} 篇`);
  console.log(`  抖音脚本: ${summary.douyin} 条`);
  console.log(`  微信文案: ${summary.wechat} 条`);
  console.log(`\n📁 全部输出: miniprogram/推广/`);

  return summary;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runPromotionEngine().then(() => { console.log('✅ 推广引擎完成'); process.exit(0); });
}

export default { runPromotionEngine };

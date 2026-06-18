App({
  onLaunch() {
    wx.cloud?.init({ env: 'pawsomeart-0gxxx' });
  },
  globalData: {
    shopName: 'PawsomeArt',
    shopDesc: '纯手绘宠物肖像·电子版·即时交付',
    products: [
      { id: 'custom-pet-portrait', name: '定制宠物肖像', price: 88, emoji: '🎨', desc: '发照片→纯手绘→2天出稿·电子版', tag: 'BESTSELLER', detail: '你发照片，我们纯手绘。\n\n🎨 风格可选：水彩 / 极简线条 / 波西米亚 / 卡通\n📐 尺寸：8x10寸 / 11x14寸 / 16x20寸\n📁 格式：JPG + PNG + PDF\n🔄 改到满意为止\n\n下单后2-3天出第一版给你确认' },
      { id: 'dog-mom-print', name: '狗妈定义画', price: 39, emoji: '😂', desc: '搞笑装饰画·电子版·下单秒发', tag: 'HOT', detail: '🐕 "狗妈：一个为了狗取消约会、手机里5000张狗照片、进门先喊狗名的人类"\n\n🎨 4种风格可选\n📐 3个尺寸：8x10/11x14/A3\n📥 下单秒发电子版\n🖨️ 自己打印装裱' },
      { id: 'dog-dad-print', name: '狗爸定义画', price: 39, emoji: '🐕', desc: '养狗男人的真实写照·秒发', tag: 'GIFT', detail: '🐕 "狗爸：说过绝对不能养狗的男人，现在有47个狗的外号，睡前先给狗盖被子"\n\n🎨 4种风格可选\n📐 3个尺寸\n📥 下单秒发电子版' },
      { id: 'rainbow-bridge', name: '彩虹桥纪念画', price: 29, emoji: '🌈', desc: '最温柔的告别·个性化定制', tag: '', detail: '🌈 温柔纪念你最好的朋友\n\n个性化定制：宠物名字 + 日期\n3种配色：日落 / 月光 / 花园\n配套悼念卡片\n📥 下单秒发' },
      { id: 'pet-birth-stats', name: '宠物出生证', price: 29, emoji: '📋', desc: '毛孩子专属身份卡·秒发', tag: 'NEW', detail: '📋 毛孩子的专属"出生证"\n\n名字/品种/生日/体重/爱好\n5种配色可选\n📐 8x10/11x14寸\n📥 下单秒发' },
      { id: 'family-pet-portrait', name: '全家福+宠物', price: 168, emoji: '👨‍👩‍👧‍👦', desc: '一家人的温暖画像·3-5天出稿', tag: 'PREMIUM', detail: '👨‍👩‍👧‍👦 全家福+宠物定制肖像\n\n发你们全家和宠物的照片\n🎨 风格可选\n📐 最大18x24寸\n🔄 改到满意\n⏱ 3-5天出稿' },
    ]
  }
});

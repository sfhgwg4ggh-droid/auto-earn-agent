const app = getApp();

Page({
  data: { products: [] },
  onLoad() {
    const products = app.globalData.products.map(p => ({
      ...p,
      img: `/images/${p.name}.png`
    }));
    this.setData({ products });
  },
  onShow() {
    wx.setNavigationBarTitle({ title: 'PawsomeArt' });
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
  quickBuy(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order/order?id=${id}` });
  }
});

const app = getApp();

Page({
  data: { product: {} },
  onLoad(options) {
    const id = options.id;
    const product = app.globalData.products.find(p => p.id === id);
    if (product) {
      this.setData({ product });
      wx.setNavigationBarTitle({ title: product.name });
    }
  },
  buyNow() {
    const id = this.data.product.id;
    wx.navigateTo({ url: `/pages/order/order?id=${id}` });
  }
});

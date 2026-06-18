Page({
  data: { orders: [] },
  onShow() {
    const orders = wx.getStorageSync('pawsomeart_orders') || [];
    this.setData({ orders });
    wx.setNavigationBarTitle({ title: '我的订单' });
  }
});

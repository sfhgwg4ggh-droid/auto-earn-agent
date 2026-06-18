const app = getApp();

Page({
  data: {
    product: {},
    nickName: '',
    phone: '',
    email: '',
    petName: '',
    note: '',
    photoPath: '',
    payMethod: 'wechat',
    submitting: false
  },

  onLoad(options) {
    const id = options.id;
    const product = app.globalData.products.find(p => p.id === id);
    if (product) {
      this.setData({ product });
      wx.setNavigationBarTitle({ title: '下单 - ' + product.name });
    }
  },

  onNickInput(e) { this.setData({ nickName: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onEmailInput(e) { this.setData({ email: e.detail.value }); },
  onPetNameInput(e) { this.setData({ petName: e.detail.value }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },

  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ photoPath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  switchPay(e) {
    this.setData({ payMethod: e.currentTarget.dataset.method });
  },

  submitOrder() {
    const { nickName, phone, email, petName, photoPath } = this.data;

    if (!nickName) { wx.showToast({ title: '请输入你的名字', icon: 'none' }); return; }
    if (!phone && !email) { wx.showToast({ title: '请填写手机号或邮箱', icon: 'none' }); return; }
    if (!petName) { wx.showToast({ title: '请输入宠物名字', icon: 'none' }); return; }
    if (!photoPath) { wx.showToast({ title: '请上传宠物照片', icon: 'none' }); return; }

    this.setData({ submitting: true });

    // 生成订单号
    const orderNo = 'PAW' + Date.now().toString(36).toUpperCase();
    const product = this.data.product;

    // 保存订单到本地
    const orders = wx.getStorageSync('pawsomeart_orders') || [];
    orders.unshift({
      orderNo,
      productId: product.id,
      productName: product.name,
      price: product.price,
      nickName,
      phone,
      email,
      petName,
      note: this.data.note,
      payMethod: this.data.payMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    wx.setStorageSync('pawsomeart_orders', orders);

    // 显示成功页
    wx.showModal({
      title: '✅ 订单已提交',
      content: `订单号: ${orderNo}\n\n请扫码付款 ¥${product.price}\n付款后我们会尽快处理！\n\n文件将发送到: ${email || '你的微信'}`,
      showCancel: false,
      confirmText: '我知道了',
      success: () => {
        this.setData({ submitting: false });
        wx.switchTab({ url: '/pages/orders/orders' });
      }
    });
  }
});

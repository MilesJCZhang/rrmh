// pages/pay/pay.js
// 支付结果页：返回时跳过中间页面，直接回到首页
Page({
  onBack() {
    const pages = getCurrentPages();
    if (pages.length >= 3) {
      // 页面栈足够深，返回 2 页（跳过支付中间页）
      wx.navigateBack({ delta: 2 });
    } else {
      // 页面栈不够深，直接回到首页 tabBar
      wx.switchTab({ url: '/pages/index/index' });
    }
  }
});

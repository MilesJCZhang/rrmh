// subpackages/activity/pages/salon-weekly/salon-weekly.js
// 主题社交沙龙-同城社交小班预约页面 v1.0.8
const { request } = require('../../../../utils/request');
const API = require('../../../../services/api');

// ===== 固定库存数据（真实数据由后端返回） =====
const MOCK_SLOTS = {
  am: [1, 0, 2, 3, 2],   // 周一~周五 上午场剩余名额（0=满员）
  pm: [2, 3, 1, 3, 1],   // 周一~周五 下午场剩余名额
};

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五'];

Page({
  data: {
    // 导航
    statusBarHeight: 0,
    // 场次
    activeSession: 'am',
    currentWeekOffset: 0,  // 0=本周, 1=下周, -1=上周...
    // 周历
    weekSchedule: [],
    weekDateText: '',
    // 规则折叠
    showRules: false,
    // 报名弹窗
    showBookingModal: false,
    bookingSlot: null,
    bookingStatus: '',  // 'success' | 'fail'
    // 主题
    themeColor: '#C8102E',
    themeGradient: 'linear-gradient(135deg, #C8102E 0%, #E8454A 100%)',
  },

  onLoad() {
    // 获取状态栏高度（用于自定义导航栏留位）
    const app = getApp();
    const statusBarHeight = app?.globalData?.statusBarHeight || 44;
    this.setData({ statusBarHeight });
    this._buildWeekSchedule();
  },

  // ===== 构建周历数据 =====
  _buildWeekSchedule() {
    const { activeSession, currentWeekOffset } = this.data;
    const now = new Date();
    const monday = this._getMonday(now);
    monday.setDate(monday.getDate() + currentWeekOffset * 7);

    const slots = activeSession === 'am' ? MOCK_SLOTS.am : MOCK_SLOTS.pm;

    const schedule = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(date.getDate() + i);
      const remaining = slots[i];
      const isFull = remaining <= 0;

      schedule.push({
        dayKey: `day_${i}`,
        dayLabel: WEEKDAY_LABELS[i],
        dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
        slot: {
          remaining,
          maxParticipants: 3,
          isFull,
          registrationFee: 299,
          originalFee: 399,
          isRegistered: false,
          id: `salon_${activeSession}_${i}`,
        },
      });
    }

    // 周日期范围
    const mon = `${monday.getMonth() + 1}/${monday.getDate()}`;
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    const fri = `${friday.getMonth() + 1}/${friday.getDate()}`;

    this.setData({
      weekSchedule: schedule,
      weekDateText: `${mon} - ${fri}`,
    });
  },

  // ===== 上下午场切换 =====
  switchSession(e) {
    const session = e.currentTarget.dataset.session;
    if (session === this.data.activeSession) return;
    this.setData({ activeSession: session });
    this._buildWeekSchedule();
  },

  // ===== 上一周 =====
  prevWeek() {
    this.setData({ currentWeekOffset: this.data.currentWeekOffset - 1 });
    this._buildWeekSchedule();
  },

  // ===== 下一周 =====
  nextWeek() {
    this.setData({ currentWeekOffset: this.data.currentWeekOffset + 1 });
    this._buildWeekSchedule();
  },

  // ===== 规则折叠 =====
  toggleRules() {
    this.setData({ showRules: !this.data.showRules });
  },

  // ===== 返回 =====
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // ===== 点击预约 =====
  onSlotTap(e) {
    const dataset = e.currentTarget.dataset;
    const dayIndex = dataset.dayIdx;

    if (dataset.isFull) {
      wx.showToast({ title: '该场次已满员', icon: 'none' });
      return;
    }

    const day = this.data.weekSchedule[dayIndex];
    this.setData({
      showBookingModal: true,
      bookingSlot: day,
      bookingStatus: '',
    });
  },

  // ===== 确认预约 =====
  confirmBooking() {
    this.setData({ bookingStatus: 'success' });
    setTimeout(() => {
      this.setData({ showBookingModal: false, bookingStatus: '' });

      // 更新本地剩余名额
      const { activeSession, weekSchedule } = this.data;
      const mockKey = activeSession === 'am' ? 'am' : 'pm';
      const bookingDayIndex = weekSchedule.findIndex(
        d => d.dayKey === this.data.bookingSlot.dayKey
      );

      if (bookingDayIndex >= 0) {
        const slot = weekSchedule[bookingDayIndex].slot;
        if (slot.remaining > 0) {
          slot.remaining -= 1;
          slot.isFull = slot.remaining <= 0;
          slot.isRegistered = true;
        }
      }

      this.setData({ weekSchedule, bookingSlot: null });
      wx.showToast({ title: '预约成功', icon: 'success' });
    }, 1200);
  },

  // ===== 关闭弹窗 =====
  closeModal() {
    this.setData({ showBookingModal: false, bookingStatus: '' });
  },

  // ===== 阻止冒泡 =====
  preventClose() {},

  // ===== 工具函数 =====
  _getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },
});

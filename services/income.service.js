// services/income.service.js - 收益与提现相关 API
// ============================================================
// 所有"工作台收益"相关的网络请求统一在此封装
// 页面直接 require 此模块，不直接调 request()
// ============================================================

const { request } = require('../utils/request');
const API = require('./api');
const { DEV_MOCK_DATA } = require('../utils/config');

// ==================== Mock 数据（DEV_MOCK_DATA=true 时生效）====================
// 上线后将 config.js 中 ENV 改为 'prod' 即可关闭，代码无需改动

const _MOCK = {
  public_matchmaker: {
    summary: {
      todayIncome: '198.00',
      monthIncome: '1,280.00',
      totalIncome: '8,650.00',
      withdrawable: '580.00',
    },
    stats: {
      memberCount: 36,
      memberIncome: '3,564.00',
      partnerCount: 0,
      partnerIncome: '0.00',
      salonCount: 0,
      salonIncome: '0.00',
    },
    records: [
      { id: 1, icon: '💑', title: '推荐建档', time: '04-14 16:30', amount: '99.00', settled: true },
      { id: 2, icon: '💑', title: '推荐建档', time: '04-13 10:15', amount: '99.00', settled: true },
      { id: 3, icon: '💑', title: '推荐建档', time: '04-12 09:00', amount: '99.00', settled: true },
    ],
  },
  partner_matchmaker: {
    summary: {
      todayIncome: '396.00',
      monthIncome: '2,480.00',
      totalIncome: '18,350.00',
      withdrawable: '1,280.00',
    },
    stats: {
      memberCount: 58,
      memberIncome: '5,742.00',
      partnerCount: 4,
      partnerIncome: '1,197.00',
      salonCount: 12,
      salonIncome: '1,188.00',
    },
    records: [
      { id: 1, icon: '🎉', title: '沙龙补贴', time: '04-14 18:00', amount: '198.00', settled: true },
      { id: 2, icon: '💑', title: '推荐建档', time: '04-14 16:30', amount: '99.00', settled: true },
      { id: 3, icon: '👑', title: '推荐联创', time: '04-11 14:00', amount: '399.00', settled: true },
    ],
  },
  community_station: {
    summary: {
      todayIncome: '99.00',
      monthIncome: '980.00',
      totalIncome: '4,200.00',
      withdrawable: '320.00',
    },
    stats: {
      memberCount: 22,
      memberIncome: '2,178.00',
      partnerCount: 2,
      partnerIncome: '399.00',
      salonCount: 0,
      salonIncome: '0.00',
    },
    records: [
      { id: 1, icon: '💑', title: '推荐建档', time: '04-15 09:00', amount: '99.00', settled: true },
      { id: 2, icon: '👑', title: '推荐联创', time: '04-10 15:00', amount: '399.00', settled: true },
    ],
  },
};

// ==================== API 方法 ====================

// 统一处理 request.js 返回值（兼容返回 body 或 body.data 两种情况）
const _extract = (resp) => resp && resp.data !== undefined ? resp.data : resp;

/**
 * 获取收益概览（今日/本月/累计/可提现）
 * @param {string} role - 当前角色
 */
function getSummary(role) {
  if (DEV_MOCK_DATA) {
    const mock = _MOCK[role] || _MOCK.public_matchmaker;
    return Promise.resolve(mock.summary);
  }
  return request({ url: API.INCOME.SUMMARY }).then(_extract);
}

/**
 * 获取业务统计（建档数/联创数/沙龙次数等）
 * @param {string} role - 当前角色
 */
function getStats(role) {
  if (DEV_MOCK_DATA) {
    const mock = _MOCK[role] || _MOCK.public_matchmaker;
    return Promise.resolve(mock.stats);
  }
  return request({ url: API.INCOME.STATS }).then(_extract);
}

/**
 * 获取最近收益记录
 * @param {Object} params - { page, pageSize }
 * @param {string} role - 当前角色（Dev Mock 时用）
 */
function getRecords(params, role) {
  if (DEV_MOCK_DATA) {
    const mock = _MOCK[role] || _MOCK.public_matchmaker;
    return Promise.resolve(mock.records);
  }
  return request({ url: API.INCOME.RECORDS, data: params }).then(_extract);
}

/**
 * 申请提现
 * @param {number} amount - 提现金额（元）
 */
function withdraw(amount) {
  if (DEV_MOCK_DATA) {
    return Promise.resolve({ success: true, message: '提现申请已提交（Mock）' });
  }
  return request({ url: API.INCOME.WITHDRAW, method: 'POST', data: { amount } });
}

/**
 * 一次性加载工作台所需全部数据
 * @param {string} role
 */
async function loadWorkbenchData(role) {
  const [summary, stats, records] = await Promise.all([
    getSummary(role),
    getStats(role),
    getRecords({ page: 1, pageSize: 10 }, role),
  ]);
  return { summary, stats, records };
}

module.exports = {
  getSummary,
  getStats,
  getRecords,
  withdraw,
  loadWorkbenchData,
};

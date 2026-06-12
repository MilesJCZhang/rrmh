// 优化工具类
const optimizeUtil = {
  
  /**
   * 图片优化
   * @param {string} imageUrl 图片URL
   * @param {Object} options 优化选项
   * @returns {string} 优化后的图片URL
   */
  optimizeImage(imageUrl, options = {}) {
    if (!imageUrl) return '';
    
    const defaultOptions = {
      width: 750,
      quality: 80,
      format: 'webp',
      mode: 'aspectFit'
    };
    
    const opts = { ...defaultOptions, ...options };
    
    // 如果是网络图片，添加优化参数
    if (imageUrl.startsWith('http')) {
      // 这里应该使用图片服务商提供的优化方案
      // 例如：七牛、又拍云、腾讯云等
      return `${imageUrl}?imageView2/2/w/${opts.width}/format/${opts.format}/q/${opts.quality}`;
    }
    
    // 本地图片，在开发阶段不做处理，生产环境需压缩
    return imageUrl;
  },
  
  /**
   * 数据缓存优化
   */
  cacheUtil: {
    // 缓存策略
    cacheStrategies: {
      'frequently_used': { ttl: 3600000 }, // 1小时
      'normal': { ttl: 1800000 }, // 30分钟
      'rarely_used': { ttl: 600000 }, // 10分钟
      'temporary': { ttl: 300000 } // 5分钟
    },
    
    /**
     * 设置缓存
     * @param {string} key 缓存键
     * @param {any} data 缓存数据
     * @param {string} strategy 缓存策略
     */
    setCache(key, data, strategy = 'normal') {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        strategy: strategy
      };
      
      try {
        wx.setStorageSync(key, cacheData);
      } catch (err) {
        console.error('缓存设置失败:', err);
      }
    },
    
    /**
     * 获取缓存
     * @param {string} key 缓存键
     * @returns {any|null} 缓存数据或null
     */
    getCache(key) {
      try {
        const cacheData = wx.getStorageSync(key);
        
        if (!cacheData) return null;
        
        // 检查缓存是否过期
        const strategy = this.cacheStrategies[cacheData.strategy];
        if (!strategy) return null;
        
        const age = Date.now() - cacheData.timestamp;
        if (age > strategy.ttl) {
          // 缓存过期，清理
          wx.removeStorageSync(key);
          return null;
        }
        
        return cacheData.data;
      } catch (err) {
        console.error('缓存获取失败:', err);
        return null;
      }
    },
    
    /**
     * 清理过期缓存
     */
    cleanExpiredCache() {
      const keys = wx.getStorageInfoSync().keys;
      
      keys.forEach(key => {
        const cacheData = wx.getStorageSync(key);
        if (cacheData && cacheData.timestamp) {
          const strategy = this.cacheStrategies[cacheData.strategy];
          if (strategy) {
            const age = Date.now() - cacheData.timestamp;
            if (age > strategy.ttl) {
              wx.removeStorageSync(key);
            }
          }
        }
      });
    }
  },
  
  /**
   * 网络请求优化
   */
  requestOptimizer: {
    // 请求队列
    requestQueue: new Map(),
    maxConcurrent: 3,
    
    /**
     * 优化请求
     * @param {Function} requestFn 请求函数
     * @param {string} key 请求标识
     * @param {Object} options 请求选项
     */
    async optimizedRequest(requestFn, key, options = {}) {
      // 检查是否有相同的请求在进行中
      if (this.requestQueue.has(key)) {
        return new Promise((resolve, reject) => {
          this.requestQueue.get(key).push({ resolve, reject });
        });
      }
      
      // 新建请求队列
      this.requestQueue.set(key, []);
      
      try {
        const result = await requestFn();
        
        // 通知等待中的相同请求
        const queue = this.requestQueue.get(key);
        queue.forEach(({ resolve }) => resolve(result));
        
        return result;
      } catch (error) {
        const queue = this.requestQueue.get(key);
        queue.forEach(({ reject }) => reject(error));
        throw error;
      } finally {
        this.requestQueue.delete(key);
      }
    },
    
    /**
     * 合并请求
     * @param {Array} requests 请求数组
     */
    async mergeRequests(requests) {
      const batchKey = 'batch_' + Date.now();
      const batchResults = {};
      
      // 分组处理请求
      const groupedRequests = this.groupRequests(requests);
      
      for (const [group, groupRequests] of Object.entries(groupedRequests)) {
        if (groupRequests.length === 1) {
          // 单个请求直接执行
          batchResults[groupRequests[0].key] = await groupRequests[0].requestFn();
        } else {
          // 多个请求合并执行
          const mergedResult = await this.executeMergedRequest(group, groupRequests);
          Object.assign(batchResults, mergedResult);
        }
      }
      
      return batchResults;
    },
    
    groupRequests(requests) {
      const groups = {};
      
      requests.forEach(request => {
        const group = request.group || 'default';
        if (!groups[group]) groups[group] = [];
        groups[group].push(request);
      });
      
      return groups;
    },
    
    async executeMergedRequest(group, requests) {
      // 这里应该调用后端提供的批量接口
      // 当前为模拟实现
      const results = {};
      
      for (const request of requests) {
        try {
          results[request.key] = await request.requestFn();
        } catch (error) {
          results[request.key] = { error: error.message };
        }
      }
      
      return results;
    }
  },
  
  /**
   * 渲染优化
   */
  renderOptimizer: {
    
    /**
     * 延迟加载数据
     * @param {Array} items 数据项
     * @param {number} pageSize 每页大小
     * @param {Function} loadMoreFn 加载更多函数
     */
    lazyLoad(items, pageSize, loadMoreFn) {
      const visibleItems = items.slice(0, pageSize);
      let currentPage = 1;
      
      return {
        items: visibleItems,
        hasMore: items.length > pageSize,
        
        loadMore() {
          if (!this.hasMore) return;
          
          currentPage++;
          const startIndex = (currentPage - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          
          const newItems = items.slice(startIndex, endIndex);
          visibleItems.push(...newItems);
          
          this.hasMore = endIndex < items.length;
          
          // 如果有自定义加载函数，调用它
          if (loadMoreFn && typeof loadMoreFn === 'function') {
            loadMoreFn(currentPage, newItems);
          }
        }
      };
    },
    
    /**
     * 虚拟滚动优化
     * @param {Array} allItems 所有数据项
     * @param {number} visibleCount 可见数量
     * @param {number} itemHeight 每项高度
     */
    virtualScroll(allItems, visibleCount, itemHeight) {
      const bufferCount = 5; // 缓冲区项数
      let scrollTop = 0;
      
      return {
        getVisibleItems() {
          const startIndex = Math.floor(scrollTop / itemHeight);
          const endIndex = startIndex + visibleCount + bufferCount;
          
          return allItems.slice(
            Math.max(0, startIndex - bufferCount),
            Math.min(allItems.length, endIndex)
          );
        },
        
        setScrollPosition(position) {
          scrollTop = position;
        },
        
        getOffset() {
          const startIndex = Math.floor(scrollTop / itemHeight);
          return Math.max(0, startIndex - bufferCount) * itemHeight;
        }
      };
    }
  },
  
  /**
   * 内存优化
   */
  memoryOptimizer: {
    
    /**
     * 清理不再使用的数据
     */
    cleanupUnusedData() {
      // 清理过期的缓存
      optimizeUtil.cacheUtil.cleanExpiredCache();
      
      // 清理过期的图片缓存（如果有）
      this.cleanImageCache();
      
      // 清理临时数据
      this.cleanTempData();
    },
    
    cleanImageCache() {
      // 在小程序中，图片缓存由微信管理
      // 这里可以清理自己管理的图片数据
    },
    
    cleanTempData() {
      // 清理临时存储的数据
      const tempKeys = ['temp_form_data', 'temp_upload_files', 'temp_search_results'];
      
      tempKeys.forEach(key => {
        try {
          wx.removeStorageSync(key);
        } catch (err) {
          // 忽略错误
        }
      });
    },
    
    /**
     * 监控内存使用
     */
    monitorMemory() {
      if (typeof wx.getPerformance === 'function') {
        const performance = wx.getPerformance();
        const memory = performance.getEntriesByType('memory');
        
        if (memory && memory.length > 0) {
          const memInfo = memory[0];
          // 内存使用率超过80%时触发清理
          if (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit > 0.8) {
            this.cleanupUnusedData();
          }
        }
      }
    }
  },
  
  /**
   * 性能监控
   */
  performanceMonitor: {
    
    /**
     * 记录页面加载时间
     * @param {string} pageName 页面名称
     */
    recordPageLoad(pageName) {
      const loadTime = Date.now();
      const performanceData = wx.getStorageSync('performance_data') || {};
      
      if (!performanceData[pageName]) {
        performanceData[pageName] = [];
      }
      
      performanceData[pageName].push({
        timestamp: loadTime,
        loadTime: loadTime
      });
      
      // 只保留最近100条记录
      if (performanceData[pageName].length > 100) {
        performanceData[pageName] = performanceData[pageName].slice(-100);
      }
      
      wx.setStorageSync('performance_data', performanceData);
    },
    
    /**
     * 获取平均加载时间
     * @param {string} pageName 页面名称
     */
    getAverageLoadTime(pageName) {
      const performanceData = wx.getStorageSync('performance_data') || {};
      const records = performanceData[pageName] || [];
      
      if (records.length === 0) return 0;
      
      const totalTime = records.reduce((sum, record) => sum + record.loadTime, 0);
      return totalTime / records.length;
    },
    
    /**
     * 监控API请求性能
     * @param {string} apiName API名称
     * @param {Function} requestFn 请求函数
     */
    async monitorApiPerformance(apiName, requestFn) {
      const startTime = Date.now();
      
      try {
        const result = await requestFn();
        const duration = Date.now() - startTime;
        
        this.recordApiPerformance(apiName, duration, true);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordApiPerformance(apiName, duration, false);
        
        throw error;
      }
    },
    
    recordApiPerformance(apiName, duration, success) {
      const apiData = wx.getStorageSync('api_performance') || {};
      
      if (!apiData[apiName]) {
        apiData[apiName] = {
          totalRequests: 0,
          successRequests: 0,
          totalDuration: 0,
          avgDuration: 0
        };
      }
      
      apiData[apiName].totalRequests++;
      apiData[apiName].totalDuration += duration;
      
      if (success) {
        apiData[apiName].successRequests++;
      }
      
      apiData[apiName].avgDuration = 
        apiData[apiName].totalDuration / apiData[apiName].totalRequests;
      
      wx.setStorageSync('api_performance', apiData);
    }
  },
  
  /**
   * 运行所有优化
   */
  runAllOptimizations() {
    
    try {
      // 清理内存
      this.memoryOptimizer.cleanupUnusedData();
      
      // 监控内存
      this.memoryOptimizer.monitorMemory();
      
      return true;
    } catch (error) {
      console.error('❌ 优化失败:', error);
      return false;
    }
  }
};

module.exports = optimizeUtil;
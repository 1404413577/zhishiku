/**
 * 搜索引擎调度中心 (主线程)
 * 职责：自身不参与任何繁重的搜索计算，仅作为与 Web Worker 通信的代理 (Proxy)
 */
export class SearchEngine {
  constructor() {
    // 实例化后台 Worker (使用 Vite 官方推荐的 Worker 加载方式)
    this.worker = new Worker(new URL("./search.worker.js", import.meta.url), {
      type: "module",
    });

    // 任务队列，用于追踪哪个 Promise 对应哪次搜索
    this.resolves = new Map();
    this.reqId = 0;

    // 监听 Worker 返回的结果
    this.worker.onmessage = (e) => {
      const { type, payload, requestId } = e.data;

      // 找到这个请求对应的 Promise 的 resolve 触发器
      if (this.resolves.has(requestId)) {
        const { resolve, reject } = this.resolves.get(requestId);
        this.resolves.delete(requestId);

        if (type === "error") {
          reject(new Error(payload));
        } else {
          resolve(payload);
        }
      }
    };
  }

  // 内部发信方法
  // 内部发信方法
  _post(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++this.reqId;
      this.resolves.set(id, { resolve, reject });

      // 🚨 修复核心：剥离 Vue Proxy 响应式包装
      // Web Worker 无法直接克隆 Proxy 或带有函数的对象
      let safePayload = payload;
      if (payload !== undefined) {
        safePayload = JSON.parse(JSON.stringify(payload));
      }

      this.worker.postMessage({ type, payload: safePayload, requestId: id });
    });
  }

  /**
   * 初始化搜索引擎
   * @param {Array} documents - 所有文档数据
   */
  async initialize(documents) {
    return this._post("initialize", documents);
  }

  /**
   * 搜索文档
   * @param {String} query - 关键词
   */
  async search(query) {
    return this._post("search", query);
  }

  /**
   * 获取所有标签
   */
  async getAllTags() {
    return this._post("getAllTags");
  }

  /**
   * 复杂高级搜索
   */
  async advancedSearch(options = {}) {
    // 我们可以直接在主线程调度高级条件（因为不涉及大量的正则计算），
    // 或者也放入 Worker，这里演示为了简单，先通过 query 获取全量结果，再在主线程做属性过滤。
    const searchResults = await this.search(options.query);
    let results = searchResults.map((res) => res.item || res);

    if (options.tags && options.tags.length > 0) {
      results = results.filter(
        (doc) => doc.tags && options.tags.some((tag) => doc.tags.includes(tag)),
      );
    }

    if (options.dateRange && options.dateRange.start && options.dateRange.end) {
      results = results.filter((doc) => {
        const docDate = new Date(doc.updatedAt);
        return (
          docDate >= new Date(options.dateRange.start) &&
          docDate <= new Date(options.dateRange.end)
        );
      });
    }

    if (options.sortBy) {
      results.sort((a, b) => {
        if (options.sortBy === "title") return a.title.localeCompare(b.title);
        if (options.sortBy === "created")
          return new Date(b.createdAt) - new Date(a.createdAt);
        if (options.sortBy === "updated")
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        return 0;
      });
    }
    return results;
  }
}

// 导出单例，确保全局只启动一个 Worker 线程
export const searchEngine = new SearchEngine();

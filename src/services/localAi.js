// 延迟加载 AI 库，防止主 bundle 过大
let webllm = null;
let transformersPipeline = null;
let transformersEnv = null;

async function initTransformersEnv() {
  if (transformersEnv) return transformersEnv;
  const mod = await import("@xenova/transformers");
  transformersEnv = mod.env;
  transformersEnv.allowLocalModels = true;
  transformersEnv.allowRemoteModels = true;
  transformersEnv.useBrowserCache = true;
  transformersEnv.localModelPath = `${import.meta.env.BASE_URL}models/`;
  transformersEnv.fetch_options = { credentials: 'omit' };
  return transformersEnv;
}

async function getWebLLM() {
  if (webllm) return webllm;
  webllm = await import("@mlc-ai/web-llm");
  return webllm;
}

async function getPipeline() {
  if (transformersPipeline) return transformersPipeline;
  const mod = await import("@xenova/transformers");
  transformersPipeline = mod.pipeline;
  await initTransformersEnv();
  return transformersPipeline;
}

/**
 * 本地 AI 服务，支持 WebLLM (GPU) 和 Transformers.js (CPU)
 */
export class LocalAIService {
  constructor() {
    this.engine = null; // WebLLM 引擎
    this.pipeline = null; // Transformers.js 管道
    this.loading = false;
    this.progress = 0;
    this.statusText = "";
    this.currentType = null; // 'gpu' | 'cpu'
  }

  /**
   * 初始化或获取引擎实例
   * @param {string} modelId - 模型 ID
   * @param {string} type - 'gpu' (WebLLM) | 'cpu' (Transformers.js)
   * @param {function} onProgress - 进度回调
   */
  async getEngine(modelId, type = 'gpu', onProgress) {
    if (this.currentType === type) {
      if (type === 'gpu' && this.engine) return this.engine;
      if (type === 'cpu' && this.pipeline) return this.pipeline;
    }

    if (this.loading) {
      throw new Error("模型正在加载中，请稍候...");
    }

    this.loading = true;
    this.currentType = type;
    this.progress = 0;
    this.statusText = "准备加载...";

    try {
      if (type === 'gpu') {
        this.pipeline = null;
        const wllm = await getWebLLM();
        this.engine = new wllm.MLCEngine();
        this.engine.setInitProgressCallback((report) => {
          this.progress = Math.round(report.progress * 100);
          this.statusText = report.text;
          if (onProgress) onProgress({ progress: this.progress, statusText: this.statusText });
        });
        await this.engine.reload(modelId);
        this.loading = false;
        return this.engine;
      } else {
        // CPU 模式 (Transformers.js)
        this.engine = null;
        this.statusText = "正在初始化 CPU 文本生成管道...";
        
        const pipeline = await getPipeline();
        this.pipeline = await pipeline('text-generation', modelId, {
          progress_callback: (report) => {
            if (report.status === 'progress') {
              this.progress = Math.round(report.progress);
              this.statusText = `正在下载权重: ${report.file} (${this.progress}%)`;
              if (onProgress) onProgress({ progress: this.progress, statusText: this.statusText });
            } else if (report.status === 'done') {
              this.statusText = `加载完成: ${report.file}`;
            }
          }
        });
        
        this.loading = false;
        this.statusText = "CPU 模型加载成功";
        return this.pipeline;
      }
    } catch (err) {
      this.loading = false;
      this.engine = null;
      this.pipeline = null;
      throw err;
    }
  }

  /**
   * 执行对话补全
   */
  async chatCompletion(modelId, type, messages, onChunk = null, onProgress = null) {
    const instance = await this.getEngine(modelId, type, onProgress);

    if (type === 'gpu') {
      const completion = await instance.chat.completions.create({
        messages,
        stream: !!onChunk
      });

      if (!onChunk) {
        return completion.choices[0].message.content || "";
      } else {
        let fullText = "";
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content || "";
          fullText += delta;
          if (delta) onChunk(delta, fullText);
        }
        return fullText;
      }
    } else {
      // Transformers.js (CPU) 逻辑
      // 简单转换消息格式为文本补全格式（针对基础指令模型）
      const prompt = messages.map(m => 
        m.role === 'system' ? `System: ${m.content}\n` : 
        m.role === 'user' ? `User: ${m.content}\n` : `Assistant: ${m.content}\n`
      ).join('') + "Assistant: ";

      this.statusText = "正在思考 (CPU)...";
      
      const output = await instance(prompt, {
        max_new_tokens: 512,
        temperature: 0.7,
        do_sample: true,
        callback_function: (beams) => {
          if (onChunk && beams.length > 0) {
            // Transformers.js 的流式输出处理较为初步，通常在完成后返回
          }
        }
      });

      const fullText = output[0].generated_text.slice(prompt.length);
      if (onChunk) onChunk(fullText, fullText);
      return fullText;
    }
  }

  /**
   * 检查 WebGPU 支持情况
   */
  static async checkWebGPUSupport() {
    if (!navigator.gpu) {
      return { supported: false, message: "您的浏览器不支持 WebGPU。" };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        return { supported: false, message: "未能找到支持 WebGPU 的显卡设备。请检查显卡驱动或系统设置。" };
      }
      return { supported: true, message: "支持 WebGPU。" };
    } catch (err) {
      return { supported: false, message: `WebGPU 初始化失败: ${err.message}` };
    }
  }
}

export const localAiService = new LocalAIService();

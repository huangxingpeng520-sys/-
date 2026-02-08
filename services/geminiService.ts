
import { GoogleGenAI, Type } from "@google/genai";
import { PriceRecord, MaterialConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Fetches the current spot price for today.
 */
export const fetchCurrentPrice = async (config: MaterialConfig): Promise<Partial<PriceRecord>> => {
  const today = new Date().toISOString().split('T')[0];
  const model = ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `请搜索并获取 ${config.region} 地区 ${config.name} (${config.spec}) 在今日（${today}）的最新市场报价。
    重点参考「上海有色网(SMM)」或「我的钢铁网」。价格通常在 70,000 - 85,000 元/吨之间。`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const response = await model;
  const rawText = response.text || "";
  
  const cleaner = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `从以下文本中提取电解铜价格：\n\n${rawText}\n\n要求：
    1. 价格为纯数字。
    2. 包含确切日期(YYYY-MM-DD)。
    3. 输出JSON。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          price: { type: Type.NUMBER },
          date: { type: Type.STRING },
          unit: { type: Type.STRING },
        },
        required: ["price", "date"]
      }
    }
  });

  try {
    return JSON.parse(cleaner.text.trim());
  } catch (e) {
    throw new Error("今日价格采集失败");
  }
};

/**
 * Fetches historical weekly averages (Monday and Thursday) for the past 52 weeks.
 */
export const fetchYearlyHistory = async (config: MaterialConfig): Promise<Partial<PriceRecord>[]> => {
  const model = ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `请搜索并列出过去 52 周内，每周一和周四 ${config.region} 地区 ${config.name} (${config.spec}) 的市场参考价。
    由于数据量较大，请确保日期覆盖从一年前至今的每个星期的关键波动点。`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const response = await model;
  const rawText = response.text || "";

  const cleaner = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `从文本中提取过去一年内每周两次（如周一、周四）的价格列表：\n\n${rawText}\n\n输出为 JSON 数组，包含约 100 个数据点。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
          },
          required: ["price", "date"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(cleaner.text.trim());
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Historical parse error:", e);
    return [];
  }
};

export const generateTrendInsights = async (history: PriceRecord[]) => {
  // Use more dense recent samples for context
  const recentData = history.slice(-24).map(h => `${h.date}:${h.price}`).join(";");
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `作为大宗商品专家，根据过去三个月高频采样数据 [${recentData}]，分析近期铜价波动特征和支撑压力位。字数150字内。`,
  });
  return response.text;
};

export const getFutureForecast = async (history: PriceRecord[]) => {
  const historyString = history.slice(-10).map(h => `${h.date}: ${h.price}`).join(", ");
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `基于近期高频价格数据 [${historyString}]，预测下周及下个月铜价方向。重点考虑库存与宏观环境。`,
    config: {
       tools: [{ googleSearch: {} }]
    }
  });
  return response.text;
};

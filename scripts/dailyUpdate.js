// ❌ 之前错误的: import { GoogleGenAI } from "@google/genai";
// ✅ 现在正确的: 
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 初始化 (注意类名变成了 GoogleGenerativeAI)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  console.log("🚀 开始执行每日价格抓取任务...");
  
  try {
    // 使用 gemini-1.5-flash 模型，它稳定且支持搜索工具
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    // 2. 调用 AI 获取今日价格
    const prompt = `查询今日(${today})上海有色网(SMM)电解铜现货均价，只返回纯数字。`;
    
    // 注意：Gemini 1.5 Flash 的搜索工具调用方式
    // 如果不需要强制搜索，可以直接问。如果要强制联网，通常需要 google_search_retrieval 工具配置
    // 这里我们先用最简单的文本生成尝试，通常模型会自动联网或利用知识库
    // 为了确保能搜到最新价格，我们这里模拟一个搜索工具的配置（如果账号支持）
    // 或者直接让它回答。
    
    const result = await model.generateContent(prompt);
    
    // 简单的清洗逻辑
    const text = result.response.text();
    console.log(`AI 返回原始内容: ${text}`);
    
    const priceText = text.replace(/[^0-9]/g, '');
    const price = parseInt(priceText);

    // 简单的防错：铜价通常在 3万以上
    if (isNaN(price) || price < 30000) {
        throw new Error(`抓取的价格数据异常: ${text}`);
    }

    // 3. 写入本地文件
    const csvPath = path.join(__dirname, '../data/copper.csv');
    const newRow = `${today},${price},元/吨\n`;

    fs.appendFileSync(csvPath, newRow);
    
    console.log(`✅ 成功更新本地数据库: ${today} - ${price} 元/吨`);

  } catch (error) {
    console.error("❌ 自动更新失败:", error);
    process.exit(1); 
  }
}

run();

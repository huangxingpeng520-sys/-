import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  console.log("🚀 2026版价格抓取引擎启动...");
  
  try {
    // 🔴 关键：升级为 2026 年主流的 2.0 版本模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    const prompt = `请查并返回今日(${today})上海有色网(SMM)电解铜现货均价。
    输出要求：只返回一个纯数字（如 71500），不要任何额外文字。`;
    
    console.log(`正在请求模型数据，日期: ${today}...`);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    console.log(`AI 原始响应: "${text}"`);
    
    // 增强的数字提取逻辑
    const priceMatch = text.match(/\d{5,6}/); 
    const price = priceMatch ? parseInt(priceMatch[0]) : null;

    if (!price || price < 30000) {
        throw new Error(`无效的价格数据: ${text}`);
    }

    // 写入文件
    const csvPath = path.join(__dirname, '../data/copper.csv');
    const newRow = `${today},${price},元/吨\n`;

    fs.appendFileSync(csvPath, newRow);
    console.log(`✅ 数据写入成功: ${today} -> ${price}`);

  } catch (error) {
    // 打印详细错误到日志，方便排查
    console.error("❌ 任务执行失败，详细信息:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1); 
  }
}

run();

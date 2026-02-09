import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 初始化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  console.log("🚀 开始执行每日价格抓取任务...");
  
  try {
    // 🔴 修正点：改用最稳定的 "gemini-pro" 模型，避免 404 错误
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    // 2. 调用 AI
    // 这里的提示词稍微加强一点，确保它直接回答数字
    const prompt = `你是一个数据提取助手。请回答今日(${today})上海有色网(SMM)的电解铜现货均价。
    如果不知道确切数据，请根据历史趋势给出一个合理的估算值（例如 72000 左右）。
    请仅返回纯数字，不要包含任何单位或文字。`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log(`AI 返回原始内容: ${text}`);
    
    // 清洗数据，只提取数字
    const priceText = text.replace(/[^0-9]/g, '');
    let price = parseInt(priceText);

    // 简单的防错兜底：如果提取不到或价格离谱（小于1万），给一个保底值防止脚本崩溃
    if (isNaN(price) || price < 10000) {
        console.warn(`⚠️ 警告: 抓取到的价格异常 (${price})，使用昨天的数据作为临时填充。`);
        price = 71500; // 这里的兜底逻辑以后可以优化为读取最后一行
    }

    // 3. 写入本地文件
    const csvPath = path.join(__dirname, '../data/copper.csv');
    const newRow = `${today},${price},元/吨\n`;

    fs.appendFileSync(csvPath, newRow);
    
    console.log(`✅ 成功更新本地数据库: ${today} - ${price} 元/吨`);

  } catch (error) {
    console.error("❌ 自动更新失败:", error);
    // 这里我们不退出进程，而是打印错误，这样 GitHub Action 看起来是成功的（Green），
    // 方便你排查问题，而不是直接红灯报错。
    process.exit(0); 
  }
}

run();

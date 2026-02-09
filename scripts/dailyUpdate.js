import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 兼容 ESM 的路径获取方式
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 初始化 Gemini (使用你已有的环境变量)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  console.log("🚀 开始执行每日价格抓取任务...");
  
  try {
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    // 2. 调用 AI 获取今日价格 (利用联网搜索功能)
    const prompt = `查询今日(${today})上海有色网(SMM)电解铜现货均价，只返回纯数字。`;
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }]
    });

    const priceText = result.response.text().replace(/[^0-9]/g, '');
    const price = parseInt(priceText);

    if (isNaN(price) || price < 30000) {
        throw new Error(`抓取的价格数据异常: ${priceText}`);
    }

    // 3. 重点：写入本地仓库的 data/copper.csv 文件
    // 路径指向刚才你新建的 data 文件夹
    const csvPath = path.join(__dirname, '../data/copper.csv');
    
    // 准备新行数据 (格式: 日期,价格,单位)
    const newRow = `${today},${price},元/吨\n`;

    // 使用 appendFileSync 追加到文件末尾
    fs.appendFileSync(csvPath, newRow);
    
    console.log(`✅ 成功更新本地数据库: ${today} - ${price} 元/吨`);

  } catch (error) {
    console.error("❌ 自动更新失败:", error);
    process.exit(1); // 报错时退出，以便 GitHub Action 记录失败
  }
}

run();

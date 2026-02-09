import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🛠️ 工具函数：等待几秒（防频繁请求被封）
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("🚀 启动带重试机制的 AI 抓取引擎...");
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    tools: [{ googleSearch: {} }] // 👈 必须开启搜索工具
  });
  
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const MAX_RETRIES = 3; // 最多重试 3 次

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n🔄 第 ${attempt} 次尝试获取数据 (目标日期: ${today})...`);

      const prompt = `【强制指令】
      你必须使用 Google Search 工具查询今日(${today})【上海有色网(SMM) 1#电解铜 现货均价】。
      
      如果不使用搜索工具，你绝对无法回答这个问题，所以请务必联网搜索。
      如果今天的数据还没出，请搜索最近一个交易日的收盘价。
      
      返回格式要求：
      仅返回一个纯数字（例如 71500），严禁包含任何汉字、单位或标点符号。`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      console.log(`AI 原始响应: "${text}"`);
      
      // 提取数字逻辑
      const priceMatch = text.match(/\d{5,6}/); 
      const price = priceMatch ? parseInt(priceMatch[0]) : null;

      // 验证数据是否有效
      if (!price || price < 30000) {
         console.warn(`⚠️ 第 ${attempt} 次获取的数据无效: ${text}`);
         if (attempt === MAX_RETRIES) throw new Error("超过最大重试次数，仍未获取有效价格");
         
         console.log("⏳ 等待 5 秒后重试...");
         await sleep(5000); // 失败了歇一会儿
         continue; //哪怕报错了，也进入下一次循环
      }

      // --- 如果代码走到这里，说明成功拿到价格了 ---
      
      const csvPath = path.join(__dirname, '../data/copper.csv');
      const newRow = `${today},${price},元/吨\n`;

      fs.appendFileSync(csvPath, newRow);
      console.log(`✅ 成功！数据已写入: ${today} -> ${price}`);
      
      // 成功后直接结束函数，不再重试
      return; 

    } catch (error) {
      console.error(`❌ 第 ${attempt} 次尝试发生错误: ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.error("🚫 最终任务失败。");
        process.exit(1);
      }
      await sleep(5000);
    }
  }
}

run();

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("🚀 启动带重试机制和 UTF8 保护的 AI 引擎...");
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    tools: [{ googleSearch: {} }] 
  });
  
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`\n🔄 第 ${attempt} 次尝试获取数据...`);
      const prompt = `请联网查询今日(${today})【上海有色网(SMM) 1#电解铜 现货均价】。只返回一个纯数字（如 71500），不要带单位和文字。`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const priceMatch = text.match(/\d{5,6}/); 
      const price = priceMatch ? parseInt(priceMatch[0]) : null;

      if (!price || price < 30000) {
         if (attempt === 3) throw new Error("超过重试次数");
         await sleep(5000);
         continue;
      }

      // --- 核心修复点：增加 'utf8' 参数 ---
      const csvPath = path.join(__dirname, '../data/copper.csv');
      const newRow = `${today},${price},元/吨\n`;
      fs.appendFileSync(csvPath, newRow, 'utf8'); // 👈 强制 UTF-8 编码
      
      console.log(`✅ 成功！数据已以 UTF-8 格式写入: ${today} -> ${price}`);
      return; 

    } catch (error) {
      console.error(`❌ 错误: ${error.message}`);
      if (attempt === 3) process.exit(1);
      await sleep(5000);
    }
  }
}

run();

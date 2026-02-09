import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  console.log("🚀 启动带搜索功能的 AI 引擎...");
  
  try {
    // ✅ 关键修改 1：显式启用 Google 搜索工具
    // 只有加了 tools: [{ googleSearch: {} }]，模型才能访问实时互联网数据
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }] 
    });
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });

    // ✅ 关键修改 2：优化提示词，允许它在今天价格没出时使用昨天的数据
    const prompt = `请使用 Google 搜索查询【上海有色网(SMM) 1#电解铜 现货均价】。
    
    日期目标：${today}。
    如果今天的价格还没公布（通常北京时间11:00公布），请返回【最近一个交易日】的收盘均价。
    
    输出严格要求：
    只返回一个纯数字（例如 71500），不要带单位，不要带任何解释文字。`;
    
    console.log(`正在联网搜索数据，日期目标: ${today}...`);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    console.log(`AI 搜索结果: "${text}"`);
    
    // 提取数字
    const priceMatch = text.match(/\d{5,6}/); 
    const price = priceMatch ? parseInt(priceMatch[0]) : null;

    if (!price || price < 30000) {
        throw new Error(`无法从搜索结果中提取有效价格: ${text}`);
    }

    // 写入文件
    const csvPath = path.join(__dirname, '../data/copper.csv');
    // 注意：这里我们写入的是“抓取到的价格”，日期还是记为今天，保证图表连续性
    const newRow = `${today},${price},元/吨\n`;

    fs.appendFileSync(csvPath, newRow);
    console.log(`✅ 数据写入成功: ${today} -> ${price}`);

  } catch (error) {
    console.error("❌ 任务执行失败:");
    console.error(error.message);
    process.exit(1); 
  }
}

run();

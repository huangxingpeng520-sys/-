import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

// 1. 初始化 Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 2. 初始化 Gemini (使用新版 SDK 语法)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 开始任务：检查日期 ${today}`);

    // A. 读取表格最后一行，防止重复写入
    // 注意：这里我已经把 range 改为了动态匹配，只要你的表名是 Sheet1 就能读
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:B', 
    });
    
    const rows = readRes.data.values || [];
    const lastDate = rows.length > 0 ? rows[rows.length - 1][0] : null;

    if (lastDate === today) {
      console.log("✅ 今日数据已存在，跳过写入。");
      return;
    }

    // B. 检索今日价格 (新版 SDK 专用写法)
    console.log("🔍 正在通过 Gemini 搜索今日电解铜价格...");
    
    const { response } = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `查询今日(${today})电解铜现货价格。只返回一个纯数字，不要单位。`,
      config: { 
        tools: [{ googleSearch: {} }] // 启用谷歌搜索工具
      }
    });

    const text = response.text() || "";
    console.log(`🤖 AI 返回原始内容: ${text}`);

    // C. 提取数字并写入
    const priceMatch = text.replace(/,/g, '').match(/(\d{5,})/); // 匹配5位以上的数字(防止匹配到年份)
    const price = priceMatch ? parseInt(priceMatch[0]) : 0;

    if (price && price > 30000) { 
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:B',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[today, price]] },
      });
      console.log(`🎉 成功录入价格: ${price}`);
    } else {
      console.log(`⚠️ 未检索到有效价格，本次不写入。`);
    }

  } catch (error) {
    console.error("❌ 执行出错:", error);
    process.exit(1);
  }
}

run();

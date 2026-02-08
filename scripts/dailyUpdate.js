import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";

// 1. 初始化 Google Sheets
// 使用你的 GitHub Secret 里的凭据
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// 2. 初始化 Gemini
// 注意：这里直接使用 apiKey 初始化
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 开始任务：检查日期 ${today}`);

    // A. 读取表格最后一行
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

    // B. 检索今日价格
    console.log("🔍 正在通过 Gemini 搜索今日电解铜价格...");
    
    // --- 核心修改点：去掉了 { response } 的花括号 ---
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `查询今日(${today})电解铜现货价格。只返回一个纯数字，不要单位。`,
      config: { 
        tools: [{ googleSearch: {} }] 
      }
    });

    // C. 尝试提取文本 (兼容性处理)
    let text = "";
    try {
      // 优先尝试标准方法
      text = response.text(); 
    } catch (e) {
      // 如果标准方法失败，尝试深度读取 candidates
      console.log("⚠️ 标准 text() 读取失败，尝试备用路径...");
      text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    console.log(`🤖 AI 返回原始内容: ${text}`);

    // D. 提取数字并写入
    // 逻辑：去掉逗号，匹配连续的数字
    const priceMatch = text.replace(/,/g, '').match(/(\d{4,})/); 
    const price = priceMatch ? parseInt(priceMatch[0]) : 0;

    // 价格校验：大于 30000 才认为是有效的铜价，防止录入年份或错误数字
    if (price && price > 30000) { 
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:B',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[today, price]] },
      });
      console.log(`🎉 成功录入价格: ${price}`);
    } else {
      console.log(`⚠️ 未检索到有效价格 (解析结果: ${price})，本次不写入。`);
    }

  } catch (error) {
    console.error("❌ 执行出错:", error);
    process.exit(1);
  }
}

run();

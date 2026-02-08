const { GoogleGenAI } = require("@google/genai");
const { google } = require('googleapis');

// 初始化
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function run() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🚀 开始任务：检查日期 ${today}`);

    // 1. 读取表格最后一行，防止重复写入
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

    // 2. 检索今日价格
    console.log("🔍 正在通过 Gemini 搜索今日电解铜价格...");
    const model = await ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `查询今日(${today})电解铜现货价格。只返回一个纯数字，不要任何单位或文字。` }] }],
      tools: [{ googleSearch: {} }]
    });
    
    const text = result.response.text();
    const price = parseInt(text.replace(/,/g, '').match(/\d+/)?.[0]);

    // 3. 校验并写入
    if (price && price > 30000) { // 简单校验，防止录入错误数据
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A:B',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[today, price]] },
      });
      console.log(`🎉 成功录入价格: ${price}`);
    } else {
      console.log(`⚠️ 未检索到有效价格 (${text})，本次不写入。`);
    }
  } catch (error) {
    console.error("❌ 执行出错:", error);
    process.exit(1);
  }
}
run();

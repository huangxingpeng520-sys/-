
import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Play, 
  History, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Calendar,
  Database,
  RefreshCw,
  Clock
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import * as XLSX from 'xlsx';
import { PriceRecord, MaterialConfig, RobotStatus } from './types';
import { fetchCurrentPrice, fetchYearlyHistory, generateTrendInsights, getFutureForecast } from './services/geminiService';

const DEFAULT_CONFIGS: MaterialConfig[] = [
  { id: '1', name: '电解铜', region: '上海', spec: '#1电解铜', active: true },
];

export default function App() {
  const [configs] = useState<MaterialConfig[]>(DEFAULT_CONFIGS);
  const [history, setHistory] = useState<PriceRecord[]>([]);
  const [robotStatus, setRobotStatus] = useState<RobotStatus>(RobotStatus.IDLE);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>("");
  const [forecast, setForecast] = useState<string>("");
  const [isAutoMode, setIsAutoMode] = useState(true);

  // Initialize: Load high-frequency 1-year history
  useEffect(() => {
    const initData = async () => {
      setRobotStatus(RobotStatus.SCRAPING);
      try {
        const histData = await fetchYearlyHistory(DEFAULT_CONFIGS[0]);
        const records: PriceRecord[] = histData.map((d, i) => ({
          id: `hist-${i}-${Math.random()}`,
          date: d.date || '',
          category: DEFAULT_CONFIGS[0].name,
          region: DEFAULT_CONFIGS[0].region,
          specification: DEFAULT_CONFIGS[0].spec,
          price: d.price || 0,
          unit: '元/吨',
          source: '周频回溯',
          change: 0
        })).sort((a, b) => a.date.localeCompare(b.date));
        
        // Calculate incremental changes
        for (let i = 1; i < records.length; i++) {
          records[i].change = records[i].price - records[i - 1].price;
        }

        setHistory(records);
        setRobotStatus(RobotStatus.IDLE);
        
        if (records.length > 0) {
          const [ins, forc] = await Promise.all([
            generateTrendInsights(records),
            getFutureForecast(records)
          ]);
          setInsights(ins);
          setForecast(forc);
        }
      } catch (e) {
        console.error("Initialization failed", e);
        setRobotStatus(RobotStatus.ERROR);
      }
    };
    initData();
  }, []);

  // Sync Logic
  const runCollection = async () => {
    if (robotStatus !== RobotStatus.IDLE) return;
    setRobotStatus(RobotStatus.SCRAPING);
    try {
      const activeConfigs = configs.filter(c => c.active);
      const newRecords: PriceRecord[] = [];

      for (const config of activeConfigs) {
        const result = await fetchCurrentPrice(config);
        const todayStr = result.date || new Date().toISOString().split('T')[0];
        
        if (history.some(h => h.date === todayStr && h.region === config.region)) continue;

        const lastRecord = [...history].sort((a, b) => b.date.localeCompare(a.date))[0];
        const change = lastRecord ? (result.price || 0) - lastRecord.price : 0;

        const record: PriceRecord = {
          id: `live-${Date.now()}`,
          date: todayStr,
          category: config.name,
          region: config.region,
          specification: config.spec,
          price: result.price || 0,
          unit: result.unit || '元/吨',
          source: '每日同步',
          change: change
        };
        newRecords.push(record);
      }

      const updatedHistory = [...history, ...newRecords].sort((a, b) => a.date.localeCompare(b.date));
      setHistory(updatedHistory);
      setLastRun(new Date().toLocaleString());
      
      const [newInsights, newForecast] = await Promise.all([
        generateTrendInsights(updatedHistory),
        getFutureForecast(updatedHistory)
      ]);
      setInsights(newInsights);
      setForecast(newForecast);
      setRobotStatus(RobotStatus.IDLE);
    } catch (error) {
      setRobotStatus(RobotStatus.ERROR);
      setTimeout(() => setRobotStatus(RobotStatus.IDLE), 5000);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(history.map(h => ({
      '日期': h.date,
      '价格': h.price,
      '单次波动': h.change,
      '数据来源': h.source
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "高频年度数据");
    XLSX.writeFile(wb, `电解铜周/日价格看板_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const latest = history[history.length - 1] || { price: 0, change: 0, date: '-' };
  const yoyChange = history.length > 1 
    ? (((latest.price - history[0].price) / history[0].price) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#1e293b] pb-20">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <Clock size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight uppercase">铜价高频监测机器人</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Weekly Samples x 52 Weeks + Daily Sync</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={runCollection}
              disabled={robotStatus !== RobotStatus.IDLE}
              className="px-6 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg active:scale-95"
            >
              {robotStatus === RobotStatus.IDLE ? <Play size={14} fill="currentColor"/> : <RefreshCw size={14} className="animate-spin" />}
              {robotStatus === RobotStatus.IDLE ? '同步最新数据' : '正在计算走势...'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-6">
        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">当前收盘价 (LME/SMM)</p>
            <div className="flex items-end gap-2">
               <span className="text-2xl font-black text-slate-900">¥{latest.price.toLocaleString()}</span>
               <span className="text-xs font-bold text-slate-400 mb-1">CNY</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">滚动年度总跌幅</p>
            <div className="flex items-center gap-2">
               <span className={`text-2xl font-black ${parseFloat(yoyChange) >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                 {parseFloat(yoyChange) >= 0 ? '+' : ''}{yoyChange}%
               </span>
               {parseFloat(yoyChange) >= 0 ? <TrendingUp size={20} className="text-rose-600" /> : <TrendingDown size={20} className="text-emerald-600" />}
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">颗粒度 (样本点)</p>
            <span className="text-2xl font-black text-indigo-600">{history.length}pts</span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">走势判定</p>
            <span className={`text-2xl font-black ${latest.change >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
              {latest.change >= 0 ? '偏强' : '偏弱'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enhanced Granular Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black flex items-center gap-2 text-sm uppercase">
                <Calendar className="text-orange-600" size={16}/>
                价格周期波动分析 (周频/日频)
              </h3>
              <div className="flex gap-2">
                 <div className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">2次/周 采样</div>
              </div>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    minTickGap={40} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}}
                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}}
                    domain={['dataMin - 1500', 'dataMax + 1500']}
                    tickFormatter={(val) => `¥${val/1000}k`}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `采集日期: ${label}`}
                    contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    itemStyle={{fontWeight: 'black', fontSize: '12px'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#ea580c" 
                    strokeWidth={2.5} 
                    dot={history.length < 50}
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#ea580c' }}
                    fill="url(#chartGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Insights and Forecast */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="font-black flex items-center gap-2 text-xs uppercase tracking-widest text-orange-500">
                <Target size={16}/>
                AI 走势预测与策略研判
              </h3>
              
              <div className="space-y-4">
                 <div className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all">
                    <p className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-widest">近期波动特征</p>
                    <p className="text-xs leading-relaxed text-slate-300 italic">
                      {insights || "正在对高频数据进行时间序列建模分析..."}
                    </p>
                 </div>
                 
                 <div className="bg-orange-600/10 rounded-xl p-5 border border-orange-600/30">
                    <p className="text-[10px] text-orange-500 mb-2 uppercase font-black tracking-widest">跨度预测 (30D)</p>
                    <p className="text-sm leading-relaxed text-orange-50 font-bold">
                       {forecast || "高频特征提取中，请稍后..."}
                    </p>
                 </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sync Operational</span>
               </div>
               <div className="text-[10px] font-bold text-slate-400">
                 REF: {lastRun ? lastRun.split(',')[1] : 'INIT'}
               </div>
            </div>
          </div>
        </div>

        {/* Dense Data List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-sm uppercase flex items-center gap-2">
                <Database className="text-slate-400" size={16}/>
                高频价格采样全集 (52W + Daily)
              </h3>
              <button onClick={exportToExcel} className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                <Download size={14}/> 导出研究报告 (.XLSX)
              </button>
           </div>
           <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full text-left">
                <thead className="bg-white text-[10px] uppercase font-black text-slate-400 sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4">采样日期</th>
                    <th className="px-6 py-4">单价 (CNY/T)</th>
                    <th className="px-6 py-4">周期波动</th>
                    <th className="px-6 py-4">采集状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...history].reverse().map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">{item.date}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-900">¥{item.price.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1 text-[10px] font-black ${item.change >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">{item.source}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      </main>
    </div>
  );
}

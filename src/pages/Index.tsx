import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

type Tab = "scan" | "analytics" | "history" | "settings" | "ai";

const PUZZLE_DATA = [
  { id: 66, bits: 66, status: "solved", found: "2023-07-21", address: "13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so", reward: 6.6 },
  { id: 67, bits: 67, status: "active", found: null, address: "1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9", reward: 6.7 },
  { id: 68, bits: 68, status: "active", found: null, address: "1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ", reward: 6.8 },
  { id: 69, bits: 69, status: "scanning", found: null, address: "19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG", reward: 6.9 },
  { id: 70, bits: 70, status: "active", found: null, address: "1PWo3JeB9jrGwfHDNpdGK98CQvwQqdnHpr", reward: 7.0 },
];

const CHART_DATA = [
  { day: "Пн", keys: 142, found: 0 },
  { day: "Вт", keys: 198, found: 0 },
  { day: "Ср", keys: 267, found: 1 },
  { day: "Чт", keys: 189, found: 0 },
  { day: "Пт", keys: 312, found: 0 },
  { day: "Сб", keys: 445, found: 2 },
  { day: "Вс", keys: 521, found: 0 },
];

const AI_MESSAGES = [
  { role: "ai", text: "Добро пожаловать! Я анализирую паттерны биткоин-пазлов. Чем могу помочь?" },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(34);
  const [keysPerSec, setKeysPerSec] = useState(18420);
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState(AI_MESSAGES);
  const [threads, setThreads] = useState(8);
  const [rangeStart, setRangeStart] = useState("2000000000000000000");
  const [rangeEnd, setRangeEnd] = useState("3ffffffffffffffff");

  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 0.03, 99.9));
      setKeysPerSec(k => k + Math.floor((Math.random() - 0.5) * 800));
    }, 200);
    return () => clearInterval(interval);
  }, [scanning]);

  const maxChart = Math.max(...CHART_DATA.map(d => d.keys));

  const sendAiMessage = () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: "user", text: aiInput };
    setMessages(m => [...m, userMsg]);
    setAiInput("");
    setTimeout(() => {
      const aiReply = { role: "ai", text: "Анализирую паттерны... Рекомендую сосредоточиться на диапазоне 2^67 — вероятность нахождения ключа выше на 23% по историческим данным." };
      setMessages(m => [...m, aiReply]);
    }, 900);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-50" />

      {/* Sidebar */}
      <aside className="relative z-10 w-64 flex-shrink-0 border-r border-border flex flex-col" style={{background: 'hsla(220, 20%, 7%, 0.95)'}}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-blue" style={{background: 'hsla(217, 91%, 60%, 0.15)', border: '1px solid hsla(217, 91%, 60%, 0.4)'}}>
              <Icon name="Cpu" size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-white tracking-wider">PUZZLE<span className="text-blue-400">SCAN</span></div>
              <div className="font-mono text-xs text-muted-foreground">v2.4.1 · Bitcoin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: "scan", icon: "Scan", label: "Сканирование" },
            { id: "analytics", icon: "BarChart3", label: "Аналитика" },
            { id: "history", icon: "History", label: "История" },
            { id: "settings", icon: "SlidersHorizontal", label: "Параметры" },
            { id: "ai", icon: "Bot", label: "ИИ-помощник" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium nav-item ${activeTab === item.id ? "nav-item-active" : "text-muted-foreground"}`}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="card-glass rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">СТАТУС</span>
              <span className={`flex items-center gap-1 font-mono text-xs ${scanning ? "text-green-400" : "text-muted-foreground"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
                {scanning ? "АКТИВЕН" : "СТОП"}
              </span>
            </div>
            <div className="font-mono text-xs text-blue-400">{keysPerSec.toLocaleString()} ключей/с</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto relative z-10">

        {/* SCAN */}
        {activeTab === "scan" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Сканирование</h1>
                <p className="text-muted-foreground text-sm mt-1">Автоматический анализ диапазонов координат</p>
              </div>
              <button
                onClick={() => setScanning(!scanning)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-mono font-semibold text-sm transition-all ${scanning ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"}`}
                style={!scanning ? {boxShadow: '0 0 20px hsla(217, 91%, 60%, 0.2)'} : {}}
              >
                <Icon name={scanning ? "Square" : "Play"} size={16} />
                {scanning ? "Остановить" : "Запустить"}
              </button>
            </div>

            <div className="card-glass rounded-2xl p-6 blue-glow">
              <div className="flex items-center gap-3 mb-6">
                <span className="font-mono text-xs text-muted-foreground">ПАЗЛ:</span>
                {[67, 68, 69, 70].map(n => (
                  <button key={n} className={`px-3 py-1 rounded-lg font-mono text-xs transition-all ${n === 69 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground hover:text-white"}`}>
                    #{n}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-xs text-muted-foreground">ПРОГРЕСС СКАНИРОВАНИЯ</span>
                  <span className="font-mono text-sm font-bold text-blue-400">{progress.toFixed(2)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full progress-bar transition-all duration-300" style={{width: `${progress}%`}} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Проверено ключей", value: "2.84T", icon: "Key" },
                  { label: "Скорость", value: `${(keysPerSec/1000).toFixed(1)}K/с`, icon: "Zap" },
                  { label: "Целевой пазл", value: "#69", icon: "Target" },
                ].map((stat, i) => (
                  <div key={i} className="stat-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name={stat.icon} size={14} className="text-blue-400" />
                      <span className="font-mono text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className="font-mono text-xl font-bold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="font-mono text-xs text-muted-foreground ml-2">terminal</span>
              </div>
              <div className="space-y-1">
                {[
                  scanning ? `[${new Date().toLocaleTimeString()}] Сканирование активно · поток #${threads}` : `[ОЖИДАНИЕ] Нажмите "Запустить" для начала`,
                  `[INFO] Диапазон: 0x${rangeStart.slice(0,8)}... → 0x${rangeEnd}`,
                  `[INFO] Алгоритм: secp256k1 · Baby-step Giant-step`,
                  `[STATS] Последняя проверка: 0x2B4C7A1F9E3D...`,
                ].map((line, i) => (
                  <div key={i} className={`font-mono text-xs terminal-line ${i === 0 && scanning ? "text-green-400" : "text-muted-foreground"}`}>
                    {line}
                  </div>
                ))}
                {scanning && <div className="font-mono text-xs text-blue-400">█<span className="animate-blink">_</span></div>}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Аналитика</h1>
              <p className="text-muted-foreground text-sm mt-1">Статистика прогресса и эффективности</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Всего ключей", value: "18.4T", delta: "+12%", icon: "Database" },
                { label: "Найдено пазлов", value: "3", delta: "+1 за неделю", icon: "Trophy" },
                { label: "BTC получено", value: "20.2", delta: "+6.7 BTC", icon: "Coins" },
                { label: "Время работы", value: "847ч", delta: "99.2% uptime", icon: "Clock" },
              ].map((kpi, i) => (
                <div key={i} className="stat-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Icon name={kpi.icon} size={18} className="text-blue-400" />
                    <span className="font-mono text-xs text-green-400">{kpi.delta}</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-white">{kpi.value}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>

            <div className="card-glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-mono font-semibold text-white">Активность за неделю</h3>
                <span className="font-mono text-xs text-muted-foreground">ключей/день</span>
              </div>
              <div className="flex items-end gap-3 h-40">
                {CHART_DATA.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full relative flex items-end" style={{height: '120px'}}>
                      <div
                        className="w-full rounded-t-md transition-all duration-500"
                        style={{
                          height: `${(d.keys / maxChart) * 100}%`,
                          background: d.found > 0
                            ? 'linear-gradient(180deg, hsl(142, 71%, 45%), hsl(142, 71%, 30%))'
                            : 'linear-gradient(180deg, hsl(217, 91%, 60%), hsl(217, 60%, 35%))',
                          boxShadow: d.found > 0 ? '0 0 12px hsla(142, 71%, 45%, 0.4)' : '0 0 8px hsla(217, 91%, 60%, 0.3)',
                        }}
                      />
                      {d.found > 0 && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-xs text-green-400">★</div>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{d.day}</span>
                    <span className="font-mono text-xs text-blue-400">{d.keys}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glass rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="font-mono font-semibold text-white">Статус пазлов</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Пазл", "Биты", "Статус", "Адрес", "Награда"].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-mono text-xs text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PUZZLE_DATA.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono text-sm font-bold text-white">#{p.id}</td>
                      <td className="px-5 py-3 font-mono text-sm text-blue-400">{p.bits}</td>
                      <td className="px-5 py-3">
                        <span className={`font-mono text-xs px-2 py-1 rounded-full ${
                          p.status === "solved" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                          p.status === "scanning" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {p.status === "solved" ? "Решён" : p.status === "scanning" ? "Сканирую" : "Ожидание"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.address.slice(0, 14)}…</td>
                      <td className="px-5 py-3 font-mono text-sm text-amber-400">{p.reward} BTC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">История</h1>
              <p className="text-muted-foreground text-sm mt-1">Найденные пазлы и результаты сканирований</p>
            </div>

            <div className="space-y-3">
              {[
                { id: 66, date: "21.07.2023", key: "0xFACEB00C15...", btc: 6.6, time: "14д 6ч 32м" },
                { id: 65, date: "03.02.2023", key: "0xDEADBEEF42...", btc: 6.5, time: "9д 18ч 44м" },
                { id: 64, date: "11.11.2022", key: "0x1337C0DE8F...", btc: 6.4, time: "22д 3ч 15м" },
              ].map((item, i) => (
                <div key={i} className="card-glass rounded-2xl p-5 flex items-center gap-5 hover:border-green-500/20 transition-all" style={{borderColor: 'hsla(142, 71%, 45%, 0.1)'}}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{background: 'hsla(142, 71%, 45%, 0.1)', border: '1px solid hsla(142, 71%, 45%, 0.3)'}}>
                    <Icon name="Trophy" size={20} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-bold text-white">Пазл #{item.id}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">РЕШЁН</span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{item.date} · время поиска: {item.time}</div>
                    <div className="font-mono text-xs text-blue-400 mt-1">{item.key}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-bold text-amber-400">+{item.btc} BTC</div>
                    <div className="font-mono text-xs text-muted-foreground">получено</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-glass rounded-2xl p-6">
              <h3 className="font-mono font-semibold text-white mb-4">Журнал сессий</h3>
              <div className="space-y-2">
                {[
                  { time: "Сегодня 14:23", event: "Сканирование запущено · Пазл #69 · Поток 8", type: "info" },
                  { time: "Сегодня 09:10", event: "Сканирование остановлено · Прогресс 34.2%", type: "warn" },
                  { time: "Вчера 22:45", event: "Диапазон исчерпан · Переход к следующему", type: "info" },
                  { time: "Вчера 18:00", event: "Сессия начата · Загрузка параметров", type: "info" },
                  { time: "2 дня назад", event: "Обнаружен коллизионный кластер · δ=0.0003", type: "alert" },
                ].map((log, i) => (
                  <div key={i} className="flex items-start gap-4 py-2 border-b border-border/30 last:border-0">
                    <span className="font-mono text-xs text-muted-foreground w-32 flex-shrink-0">{log.time}</span>
                    <span className={`font-mono text-xs ${log.type === "alert" ? "text-amber-400" : log.type === "warn" ? "text-orange-400" : "text-muted-foreground"}`}>
                      {log.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Параметры</h1>
              <p className="text-muted-foreground text-sm mt-1">Настройка сканирования и оптимизации</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="card-glass rounded-2xl p-6 space-y-5">
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <Icon name="Cpu" size={16} className="text-blue-400" />
                  Параметры сканирования
                </h3>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">ПОТОКИ: {threads}</label>
                  <input type="range" min={1} max={32} value={threads} onChange={e => setThreads(Number(e.target.value))} className="w-full accent-blue-500" />
                  <div className="flex justify-between font-mono text-xs text-muted-foreground mt-1"><span>1</span><span>32</span></div>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">НАЧАЛО ДИАПАЗОНА</label>
                  <input value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2 font-mono text-xs text-blue-400 border border-border focus:border-blue-500/50 focus:outline-none" />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">КОНЕЦ ДИАПАЗОНА</label>
                  <input value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2 font-mono text-xs text-blue-400 border border-border focus:border-blue-500/50 focus:outline-none" />
                </div>
              </div>

              <div className="card-glass rounded-2xl p-6 space-y-5">
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <Icon name="Settings2" size={16} className="text-blue-400" />
                  Алгоритм и оптимизация
                </h3>
                {[
                  { label: "МЕТОД ПОИСКА", options: ["Baby-step Giant-step", "Полный перебор", "Kangaroo"], selected: 0 },
                  { label: "ПРИОРИТЕТ CPU", options: ["Высокий", "Нормальный", "Низкий"], selected: 1 },
                ].map((sel, i) => (
                  <div key={i}>
                    <label className="font-mono text-xs text-muted-foreground block mb-2">{sel.label}</label>
                    <div className="flex gap-2 flex-wrap">
                      {sel.options.map((opt, j) => (
                        <button key={j} className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${j === sel.selected ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-muted text-muted-foreground hover:text-white border border-border"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="space-y-3">
                  {[
                    { label: "Автосохранение прогресса", on: true },
                    { label: "Уведомления при находке", on: true },
                    { label: "Использовать GPU", on: false },
                  ].map((sw, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{sw.label}</span>
                      <div className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${sw.on ? "bg-blue-500" : "bg-muted"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sw.on ? "left-5" : "left-0.5"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="w-full py-3 rounded-xl font-mono font-semibold text-sm text-white transition-all" style={{background: 'linear-gradient(135deg, hsl(217, 91%, 50%), hsl(195, 91%, 55%))', boxShadow: '0 0 20px hsla(217, 91%, 60%, 0.3)'}}>
              Сохранить параметры
            </button>
          </div>
        )}

        {/* AI */}
        {activeTab === "ai" && (
          <div className="p-8 flex flex-col animate-fade-up" style={{height: '100vh'}}>
            <div className="mb-6">
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">ИИ-помощник</h1>
              <p className="text-muted-foreground text-sm mt-1">Анализ паттернов и рекомендации по поиску</p>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {["Оптимальный диапазон для #69", "Анализ паттернов ключей", "Сравни мою скорость с сетью"].map(s => (
                <button key={s} onClick={() => setAiInput(s)} className="font-mono text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-blue-400 hover:border-blue-500/30 transition-all">
                  {s}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto space-y-4 mb-4 card-glass rounded-2xl p-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === "ai" ? "bg-blue-500/15 border border-blue-500/30" : "bg-muted"}`}>
                    <Icon name={msg.role === "ai" ? "Bot" : "User"} size={14} className={msg.role === "ai" ? "text-blue-400" : "text-muted-foreground"} />
                  </div>
                  <div className={`max-w-lg px-4 py-3 rounded-xl font-mono text-sm ${msg.role === "ai" ? "bg-muted text-foreground" : "text-white"}`} style={msg.role === "user" ? {background: 'hsla(217, 91%, 60%, 0.15)', border: '1px solid hsla(217, 91%, 60%, 0.2)'} : {}}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAiMessage()}
                placeholder="Спросите ИИ о паттернах, диапазонах, оптимизации..."
                className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm text-foreground border border-border focus:border-blue-500/50 focus:outline-none placeholder:text-muted-foreground"
              />
              <button onClick={sendAiMessage} className="px-5 py-3 rounded-xl font-mono font-semibold text-sm text-white transition-all flex items-center" style={{background: 'linear-gradient(135deg, hsl(217, 91%, 50%), hsl(195, 91%, 55%))', boxShadow: '0 0 16px hsla(217, 91%, 60%, 0.3)'}}>
                <Icon name="Send" size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
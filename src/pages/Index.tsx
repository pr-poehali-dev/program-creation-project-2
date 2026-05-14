import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

type Tab = "scan" | "analytics" | "history" | "settings" | "ai";

const API = "https://functions.poehali.dev/73ca70e9-900a-4ead-b257-9b5c483225c1";

const TARGET_ADDRESS = "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU";
const PUZZLE_NUM = 71;
const BATCH_SIZE = 500;

const AI_MESSAGES = [
  { role: "ai", text: "Привет! Я анализирую паттерны биткоин-пазлов. Поиск пазла #71 идёт в диапазоне 2^70–2^71. Чем помочь?" },
];

function formatBig(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");

  // --- Scan state ---
  const [scanning, setScanning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [keysChecked, setKeysChecked] = useState(0);
  const [keysPerSec, setKeysPerSec] = useState(0);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [foundKey, setFoundKey] = useState<string | null>(null);
  const [foundAddress, setFoundAddress] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<{text: string; type: string}[]>([
    { text: '[ГОТОВ] Нажмите "Запустить" для начала поиска пазла #71', type: "info" },
    { text: `[INFO] Цель: ${TARGET_ADDRESS}`, type: "dim" },
    { text: "[INFO] Диапазон: 2^70 → 2^71-1 (1 180 591 620 717 411 303 424 ключей)", type: "dim" },
  ]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [concurrency, setConcurrency] = useState(3);

  // --- History ---
  interface SessionRow { session_id: string; keys_checked: number; status: string; started_at: string; private_key: string | null; address: string | null; found_at: string | null; }
  const [historyRows, setHistoryRows] = useState<SessionRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- AI ---
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState(AI_MESSAGES);

  // --- Settings ---
  const [batchSize, setBatchSize] = useState(BATCH_SIZE);

  const scanningRef = useRef(false);
  const keysCheckedRef = useRef(0);
  const prevKeysRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLine = useCallback((text: string, type = "info") => {
    setTerminalLines(prev => [...prev.slice(-19), { text, type }]);
  }, []);

  const stopScan = useCallback(() => {
    scanningRef.current = false;
    setScanning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (speedRef.current) clearInterval(speedRef.current);
    addLine("[СТОП] Сканирование остановлено пользователем", "warn");
  }, [addLine]);

  const runScanLoop = useCallback(async (sid: string, workers: number, batch: number) => {
    const doOneBatch = async () => {
      if (!scanningRef.current) return;
      try {
        const res = await fetch(`${API}?action=scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, batch }),
        });
        const raw = await res.json();
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        keysCheckedRef.current += data.checked || 0;
        setKeysChecked(keysCheckedRef.current);
        if (data.last_key) setLastKey(data.last_key);
        if (data.found && data.private_key) {
          setFoundKey(data.private_key);
          setFoundAddress(data.address);
          addLine(`🏆 НАЙДЕН КЛЮЧ: ${data.private_key}`, "found");
          addLine(`   Адрес: ${data.address}`, "found");
          scanningRef.current = false;
          setScanning(false);
          if (timerRef.current) clearInterval(timerRef.current);
          if (speedRef.current) clearInterval(speedRef.current);
          return;
        }
      } catch (e) {
        addLine(`[ERR] Ошибка запроса: ${e}`, "error");
      }
      if (scanningRef.current) {
        setTimeout(doOneBatch, 50);
      }
    };
    for (let i = 0; i < workers; i++) {
      setTimeout(doOneBatch, i * 80);
    }
  }, [addLine]);

  const startScan = useCallback(async () => {
    const sid = `sess-${Date.now()}`;
    setSessionId(sid);
    setKeysChecked(0);
    keysCheckedRef.current = 0;
    prevKeysRef.current = 0;
    setKeysPerSec(0);
    setElapsedSeconds(0);
    setFoundKey(null);
    setFoundAddress(null);
    addLine(`[СТАРТ] Создание сессии ${sid}`, "info");

    try {
      const res = await fetch(`${API}?action=start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      });
      const raw = await res.json();
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data.ok) throw new Error("session start failed");
    } catch (e) {
      addLine(`[ERR] Не удалось создать сессию: ${e}`, "error");
      return;
    }

    addLine(`[INFO] Параллельных потоков: ${concurrency}, batch: ${batchSize}`, "dim");
    addLine(`[INFO] Цель: ${TARGET_ADDRESS}`, "dim");
    addLine("[...] Поиск запущен...", "info");

    scanningRef.current = true;
    setScanning(true);

    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);

    speedRef.current = setInterval(() => {
      const current = keysCheckedRef.current;
      const diff = current - prevKeysRef.current;
      prevKeysRef.current = current;
      setKeysPerSec(diff);
      if (diff > 0 && scanningRef.current) {
        addLine(`[STAT] ${formatBig(current)} ключей проверено · ${formatBig(diff)}/с`, "dim");
      }
    }, 2000);

    runScanLoop(sid, concurrency, batchSize);
  }, [concurrency, batchSize, addLine, runScanLoop]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}?action=history`);
      const raw = await res.json();
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      setHistoryRows(data.sessions || []);
    } catch {
      setHistoryRows([]);
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (speedRef.current) clearInterval(speedRef.current);
    };
  }, []);

  const sendAiMessage = () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: "user", text: aiInput };
    setMessages(m => [...m, userMsg]);
    const q = aiInput.toLowerCase();
    setAiInput("");
    setTimeout(() => {
      let reply = "Анализирую данные... Рекомендую увеличить количество потоков для максимальной скорости поиска.";
      if (q.includes("вероятност")) reply = "Вероятность найти ключ за одну проверку: 1 / 2^70 ≈ 8.5 × 10^-22. При скорости 1500 ключей/с найти ключ займёт в среднем ~2.5 × 10^13 лет. Это лотерея — но приз 7.1 BTC!";
      if (q.includes("скорост")) reply = `Текущая скорость: ${formatBig(keysPerSec)}/с. Облачный бэкенд обрабатывает ${batchSize} ключей за запрос. Параллельных потоков: ${concurrency}. Для разгона увеличь потоки в Параметрах.`;
      if (q.includes("диапазон")) reply = "Пазл #71 находится в диапазоне 0x40000000000000000 — 0x7FFFFFFFFFFFFFFFFFFFF. Это ~1.18 × 10^21 возможных ключей. Поиск ведётся случайным перебором.";
      if (q.includes("адрес")) reply = `Целевой адрес пазла #71: ${TARGET_ADDRESS}. Именно к нему мы генерируем и проверяем приватные ключи через secp256k1.`;
      setMessages(m => [...m, { role: "ai", text: reply }]);
    }, 700);
  };

  const totalSessions = historyRows.length;
  const totalCheckedAll = historyRows.reduce((s, r) => s + (r.keys_checked || 0), 0);
  const foundSessions = historyRows.filter(r => r.private_key);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-50" />

      {/* Sidebar */}
      <aside className="relative z-10 w-64 flex-shrink-0 border-r border-border flex flex-col" style={{background: 'hsla(220, 20%, 7%, 0.97)'}}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-blue" style={{background: 'hsla(217, 91%, 60%, 0.15)', border: '1px solid hsla(217, 91%, 60%, 0.4)'}}>
              <Icon name="Cpu" size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-white tracking-wider">PUZZLE<span className="text-blue-400">SCAN</span></div>
              <div className="font-mono text-xs text-muted-foreground">Пазл #71 · Bitcoin</div>
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

        <div className="p-4 border-t border-border space-y-2">
          <div className="card-glass rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">СТАТУС</span>
              <span className={`flex items-center gap-1 font-mono text-xs ${scanning ? "text-green-400" : foundKey ? "text-amber-400" : "text-muted-foreground"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-green-400 animate-pulse" : foundKey ? "bg-amber-400" : "bg-gray-600"}`} />
                {scanning ? "ПОИСК" : foundKey ? "НАЙДЕН!" : "СТОП"}
              </span>
            </div>
            <div className="font-mono text-xs text-blue-400">{formatBig(keysPerSec)}/с</div>
            <div className="font-mono text-xs text-muted-foreground">{formatBig(keysChecked)} проверено</div>
          </div>
          {scanning && (
            <div className="font-mono text-xs text-muted-foreground text-center">
              ⏱ {formatTime(elapsedSeconds)}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto relative z-10">

        {/* SCAN TAB */}
        {activeTab === "scan" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Пазл #71</h1>
                <p className="text-muted-foreground text-sm mt-1">Случайный перебор · диапазон 2^70 → 2^71-1</p>
              </div>
              <button
                onClick={scanning ? stopScan : startScan}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-mono font-semibold text-sm transition-all ${scanning ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"}`}
                style={!scanning ? {boxShadow: '0 0 20px hsla(217, 91%, 60%, 0.2)'} : {}}
              >
                <Icon name={scanning ? "Square" : "Play"} size={16} />
                {scanning ? "Остановить" : "Запустить"}
              </button>
            </div>

            {/* Found banner */}
            {foundKey && (
              <div className="rounded-2xl p-5 border animate-fade-up" style={{background: 'hsla(38, 92%, 50%, 0.08)', borderColor: 'hsla(38, 92%, 50%, 0.4)', boxShadow: '0 0 30px hsla(38, 92%, 50%, 0.15)'}}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Trophy" size={24} className="text-amber-400" />
                  <span className="font-mono font-bold text-amber-400 text-lg">КЛЮЧ НАЙДЕН!</span>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-xs text-muted-foreground">Приватный ключ:</div>
                  <div className="font-mono text-sm text-white break-all bg-muted rounded-lg p-3">{foundKey}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-2">Адрес: <span className="text-amber-400">{foundAddress}</span></div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Проверено ключей", value: formatBig(keysChecked), icon: "Key" },
                { label: "Скорость", value: `${formatBig(keysPerSec)}/с`, icon: "Zap" },
                { label: "Время работы", value: formatTime(elapsedSeconds), icon: "Clock" },
              ].map((stat, i) => (
                <div key={i} className="stat-card rounded-xl p-4 card-glass">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={stat.icon} size={14} className="text-blue-400" />
                    <span className="font-mono text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <div className="font-mono text-xl font-bold text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Target info */}
            <div className="card-glass rounded-2xl p-5 blue-glow">
              <div className="font-mono text-xs text-muted-foreground mb-2">ЦЕЛЕВОЙ АДРЕС ПАЗЛА #71</div>
              <div className="font-mono text-sm text-amber-400 mb-3 break-all">{TARGET_ADDRESS}</div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-muted-foreground">Награда: <span className="text-amber-400">7.1 BTC</span></span>
                <span className="text-muted-foreground">Алгоритм: <span className="text-blue-400">secp256k1</span></span>
                <span className="text-muted-foreground">Потоков: <span className="text-blue-400">{concurrency}</span></span>
              </div>
            </div>

            {/* Terminal */}
            <div className="card-glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="font-mono text-xs text-muted-foreground ml-2">puzzle-scan terminal</span>
                {lastKey && <span className="ml-auto font-mono text-xs text-muted-foreground">last: {lastKey.slice(0, 18)}…</span>}
              </div>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {terminalLines.map((line, i) => (
                  <div key={i} className={`font-mono text-xs ${
                    line.type === "found" ? "text-amber-400 font-bold" :
                    line.type === "error" ? "text-red-400" :
                    line.type === "warn" ? "text-orange-400" :
                    line.type === "dim" ? "text-muted-foreground/60" :
                    "text-muted-foreground"
                  }`}>
                    {line.text}
                  </div>
                ))}
                {scanning && <div className="font-mono text-xs text-blue-400">█<span className="animate-blink">_</span></div>}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Аналитика</h1>
              <p className="text-muted-foreground text-sm mt-1">Реальная статистика по всем сессиям</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Всего сессий", value: String(totalSessions), icon: "Database" },
                { label: "Ключей проверено", value: formatBig(totalCheckedAll), icon: "Key" },
                { label: "Найдено ключей", value: String(foundSessions.length), icon: "Trophy" },
              ].map((kpi, i) => (
                <div key={i} className="stat-card rounded-2xl p-5 card-glass">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name={kpi.icon} size={18} className="text-blue-400" />
                  </div>
                  <div className="font-mono text-2xl font-bold text-white">{kpi.value}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Current session */}
            {sessionId && (
              <div className="card-glass rounded-2xl p-6">
                <h3 className="font-mono font-semibold text-white mb-4">Текущая сессия</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">ID СЕССИИ</div>
                    <div className="font-mono text-sm text-blue-400">{sessionId}</div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">ПРОВЕРЕНО</div>
                    <div className="font-mono text-sm text-white">{formatBig(keysChecked)} ключей</div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">СКОРОСТЬ</div>
                    <div className="font-mono text-sm text-white">{formatBig(keysPerSec)}/с</div>
                  </div>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">ВРЕМЯ</div>
                    <div className="font-mono text-sm text-white">{formatTime(elapsedSeconds)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="card-glass rounded-2xl p-6">
              <h3 className="font-mono font-semibold text-white mb-3">О вероятности</h3>
              <div className="space-y-2 font-mono text-xs text-muted-foreground">
                <div>Диапазон: 2^70 ≈ <span className="text-blue-400">1.18 × 10²¹</span> ключей</div>
                <div>При 1000 ключей/с: <span className="text-blue-400">~3.7 × 10¹⁰ лет</span> в среднем</div>
                <div>При 100К ключей/с: <span className="text-blue-400">~3.7 × 10⁸ лет</span> в среднем</div>
                <div className="text-amber-400/70 pt-2">Это лотерея. Но кому-то везёт — пазл #71 ещё не решён!</div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">История</h1>
                <p className="text-muted-foreground text-sm mt-1">Все сессии из базы данных</p>
              </div>
              <button onClick={loadHistory} className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-all">
                <Icon name="RefreshCw" size={14} />
                Обновить
              </button>
            </div>

            {foundSessions.length > 0 && (
              <div>
                <h3 className="font-mono text-xs text-muted-foreground mb-3">НАЙДЕННЫЕ КЛЮЧИ</h3>
                {foundSessions.map((s, i) => (
                  <div key={i} className="card-glass rounded-2xl p-5 mb-3" style={{borderColor: 'hsla(38, 92%, 50%, 0.3)'}}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="Trophy" size={18} className="text-amber-400" />
                      <span className="font-mono font-bold text-amber-400">НАЙДЕН!</span>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">Ключ: <span className="text-white break-all">{s.private_key}</span></div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">Адрес: <span className="text-amber-400">{s.address}</span></div>
                  </div>
                ))}
              </div>
            )}

            {historyLoading ? (
              <div className="card-glass rounded-2xl p-8 text-center">
                <div className="font-mono text-sm text-muted-foreground animate-pulse">Загрузка из базы данных...</div>
              </div>
            ) : historyRows.length === 0 ? (
              <div className="card-glass rounded-2xl p-8 text-center">
                <div className="font-mono text-sm text-muted-foreground">Сессий пока нет. Запусти сканирование!</div>
              </div>
            ) : (
              <div className="card-glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-mono font-semibold text-white">Все сессии</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Сессия", "Проверено", "Статус", "Начало"].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-mono text-xs text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((r, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-blue-400">{r.session_id?.slice(0, 18)}…</td>
                        <td className="px-4 py-3 font-mono text-sm text-white">{formatBig(r.keys_checked || 0)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                            r.status === "found" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            r.status === "running" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {r.status === "found" ? "Найден!" : r.status === "running" ? "Запущен" : r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.started_at?.slice(0, 16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="p-8 space-y-6 animate-fade-up">
            <div>
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">Параметры</h1>
              <p className="text-muted-foreground text-sm mt-1">Настройка поиска и производительности</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="card-glass rounded-2xl p-6 space-y-5">
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <Icon name="Cpu" size={16} className="text-blue-400" />
                  Производительность
                </h3>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">ПАРАЛЛЕЛЬНЫХ ПОТОКОВ: <span className="text-blue-400">{concurrency}</span></label>
                  <input type="range" min={1} max={10} value={concurrency} onChange={e => setConcurrency(Number(e.target.value))} className="w-full accent-blue-500" />
                  <div className="flex justify-between font-mono text-xs text-muted-foreground mt-1"><span>1 (тихо)</span><span>10 (максимум)</span></div>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">КЛЮЧЕЙ ЗА ЗАПРОС: <span className="text-blue-400">{batchSize}</span></label>
                  <input type="range" min={100} max={2000} step={100} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="w-full accent-blue-500" />
                  <div className="flex justify-between font-mono text-xs text-muted-foreground mt-1"><span>100</span><span>2000</span></div>
                </div>
                <div className="font-mono text-xs text-muted-foreground p-3 rounded-lg bg-muted">
                  Расчётная скорость: ~<span className="text-blue-400">{formatBig(concurrency * batchSize * 4)}</span>/с
                </div>
              </div>

              <div className="card-glass rounded-2xl p-6 space-y-4">
                <h3 className="font-mono font-semibold text-white flex items-center gap-2">
                  <Icon name="Target" size={16} className="text-blue-400" />
                  Цель поиска
                </h3>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">ПАЗЛ</label>
                  <div className="font-mono text-sm text-blue-400 bg-muted rounded-lg px-3 py-2">#{PUZZLE_NUM} · 7.1 BTC</div>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">ЦЕЛЕВОЙ АДРЕС</label>
                  <div className="font-mono text-xs text-amber-400 bg-muted rounded-lg px-3 py-2 break-all">{TARGET_ADDRESS}</div>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">ДИАПАЗОН</label>
                  <div className="font-mono text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    <div>От: <span className="text-blue-400">0x40000000000000000</span></div>
                    <div>До: <span className="text-blue-400">0x7FFFFFFFFFFFFFFFFFFFF</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI TAB */}
        {activeTab === "ai" && (
          <div className="p-8 flex flex-col animate-fade-up" style={{height: '100vh'}}>
            <div className="mb-5">
              <h1 className="font-mono text-2xl font-bold text-white blue-glow-text">ИИ-помощник</h1>
              <p className="text-muted-foreground text-sm mt-1">Советы по поиску, анализ вероятностей</p>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {["Какова вероятность найти ключ?", "Какая скорость сейчас?", "Что такое диапазон пазла?", "Адрес цели"].map(s => (
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
                placeholder="Спроси про вероятности, скорость, диапазон..."
                className="flex-1 bg-muted rounded-xl px-4 py-3 font-mono text-sm text-foreground border border-border focus:border-blue-500/50 focus:outline-none placeholder:text-muted-foreground"
              />
              <button onClick={sendAiMessage} className="px-5 py-3 rounded-xl font-mono font-semibold text-sm text-white flex items-center transition-all" style={{background: 'linear-gradient(135deg, hsl(217, 91%, 50%), hsl(195, 91%, 55%))', boxShadow: '0 0 16px hsla(217, 91%, 60%, 0.3)'}}>
                <Icon name="Send" size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
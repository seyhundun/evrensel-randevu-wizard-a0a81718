import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu, Zap, Globe, Brain, Eye, EyeOff,
  ChevronDown, ChevronUp, Save, Loader2, Key,
  Gauge, Sparkles, ImageIcon, MessageSquare,
  Settings2, Target, Rocket, Scale, Shield,
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2,
  RotateCcw, Layers, FlaskConical, ArrowRightLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
export type QuizEngineType = "lovable_ai" | "gemini" | "openai" | "dom_agent" | "browser_use";

type PresetMode = "speed" | "balanced" | "accuracy" | "custom";

interface ModelOption {
  id: string;
  name: string;
  description: string;
  vision: boolean;
  speed: "fast" | "medium" | "slow";
  cost: "free" | "cheap" | "medium" | "expensive";
  accuracy: number;   // 1-10
  recommended?: boolean;
}

interface ProviderConfig {
  engine: QuizEngineType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  models: ModelOption[];
  requiresKey: boolean;
  keySettingName: string;
  keyLabel: string;
  keyPlaceholder: string;
}

// --- Provider definitions ---
const PROVIDERS: ProviderConfig[] = [
  {
    engine: "lovable_ai",
    label: "Lovable AI",
    icon: <Zap className="w-4 h-4" />,
    color: "purple",
    description: "Gateway üzerinden tüm modellere erişim — API key otomatik",
    requiresKey: true,
    keySettingName: "lovable_api_key",
    keyLabel: "Lovable API Key",
    keyPlaceholder: "Lovable API key...",
    models: [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Hızlı, multimodal, dengeli", vision: true, speed: "fast", cost: "cheap", accuracy: 7, recommended: true },
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "En hızlı ve ucuz, basit işler", vision: true, speed: "fast", cost: "free", accuracy: 5 },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "En güçlü Gemini, karmaşık reasoning", vision: true, speed: "slow", cost: "expensive", accuracy: 9 },
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Yeni nesil, hız + kalite dengesi", vision: true, speed: "fast", cost: "cheap", accuracy: 8 },
      { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", description: "En yeni reasoning modeli", vision: true, speed: "medium", cost: "medium", accuracy: 9 },
      { id: "openai/gpt-5", name: "GPT-5", description: "En güçlü, en doğru, multimodal", vision: true, speed: "slow", cost: "expensive", accuracy: 10 },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Hızlı, güçlü, uygun fiyat", vision: true, speed: "medium", cost: "medium", accuracy: 8 },
      { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "En hızlı, yüksek hacim", vision: true, speed: "fast", cost: "cheap", accuracy: 6 },
      { id: "openai/gpt-5.2", name: "GPT-5.2", description: "Gelişmiş reasoning, en yeni", vision: true, speed: "medium", cost: "expensive", accuracy: 10 },
    ],
  },
  {
    engine: "dom_agent",
    label: "DOM Agent",
    icon: <Cpu className="w-4 h-4" />,
    color: "orange",
    description: "Edge function + DOM analizi, Lovable Gateway kullanır",
    requiresKey: true,
    keySettingName: "lovable_api_key",
    keyLabel: "Lovable API Key",
    keyPlaceholder: "Lovable API key...",
    models: [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "DOM + Vision, hızlı karar", vision: true, speed: "fast", cost: "cheap", accuracy: 7, recommended: true },
      { id: "google/gemini-2.5-flash-lite", name: "Flash Lite", description: "Sadece DOM, ultra hızlı", vision: false, speed: "fast", cost: "free", accuracy: 5 },
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Yeni nesil DOM analizi", vision: true, speed: "fast", cost: "cheap", accuracy: 8 },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Güçlü DOM reasoning", vision: true, speed: "medium", cost: "medium", accuracy: 8 },
      { id: "openai/gpt-5.2", name: "GPT-5.2", description: "En gelişmiş DOM analizi", vision: true, speed: "medium", cost: "expensive", accuracy: 10 },
    ],
  },
  {
    engine: "gemini",
    label: "Google Gemini",
    icon: <Sparkles className="w-4 h-4" />,
    color: "emerald",
    description: "Direkt Google API — kendi key'iniz ile",
    requiresKey: true,
    keySettingName: "gemini_api_key",
    keyLabel: "Gemini API Key",
    keyPlaceholder: "AIza... Gemini key",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Hızlı + multimodal", vision: true, speed: "fast", cost: "cheap", accuracy: 7, recommended: true },
      { id: "gemini-2.5-flash-lite", name: "Flash Lite", description: "En ucuz", vision: true, speed: "fast", cost: "free", accuracy: 5 },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "En güçlü, karmaşık görevler", vision: true, speed: "slow", cost: "expensive", accuracy: 9 },
    ],
  },
  {
    engine: "openai",
    label: "OpenAI",
    icon: <Brain className="w-4 h-4" />,
    color: "sky",
    description: "Gateway üzerinden OpenAI modelleri",
    requiresKey: true,
    keySettingName: "openai_api_key",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-... OpenAI key",
    models: [
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Hızlı, güçlü reasoning", vision: true, speed: "medium", cost: "medium", accuracy: 8, recommended: true },
      { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "En hızlı, yüksek hacim", vision: true, speed: "fast", cost: "cheap", accuracy: 6 },
      { id: "openai/gpt-5", name: "GPT-5", description: "En doğru, multimodal", vision: true, speed: "slow", cost: "expensive", accuracy: 10 },
      { id: "openai/gpt-5.2", name: "GPT-5.2", description: "Gelişmiş reasoning", vision: true, speed: "medium", cost: "expensive", accuracy: 10 },
    ],
  },
  {
    engine: "browser_use",
    label: "Browser Use",
    icon: <Globe className="w-4 h-4" />,
    color: "blue",
    description: "Cloud agent — tarayıcıyı uzaktan yönetir",
    requiresKey: true,
    keySettingName: "browser_use_api_key",
    keyLabel: "Browser Use API Key",
    keyPlaceholder: "Browser Use API key...",
    models: [
      { id: "bu-latest", name: "BU Latest", description: "Varsayılan, optimize edilmiş", vision: true, speed: "fast", cost: "cheap", accuracy: 7, recommended: true },
      { id: "bu-2-0", name: "BU 2.0 Premium", description: "En iyi, gelişmiş yetenekler", vision: true, speed: "medium", cost: "medium", accuracy: 9 },
    ],
  },
];

// --- Preset configurations ---
const PRESETS: { mode: PresetMode; label: string; icon: React.ReactNode; description: string; color: string; config: { temperature: number; maxTokens: number; vision: boolean; preferredSpeed: string } }[] = [
  {
    mode: "speed",
    label: "Hız",
    icon: <Rocket className="w-3.5 h-3.5" />,
    description: "En hızlı ayarlar, basit anketler",
    color: "text-emerald-600",
    config: { temperature: 0.05, maxTokens: 1024, vision: false, preferredSpeed: "fast" },
  },
  {
    mode: "balanced",
    label: "Dengeli",
    icon: <Scale className="w-3.5 h-3.5" />,
    description: "Hız ve doğruluk dengesi",
    color: "text-amber-600",
    config: { temperature: 0.1, maxTokens: 2048, vision: true, preferredSpeed: "fast" },
  },
  {
    mode: "accuracy",
    label: "Doğruluk",
    icon: <Target className="w-3.5 h-3.5" />,
    description: "Maksimum doğruluk, yavaş",
    color: "text-blue-600",
    config: { temperature: 0.15, maxTokens: 4096, vision: true, preferredSpeed: "medium" },
  },
  {
    mode: "custom",
    label: "Özel",
    icon: <Settings2 className="w-3.5 h-3.5" />,
    description: "Manuel ayarlar",
    color: "text-foreground",
    config: { temperature: 0.1, maxTokens: 2048, vision: true, preferredSpeed: "fast" },
  },
];

// --- Helpers ---
async function upsertSetting(key: string, value: string, label?: string) {
  const { data: existing } = await supabase.from("bot_settings").select("id").eq("key", key).limit(1);
  if (existing && existing.length > 0) {
    await supabase.from("bot_settings").update({ value }).eq("key", key);
  } else {
    await supabase.from("bot_settings").insert({ key, value, label: label || key });
  }
}

const speedIcon = (s: string) => s === "fast" ? "⚡" : s === "medium" ? "🔄" : "🐢";
const costLabel = (c: string) => {
  switch (c) {
    case "free": return { text: "Ücretsiz", cls: "text-emerald-600 border-emerald-500/30" };
    case "cheap": return { text: "Ucuz", cls: "text-emerald-600 border-emerald-500/30" };
    case "medium": return { text: "Orta", cls: "text-amber-600 border-amber-500/30" };
    case "expensive": return { text: "Pahalı", cls: "text-red-500 border-red-500/30" };
    default: return { text: c, cls: "" };
  }
};

const colorMap: Record<string, { border: string; bg: string; text: string; ring: string }> = {
  purple: { border: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", ring: "ring-purple-500/30" },
  orange: { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", ring: "ring-orange-500/30" },
  emerald: { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-500/30" },
  sky: { border: "border-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-400", ring: "ring-sky-500/30" },
  blue: { border: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", ring: "ring-blue-500/30" },
};

function AccuracyBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-px">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-3 rounded-[1px] transition-all ${
              i < value
                ? value >= 8 ? "bg-emerald-500" : value >= 5 ? "bg-amber-500" : "bg-red-400"
                : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <span className="text-[8px] font-mono tabular-nums text-muted-foreground">{value}/10</span>
    </div>
  );
}

// --- Component ---
interface Props {
  engine: QuizEngineType;
  onEngineChange: (engine: QuizEngineType) => void;
  apiKeys: Record<string, string>;
  onSaveKey: (settingKey: string, value: string, label: string) => Promise<void>;
}

export default function QuizEngineSelector({ engine, onEngineChange, apiKeys, onSaveKey }: Props) {
  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [visionEnabled, setVisionEnabled] = useState(true);
  const [presetMode, setPresetMode] = useState<PresetMode>("balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackModel, setFallbackModel] = useState("");
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelay, setRetryDelay] = useState(15);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, error: 0, rate: 100, avgTime: 0 });
  const [testing, setTesting] = useState(false);

  // Load saved settings + stats
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bot_settings").select("key, value");
      if (data) {
        const map = Object.fromEntries(data.map(d => [d.key, d.value]));
        setSelectedModel(map.quiz_model || "");
        setTemperature(parseFloat(map.quiz_temperature || "0.1"));
        setMaxTokens(parseInt(map.quiz_max_tokens || "2048"));
        setVisionEnabled(map.quiz_vision !== "false");
        setPresetMode((map.quiz_preset as PresetMode) || "balanced");
        setFallbackModel(map.quiz_fallback_model || "");
        setMaxRetries(parseInt(map.quiz_max_retries || "3"));
        setRetryDelay(parseInt(map.quiz_retry_delay || "15"));
        const keys: Record<string, string> = {};
        PROVIDERS.forEach(p => {
          keys[p.keySettingName] = map[p.keySettingName] || apiKeys[p.keySettingName] || "";
        });
        setKeyValues(keys);
      }
    })();
  }, [apiKeys]);

  // Load usage stats
  const loadStats = useCallback(async () => {
    const { data } = await supabase
      .from("quiz_tracking_logs")
      .select("status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data && data.length > 0) {
      const total = data.length;
      const errors = data.filter(l => l.status === "error").length;
      const successes = data.filter(l => l.status === "success").length;
      const rate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      // Calculate avg time between consecutive logs
      let avgMs = 0;
      if (data.length > 1) {
        const times = data.map(d => new Date(d.created_at).getTime());
        const diffs = times.slice(0, -1).map((t, i) => Math.abs(t - times[i + 1]));
        const validDiffs = diffs.filter(d => d > 0 && d < 120000);
        avgMs = validDiffs.length > 0 ? validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length : 0;
      }
      setStats({ total, success: successes, error: errors, rate, avgTime: Math.round(avgMs / 1000) });
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const activeProvider = PROVIDERS.find(p => p.engine === engine)!;
  const activeModel = activeProvider.models.find(m => m.id === selectedModel) || activeProvider.models.find(m => m.recommended) || activeProvider.models[0];

  const handleEngineSwitch = async (newEngine: QuizEngineType) => {
    onEngineChange(newEngine);
    const provider = PROVIDERS.find(p => p.engine === newEngine)!;
    const defaultModel = provider.models.find(m => m.recommended) || provider.models[0];
    setSelectedModel(defaultModel.id);
    await upsertSetting("quiz_engine", newEngine, "Quiz Motor");
    await upsertSetting("quiz_model", defaultModel.id, "Quiz Model");
    toast.success(`Motor: ${provider.label} — ${defaultModel.name}`);
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    setPresetMode("custom");
    await upsertSetting("quiz_model", modelId, "Quiz Model");
    await upsertSetting("quiz_preset", "custom", "Quiz Preset");
    const model = activeProvider.models.find(m => m.id === modelId);
    toast.success(`Model: ${model?.name || modelId}`);
  };

  const applyPreset = async (preset: typeof PRESETS[0]) => {
    setPresetMode(preset.mode);
    if (preset.mode === "custom") {
      setShowAdvanced(true);
      await upsertSetting("quiz_preset", "custom", "Quiz Preset");
      return;
    }
    const { temperature: t, maxTokens: mt, vision: v, preferredSpeed } = preset.config;
    setTemperature(t);
    setMaxTokens(mt);
    setVisionEnabled(v);

    // Auto-select best model for this preset
    const bestModel = activeProvider.models
      .filter(m => preferredSpeed === "fast" ? m.speed === "fast" : true)
      .sort((a, b) => preset.mode === "accuracy" ? b.accuracy - a.accuracy : a.accuracy - b.accuracy)[0]
      || activeModel;

    setSelectedModel(bestModel.id);

    await Promise.all([
      upsertSetting("quiz_preset", preset.mode, "Quiz Preset"),
      upsertSetting("quiz_temperature", t.toString(), "Quiz Temperature"),
      upsertSetting("quiz_max_tokens", mt.toString(), "Quiz Max Tokens"),
      upsertSetting("quiz_vision", v ? "true" : "false", "Quiz Vision"),
      upsertSetting("quiz_model", bestModel.id, "Quiz Model"),
    ]);
    toast.success(`Preset: ${preset.label} — ${bestModel.name}`);
  };

  const saveAdvancedSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        upsertSetting("quiz_temperature", temperature.toString(), "Quiz Temperature"),
        upsertSetting("quiz_max_tokens", maxTokens.toString(), "Quiz Max Tokens"),
        upsertSetting("quiz_vision", visionEnabled ? "true" : "false", "Quiz Vision"),
        upsertSetting("quiz_fallback_model", fallbackModel, "Quiz Fallback Model"),
        upsertSetting("quiz_max_retries", maxRetries.toString(), "Quiz Max Retries"),
        upsertSetting("quiz_retry_delay", retryDelay.toString(), "Quiz Retry Delay"),
        upsertSetting("quiz_preset", presetMode, "Quiz Preset"),
      ]);
      toast.success("Tüm ayarlar kaydedildi");
    } catch (err: any) {
      toast.error("Hata: " + err.message);
    }
    setSavingSettings(false);
  };

  const handleSaveKey = async (settingKey: string, label: string) => {
    setSavingKey(prev => ({ ...prev, [settingKey]: true }));
    try {
      await onSaveKey(settingKey, keyValues[settingKey] || "", label);
      toast.success(`${label} kaydedildi`);
    } catch (err: any) {
      toast.error("Hata: " + err.message);
    }
    setSavingKey(prev => ({ ...prev, [settingKey]: false }));
  };

  const testModel = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("dom-agent", {
        body: {
          elements: [{ index: 0, tag: "button", text: "Next", type: "submit", rect: { x: 100, y: 200, w: 80, h: 30 } }],
          task: "Click the Next button to continue the survey",
          pageText: "Question 1 of 10: What is your age? [18-24] [25-34] [35-44] [45+] [Next]",
          pageUrl: "https://test-survey.example.com/q1",
          step: 1,
          model: selectedModel || activeModel.id,
          temperature,
          maxTokens,
          visionEnabled,
        },
      });
      if (error) throw error;
      if (data?.actions?.length > 0) {
        toast.success(`✅ Model çalışıyor! ${data.actions.length} aksiyon döndü: ${data.actions[0].reason || "OK"}`);
      } else {
        toast.warning(`⚠️ Model yanıt verdi ama aksiyon yok: ${data?.message || "Boş yanıt"}`);
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes("429")) toast.error("❌ Rate limit — biraz bekleyin");
      else if (msg.includes("402")) toast.error("❌ Kredi yetersiz");
      else toast.error(`❌ Test başarısız: ${msg.slice(0, 80)}`);
    }
    setTesting(false);
  };

  // Get fallback-eligible models (different from primary)
  const fallbackModels = activeProvider.models.filter(m => m.id !== (selectedModel || activeModel.id));

  return (
    <TooltipProvider>
      <Card className="p-3 space-y-3">
        {/* Header with stats */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            Motor & Model Seçimi
          </h3>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-[8px] h-4 gap-0.5">
                  <BarChart3 className="w-2.5 h-2.5" />
                  %{stats.rate}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                Son 100 log: {stats.success} başarılı, {stats.error} hata
                {stats.avgTime > 0 && ` — Ort. ${stats.avgTime}s/adım`}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Preset Mode Selector */}
        <div className="grid grid-cols-4 gap-1">
          {PRESETS.map(p => (
            <button
              key={p.mode}
              onClick={() => applyPreset(p)}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md border text-[9px] transition-all ${
                presetMode === p.mode
                  ? `border-primary bg-primary/10 text-primary ring-1 ring-primary/30`
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
              }`}
              title={p.description}
            >
              <span className={presetMode === p.mode ? "text-primary" : p.color}>{p.icon}</span>
              <span className="font-semibold">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-5 gap-1">
          {PROVIDERS.map(p => {
            const c = colorMap[p.color];
            const isActive = engine === p.engine;
            const hasKey = !!keyValues[p.keySettingName];
            return (
              <Tooltip key={p.engine}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleEngineSwitch(p.engine)}
                    className={`relative flex flex-col items-center gap-0.5 p-1.5 rounded-md border text-[9px] transition-all ${
                      isActive
                        ? `${c.border} ${c.bg} ${c.text} ring-1 ${c.ring}`
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p.icon}
                    <span className="font-semibold leading-tight text-center">{p.label.split(" ")[0]}</span>
                    {/* Key status dot */}
                    <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${hasKey ? "bg-emerald-500" : "bg-red-400"}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px] max-w-[180px]">
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-muted-foreground">{p.description}</p>
                  <p className="mt-0.5">{p.models.length} model · API Key: {hasKey ? "✓" : "✗"}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Active Provider + Model Selection */}
        <div className={`rounded-md border p-2 space-y-2 ${colorMap[activeProvider.color].bg} ${colorMap[activeProvider.color].border}`}>
          <div className="flex items-center gap-1.5">
            {activeProvider.icon}
            <span className="text-[11px] font-semibold">{activeProvider.label}</span>
            <Badge variant="outline" className="text-[7px] h-3 ml-auto">
              {activeProvider.models.length} model
            </Badge>
          </div>

          {/* Model Selector */}
          <Select value={selectedModel || activeModel.id} onValueChange={handleModelChange}>
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-w-[320px]">
              {activeProvider.models.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-[11px] py-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span>{speedIcon(m.speed)}</span>
                      <span className="font-medium">{m.name}</span>
                      {m.recommended && <Badge className="text-[7px] h-3 bg-primary/10 text-primary border-primary/20">⭐</Badge>}
                      {m.vision && <ImageIcon className="w-3 h-3 text-muted-foreground" />}
                      <Badge variant="outline" className={`text-[7px] h-3 ml-auto ${costLabel(m.cost).cls}`}>
                        {costLabel(m.cost).text}
                      </Badge>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Stats Grid */}
          <div className="grid grid-cols-4 gap-1 text-[9px]">
            <div className="flex flex-col items-center bg-background/50 rounded px-1 py-1">
              <span className="text-[8px] text-muted-foreground">Hız</span>
              <span className="font-semibold">{speedIcon(activeModel.speed)} {activeModel.speed === "fast" ? "Hızlı" : activeModel.speed === "medium" ? "Orta" : "Yavaş"}</span>
            </div>
            <div className="flex flex-col items-center bg-background/50 rounded px-1 py-1">
              <span className="text-[8px] text-muted-foreground">Vision</span>
              <span className="font-semibold">{activeModel.vision ? "✅ Var" : "❌ Yok"}</span>
            </div>
            <div className="flex flex-col items-center bg-background/50 rounded px-1 py-1">
              <span className="text-[8px] text-muted-foreground">Maliyet</span>
              <Badge variant="outline" className={`text-[7px] h-3 ${costLabel(activeModel.cost).cls}`}>
                {costLabel(activeModel.cost).text}
              </Badge>
            </div>
            <div className="flex flex-col items-center bg-background/50 rounded px-1 py-1">
              <span className="text-[8px] text-muted-foreground">Doğruluk</span>
              <AccuracyBar value={activeModel.accuracy} />
            </div>
          </div>

          {/* Test Button */}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-[10px] gap-1"
            onClick={testModel}
            disabled={testing || !keyValues[activeProvider.keySettingName]}
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
            {testing ? "Test ediliyor..." : "Modeli Test Et"}
          </Button>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Key className="w-3 h-3" />
            {activeProvider.keyLabel}
          </Label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Input
                type={keyVisible[activeProvider.keySettingName] ? "text" : "password"}
                value={keyValues[activeProvider.keySettingName] || ""}
                onChange={(e) => setKeyValues(prev => ({ ...prev, [activeProvider.keySettingName]: e.target.value }))}
                placeholder={activeProvider.keyPlaceholder}
                className="h-7 text-[11px] pr-7 font-mono"
              />
              <Button
                variant="ghost" size="sm"
                className="absolute right-0 top-0 h-7 w-7 p-0"
                onClick={() => setKeyVisible(prev => ({ ...prev, [activeProvider.keySettingName]: !prev[activeProvider.keySettingName] }))}
              >
                {keyVisible[activeProvider.keySettingName] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
            <Button
              size="sm" className="h-7 px-2 text-[10px]"
              disabled={savingKey[activeProvider.keySettingName]}
              onClick={() => handleSaveKey(activeProvider.keySettingName, activeProvider.keyLabel)}
            >
              {savingKey[activeProvider.keySettingName] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-0.5 text-[10px]">
            <span className="text-muted-foreground">Durum</span>
            <span className={`font-medium ${keyValues[activeProvider.keySettingName] ? "text-emerald-600" : "text-destructive"}`}>
              {keyValues[activeProvider.keySettingName] ? "✓ Tanımlı" : "✗ Eksik"}
            </span>
          </div>
        </div>

        {/* Fallback Chain */}
        <button
          onClick={() => setShowFallback(!showFallback)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <ArrowRightLeft className="w-3 h-3" />
          <span>Fallback & Retry Zinciri</span>
          {showFallback ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>

        {showFallback && (
          <div className="space-y-2 border rounded-md p-2 bg-secondary/20">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 border border-primary/20">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span className="font-semibold">{activeModel.name}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex-1">
                <Select value={fallbackModel} onValueChange={setFallbackModel}>
                  <SelectTrigger className="h-6 text-[10px]">
                    <SelectValue placeholder="Fallback model seç..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-[10px]">Fallback yok</SelectItem>
                    {fallbackModels.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-[10px]">
                        {speedIcon(m.speed)} {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[8px] text-muted-foreground">
              Ana model başarısız olursa (rate limit, hata) otomatik olarak fallback modele geçer
            </p>

            {/* Retry Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground">Max Retry</Label>
                <div className="flex gap-1">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setMaxRetries(n)}
                      className={`flex-1 text-[9px] py-0.5 rounded border ${
                        maxRetries === n ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px] text-muted-foreground">Retry Delay</Label>
                <div className="flex gap-1">
                  {[10, 15, 20, 30].map(n => (
                    <button
                      key={n}
                      onClick={() => setRetryDelay(n)}
                      className={`flex-1 text-[9px] py-0.5 rounded border ${
                        retryDelay === n ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground"
                      }`}
                    >
                      {n}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Settings2 className="w-3 h-3" />
          <span>Gelişmiş Ayarlar</span>
          {showAdvanced ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t pt-2">
            {/* Temperature */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Temperature</Label>
                <span className="text-[10px] font-mono font-semibold tabular-nums">{temperature.toFixed(2)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([v]) => { setTemperature(v); setPresetMode("custom"); }}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-[8px] text-muted-foreground">
                <span>🎯 Kesin</span>
                <span>Dengeli</span>
                <span>🎲 Yaratıcı</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Max Tokens</Label>
              <div className="flex gap-1">
                {[1024, 2048, 4096].map(t => (
                  <button
                    key={t}
                    onClick={() => { setMaxTokens(t); setPresetMode("custom"); }}
                    className={`flex-1 text-[10px] py-1 rounded border transition-all ${
                      maxTokens === t
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <Input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => { setMaxTokens(parseInt(e.target.value) || 2048); setPresetMode("custom"); }}
                  className="w-16 h-7 text-[10px] font-mono"
                  min={256}
                  max={8192}
                />
              </div>
            </div>

            {/* Vision Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-muted-foreground" />
                <Label className="text-[10px]">Vision (Screenshot)</Label>
              </div>
              <Switch
                checked={visionEnabled}
                onCheckedChange={(v) => { setVisionEnabled(v); setPresetMode("custom"); }}
                className="scale-75"
              />
            </div>

            {/* Save All Button */}
            <Button
              size="sm" className="w-full h-7 text-[10px]"
              onClick={saveAdvancedSettings}
              disabled={savingSettings}
            >
              {savingSettings ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Tüm Ayarları Kaydet
            </Button>
          </div>
        )}

        {/* Current Config Summary */}
        <div className="grid grid-cols-2 gap-1 text-[9px]">
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-0.5">
            <span className="text-muted-foreground">Temp</span>
            <span className="font-mono font-semibold">{temperature.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-0.5">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono font-semibold">{maxTokens}</span>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-0.5">
            <span className="text-muted-foreground">Vision</span>
            <span className="font-semibold">{visionEnabled ? "✅" : "❌"}</span>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-0.5">
            <span className="text-muted-foreground">Fallback</span>
            <span className="font-semibold truncate max-w-[60px]">
              {fallbackModel && fallbackModel !== "none"
                ? activeProvider.models.find(m => m.id === fallbackModel)?.name || "—"
                : "—"}
            </span>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}

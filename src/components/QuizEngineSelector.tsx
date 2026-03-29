import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
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
  Gauge, Sparkles, Timer, ImageIcon, MessageSquare,
  Settings2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// --- Types ---
export type QuizEngineType = "lovable_ai" | "gemini" | "openai" | "dom_agent" | "browser_use";

interface ModelOption {
  id: string;
  name: string;
  description: string;
  vision: boolean;
  speed: "fast" | "medium" | "slow";
  cost: "free" | "cheap" | "medium" | "expensive";
  recommended?: boolean;
}

interface ProviderConfig {
  engine: QuizEngineType;
  label: string;
  icon: React.ReactNode;
  color: string;          // border/bg accent
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
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Hızlı, multimodal, dengeli", vision: true, speed: "fast", cost: "cheap", recommended: true },
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "En hızlı ve ucuz, basit işler", vision: true, speed: "fast", cost: "free" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "En güçlü Gemini, karmaşık reasoning", vision: true, speed: "slow", cost: "expensive" },
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", description: "Yeni nesil, hız + kalite dengesi", vision: true, speed: "fast", cost: "cheap" },
      { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", description: "En yeni reasoning modeli", vision: true, speed: "medium", cost: "medium" },
      { id: "openai/gpt-5", name: "GPT-5", description: "En güçlü, en doğru, multimodal", vision: true, speed: "slow", cost: "expensive" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Hızlı, güçlü, uygun fiyat", vision: true, speed: "medium", cost: "medium" },
      { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "En hızlı, yüksek hacim", vision: true, speed: "fast", cost: "cheap" },
      { id: "openai/gpt-5.2", name: "GPT-5.2", description: "Gelişmiş reasoning, en yeni", vision: true, speed: "medium", cost: "expensive" },
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
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "DOM + Vision, hızlı karar", vision: true, speed: "fast", cost: "cheap", recommended: true },
      { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Sadece DOM, ultra hızlı", vision: false, speed: "fast", cost: "free" },
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", description: "Yeni nesil DOM analizi", vision: true, speed: "fast", cost: "cheap" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Güçlü DOM reasoning", vision: true, speed: "medium", cost: "medium" },
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
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Hızlı + multimodal", vision: true, speed: "fast", cost: "cheap", recommended: true },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "En ucuz", vision: true, speed: "fast", cost: "free" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "En güçlü, karmaşık görevler", vision: true, speed: "slow", cost: "expensive" },
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
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Hızlı, güçlü reasoning", vision: true, speed: "medium", cost: "medium", recommended: true },
      { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "En hızlı, yüksek hacim", vision: true, speed: "fast", cost: "cheap" },
      { id: "openai/gpt-5", name: "GPT-5", description: "En doğru, multimodal", vision: true, speed: "slow", cost: "expensive" },
      { id: "openai/gpt-5.2", name: "GPT-5.2", description: "Gelişmiş reasoning", vision: true, speed: "medium", cost: "expensive" },
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
      { id: "bu-latest", name: "BU Latest", description: "Varsayılan, optimize edilmiş", vision: true, speed: "fast", cost: "cheap", recommended: true },
      { id: "bu-2-0", name: "BU 2.0 Premium", description: "En iyi, gelişmiş yetenekler", vision: true, speed: "medium", cost: "medium" },
    ],
  },
];

// --- Helper functions ---
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<QuizEngineType | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Load saved settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bot_settings").select("key, value");
      if (data) {
        const map = Object.fromEntries(data.map(d => [d.key, d.value]));
        setSelectedModel(map.quiz_model || "");
        setTemperature(parseFloat(map.quiz_temperature || "0.1"));
        setMaxTokens(parseInt(map.quiz_max_tokens || "2048"));
        setVisionEnabled(map.quiz_vision !== "false");
        // Populate key values
        const keys: Record<string, string> = {};
        PROVIDERS.forEach(p => {
          keys[p.keySettingName] = map[p.keySettingName] || apiKeys[p.keySettingName] || "";
        });
        setKeyValues(keys);
      }
    })();
  }, [apiKeys]);

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
    await upsertSetting("quiz_model", modelId, "Quiz Model");
    const model = activeProvider.models.find(m => m.id === modelId);
    toast.success(`Model: ${model?.name || modelId}`);
  };

  const saveAdvancedSettings = async () => {
    setSavingSettings(true);
    try {
      await upsertSetting("quiz_temperature", temperature.toString(), "Quiz Temperature");
      await upsertSetting("quiz_max_tokens", maxTokens.toString(), "Quiz Max Tokens");
      await upsertSetting("quiz_vision", visionEnabled ? "true" : "false", "Quiz Vision");
      toast.success("Gelişmiş ayarlar kaydedildi");
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

  return (
    <Card className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          Motor & Model Seçimi
        </h3>
        <Badge variant="outline" className="text-[8px] h-4">
          {activeProvider.label} / {activeModel.name}
        </Badge>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-5 gap-1">
        {PROVIDERS.map(p => {
          const c = colorMap[p.color];
          const isActive = engine === p.engine;
          return (
            <button
              key={p.engine}
              onClick={() => handleEngineSwitch(p.engine)}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md border text-[9px] transition-all ${
                isActive
                  ? `${c.border} ${c.bg} ${c.text} ring-1 ${c.ring}`
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
              }`}
              title={p.description}
            >
              {p.icon}
              <span className="font-semibold leading-tight text-center">{p.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Active Provider Info */}
      <div className={`rounded-md border p-2 space-y-2 ${colorMap[activeProvider.color].bg} ${colorMap[activeProvider.color].border}`}>
        <div className="flex items-center gap-1.5">
          {activeProvider.icon}
          <span className="text-[11px] font-semibold">{activeProvider.label}</span>
          <span className="text-[9px] text-muted-foreground ml-auto">{activeProvider.description.slice(0, 40)}...</span>
        </div>

        {/* Model Selector */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Model
          </Label>
          <Select value={selectedModel || activeModel.id} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeProvider.models.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-[11px]">
                  <div className="flex items-center gap-2 w-full">
                    <span>{speedIcon(m.speed)}</span>
                    <span className="font-medium">{m.name}</span>
                    {m.recommended && <Badge className="text-[7px] h-3 bg-primary/10 text-primary border-primary/20">Önerilen</Badge>}
                    {m.vision && <ImageIcon className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Model Info */}
        <div className="grid grid-cols-3 gap-1 text-[9px]">
          <div className="flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5">
            <Gauge className="w-3 h-3" />
            <span>{speedIcon(activeModel.speed)} {activeModel.speed === "fast" ? "Hızlı" : activeModel.speed === "medium" ? "Orta" : "Yavaş"}</span>
          </div>
          <div className="flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5">
            <ImageIcon className="w-3 h-3" />
            <span>{activeModel.vision ? "Vision ✓" : "Metin"}</span>
          </div>
          <div className="flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5">
            <Badge variant="outline" className={`text-[8px] h-3.5 ${costLabel(activeModel.cost).cls}`}>
              {costLabel(activeModel.cost).text}
            </Badge>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground">{activeModel.description}</p>
      </div>

      {/* API Key Section */}
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
              <Label className="text-[10px] text-muted-foreground">Temperature (Yaratıcılık)</Label>
              <span className="text-[10px] font-mono font-semibold tabular-nums">{temperature.toFixed(2)}</span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
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
            <Label className="text-[10px] text-muted-foreground">Max Tokens (Yanıt Uzunluğu)</Label>
            <div className="flex gap-1.5">
              {[1024, 2048, 4096].map(t => (
                <button
                  key={t}
                  onClick={() => setMaxTokens(t)}
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
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
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
              <Label className="text-[10px] text-muted-foreground">Vision (Ekran Görüntüsü)</Label>
            </div>
            <Switch
              checked={visionEnabled}
              onCheckedChange={setVisionEnabled}
              className="scale-75"
            />
          </div>
          <p className="text-[8px] text-muted-foreground -mt-2">
            Kapalıyken sadece DOM/metin analizi yapılır — daha hızlı ama daha az doğru
          </p>

          {/* Save Button */}
          <Button
            size="sm" className="w-full h-7 text-[10px]"
            onClick={saveAdvancedSettings}
            disabled={savingSettings}
          >
            {savingSettings ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Gelişmiş Ayarları Kaydet
          </Button>
        </div>
      )}
    </Card>
  );
}

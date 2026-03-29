import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  Network, Globe, Wifi, MapPin, Activity, Shield, Loader2,
  Clock, RefreshCw, Save, Eye, EyeOff, Key, Cpu, Zap
} from "lucide-react";
import QuizEngineSelector, { type QuizEngineType } from "@/components/QuizEngineSelector";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  return `${Math.floor(hr / 24)}g önce`;
}

async function upsertSetting(key: string, value: string, label?: string) {
  const { data: existing } = await supabase.from("bot_settings").select("id").eq("key", key).limit(1);
  if (existing && existing.length > 0) {
    await supabase.from("bot_settings").update({ value }).eq("key", key);
  } else {
    await supabase.from("bot_settings").insert({ key, value, label: label || key });
  }
}

export default function QuizSidebarContent() {
  const [proxyHost, setProxyHost] = useState("—");
  const [proxyPort, setProxyPort] = useState("1000");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
  const [proxyPassVisible, setProxyPassVisible] = useState(false);
  const [proxyCountry, setProxyCountry] = useState("US");
  const [proxyRegion, setProxyRegion] = useState("");
  const [quizProxyEnabled, setQuizProxyEnabled] = useState(true);
  const [captchaProvider, setCaptchaProvider] = useState("2captcha");
  const [captchaApiKey, setCaptchaApiKey] = useState("");
  const [captchaKeyVisible, setCaptchaKeyVisible] = useState(false);
  const [savingCaptchaKey, setSavingCaptchaKey] = useState(false);
  const [capsolverApiKey, setCapsolverApiKey] = useState("");
  const [capsolverKeyVisible, setCapsolverKeyVisible] = useState(false);
  const [savingCapsolverKey, setSavingCapsolverKey] = useState(false);

  // Engine selection
  const [quizEngine, setQuizEngine] = useState<QuizEngineType>("gemini");

  // API keys
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);

  const [browserUseKeyValue, setBrowserUseKeyValue] = useState("");
  const [browserUseKeyVisible, setBrowserUseKeyVisible] = useState(false);
  const [savingBuKey, setSavingBuKey] = useState(false);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false);
  const [savingOpenaiKey, setSavingOpenaiKey] = useState(false);

  const [lovableApiKey, setLovableApiKey] = useState("");
  const [lovableKeyVisible, setLovableKeyVisible] = useState(false);
  const [savingLovableKey, setSavingLovableKey] = useState(false);

  const [quizStatus, setQuizStatus] = useState<"idle" | "running">("idle");
  const [lastLog, setLastLog] = useState<{ message: string; time: string; status: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, success: 0, error: 0, successRate: 100 });
  const [stepTimeout, setStepTimeout] = useState("30");

  // Evomi API data
  const [evomiCountries, setEvomiCountries] = useState<{ code: string; name: string }[]>([]);
  const [evomiCities, setEvomiCities] = useState<{ name: string; region?: string }[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const [regionPopoverOpen, setRegionPopoverOpen] = useState(false);
  const [evomiApiKey, setEvomiApiKey] = useState("");
  const [evomiKeyVisible, setEvomiKeyVisible] = useState(false);
  const [savingEvomiKey, setSavingEvomiKey] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("bot_settings").select("key, value");
    if (data) {
      const map = Object.fromEntries(data.map(d => [d.key, d.value]));
      setProxyHost(map.proxy_host || "core-residential.evomi-proxy.com");
      setProxyPort(map.proxy_port || "1000");
      setProxyUsername(map.proxy_username || "");
      setProxyPassword(map.proxy_password || "");
      setProxyCountry(map.quiz_proxy_country || map.proxy_country || "US");
      setProxyRegion(map.quiz_proxy_region || "");
      setQuizProxyEnabled(map.quiz_proxy_enabled !== "false");
      setCaptchaProvider(map.captcha_provider || "2captcha");
      setCaptchaApiKey(map.captcha_api_key || "");
      setCapsolverApiKey(map.capsolver_api_key || "");
      setQuizEngine((map.quiz_engine as QuizEngineType) || "gemini");
      setGeminiApiKey(map.gemini_api_key || "");
      setBrowserUseKeyValue(map.browser_use_api_key || "");
      setOpenaiApiKey(map.openai_api_key || "");
      setLovableApiKey(map.lovable_api_key || "");
      setEvomiApiKey(map.evomi_api_key || "");
      setStepTimeout(map.quiz_step_timeout || "30");
      setSettingsLoaded(true);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const { data: logs } = await supabase
      .from("quiz_tracking_logs")
      .select("message, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1);
    if (logs && logs.length > 0) {
      setLastLog({ message: logs[0].message || "", time: logs[0].created_at, status: logs[0].status });
    }

    const { data: recentLogs } = await supabase
      .from("quiz_tracking_logs")
      .select("status")
      .order("created_at", { ascending: false })
      .limit(50);
    const total = recentLogs?.length || 0;
    const errors = recentLogs?.filter(l => l.status === "error").length || 0;
    const successes = recentLogs?.filter(l => l.status === "success").length || 0;
    const rate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
    setStats({ total, success: successes, error: errors, successRate: rate });

    const { data: running } = await supabase
      .from("link_analyses")
      .select("id")
      .eq("status", "quiz_running")
      .limit(1);
    setQuizStatus(running && running.length > 0 ? "running" : "idle");
  }, []);

  useEffect(() => {
    loadSettings();
    loadLogs();
    const ch = supabase
      .channel("quiz-sidebar-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_settings" }, () => loadSettings())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_tracking_logs" }, () => loadLogs())
      .on("postgres_changes", { event: "*", schema: "public", table: "link_analyses" }, () => loadLogs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadSettings, loadLogs]);

  const fetchEvomiRegions = async (country?: string) => {
    setLoadingRegions(true);
    try {
      const targetCountry = country || proxyCountry || "US";
      console.log("[QuizSidebar] Evomi regions çekiliyor, ülke:", targetCountry);
      const { data, error } = await supabase.functions.invoke("evomi-regions", {
        body: { country: targetCountry },
      });
      console.log("[QuizSidebar] Evomi response:", JSON.stringify(data)?.slice(0, 300), "error:", error);
      if (error) throw error;
      if (data?.ok) {
        const cityList = (data.cities || data.regions || []).map((c: any) => 
          typeof c === "string" ? { name: c } : { name: c.name || c.city || c.id, region: c.region, id: c.id }
        );
        setEvomiCities(cityList);
        const countriesObj = data.countries || {};
        const countryList = Object.entries(countriesObj).map(([code, name]) => ({
          code: code.toUpperCase(),
          name: String(name),
        }));
        countryList.sort((a, b) => a.name.localeCompare(b.name));
        if (countryList.length > 0) setEvomiCountries(countryList);
        console.log("[QuizSidebar] Ülkeler:", countryList.length, "Şehirler:", cityList.length);
      } else {
        console.error("[QuizSidebar] Evomi ok=false:", data?.error || JSON.stringify(data)?.slice(0, 200));
        if (data?.error) toast.error("Evomi: " + data.error);
      }
    } catch (err: any) {
      console.error("[QuizSidebar] Evomi hatası:", err);
      toast.error("Evomi API hatası: " + (err.message || String(err)));
    }
    setLoadingRegions(false);
  };

  // Settings yüklendikten sonra ve ülke değiştiğinde otomatik çek
  useEffect(() => {
    if (settingsLoaded && quizProxyEnabled) {
      fetchEvomiRegions(proxyCountry && proxyCountry !== "—" ? proxyCountry : "US");
    }
  }, [settingsLoaded, quizProxyEnabled, proxyCountry]);

  const toggleQuizProxy = async () => {
    const newVal = !quizProxyEnabled;
    setQuizProxyEnabled(newVal);
    await upsertSetting("quiz_proxy_enabled", newVal ? "true" : "false", "Quiz Proxy Aktif");
    toast.success(newVal ? "Quiz proxy aktif" : "Quiz proxy kapalı");
  };

  const handleCountryChange = (code: string) => {
    setProxyCountry(code);
    setProxyRegion("");
    setDirty(true);
    setCountryPopoverOpen(false);
  };

  const handleRegionChange = (city: string) => {
    setProxyRegion(city);
    setDirty(true);
    setRegionPopoverOpen(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await upsertSetting("quiz_proxy_country", proxyCountry, "Quiz Proxy Ülke");
      await upsertSetting("quiz_proxy_region", proxyRegion, "Quiz Proxy Bölge");
      await upsertSetting("proxy_username", proxyUsername, "Proxy Kullanıcı Adı");
      await upsertSetting("proxy_password", proxyPassword, "Proxy Şifre");
      setDirty(false);
      toast.success("Quiz proxy ayarları kaydedildi");
    } catch (err: any) {
      toast.error("Kaydetme hatası: " + err.message);
    }
    setSaving(false);
  };

  const handleEngineSaveKey = async (settingKey: string, value: string, label: string) => {
    await upsertSetting(settingKey, value, label);
  };

  const healthColor = stats.successRate >= 80 ? "text-emerald-500" : stats.successRate >= 50 ? "text-amber-500" : "text-destructive";
  const selectedCountryName = evomiCountries.find(c => c.code === proxyCountry)?.name || proxyCountry;

  return (
    <div className="p-3 space-y-3">
      {/* Bot Status */}
      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${quizStatus === "running" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <h3 className="text-xs font-semibold text-foreground">Quiz Bot v4.0</h3>
          </div>
          <Badge className={`text-[10px] ${quizStatus === "running" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-secondary text-muted-foreground"}`}>
            {quizStatus === "running" ? "Çalışıyor" : "Bekliyor"}
          </Badge>
        </div>

        {lastLog && (
          <div className="rounded-md border bg-card p-2 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Son Aktivite
              </span>
              <span className="text-[10px] text-foreground/70 tabular-nums">
                {timeAgo(lastLog.time)}
              </span>
            </div>
            <p className="text-[10px] text-foreground/80 truncate">
              {lastLog.message?.replace("[QUIZ] ", "").slice(0, 80)}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Başarı Oranı (son 50)
            </span>
            <span className={`text-xs font-bold tabular-nums ${healthColor}`}>
              %{stats.successRate}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                stats.successRate >= 80 ? "bg-emerald-500" :
                stats.successRate >= 50 ? "bg-amber-500" : "bg-destructive"
              }`}
              style={{ width: `${stats.successRate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{stats.success} başarılı</span>
            <span>{stats.error} hata</span>
          </div>
        </div>
      </Card>

      {/* Engine & Model Selection */}
      <QuizEngineSelector
        engine={quizEngine}
        onEngineChange={(e) => setQuizEngine(e)}
        apiKeys={{
          lovable_api_key: lovableApiKey,
          gemini_api_key: geminiApiKey,
          openai_api_key: openaiApiKey,
          browser_use_api_key: browserUseKeyValue,
        }}
        onSaveKey={async (key, value, label) => {
          await upsertSetting(key, value, label);
          // Sync local state
          if (key === "lovable_api_key") setLovableApiKey(value);
          if (key === "gemini_api_key") setGeminiApiKey(value);
          if (key === "openai_api_key") setOpenaiApiKey(value);
          if (key === "browser_use_api_key") setBrowserUseKeyValue(value);
        }}
      />

      {/* Step Timeout */}
      <Card className="p-3 space-y-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          Adım Zaman Aşımı
        </h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={10}
            max={120}
            value={stepTimeout}
            onChange={(e) => { setStepTimeout(e.target.value); setDirty(true); }}
            className="h-7 text-[11px] w-20 font-mono"
          />
          <span className="text-[10px] text-muted-foreground">saniye</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] ml-auto"
            onClick={async () => {
              await upsertSetting("quiz_step_timeout", stepTimeout, "Adım Zaman Aşımı (sn)");
              toast.success("Zaman aşımı: " + stepTimeout + "s");
            }}
          >
            <Save className="w-3 h-3 mr-1" />
            Kaydet
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground">
          Her adım bu sürede tamamlanmazsa bot yeniden dener (10-120sn)
        </p>
      </Card>

      {/* Proxy Settings */}
      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-muted-foreground" />
            Proxy Ayarları
          </h3>
          <Switch checked={quizProxyEnabled} onCheckedChange={toggleQuizProxy} />
        </div>

        {quizProxyEnabled && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Proxy Türü
              </Label>
              <div className="flex h-7 items-center justify-between rounded-md border bg-secondary/40 px-2.5 text-[11px]">
                <span className="font-medium text-foreground">🏠 Core Residential</span>
                <span className="font-mono text-muted-foreground">Port {proxyPort}</span>
              </div>
            </div>

            <div className="rounded-md border bg-card p-2 space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wifi className="w-3 h-3" />
                <span className="text-[10px]">Host</span>
              </div>
              <p className="text-[10px] font-mono font-semibold text-foreground truncate">
                {proxyHost}
              </p>
            </div>

            {/* Evomi API Key */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Key className="w-3 h-3" />
                Evomi API Key
              </Label>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Input
                    type={evomiKeyVisible ? "text" : "password"}
                    value={evomiApiKey}
                    onChange={(e) => setEvomiApiKey(e.target.value)}
                    placeholder="Evomi API key girin..."
                    className="h-7 text-[11px] pr-7 font-mono"
                  />
                  <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-7 w-7 p-0" onClick={() => setEvomiKeyVisible(!evomiKeyVisible)}>
                    {evomiKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </div>
                <Button
                  size="sm" className="h-7 px-2 text-[10px]" disabled={savingEvomiKey}
                  onClick={async () => {
                    setSavingEvomiKey(true);
                    try {
                      await upsertSetting("evomi_api_key", evomiApiKey, "Evomi API Key");
                      toast.success("Evomi API key kaydedildi");
                      // Key kaydedilince ülkeleri otomatik çek
                      fetchEvomiRegions(proxyCountry);
                    } catch (err: any) { toast.error("Hata: " + err.message); }
                    setSavingEvomiKey(false);
                  }}
                >
                  {savingEvomiKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
              </div>
              <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 text-[10px]">
                <span className="text-muted-foreground">Durum</span>
                <span className={`font-medium ${evomiApiKey ? "text-emerald-600" : "text-destructive"}`}>
                  {evomiApiKey ? "✓ Tanımlı" : "✗ Eksik"}
                </span>
              </div>
            </div>

            {/* Proxy Username */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Proxy Kullanıcı Adı</Label>
              <Input
                value={proxyUsername}
                onChange={(e) => { setProxyUsername(e.target.value); setDirty(true); }}
                placeholder="evomi_user"
                className="h-7 text-[11px] font-mono"
              />
            </div>

            {/* Proxy Password */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Proxy Şifre</Label>
              <div className="relative">
                <Input
                  type={proxyPassVisible ? "text" : "password"}
                  value={proxyPassword}
                  onChange={(e) => { setProxyPassword(e.target.value); setDirty(true); }}
                  placeholder="proxy şifre"
                  className="h-7 text-[11px] font-mono pr-7"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-7 w-7 p-0"
                  onClick={() => setProxyPassVisible(!proxyPassVisible)}
                >
                  {proxyPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {/* Proxy durum */}
            <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 text-[10px]">
              <span className="text-muted-foreground">Proxy Auth</span>
              <span className={`font-medium ${proxyUsername && proxyPassword ? "text-emerald-600" : "text-destructive"}`}>
                {proxyUsername && proxyPassword ? "✓ Tanımlı" : "✗ Eksik"}
              </span>
            </div>

            {/* Country Picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Proxy Ülke
              </Label>
              <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-8 text-xs"
                    onClick={() => {
                      if (evomiCountries.length === 0) fetchEvomiRegions(proxyCountry);
                      setCountryPopoverOpen(!countryPopoverOpen);
                    }}
                  >
                    <span className="truncate">{selectedCountryName} ({proxyCountry})</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Ülke ara..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>
                        {loadingRegions ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...
                          </span>
                        ) : "Ülke bulunamadı"}
                      </CommandEmpty>
                      <CommandGroup>
                        {evomiCountries.map((c) => (
                          <CommandItem
                            key={c.code}
                            value={c.name + " " + c.code}
                            onSelect={() => handleCountryChange(c.code)}
                            className="text-xs"
                          >
                            <Check className={`mr-1.5 h-3 w-3 ${proxyCountry === c.code ? "opacity-100" : "opacity-0"}`} />
                            {c.name} <span className="ml-auto text-muted-foreground font-mono text-[10px]">{c.code}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Region Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Proxy Bölge (Şehir)
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => fetchEvomiRegions(proxyCountry)}
                  disabled={loadingRegions}
                >
                  {loadingRegions ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </div>
              <Popover open={regionPopoverOpen} onOpenChange={setRegionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-8 text-xs"
                  >
                    <span className="truncate capitalize">{proxyRegion || "Tüm bölgeler (rastgele)"}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Şehir ara..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>
                        {loadingRegions ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...
                          </span>
                        ) : "Şehir bulunamadı"}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__all__"
                          onSelect={() => handleRegionChange("")}
                          className="text-xs"
                        >
                          <Check className={`mr-1.5 h-3 w-3 ${!proxyRegion ? "opacity-100" : "opacity-0"}`} />
                          Tüm bölgeler (rastgele)
                        </CommandItem>
                        {evomiCities.map((c, i) => (
                          <CommandItem
                            key={c.name + i}
                            value={c.name}
                            onSelect={() => handleRegionChange(c.name.toLowerCase())}
                            className="text-xs"
                          >
                            <Check className={`mr-1.5 h-3 w-3 ${proxyRegion === c.name.toLowerCase() ? "opacity-100" : "opacity-0"}`} />
                            <span className="capitalize">{c.name}</span>
                            {c.region && <span className="ml-auto text-muted-foreground text-[10px]">{c.region}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {dirty && (
              <Button
                onClick={saveSettings}
                disabled={saving}
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
              </Button>
            )}
          </>
        )}
      </Card>

      {/* CAPTCHA Settings */}
      <Card className="p-3 space-y-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
          CAPTCHA Ayarları
        </h3>

        {/* Provider Selection */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Sağlayıcı</Label>
          <div className="grid grid-cols-3 gap-1">
            {(["2captcha", "capsolver", "auto"] as const).map((prov) => (
              <button
                key={prov}
                onClick={async () => {
                  setCaptchaProvider(prov);
                  await upsertSetting("captcha_provider", prov, "CAPTCHA Sağlayıcı");
                  toast.success("CAPTCHA sağlayıcı: " + prov);
                }}
                className={`text-[10px] py-1.5 rounded-md border transition-all font-medium ${
                  captchaProvider === prov
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {prov === "auto" ? "Auto" : prov === "2captcha" ? "2Captcha" : "Capsolver"}
              </button>
            ))}
          </div>
        </div>

        {/* 2captcha API Key */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">2Captcha API Key</Label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Input
                type={captchaKeyVisible ? "text" : "password"}
                value={captchaApiKey}
                onChange={(e) => setCaptchaApiKey(e.target.value)}
                placeholder="2captcha API key..."
                className="h-7 text-[11px] pr-7 font-mono"
              />
              <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-7 w-7 p-0" onClick={() => setCaptchaKeyVisible(!captchaKeyVisible)}>
                {captchaKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
            <Button
              size="sm" className="h-7 px-2 text-[10px]" disabled={savingCaptchaKey}
              onClick={async () => {
                setSavingCaptchaKey(true);
                try {
                  await upsertSetting("captcha_api_key", captchaApiKey, "2Captcha API Key");
                  toast.success("2Captcha API key kaydedildi");
                } catch (err: any) { toast.error("Hata: " + err.message); }
                setSavingCaptchaKey(false);
              }}
            >
              {savingCaptchaKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 text-[10px]">
            <span className="text-muted-foreground">Durum</span>
            <span className={`font-medium ${captchaApiKey ? "text-emerald-600" : "text-destructive"}`}>
              {captchaApiKey ? "✓ Tanımlı" : "✗ Eksik"}
            </span>
          </div>
        </div>

        {/* Capsolver API Key */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Capsolver API Key</Label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Input
                type={capsolverKeyVisible ? "text" : "password"}
                value={capsolverApiKey}
                onChange={(e) => setCapsolverApiKey(e.target.value)}
                placeholder="Capsolver API key..."
                className="h-7 text-[11px] pr-7 font-mono"
              />
              <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-7 w-7 p-0" onClick={() => setCapsolverKeyVisible(!capsolverKeyVisible)}>
                {capsolverKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
            <Button
              size="sm" className="h-7 px-2 text-[10px]" disabled={savingCapsolverKey}
              onClick={async () => {
                setSavingCapsolverKey(true);
                try {
                  await upsertSetting("capsolver_api_key", capsolverApiKey, "Capsolver API Key");
                  toast.success("Capsolver API key kaydedildi");
                } catch (err: any) { toast.error("Hata: " + err.message); }
                setSavingCapsolverKey(false);
              }}
            >
              {savingCapsolverKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </Button>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 text-[10px]">
            <span className="text-muted-foreground">Durum</span>
            <span className={`font-medium ${capsolverApiKey ? "text-emerald-600" : "text-destructive"}`}>
              {capsolverApiKey ? "✓ Tanımlı" : "✗ Eksik"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Globe, Plus, Trash2, Save, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface VfsCountry {
  id: string;
  value: string;
  label: string;
  flag: string;
  code: string;
  sort_order: number;
  is_active: boolean;
}

interface BotSetting {
  id: string;
  key: string;
  value: string;
  label: string | null;
}

export default function BotSettingsPanel() {
  const [countries, setCountries] = useState<VfsCountry[]>([]);
  const [settings, setSettings] = useState<BotSetting[]>([]);
  const [newCountry, setNewCountry] = useState({ value: "", label: "", flag: "", code: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    const ch = supabase
      .channel("bot-settings-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "vfs_countries" }, () => loadCountries())
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_settings" }, () => loadSettings())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadData = () => { loadCountries(); loadSettings(); };

  const loadCountries = async () => {
    const { data } = await supabase.from("vfs_countries").select("*").order("sort_order");
    if (data) setCountries(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from("bot_settings").select("*");
    if (data) setSettings(data);
  };

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value || "";

  const updateSetting = async (key: string, value: string) => {
    await supabase.from("bot_settings").update({ value }).eq("key", key);
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
  };

  const addCountry = async () => {
    if (!newCountry.value || !newCountry.label || !newCountry.code) {
      toast.error("Değer, isim ve VFS kodu zorunlu");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vfs_countries").insert({
      ...newCountry,
      sort_order: countries.length + 1,
    });
    if (error) {
      toast.error("Eklenemedi: " + error.message);
    } else {
      toast.success(`${newCountry.label} eklendi`);
      setNewCountry({ value: "", label: "", flag: "", code: "" });
      setShowAddForm(false);
    }
    setSaving(false);
  };

  const toggleCountry = async (id: string, active: boolean) => {
    await supabase.from("vfs_countries").update({ is_active: active }).eq("id", id);
  };

  const deleteCountry = async (id: string, label: string) => {
    await supabase.from("vfs_countries").delete().eq("id", id);
    toast.info(`${label} silindi`);
  };

  const proxyCountries = [
    { code: "TR", label: "🇹🇷 Türkiye" },
    { code: "PL", label: "🇵🇱 Polonya" },
    { code: "DE", label: "🇩🇪 Almanya" },
    { code: "NL", label: "🇳🇱 Hollanda" },
    { code: "FR", label: "🇫🇷 Fransa" },
    { code: "GB", label: "🇬🇧 İngiltere" },
    { code: "US", label: "🇺🇸 ABD" },
  ];

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Bot & Ülke Ayarları</h3>
      </div>

      {/* Proxy Country */}
      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-muted-foreground" />
          Proxy Ülkesi (Evomi IP Lokasyonu)
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {proxyCountries.map(pc => (
            <button
              key={pc.code}
              onClick={() => updateSetting("proxy_country", pc.code)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                getSetting("proxy_country") === pc.code
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {pc.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Bot bu ülkeden residential IP alacak. Değişiklik anında sunucuya iletilir.
        </p>
      </div>

      {/* Proxy Host/Port */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Proxy Host</Label>
          <Input
            className="h-7 text-xs font-mono"
            value={getSetting("proxy_host")}
            onChange={e => updateSetting("proxy_host", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Proxy Port</Label>
          <Input
            className="h-7 text-xs font-mono"
            value={getSetting("proxy_port")}
            onChange={e => updateSetting("proxy_port", e.target.value)}
          />
        </div>
      </div>

      {/* VFS Countries */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">VFS Hedef Ülkeleri</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="w-3 h-3" />
            Ülke Ekle
          </Button>
        </div>

        <div className="space-y-1.5">
          {countries.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{c.flag}</span>
                <span className="text-xs font-medium">{c.label}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
                  {c.code}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={c.is_active}
                  onCheckedChange={v => toggleCountry(c.id, v)}
                  className="scale-75"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteCountry(c.id, c.label)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="space-y-2 p-3 rounded-md border border-border bg-card">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Değer (ör: germany)</Label>
                <Input
                  className="h-7 text-xs"
                  value={newCountry.value}
                  onChange={e => setNewCountry(p => ({ ...p, value: e.target.value }))}
                  placeholder="germany"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">İsim (ör: Almanya)</Label>
                <Input
                  className="h-7 text-xs"
                  value={newCountry.label}
                  onChange={e => setNewCountry(p => ({ ...p, label: e.target.value }))}
                  placeholder="Almanya"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">VFS Kodu (ör: deu)</Label>
                <Input
                  className="h-7 text-xs font-mono"
                  value={newCountry.code}
                  onChange={e => setNewCountry(p => ({ ...p, code: e.target.value }))}
                  placeholder="deu"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Bayrak Emoji</Label>
                <Input
                  className="h-7 text-xs"
                  value={newCountry.flag}
                  onChange={e => setNewCountry(p => ({ ...p, flag: e.target.value }))}
                  placeholder="🇩🇪"
                />
              </div>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1 w-full" onClick={addCountry} disabled={saving}>
              <Save className="w-3 h-3" />
              Kaydet
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

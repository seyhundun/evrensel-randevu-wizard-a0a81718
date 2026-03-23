import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, AlertCircle, Clock, Image as ImageIcon,
  LogIn, Brain, Globe, Timer, MonitorSmartphone, Trash2, X
} from "lucide-react";

interface LogEntry {
  id: string;
  status: string;
  message: string | null;
  screenshot_url: string | null;
  created_at: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  info:    { icon: <Clock className="w-4 h-4" />, label: "Bilgi", color: "text-muted-foreground bg-muted/50" },
  success: { icon: <CheckCircle2 className="w-4 h-4" />, label: "Başarılı", color: "text-green-500 bg-green-500/10" },
  warning: { icon: <AlertCircle className="w-4 h-4" />, label: "Uyarı", color: "text-amber-500 bg-amber-500/10" },
  error:   { icon: <AlertCircle className="w-4 h-4" />, label: "Hata", color: "text-destructive bg-destructive/10" },
  login_start: { icon: <LogIn className="w-4 h-4" />, label: "Giriş", color: "text-blue-500 bg-blue-500/10" },
  quiz_solving: { icon: <Brain className="w-4 h-4" />, label: "Quiz Çözülüyor", color: "text-purple-500 bg-purple-500/10" },
  quiz_done: { icon: <CheckCircle2 className="w-4 h-4" />, label: "Quiz Tamamlandı", color: "text-green-500 bg-green-500/10" },
  bot_idle: { icon: <Timer className="w-4 h-4" />, label: "Bekleme", color: "text-muted-foreground bg-muted/50" },
  page_load: { icon: <Globe className="w-4 h-4" />, label: "Sayfa Yüklendi", color: "text-blue-400 bg-blue-400/10" },
};

const defaultStatus = { icon: <Clock className="w-4 h-4" />, label: "Log", color: "text-muted-foreground bg-muted/50" };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "Şimdi";
  if (secs < 60) return `${secs}sn önce`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa önce`;
  return `${Math.floor(hours / 24)}g önce`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function QuizTrackingLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quiz_tracking_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as unknown as LogEntry[] | null) ?? []);
    setLoading(false);
  };

  const clearLogs = async () => {
    if (!confirm("Tüm Quiz loglarını silmek istediğinize emin misiniz?")) return;
    await supabase.from("quiz_tracking_logs" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setLogs([]);
  };

  useEffect(() => {
    fetchLogs();
    const channel = supabase
      .channel("quiz-tracking-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quiz_tracking_logs" },
        (payload) => {
          const newLog = payload.new as LogEntry;
          setLogs((prev) => [newLog, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    const interval = setInterval(fetchLogs, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const lastLogTime = logs[0]?.created_at;
  const lastLogAge = lastLogTime ? (Date.now() - new Date(lastLogTime).getTime()) / 1000 : Infinity;
  const botActive = lastLogAge < 300;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card border border-border/50 px-3 md:px-4 py-3">
        <div className="flex items-center gap-2">
          {botActive ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium text-green-600">Quiz Bot Çalışıyor</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground/40"></span>
              </span>
              <span className="text-sm font-medium text-muted-foreground">Quiz Bot Durdu</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{logs.length} kayıt</span>
        <Button variant="ghost" size="sm" onClick={clearLogs} className="gap-1.5 text-xs text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
          Temizle
        </Button>
      </div>

      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <MonitorSmartphone className="w-4 h-4 text-muted-foreground" />
        🧠 Quiz Bot Aktivitesi
      </h3>

      {loading && logs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Yükleniyor...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm rounded-lg bg-secondary/50">
          Henüz quiz bot aktivitesi yok.
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1 font-mono">
          {logs.map((log) => {
            const cfg = statusConfig[log.status] ?? defaultStatus;
            const msg = log.message?.replace(/^\[QUIZ\]\s*/, "") || "";
            return (
              <div
                key={log.id}
                className={`flex items-start gap-2.5 rounded-lg bg-card border border-border/50 px-3 py-2 text-xs transition-colors hover:bg-secondary/30 ${
                  log.status === "error" ? "bg-destructive/5" : ""
                } ${log.status === "success" ? "bg-green-500/5" : ""}`}
              >
                <span className={`mt-0.5 flex items-center justify-center rounded-md p-1 shrink-0 ${cfg.color}`}>
                  {cfg.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${cfg.color.split(" ")[0]}`}>{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatTime(log.created_at)} · {timeAgo(log.created_at)}
                    </span>
                  </div>
                  {msg && (
                    <p className="text-muted-foreground mt-0.5 break-words leading-relaxed text-[11px]">{msg}</p>
                  )}
                  {log.screenshot_url && (
                    <button
                      onClick={() => setLightboxUrl(log.screenshot_url)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ImageIcon className="w-3 h-3" /> Ekran Görüntüsü
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setLightboxUrl(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="Screenshot" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
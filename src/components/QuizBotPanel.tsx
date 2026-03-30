import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, Play, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle,
  Clock, Mail, Power, Globe, RotateCcw, StopCircle, UserCircle
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuizTrackingLogs from "@/components/QuizTrackingLogs";

type QuizAccount = {
  id: string;
  email: string;
  password: string;
  platform: string;
  status: string;
  notes: string | null;
  last_used_at: string | null;
  fail_count: number;
};

interface QuizLink {
  id: string;
  url: string;
  status: string;
  created_at: string;
  quiz_account_id: string | null;
}

export default function QuizBotPanel() {
  const [accounts, setAccounts] = useState<QuizAccount[]>([]);
  const [quizLinks, setQuizLinks] = useState<QuizLink[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAccounts();
    loadQuizLinks();
    const ch = supabase
      .channel("quiz-panel-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "link_analyses" }, () => loadQuizLinks())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_accounts" }, () => fetchAccounts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function fetchAccounts() {
    const { data } = await supabase.from("quiz_accounts").select("*").order("created_at", { ascending: false });
    if (data) setAccounts(data);
  }

  async function loadQuizLinks() {
    const { data } = await supabase
      .from("link_analyses")
      .select("id, url, status, created_at, quiz_account_id")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setQuizLinks(data as QuizLink[]);
  }

  async function addAccount() {
    if (!newEmail || !newPassword) { toast.error("Email ve şifre gerekli"); return; }
    const { error } = await supabase.from("quiz_accounts").insert({ email: newEmail, password: newPassword, platform: "email" });
    if (error) { toast.error("Hata: " + error.message); } else {
      toast.success("Hesap eklendi");
      setNewEmail(""); setNewPassword("");
      fetchAccounts();
    }
  }

  async function deleteAccount(id: string) {
    await supabase.from("quiz_accounts").delete().eq("id", id);
    toast.success("Hesap silindi");
    fetchAccounts();
  }

  async function toggleAccountStatus(acc: QuizAccount) {
    const newStatus = acc.status === "active" ? "inactive" : "active";
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, status: newStatus } : a));
    await supabase.from("quiz_accounts").update({ status: newStatus }).eq("id", acc.id);
    toast.success(newStatus === "active" ? "Hesap aktif edildi" : "Hesap pasif edildi");
  }

  async function addQuizLink() {
    const url = newUrl.trim();
    if (!url) { toast.error("URL girin"); return; }
    const { error } = await supabase.from("link_analyses").insert({ url, status: "idle" } as any);
    if (error) { toast.error("Hata: " + error.message); } else {
      toast.success("Link eklendi");
      setNewUrl("");
    }
  }

  async function deleteQuizLink(id: string) {
    setQuizLinks(prev => prev.filter(l => l.id !== id));
    await supabase.from("link_analyses").delete().eq("id", id);
    toast.success("Link silindi");
  }

  async function toggleLinkActive(link: QuizLink) {
    const newStatus = link.status === "idle" || link.status === "quiz_done" || link.status === "error" ? "active" : "idle";
    setQuizLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: newStatus } : l));
    await supabase.from("link_analyses").update({ status: newStatus }).eq("id", link.id);
    toast.success(newStatus === "active" ? "Link aktif" : "Link pasif");
  }

  async function startQuiz(link: QuizLink) {
    setQuizLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: "quiz_pending" } : l));
    await supabase.from("link_analyses").update({ status: "quiz_pending" }).eq("id", link.id);
    toast.success("Quiz başlatıldı: " + link.url.slice(0, 40));
  }

  async function stopQuiz(link: QuizLink) {
    setQuizLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: "idle" } : l));
    await supabase.from("link_analyses").update({ status: "idle" }).eq("id", link.id);
    toast.success("Quiz durduruldu");
  }

  async function startAllActive() {
    const activeLinks = quizLinks.filter(l => l.status === "active");
    if (activeLinks.length === 0) { toast.error("Aktif link yok"); return; }
    setQuizLinks(prev => prev.map(l => l.status === "active" ? { ...l, status: "quiz_pending" } : l));
    for (const link of activeLinks) {
      await supabase.from("link_analyses").update({ status: "quiz_pending" }).eq("id", link.id);
    }
    toast.success(`${activeLinks.length} link quiz kuyruğuna eklendi`);
  }

  async function assignAccount(linkId: string, accountId: string | null) {
    setQuizLinks(prev => prev.map(l => l.id === linkId ? { ...l, quiz_account_id: accountId } : l));
    await supabase.from("link_analyses").update({ quiz_account_id: accountId } as any).eq("id", linkId);
    toast.success(accountId ? "Hesap atandı" : "Hesap kaldırıldı");
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "idle":
        return <Badge variant="secondary" className="text-[10px] gap-1">Pasif</Badge>;
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1"><Power className="w-3 h-3" /> Aktif</Badge>;
      case "quiz_pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1"><Clock className="w-3 h-3 animate-pulse" /> Bekliyor</Badge>;
      case "quiz_running":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Çalışıyor</Badge>;
      case "quiz_done":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" /> Tamamlandı</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-[10px] gap-1"><AlertCircle className="w-3 h-3" /> Hata</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const activeCount = quizLinks.filter(l => l.status === "active").length;
  const runningCount = quizLinks.filter(l => l.status === "quiz_pending" || l.status === "quiz_running").length;

  // Group unassigned accounts (not linked to any quiz link)
  const assignedAccountIds = new Set(quizLinks.map(l => l.quiz_account_id).filter(Boolean));
  const unassignedAccounts = accounts.filter(a => !assignedAccountIds.has(a.id));

  return (
    <div className="space-y-4">
      {/* Quiz Linkleri + Hesap Ataması */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Quiz Linkleri & Hesaplar
          </h2>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <Button onClick={startAllActive} size="sm" className="h-7 text-xs gap-1.5">
                <Play className="w-3.5 h-3.5" />
                Tümünü Başlat ({activeCount})
              </Button>
            )}
          </div>
        </div>

        {/* Yeni link ekle */}
        <div className="flex gap-2">
          <Input
            placeholder="https://www.swagbucks.com/"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addQuizLink()}
            className="flex-1 text-sm font-mono"
          />
          <Button onClick={addQuizLink} size="sm" variant="outline" className="gap-1">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Durum özeti */}
        {quizLinks.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{quizLinks.length} link</span>
            <span className="text-emerald-600">{activeCount} aktif</span>
            {runningCount > 0 && <span className="text-blue-600">{runningCount} çalışıyor</span>}
          </div>
        )}

        {/* Link listesi */}
        {quizLinks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Henüz link eklenmemiş</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {quizLinks.map((link) => {
                const assignedAccount = accounts.find(a => a.id === link.quiz_account_id);
                return (
                  <div key={link.id} className="bg-secondary/30 rounded-lg overflow-hidden">
                    {/* Link satırı */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Switch
                        checked={link.status === "active" || link.status === "quiz_pending" || link.status === "quiz_running"}
                        onCheckedChange={() => toggleLinkActive(link)}
                        disabled={link.status === "quiz_pending" || link.status === "quiz_running"}
                        className="scale-75"
                      />
                      <div className="flex-1 min-w-0">
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-foreground hover:text-primary truncate block">
                          {link.url}
                        </a>
                      </div>
                      {statusBadge(link.status)}
                      {(link.status === "quiz_done" || link.status === "error") && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700" onClick={() => startQuiz(link)} title="Yeniden Başlat">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(link.status === "quiz_pending" || link.status === "quiz_running") && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive/80" onClick={() => stopQuiz(link)} title="Durdur">
                          <StopCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {link.status !== "quiz_pending" && link.status !== "quiz_running" && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700" onClick={() => startQuiz(link)} title="Quiz Başlat">
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteQuizLink(link.id)} disabled={link.status === "quiz_running"}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Hesap atama alanı */}
                    <div className="px-3 pb-2 flex items-center gap-2 border-t border-border/30 pt-1.5">
                      <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <Select
                        value={link.quiz_account_id || "none"}
                        onValueChange={(val) => assignAccount(link.id, val === "none" ? null : val)}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Hesap seç..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Hesap atanmadı</span>
                          </SelectItem>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              <span className="flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${acc.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                {acc.email}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignedAccount && (
                        <Badge variant={assignedAccount.status === "active" ? "secondary" : "destructive"} className="text-[10px] shrink-0">
                          {assignedAccount.status === "active" ? "Aktif" : "Pasif"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Hesap Yönetimi */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          Giriş Hesapları
        </h2>
        <div className="flex gap-2">
          <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1" />
          <Input placeholder="Şifre" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="flex-1" />
          <Button onClick={addAccount} size="sm" variant="outline"><Plus className="w-4 h-4" /></Button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz hesap eklenmemiş</p>
        ) : (
          <div className="space-y-1.5">
            {accounts.map((acc) => {
              const linkedLinks = quizLinks.filter(l => l.quiz_account_id === acc.id);
              return (
                <div key={acc.id} className="bg-secondary/30 rounded-md px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Switch
                        checked={acc.status === "active"}
                        onCheckedChange={() => toggleAccountStatus(acc)}
                        className="scale-75"
                      />
                      <span className="text-xs font-mono truncate">{acc.email}</span>
                      <button onClick={() => setShowPasswords((p) => ({ ...p, [acc.id]: !p[acc.id] }))} className="text-muted-foreground hover:text-foreground">
                        {showPasswords[acc.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      {showPasswords[acc.id] && <span className="text-xs text-muted-foreground font-mono">{acc.password}</span>}
                      <Badge variant={acc.status === "active" ? "secondary" : "destructive"} className="text-[10px]">
                        {acc.status === "active" ? "Aktif" : "Pasif"}
                      </Badge>
                      {acc.fail_count > 0 && <span className="text-[10px] text-destructive">({acc.fail_count} hata)</span>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteAccount(acc.id)} className="h-6 w-6 p-0 text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {/* Bu hesaba atanmış linkler */}
                  {linkedLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-7">
                      {linkedLinks.map(l => (
                        <Badge key={l.id} variant="outline" className="text-[10px] font-mono gap-1">
                          <Globe className="w-2.5 h-2.5" />
                          {new URL(l.url).hostname.replace("www.", "")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quiz Bot Logları */}
      <QuizTrackingLogs />
    </div>
  );
}

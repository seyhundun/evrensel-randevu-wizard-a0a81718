import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, User, ClipboardCheck, Loader2, Copy } from "lucide-react";
import type { Applicant } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApplicantCardProps {
  applicant: Applicant;
  index: number;
  total: number;
  onUpdate: (id: string, field: keyof Applicant, value: string) => void;
  onRemove?: () => void;
  configId?: string | null;
}

// Tarih formatı: "21.12.2016" veya "21122016" → "21/12/2016"
function formatDateSlash(val: string): string {
  if (!val) return val;
  // Zaten "/" varsa dokunma
  if (val.includes("/")) return val;
  // "." ile ayrılmışsa dönüştür
  if (val.includes(".")) return val.replace(/\./g, "/");
  // Sadece rakamlarsa ve 8 hane ise
  const digits = val.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  return val;
}

function CopyTick({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Kopyala"
    >
      {copied ? (
        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

export default function ApplicantCard({
  applicant,
  index,
  total,
  onUpdate,
  onRemove,
  configId,
}: ApplicantCardProps) {
  const [filling, setFilling] = useState(false);

  // Tarih alanlarında "/" formatını zorla
  const handleDateChange = (field: keyof Applicant) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateSlash(e.target.value);
    onUpdate(applicant.id, field, formatted);
  };

  const handleFillSingle = async () => {
    if (!configId) {
      toast.error("Önce takip başlatın veya kaydedin");
      console.error("[Doldur] configId yok!");
      return;
    }
    console.log("[Doldur] configId:", configId, "index:", index);
    setFilling(true);
    try {
      const { data, error } = await supabase
        .from("applicants")
        .select("*")
        .eq("config_id", configId)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[Doldur] DB hatası:", error);
        throw error;
      }
      
      console.log("[Doldur] DB sonuç:", data?.length, "kayıt, index:", index);
      
      if (!data || data.length === 0) {
        toast.error("Veritabanında başvuru sahibi bulunamadı");
        setFilling(false);
        return;
      }

      const db = data[index];
      if (!db) {
        toast.error(`${index + 1}. kişi veritabanında bulunamadı`);
        setFilling(false);
        return;
      }

      console.log("[Doldur] Dolduruluyor:", db.first_name, db.last_name);
      
      // Tarihleri "/" formatına dönüştür
      const birthDate = formatDateSlash(db.birth_date || "");
      const passportExpiry = formatDateSlash(db.passport_expiry || "");

      const fields: [keyof Applicant, string][] = [
        ["firstName", db.first_name || ""],
        ["lastName", db.last_name || ""],
        ["gender", db.gender || ""],
        ["birthDate", birthDate],
        ["nationality", db.nationality || "Turkey"],
        ["passport", db.passport || ""],
        ["passportExpiry", passportExpiry],
      ];
      
      for (const [field, value] of fields) {
        onUpdate(applicant.id, field, value);
      }

      // Send fill request to bot via bot_settings
      const fillPayload = JSON.stringify({
        action: "fill_single",
        timestamp: Date.now(),
        index,
        applicant: {
          firstName: db.first_name || "",
          lastName: db.last_name || "",
          gender: db.gender || "",
          birthDate: birthDate,
          nationality: db.nationality || "Turkey",
          passport: db.passport || "",
          passportExpiry: passportExpiry,
        },
      });

      await supabase
        .from("bot_settings")
        .upsert({ key: "fill_applicants_request", value: fillPayload, label: "Form Doldurma İsteği" }, { onConflict: "key" });

      toast.success(`${db.first_name} ${db.last_name} bota gönderildi — VFS formu dolduruluyor!`);
    } catch (err: any) {
      console.error("[Doldur] Hata:", err);
      toast.error("Hata: " + (err.message || "Bilinmeyen"));
    } finally {
      setFilling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.05 }}
      className="bg-card rounded-xl p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="section-title text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Başvuru Sahibi {index + 1}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleFillSingle}
            variant="outline"
            size="sm"
            disabled={filling}
            className="gap-1.5 h-7 text-xs"
          >
            {filling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
            {filling ? "..." : "Doldur"}
          </Button>
          {total > 1 && onRemove && (
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">İsim <CopyTick value={applicant.firstName} /></Label>
          <Input placeholder="ZEYNEP MASAL" value={applicant.firstName} onChange={(e) => onUpdate(applicant.id, "firstName", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">Soyisim <CopyTick value={applicant.lastName} /></Label>
          <Input placeholder="ÇAKAN" value={applicant.lastName} onChange={(e) => onUpdate(applicant.id, "lastName", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">Cinsiyet <CopyTick value={applicant.gender} /></Label>
          <Select value={applicant.gender} onValueChange={(v) => onUpdate(applicant.id, "gender", v)}>
            <SelectTrigger className="bg-background shadow-card">
              <SelectValue placeholder="Seçiniz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Erkek">Erkek</SelectItem>
              <SelectItem value="Kadın">Kadın</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">Doğum Tarihi (GG/AA/YYYY) <CopyTick value={applicant.birthDate} /></Label>
          <Input placeholder="21/12/2016" value={applicant.birthDate} onChange={handleDateChange("birthDate")} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">Uyruk <CopyTick value={applicant.nationality} /></Label>
          <Input placeholder="Turkey" value={applicant.nationality} onChange={(e) => onUpdate(applicant.id, "nationality", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium flex items-center">Pasaport Numarası <CopyTick value={applicant.passport} /></Label>
          <Input placeholder="U12345678" value={applicant.passport} onChange={(e) => onUpdate(applicant.id, "passport", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="helper-text font-medium flex items-center">Pasaport Son Kullanma Tarihi <CopyTick value={applicant.passportExpiry} /></Label>
          <Input placeholder="15/08/2030" value={applicant.passportExpiry} onChange={handleDateChange("passportExpiry")} className="bg-background shadow-card" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
      // Send fill request to bot via bot_settings
      const fillPayload = JSON.stringify({
        action: "fill_single",
        timestamp: Date.now(),
        index,
        applicant: {
          firstName: db.first_name || "",
          lastName: db.last_name || "",
          gender: db.gender || "",
          birthDate: db.birth_date || "",
          nationality: db.nationality || "Turkey",
          passport: db.passport || "",
          passportExpiry: db.passport_expiry || "",
        },
      });

      await supabase
        .from("bot_settings")
        .upsert({ key: "fill_applicants_request", value: fillPayload, label: "Form Doldurma İsteği" }, { onConflict: "key" });

      toast.success(`${db.first_name} ${db.last_name} bota gönderildi — VFS formu dolduruluyor!`);
    } catch (err: any) {
      console.error("[Doldur] Hata:", err);
      toast.error("Hata: " + (err.message || "Bilinmeyen"));
    } finally {
      setFilling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1], delay: index * 0.05 }}
      className="bg-card rounded-xl p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="section-title text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Başvuru Sahibi {index + 1}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleFillSingle}
            variant="outline"
            size="sm"
            disabled={filling}
            className="gap-1.5 h-7 text-xs"
          >
            {filling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ClipboardCheck className="w-3 h-3" />}
            {filling ? "..." : "Doldur"}
          </Button>
          {total > 1 && onRemove && (
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">İsim</Label>
          <Input placeholder="ZEYNEP MASAL" value={applicant.firstName} onChange={(e) => onUpdate(applicant.id, "firstName", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">Soyisim</Label>
          <Input placeholder="ÇAKAN" value={applicant.lastName} onChange={(e) => onUpdate(applicant.id, "lastName", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">Cinsiyet</Label>
          <Select value={applicant.gender} onValueChange={(v) => onUpdate(applicant.id, "gender", v)}>
            <SelectTrigger className="bg-background shadow-card">
              <SelectValue placeholder="Seçiniz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Erkek">Erkek</SelectItem>
              <SelectItem value="Kadın">Kadın</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">Doğum Tarihi (GG/AA/YYYY)</Label>
          <Input placeholder="15/08/1992" value={applicant.birthDate} onChange={(e) => onUpdate(applicant.id, "birthDate", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">Uyruk</Label>
          <Input placeholder="Turkey" value={applicant.nationality} onChange={(e) => onUpdate(applicant.id, "nationality", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5">
          <Label className="helper-text font-medium">Pasaport Numarası</Label>
          <Input placeholder="U12345678" value={applicant.passport} onChange={(e) => onUpdate(applicant.id, "passport", e.target.value)} className="bg-background shadow-card" />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="helper-text font-medium">Pasaport Son Kullanma Tarihi</Label>
          <Input placeholder="15/08/2030" value={applicant.passportExpiry} onChange={(e) => onUpdate(applicant.id, "passportExpiry", e.target.value)} className="bg-background shadow-card" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
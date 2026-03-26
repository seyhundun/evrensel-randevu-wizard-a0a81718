import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, User } from "lucide-react";
import type { Applicant } from "@/lib/constants";

interface ApplicantCardProps {
  applicant: Applicant;
  index: number;
  total: number;
  onUpdate: (id: string, field: keyof Applicant, value: string) => void;
  onRemove?: () => void;
}

export default function ApplicantCard({
  applicant,
  index,
  total,
  onUpdate,
  onRemove,
}: ApplicantCardProps) {
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
        {total > 1 && onRemove && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
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

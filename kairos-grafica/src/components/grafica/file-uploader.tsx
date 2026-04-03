import { useState, useCallback } from "react";
import { Upload, X, FileCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "application/postscript",
];
const MAX_SIZE_MB = 50;

export function FileUploader({ onFileSelect, file }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.endsWith(".ai") && !f.name.endsWith(".eps")) {
      return "Formato não suportado. Envie PDF, JPG, PNG, TIFF ou AI.";
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFileSelect(f);
  }, [validateFile, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  if (file) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Arte / Arquivo</label>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/5">
          <FileCheck className="w-5 h-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <button
            onClick={() => { onFileSelect(null); setError(null); }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Arte / Arquivo <span className="text-muted-foreground font-normal">(opcional)</span>
      </label>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
        )}
      >
        <input
          type="file"
          onChange={handleChange}
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.ai,.eps"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className={cn(
          "w-8 h-8",
          isDragging ? "text-primary" : "text-muted-foreground",
        )} />
        <p className="text-sm text-muted-foreground text-center">
          Arraste sua arte aqui ou <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG, TIFF ou AI - Máx. {MAX_SIZE_MB}MB
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

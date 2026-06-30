"use client";

import { useState, useRef } from "react";

interface UploadedFile {
  name: string;
  size: number;
  uploaded: boolean;
  url?: string;
}

export function FileUploader({ contractId }: { contractId?: string }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (contractId) formData.append("contractId", contractId);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => [...prev, {
          name: file.name,
          size: file.size,
          uploaded: true,
          url: data.url,
        }]);
      }
    } catch {
      // ignore
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="rounded-xl border border-[#E2E0D9] p-6">
      <h3 className="font-semibold mb-4">📎 Livrables</h3>
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center hover:border-primary/50 transition-colors"
      >
        <input ref={inputRef} type="file" onChange={handleUpload} className="hidden" />
        <p className="text-sm text-[#5A5750]">
          {uploading ? "Upload en cours..." : "Cliquez pour ajouter un fichier"}
        </p>
        <p className="text-xs text-[#5A5750] mt-1">PDF, ZIP, images — max 10 Mo</p>
      </div>
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-[#F5F5F0]/50 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span>📄</span>
                <span className="font-medium truncate">{f.name}</span>
                <span className="text-xs text-[#5A5750] shrink-0">({formatSize(f.size)})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {f.url && (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    📥 Télécharger
                  </a>
                )}
                <span className="text-xs text-green-600 font-medium">✓ Livré</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

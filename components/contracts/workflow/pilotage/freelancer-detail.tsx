"use client";

/**
 * Modal de détail pour le prestataire : téléversement de preuves et soumission.
 * Les fichiers sont uploadés via l'API /api/upload avec la catégorie "evidence".
 * Supporte la capture photo/vidéo via la webcam et la géolocalisation.
 */

import { useState, useRef, useCallback } from "react";
import type { PilotageMilestone, EvidenceFile } from "./types";
import { evCount } from "./types";
import { MediaCapture } from "./media-capture";
import type { CaptureMode } from "./media-capture";

interface Props {
  milestone: PilotageMilestone;
  contractId: string;
  userId: string;
  onClose: () => void;
  onAddEvidenceFile: (kind: "photo" | "video" | "document", file: EvidenceFile) => void;
  onRemoveEvidence: (kind: string, idx: number) => void;
  onCaptureGeoloc: () => void;
  onRemoveGeoloc: () => void;
  onAddAutre: (label: string) => void;
  onSubmit: () => void;
  statusMap: Record<string, { cls: string; label: string }>;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

function isVideo(mime: string): boolean {
  return mime.startsWith("video/");
}

export function MilestoneDetailFreelancer({
  milestone: m,
  contractId,
  userId,
  onClose,
  onAddEvidenceFile,
  onRemoveEvidence,
  onCaptureGeoloc,
  onRemoveGeoloc,
  onAddAutre,
  onSubmit,
  statusMap,
}: Props) {
  const [autreInput, setAutreInput] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null!);
  const videoInputRef = useRef<HTMLInputElement>(null!);
  const docInputRef = useRef<HTMLInputElement>(null!);

  const st = statusMap[m.status] || { cls: "b-gray", label: m.status };
  const isRevision = m.status === "REJECTED";
  const canSubmit = evCount(m.evidence) > 0;

  const handleFileUpload = useCallback(
    async (kind: "photo" | "video" | "document", file: File) => {
      setUploading(kind);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "evidence");
        formData.append("entityType", "Milestone");
        formData.append("entityId", m.milestoneId);
        formData.append("userId", userId);
        if (contractId) formData.append("contractId", contractId);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Échec de l'upload");
        }
        const data = await res.json();
        onAddEvidenceFile(kind, {
          name: data.file.name,
          url: data.file.url,
          mimeType: data.file.mimeType,
          size: data.file.size,
        });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Erreur d'upload");
      } finally {
        setUploading(null);
      }
    },
    [contractId, userId, m.milestoneId, onAddEvidenceFile]
  );

  const renderFileItem = (f: EvidenceFile, kind: string, idx: number, cls: string) => (
    <span key={idx} className={`ev-item ${cls}`}>
      {isImage(f.mimeType) ? (
        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "inherit", textDecoration: "none" }}>
          🖼️ {f.name}
        </a>
      ) : isVideo(f.mimeType) ? (
        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "inherit", textDecoration: "none" }}>
          🎬 {f.name}
        </a>
      ) : (
        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "inherit", textDecoration: "none" }}>
          📎 {f.name}
        </a>
      )}
      <span className="ev-size">{formatSize(f.size)}</span>
      <button onClick={() => onRemoveEvidence(kind, idx)}>✕</button>
    </span>
  );

  const emptyMsg = (arr: unknown[]) => (arr.length === 0 ? <span className="ev-empty">Aucune</span> : null);

  const renderUploadSection = (
    kind: "photo" | "video" | "document",
    label: string,
    accept: string,
    inputRef: React.RefObject<HTMLInputElement>,
    files: EvidenceFile[],
    itemCls: string,
    canCapture?: boolean
  ) => (
    <div className="ev-type">
      <div className="ev-type-head">
        <span className="ev-type-label">{label}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {canCapture && (
            <button
              className="ev-add-btn capture-action"
              onClick={() => setCaptureMode(kind === "photo" ? "photo" : "video")}
              title={kind === "photo" ? "Prendre une photo" : "Enregistrer une vidéo"}
            >
              {kind === "photo" ? "📸" : "🎥"}
            </button>
          )}
          <label className="ev-add-btn" style={{ cursor: "pointer" }}>
            {uploading === kind ? "⏳ Upload..." : "+ Ajouter"}
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(kind, file);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div className="ev-items">
        {files.map((f, i) => renderFileItem(f, kind, i, itemCls))}
        {emptyMsg(files)}
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DETAIL_STYLES }} />
      <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-card">
          <div className="modal-head">
            <div>
              <h3>{m.title}</h3>
              <div className="m-sub">
                {fmtEur(m.amount)} · <span className={`badge ${st.cls}`}>{st.label}</span>
              </div>
            </div>
            <div className="modal-close" onClick={onClose}>✕</div>
          </div>
          <div className="modal-body">
            {/* Message de révision */}
            {isRevision && m.rejectionReason && (
              <div className="rejection-box">
                <strong>Motif du rejet à corriger</strong>
                <br />
                {m.rejectionReason}
                <br />
                <span className="hint" style={{ color: "inherit" }}>
                  Révision n° {m.revisionCount + 1} — corrigez puis resoumettez.
                </span>
              </div>
            )}

            {/* Preuves d'exécution */}
            <div className="modal-section">
              <h4>Preuves d&apos;exécution</h4>

              {renderUploadSection("photo", "📷 Photos", "image/*", photoInputRef, m.evidence.photos, "", true)}
              {renderUploadSection("video", "🎥 Vidéos", "video/*", videoInputRef, m.evidence.videos, "", true)}
              {renderUploadSection("document", "📄 Documents", ".pdf,.doc,.docx,.txt,.zip", docInputRef, m.evidence.documents, "doc")}

              {/* Géolocalisation */}
              <div className="ev-type">
                <div className="ev-type-head">
                  <span className="ev-type-label">📍 Géolocalisation</span>
                  {!m.evidence.geoloc && (
                    <button className="ev-add-btn" onClick={onCaptureGeoloc}>
                      + Capturer ma position
                    </button>
                  )}
                </div>
                <div className="ev-items">
                  {m.evidence.geoloc ? (
                    <span className="ev-item geo">
                      {m.evidence.geoloc.lat}, {m.evidence.geoloc.lng}
                      {m.evidence.geoloc.simulated ? " (simulée)" : ""}
                      <button onClick={onRemoveGeoloc}>✕</button>
                    </span>
                  ) : (
                    <span className="ev-empty">Aucune</span>
                  )}
                </div>
              </div>

              {/* Autres preuves */}
              <div className="ev-type">
                <div className="ev-type-head">
                  <span className="ev-type-label">➕ Autres preuves</span>
                </div>
                <div className="ev-items">
                  {m.evidence.autres.length > 0
                    ? m.evidence.autres.map((a, i) => (
                        <span key={i} className="ev-item autre">
                          {a.label}
                          <button onClick={() => onRemoveEvidence("autre", i)}>✕</button>
                        </span>
                      ))
                    : <span className="ev-empty">Aucune</span>}
                </div>
                <div className="autre-row">
                  <input
                    type="text"
                    placeholder="Décrire la preuve (ex. fiche technique, attestation...)"
                    value={autreInput}
                    onChange={(e) => setAutreInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onAddAutre(autreInput);
                        setAutreInput("");
                      }
                    }}
                  />
                  <button
                    className="btn sm"
                    onClick={() => {
                      onAddAutre(autreInput);
                      setAutreInput("");
                    }}
                  >
                    + Ajouter
                  </button>
                </div>
              </div>
            </div>

            {/* Bouton de soumission */}
            <div className="modal-section">
              <button className="btn primary" disabled={!canSubmit || !!uploading} onClick={onSubmit}>
                {isRevision ? "Resoumettre pour validation" : "Soumettre pour validation"}
              </button>
              {!canSubmit && (
                <p className="hint" style={{ marginTop: 8 }}>
                  Au moins une preuve requise pour soumettre.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay de capture photo/vidéo */}
      {captureMode && (
        <MediaCapture
          mode={captureMode}
          onCapture={(file) => {
            setCaptureMode(null);
            const kind: "photo" | "video" = captureMode;
            handleFileUpload(kind, file);
          }}
          onClose={() => setCaptureMode(null)}
        />
      )}
    </>
  );
}

const DETAIL_STYLES = `
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(31, 30, 29, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 20px;
  }
  .modal-card {
    background: var(--panel, #FFFFFF);
    border-radius: 14px;
    width: 600px;
    max-width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-head {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--line, #E1DFD8);
    position: sticky;
    top: 0;
    background: var(--panel, #FFFFFF);
    z-index: 2;
  }
  .modal-head h3 {
    font-size: 17px;
    font-weight: 700;
    margin: 0 0 3px;
  }
  .modal-head .m-sub {
    font-size: 12px;
    color: var(--muted, #6B6862);
  }
  .modal-close {
    margin-left: auto;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--line, #E1DFD8);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--muted, #6B6862);
    flex-shrink: 0;
  }
  .modal-body {
    padding: 20px 24px;
  }
  .modal-section {
    margin-bottom: 22px;
  }
  .modal-section:last-child {
    margin-bottom: 0;
  }
  .modal-section h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--muted, #6B6862);
    font-weight: 600;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ev-type { margin-bottom: 14px; }
  .ev-type-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .ev-type-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink, #1F1E1D);
  }
  .ev-add-btn {
    font-size: 11px;
    font-weight: 600;
    color: var(--indigo, #534AB7);
    background: var(--indigo-bg, #EEEDFE);
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
  }
  .ev-add-btn:hover { background: #E1DFFB; }
  .ev-add-btn.capture-action { background: var(--green-bg,#E1F5EE); color: var(--green-text,#085041); }
  .ev-add-btn.capture-action:hover { background: #C8ECD8; }
  .ev-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ev-item {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--blue-bg, #E6F1FB);
    color: var(--blue-text, #0C447C);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 11.5px;
  }
  .ev-item.doc { background: var(--gray-bg, #F1EFE8); color: var(--gray-text, #44443F); }
  .ev-item.geo { background: var(--green-bg, #E1F5EE); color: var(--green-text, #085041); }
  .ev-item.autre { background: var(--amber-bg, #FAEEDA); color: var(--amber-text, #633806); }
  .ev-item button {
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    font-size: 12px;
    padding: 0;
    line-height: 1;
  }
  .ev-item button:hover { opacity: 1; }
  .ev-size { font-size: 10px; opacity: 0.7; margin-left: 2px; }
  .ev-empty {
    font-size: 11.5px;
    color: var(--muted, #6B6862);
    font-style: italic;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .field-row label {
    font-size: 12px;
    color: var(--muted, #6B6862);
    min-width: 150px;
  }
  input[type="number"] {
    width: 80px;
    font-size: 13px;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--line, #E1DFD8);
    background: var(--paper, #FAFAF8);
    color: var(--ink, #1F1E1D);
  }
  input[type="text"] {
    font-size: 12.5px;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--line, #E1DFD8);
    background: var(--paper, #FAFAF8);
    color: var(--ink, #1F1E1D);
    flex: 1;
  }

  .rejection-box {
    background: var(--red-bg, #FCEBEB);
    color: var(--red-text, #791F1F);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 16px;
    font-size: 12.5px;
  }
  .autre-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
`;

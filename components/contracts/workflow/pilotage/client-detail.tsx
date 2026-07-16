"use client";

/**
 * Modal de détail pour le client : examen des preuves, progression constatée, validation/rejet.
 * Adapté de client_jalons.html.
 */

import { useState, useEffect } from "react";
import type { PilotageMilestone } from "./types";

interface Props {
  milestone: PilotageMilestone;
  onClose: () => void;
  onUpdateConstatee: (val: number) => void;
  onValidate: () => void;
  onReject: (motif: string) => void;
  statusMap: Record<string, { cls: string; label: string }>;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

export function MilestoneDetailClient({
  milestone: m,
  onClose,
  onUpdateConstatee,
  onValidate,
  onReject,
  statusMap,
}: Props) {
  const [rejectMotif, setRejectMotif] = useState("");
  const st = statusMap[m.status] || { cls: "b-gray", label: m.status };

  // Initialiser progressionConstatee si null
  const constatee = m.progressionConstatee ?? m.progressionDeclaree;
  const canValidate = constatee === 100;
  const nearThreshold = m.revisionCount >= 4; // seuil de litige = 5 rejets, avertir au 4ᵉ

  // Synchroniser la valeur initiale
  useEffect(() => {
    if (m.progressionConstatee === null) {
      onUpdateConstatee(m.progressionDeclaree);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listOrEmpty = (arr: import("./types").EvidenceFile[], cls: string) =>
    arr.length > 0
      ? arr.map((f, i) => (
          <span key={i} className={`ev-item ${cls}`}>
            <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
              {f.mimeType.startsWith("image/") ? "🖼️ " : f.mimeType.startsWith("video/") ? "🎬 " : "📎 "}
              {f.name}
            </a>
          </span>
        ))
      : null;

  const emptyMsg = (arr: unknown[]) => (arr.length === 0 ? <span className="ev-empty">Aucune</span> : null);

  let actionZone: React.ReactNode;

  if (m.status === "SUBMITTED") {
    const constateeCls = constatee === 100 ? "full" : "partial";
    actionZone = (
      <>
        <div className="modal-section" style={{ marginBottom: 18 }}>
          <h4>Progression constatée</h4>
          <div className="constatee-row">
            <span className="row-label">Déclarée par le prestataire</span>
            <span className="row-value">{m.progressionDeclaree}%</span>
          </div>
          <div className="progress-track" style={{ marginBottom: 14 }}>
            <div className="progress-fill declared" style={{ width: `${m.progressionDeclaree}%` }} />
          </div>
          <div className="constatee-row">
            <span className="row-label">Constatée par vous, après examen des preuves</span>
            <span className="row-value">{constatee}%</span>
          </div>
          <div className="progress-track" style={{ marginBottom: 6 }}>
            <div
              className={`progress-fill constatee ${constateeCls}`}
              style={{ width: `${constatee}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={constatee}
            onChange={(e) => onUpdateConstatee(parseInt(e.target.value))}
          />
          {!canValidate && (
            <div className="constatee-warning">
              La validation n&apos;est possible que si la progression constatée atteint 100 %. En dessous, seul le rejet est disponible.
            </div>
          )}
        </div>
        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          Motif si rejet (obligatoire)
        </label>
        <textarea
          placeholder="Ex. Reprises non conformes au CCTP, zone concernée..."
          value={rejectMotif}
          onChange={(e) => setRejectMotif(e.target.value)}
        />
        {nearThreshold && (
          <div className="dispute-note">
            ⚠️ Attention : un rejet supplémentaire (5ᵉ révision) déclenchera automatiquement une procédure de litige.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            className="btn red"
            onClick={() => {
              if (!rejectMotif.trim()) {
                alert("Un motif est obligatoire pour rejeter ce jalon.");
                return;
              }
              onReject(rejectMotif.trim());
            }}
          >
            Rejeter
          </button>
          <button
            className="btn green"
            disabled={!canValidate}
            onClick={() => {
              if (constatee !== 100) {
                alert("La progression constatée doit être de 100 % pour valider ce jalon.");
                return;
              }
              onValidate();
            }}
          >
            Valider — libérer {fmtEur(m.amount)}
          </button>
        </div>
      </>
    );
  } else if (m.status === "VALIDATED") {
    actionZone = (
      <p className="hint">
        Jalon déjà validé — {fmtEur(m.amount)} libérés. Progression constatée finale : {m.progressionConstatee}%.
      </p>
    );
  } else if (m.status === "REJECTED") {
    actionZone = (
      <p className="hint">
        Progression constatée lors du dernier examen : {m.progressionConstatee}%. En attente d&apos;une nouvelle soumission du prestataire après correction.
      </p>
    );
  } else {
    actionZone = <p className="hint">Le prestataire n&apos;a pas encore soumis ce jalon.</p>;
  }

  const geoHTML = m.evidence.geoloc ? (
    <span className="ev-item geo">
      📍 {m.evidence.geoloc.lat}, {m.evidence.geoloc.lng}
      {m.evidence.geoloc.simulated ? " (simulée)" : ""} —{" "}
      <a
        href={`https://www.google.com/maps?q=${m.evidence.geoloc.lat},${m.evidence.geoloc.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit" }}
      >
        voir sur la carte
      </a>
    </span>
  ) : (
    <span className="ev-empty">Aucune</span>
  );

  const autresHTML =
    m.evidence.autres.length > 0
      ? m.evidence.autres.map((a, i) => (
          <span key={i} className="ev-item autre">
            {a.label}
          </span>
        ))
      : null;

  let historyHTML: React.ReactNode = null;
  if (m.revisionCount > 0 && m.status === "SUBMITTED") {
    historyHTML = (
      <div className="history-box">
        <strong>Révision n° {m.revisionCount}</strong> — le prestataire a resoumis ce jalon après un précédent rejet.
        {m.rejectionReason && (
          <>
            <br />
            <span className="hint" style={{ color: "inherit" }}>
              Motif précédent : {m.rejectionReason}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{DETAIL_STYLES}</style>
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
            {historyHTML}

            {/* Preuves fournies (lecture seule) */}
            <div className="modal-section">
              <h4>Preuves fournies par le prestataire</h4>

              <div className="ev-type">
                <span className="ev-type-label">📷 Photos</span>
                <div className="ev-items">
                  {listOrEmpty(m.evidence.photos, "")}
                  {emptyMsg(m.evidence.photos)}
                </div>
              </div>
              <div className="ev-type">
                <span className="ev-type-label">🎥 Vidéos</span>
                <div className="ev-items">
                  {listOrEmpty(m.evidence.videos, "")}
                  {emptyMsg(m.evidence.videos)}
                </div>
              </div>
              <div className="ev-type">
                <span className="ev-type-label">📄 Documents</span>
                <div className="ev-items">
                  {listOrEmpty(m.evidence.documents, "doc")}
                  {emptyMsg(m.evidence.documents)}
                </div>
              </div>
              <div className="ev-type">
                <span className="ev-type-label">📍 Géolocalisation</span>
                <div className="ev-items">{geoHTML}</div>
              </div>
              <div className="ev-type">
                <span className="ev-type-label">➕ Autres preuves</span>
                <div className="ev-items">
                  {autresHTML}
                  {emptyMsg(m.evidence.autres)}
                </div>
              </div>
            </div>

            {/* Zone d'action */}
            <div className="modal-section">{actionZone}</div>
          </div>
        </div>
      </div>
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
  .modal-head h3 { font-size: 17px; font-weight: 700; margin: 0 0 3px; }
  .modal-head .m-sub { font-size: 12px; color: var(--muted, #6B6862); }
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
  .modal-body { padding: 20px 24px; }
  .modal-section { margin-bottom: 22px; }
  .modal-section:last-child { margin-bottom: 0; }
  .modal-section h4 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--muted, #6B6862);
    font-weight: 600;
    margin: 0 0 10px;
  }

  .ev-type { margin-bottom: 14px; }
  .ev-type-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink, #1F1E1D);
    margin-bottom: 8px;
    display: block;
  }
  .ev-items { display: flex; flex-wrap: wrap; gap: 8px; }
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
  .ev-item a { color: inherit; }
  .ev-empty { font-size: 11.5px; color: var(--muted, #6B6862); font-style: italic; }

  textarea {
    width: 100%;
    min-height: 80px;
    resize: vertical;
    font-size: 13px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--line, #E1DFD8);
    background: var(--paper, #FAFAF8);
    color: var(--ink, #1F1E1D);
    font-family: 'Inter', sans-serif;
  }

  .constatee-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .constatee-row .row-label { font-size: 12px; color: var(--muted, #6B6862); }
  .constatee-row .row-value {
    font-size: 12.5px;
    font-weight: 700;
    font-family: 'IBM Plex Mono', monospace;
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--indigo, #534AB7);
    margin: 6px 0 2px;
  }
  .constatee-warning {
    background: var(--amber-bg, #FAEEDA);
    color: var(--amber-text, #633806);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11.5px;
    margin-top: 8px;
  }

  .dispute-note {
    background: var(--red-bg, #FCEBEB);
    color: var(--red-text, #791F1F);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    margin-top: 14px;
  }
  .history-box {
    background: var(--gray-bg, #F1EFE8);
    color: var(--gray-text, #44443F);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    margin-bottom: 16px;
  }
`;

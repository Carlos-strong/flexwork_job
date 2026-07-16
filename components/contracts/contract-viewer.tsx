"use client";

/**
 * Lecteur de contrat — visualisation intégrale et impression.
 *
 * Affiche le contrat HTML généré dans un cadre redimensionnable
 * avec barre d'outils (impression, téléchargement DOCX, plein écran).
 * S'intègre comme onglet ou comme composant standalone.
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface ContractViewerProps {
  contractId: string;
  contractTitle?: string;
}

export function ContractViewer({ contractId, contractTitle }: ContractViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/contracts/${contractId}/document?format=html`)
      .then((r) => {
        if (!r.ok) throw new Error("Contrat introuvable");
        return r.text();
      })
      .then((text) => {
        setHtml(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Erreur de chargement");
        setLoading(false);
      });
  }, [contractId]);

  const handlePrint = useCallback(() => {
    if (!iframeRef.current) return;
    const iframe = iframeRef.current;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, []);

  const handleDownloadDocx = useCallback(() => {
    window.open(`/api/contracts/${contractId}/document?format=docx`, "_blank");
  }, [contractId]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // ── Rendu ──────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#5A5750] gap-3">
        <div className="w-8 h-8 border-3 border-[#E2E0D9] border-t-[#2D5BE3] rounded-full animate-spin" />
        <p className="text-sm">Chargement du contrat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#5A5750] gap-3">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-red-500 text-xl">⚠️</span>
        </div>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-1.5 text-xs border border-[#E2E0D9] rounded-lg hover:bg-white transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-white"
    : "relative w-full";

  return (
    <div className={containerClass}>
      {/* Barre d'outils */}
      <div className={`flex items-center justify-between px-4 py-2.5 bg-[#FAFAF8] border-b border-[#E2E0D9] ${isFullscreen ? "sticky top-0 z-10" : "rounded-t-xl"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[#1A1916] truncate">
            📄 {contractTitle || "Contrat de prestation"}
          </span>
          <span className="text-[10px] text-[#5A5750] font-mono bg-white border border-[#E2E0D9] px-2 py-0.5 rounded-md hidden sm:inline">
            {contractId}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Impression */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#1A1916] bg-white border border-[#E2E0D9] rounded-lg hover:bg-[#F4F3EF] transition-colors"
            title="Imprimer le contrat"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
            <span className="hidden sm:inline">Imprimer</span>
          </button>

          {/* Télécharger DOCX */}
          <button
            onClick={handleDownloadDocx}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#2D5BE3] bg-white border border-[#C3D1F8] rounded-lg hover:bg-[#EEF2FD] transition-colors"
            title="Télécharger au format Word"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">DOCX</span>
          </button>

          {/* Plein écran */}
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#5A5750] bg-white border border-[#E2E0D9] rounded-lg hover:bg-[#F4F3EF] transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 0v12" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
            <span className="hidden sm:inline">{isFullscreen ? "Réduire" : "Plein écran"}</span>
          </button>
        </div>
      </div>

      {/* Cadre du contrat */}
      <div className={isFullscreen ? "h-[calc(100vh-48px)]" : "h-[550px]"}>
        {html && (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="w-full h-full border-0"
            title="Contrat de prestation"
            sandbox="allow-scripts"
          />
        )}
      </div>

      {/* Indicateur de page */}
      {!isFullscreen && (
        <div className="px-4 py-1.5 bg-[#FAFAF8] border-t border-[#E2E0D9] rounded-b-xl flex items-center justify-between">
          <span className="text-[10px] text-[#5A5750]">
            Document généré automatiquement — faisant foi entre les Parties
          </span>
          <span className="text-[10px] text-[#5A5750]">
            Utilisez le bouton <strong>Imprimer</strong> pour exporter en PDF
          </span>
        </div>
      )}
    </div>
  );
}

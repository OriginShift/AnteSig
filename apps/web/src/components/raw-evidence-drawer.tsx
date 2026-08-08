"use client";

import type { Provenance } from "@moss-mini-demo/report-schema";
import { useId, useRef } from "react";
import { serializeRawArtifact } from "../client/evidence-model";

type RawEvidenceDrawerProps = Readonly<{
  artifact: unknown;
  filename: string;
  provenance: Provenance;
  title: string;
  triggerId: string;
}>;

export function RawEvidenceDrawer({
  artifact,
  filename,
  provenance,
  title,
  triggerId,
}: RawEvidenceDrawerProps) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const serialized = serializeRawArtifact(artifact);

  const open = () => {
    opener.current = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
  };

  const close = () => dialog.current?.close();

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([serialized], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="raw-drawer-control">
      <button
        className="command-button secondary compact"
        id={triggerId}
        onClick={open}
        type="button"
      >
        View raw JSON
      </button>
      <dialog
        aria-labelledby={titleId}
        className="raw-evidence-drawer"
        onClose={() => opener.current?.focus()}
        ref={dialog}
      >
        <div className="raw-drawer-header">
          <div>
            <span className="raw-drawer-eyebrow">Raw evidence</span>
            <h3 id={titleId}>{title}</h3>
            <span className="raw-drawer-provenance">Source: {provenance}</span>
          </div>
          <button
            aria-label="Close raw evidence"
            className="icon-button"
            onClick={close}
            title="Close"
            type="button"
          >
            &times;
          </button>
        </div>
        <textarea
          aria-label={`${title} raw JSON`}
          className="raw-json"
          readOnly
          spellCheck={false}
          value={serialized}
        />
        <div className="raw-drawer-actions">
          <button
            className="command-button secondary"
            onClick={download}
            type="button"
          >
            Download JSON
          </button>
        </div>
      </dialog>
    </div>
  );
}

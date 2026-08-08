"use client";

import type { Clear402MonadActionCredentialV0_1 } from "@moss-mini-demo/clear402-profile";
import { useEffect, useId, useState } from "react";
import {
  credentialCopy,
  credentialExport,
  credentialVerificationLabel,
  tamperProtectedReportCopy,
} from "../client/credential-actions";
import {
  CredentialVerifyClientError,
  requestCredentialVerification,
} from "../client/verify-client";
import type {
  Clear402PreflightExtension,
  Clear402VerifyResponse,
} from "../contracts/clear402";

type VerificationState =
  | Readonly<{ status: "IDLE" }>
  | Readonly<{ status: "RUNNING" }>
  | Readonly<{ status: "COMPLETE"; result: Clear402VerifyResponse }>
  | Readonly<{ status: "ERROR"; message: string }>;

function triggerDownload(credential: Clear402MonadActionCredentialV0_1): void {
  const artifact = credentialExport(credential);
  const url = URL.createObjectURL(
    new Blob([artifact.text], { type: artifact.mediaType }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AvailableCredentialActions({
  credential,
}: Readonly<{ credential: Clear402MonadActionCredentialV0_1 }>) {
  const headingId = useId();
  const [copy, setCopy] = useState(() => credentialCopy(credential));
  const [tampered, setTampered] = useState(false);
  const [verification, setVerification] = useState<VerificationState>({
    status: "IDLE",
  });

  useEffect(() => {
    setCopy(credentialCopy(credential));
    setTampered(false);
    setVerification({ status: "IDLE" });
  }, [credential]);

  const artifact = credentialExport(copy);

  const verifyCopy = async () => {
    setVerification({ status: "RUNNING" });
    try {
      setVerification({
        status: "COMPLETE",
        result: await requestCredentialVerification(copy),
      });
    } catch (error) {
      setVerification({
        status: "ERROR",
        message:
          error instanceof CredentialVerifyClientError
            ? error.message
            : "The credential verifier could not be reached.",
      });
    }
  };

  const tamperCopy = () => {
    setCopy(tamperProtectedReportCopy(credential));
    setTampered(true);
    setVerification({ status: "IDLE" });
  };

  const restoreCopy = () => {
    setCopy(credentialCopy(credential));
    setTampered(false);
    setVerification({ status: "IDLE" });
  };

  return (
    <section className="credential-actions" aria-labelledby={headingId}>
      <div className="section-heading credential-heading">
        <div>
          <h3 id={headingId}>Clear402 credential</h3>
          <p>Portable report integrity envelope</p>
        </div>
        <span className="credential-kind">Unsigned</span>
      </div>

      <dl className="credential-facts">
        <div>
          <dt>Version</dt>
          <dd>{credential.credentialVersion}</dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{credential.report.provenance}</dd>
        </div>
        <div>
          <dt>Protected object</dt>
          <dd>credential.report</dd>
        </div>
        <div>
          <dt>Copy state</dt>
          <dd>{tampered ? "Protected field modified" : "Original copy"}</dd>
        </div>
        <div className="credential-digest">
          <dt>Report digest</dt>
          <dd>{credential.integrity.reportDigest}</dd>
        </div>
        <div className="credential-filename">
          <dt>Export file</dt>
          <dd>{artifact.filename}</dd>
        </div>
      </dl>

      <div className="credential-commands">
        <button
          className="command-button secondary compact"
          onClick={() => triggerDownload(copy)}
          type="button"
        >
          Export credential
        </button>
        <button
          className="command-button secondary compact"
          disabled={verification.status === "RUNNING"}
          onClick={verifyCopy}
          type="button"
        >
          {verification.status === "RUNNING"
            ? "Verifying credential"
            : "Verify credential"}
        </button>
        <button
          className="command-button tamper compact"
          disabled={tampered || verification.status === "RUNNING"}
          onClick={tamperCopy}
          type="button"
        >
          Tamper protected field
        </button>
        {tampered ? (
          <button
            className="command-button secondary compact"
            disabled={verification.status === "RUNNING"}
            onClick={restoreCopy}
            type="button"
          >
            Restore credential
          </button>
        ) : null}
      </div>

      <div
        aria-live="polite"
        className={`credential-verification ${verification.status.toLowerCase()}`}
      >
        {verification.status === "IDLE" ? (
          <p>Verification has not run on this copy.</p>
        ) : null}
        {verification.status === "RUNNING" ? (
          <p>Verifying copied data.</p>
        ) : null}
        {verification.status === "COMPLETE" ? (
          <>
            <strong>{credentialVerificationLabel(verification.result)}</strong>
            <p>
              {verification.result.ok
                ? "The schema-valid copied report matches its stored unkeyed digest."
                : verification.result.error.message}
            </p>
          </>
        ) : null}
        {verification.status === "ERROR" ? (
          <>
            <strong>Verification unavailable</strong>
            <p>{verification.message}</p>
          </>
        ) : null}
      </div>

      <div className="credential-assurance">
        <strong>{credential.assurance.kind}</strong>
        <p>{credential.assurance.statement}</p>
      </div>
    </section>
  );
}

export function CredentialActions({
  extension,
}: Readonly<{ extension: Clear402PreflightExtension }>) {
  if (extension.status === "ERROR") {
    return (
      <section className="credential-actions credential-error">
        <div className="section-heading">
          <div>
            <h3>Clear402 credential unavailable</h3>
            <p>{extension.error.code}</p>
          </div>
        </div>
        <p>{extension.error.message}</p>
      </section>
    );
  }
  return <AvailableCredentialActions credential={extension.credential} />;
}

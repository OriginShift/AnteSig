"use client";

import {
  type IntentDraft,
  type IntentErrors,
  type IntentField,
  LIVE_PROTOCOLS,
} from "../client/intent-form";

type IntentFormProps = Readonly<{
  draft: IntentDraft;
  errors: IntentErrors;
  disabled: boolean;
  onChange(draft: IntentDraft): void;
}>;

export function IntentForm({
  draft,
  errors,
  disabled,
  onChange,
}: IntentFormProps) {
  const update = (field: IntentField, value: string | readonly string[]) => {
    onChange({ ...draft, [field]: value });
  };

  return (
    <div className="intent-form">
      <div className="asset-control fixed-asset">
        <span className="field-label">Input asset</span>
        <strong className="fixed-asset-kind">NATIVE</strong>
        <span>No token contract address</span>
        <small>Source: fixed Exact-input Swap control</small>
      </div>

      <label className="field-control">
        <span className="field-label">Account</span>
        <input
          aria-invalid={Boolean(errors.account)}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => update("account", event.target.value)}
          placeholder="0x... EIP-55 address"
          spellCheck={false}
          value={draft.account}
        />
        <small>Source: user input</small>
        {errors.account ? (
          <span className="field-error">{errors.account}</span>
        ) : null}
      </label>

      <label className="field-control">
        <span className="field-label">Output token address</span>
        <input
          aria-invalid={Boolean(errors.outputAddress)}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => update("outputAddress", event.target.value)}
          placeholder="0x... EIP-55 address"
          spellCheck={false}
          value={draft.outputAddress}
        />
        <small>
          Address source: user input; symbol is display-only after response
        </small>
        {errors.outputAddress ? (
          <span className="field-error">{errors.outputAddress}</span>
        ) : null}
      </label>

      <div className="field-row">
        <label className="field-control">
          <span className="field-label">Amount in</span>
          <input
            aria-invalid={Boolean(errors.inputAmount)}
            autoComplete="off"
            disabled={disabled}
            inputMode="numeric"
            onChange={(event) => update("inputAmount", event.target.value)}
            placeholder="Base-unit integer"
            value={draft.inputAmount}
          />
          <small>Contract integer, never converted through float</small>
          {errors.inputAmount ? (
            <span className="field-error">{errors.inputAmount}</span>
          ) : null}
        </label>

        <label className="field-control">
          <span className="field-label">Max slippage (bps)</span>
          <input
            aria-invalid={Boolean(errors.maxSlippageBps)}
            autoComplete="off"
            disabled={disabled}
            inputMode="numeric"
            max="10000"
            min="0"
            onChange={(event) => update("maxSlippageBps", event.target.value)}
            value={draft.maxSlippageBps}
          />
          <small>0 to 10000</small>
          {errors.maxSlippageBps ? (
            <span className="field-error">{errors.maxSlippageBps}</span>
          ) : null}
        </label>
      </div>

      <fieldset className="protocol-control" disabled={disabled}>
        <legend>Allowed protocols</legend>
        {LIVE_PROTOCOLS.map((protocol) => (
          <label className="check-control" key={protocol.id}>
            <input
              checked={draft.allowedProtocols.includes(protocol.id)}
              onChange={(event) =>
                update(
                  "allowedProtocols",
                  event.target.checked
                    ? [...draft.allowedProtocols, protocol.id]
                    : draft.allowedProtocols.filter((id) => id !== protocol.id),
                )
              }
              type="checkbox"
            />
            <span className="protocol-name">
              <strong className="protocol-label">{protocol.label}</strong>
              <small>{protocol.id}</small>
            </span>
          </label>
        ))}
        {errors.allowedProtocols ? (
          <span className="field-error">{errors.allowedProtocols}</span>
        ) : null}
      </fieldset>

      <label className="field-control">
        <span className="field-label">Recipient (optional)</span>
        <input
          aria-invalid={Boolean(errors.recipient)}
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => update("recipient", event.target.value)}
          placeholder="Defaults to account"
          spellCheck={false}
          value={draft.recipient}
        />
        <small>Source: user input when present</small>
        {errors.recipient ? (
          <span className="field-error">{errors.recipient}</span>
        ) : null}
      </label>
    </div>
  );
}

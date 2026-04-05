"use client";

import { useId, useState, type ChangeEventHandler } from "react";

export function RevealInput(props: {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();

  return (
    <div className="input-shell">
      <input
        autoComplete={props.autoComplete}
        className="input input-with-toggle"
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={inputId}
        name={props.name}
        onChange={props.onChange}
        placeholder={props.placeholder}
        type={revealed ? "text" : "password"}
        value={props.value}
      />
      <button
        aria-controls={inputId}
        aria-label={revealed ? "Hide value" : "Show value"}
        className="visibility-button"
        disabled={props.disabled}
        onClick={() => setRevealed((current) => !current)}
        type="button"
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M3 3 21 21" />
      <path d="M10.6 10.5a3 3 0 0 0 4 4" />
      <path d="M9.9 5.2A11.3 11.3 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-3.3 4.2" />
      <path d="M6.2 6.3C3.9 8 2.5 10.6 2 12c0 0 3.5 7 10 7 1.7 0 3.2-.3 4.5-.9" />
    </svg>
  );
}

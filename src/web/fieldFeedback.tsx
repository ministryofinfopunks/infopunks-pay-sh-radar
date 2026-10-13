import { useState } from 'react';

export function FieldFeedback({ id, message }: { id: string; message?: string }) {
  return message ? <small id={id} className="radar-field-error" role="alert">{message}</small> : null;
}
export function TenantKeyField({ id, value, onChange, disabled, error, lifetime = "this page's" }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string; lifetime?: string }) {
  const [revealed, setRevealed] = useState(false);
  return <div className="radar-credential-field">
    <label htmlFor={id}>Tenant access key</label>
    <div className="radar-credential-control"><input id={id} aria-label="Tenant access key" type={revealed ? 'text' : 'password'} autoComplete="off" value={value} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={event => onChange(event.target.value)} />
      <button className="execute secondary" type="button" disabled={disabled} aria-controls={id} aria-pressed={revealed} aria-label={revealed ? 'Hide tenant access key' : 'Show tenant access key'} onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide' : 'Show'}</button></div>
    <p id={`${id}-help`} className="panel-caption spend-form-note">An operator-issued key is required for your tenant and agent identity. Ask your operator for access or consult <a href="/developers">the integration reference</a>. Your key stays in {lifetime} memory. This operation cannot authorize payment or execute an action.</p>
    <FieldFeedback id={`${id}-error`} message={error} />
  </div>;
}

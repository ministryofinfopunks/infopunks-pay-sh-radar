import { useEffect, useRef, useState } from 'react';
import {
  RhPulseCallChallengeResponseSchema,
  RhPulseCallSubmissionResponseSchema,
  type RhPulseCallOutcome
} from '../../shared/rhPulseCalls';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import type { RhPulseCallOption } from './rhPulseTypes';

type WalletModule = typeof import('./rhPulseWallet');
type WalletSession = import('./rhPulseWallet').RhPulseWalletSession;
type AcceptedCall = ReturnType<typeof RhPulseCallSubmissionResponseSchema.parse>['data'];

type SigningState =
  | 'wallet_module_loading'
  | 'wallet_options'
  | 'wallet_connecting'
  | 'account_unavailable'
  | 'challenge_creating'
  | 'message_ready'
  | 'signature_requested'
  | 'signature_pending'
  | 'signature_rejected'
  | 'signature_invalid'
  | 'challenge_expired'
  | 'window_closed'
  | 'duplicate_call'
  | 'server_unavailable'
  | 'call_accepted'
  | 'receipt_loading'
  | 'receipt_ready';

export function RhPulseSigningSheet({
  selected,
  onClose
}: {
  selected: RhPulseCallOption;
  onClose: () => void;
}) {
  const [state, setState] = useState<SigningState>('wallet_module_loading');
  const [walletModule, setWalletModule] = useState<WalletModule | null>(null);
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
  const [challenge, setChallenge] = useState<ReturnType<typeof RhPulseCallChallengeResponseSchema.parse>['data'] | null>(null);
  const [accepted, setAccepted] = useState<AcceptedCall | null>(null);
  const [detail, setDetail] = useState('Preparing secure wallet options.');
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    import('./rhPulseWallet')
      .then((module) => {
        if (!active) return;
        setWalletModule(module);
        setState('wallet_options');
        setDetail('Choose an available wallet path.');
      })
      .catch(() => {
        if (!active) return;
        setState('server_unavailable');
        setDetail('The wallet module could not load. Reload and try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = priorOverflow;
    };
  }, []);

  async function connect(kind: 'injected' | 'walletconnect') {
    if (!walletModule) return;
    setState('wallet_connecting');
    setDetail(kind === 'injected' ? 'Waiting for the injected wallet.' : 'Opening the WalletConnect handoff.');
    try {
      const session = kind === 'injected'
        ? await walletModule.connectInjectedWallet()
        : await walletModule.connectWalletConnect();
      setWalletSession(session);
      await createChallenge(session);
    } catch (error) {
      const code = walletErrorCode(error);
      if (code === 'account_unavailable' || code === 'wallet_unavailable') {
        setState('account_unavailable');
        setDetail('No wallet account was available. Open this page inside a wallet browser or use WalletConnect.');
      } else if (code === 'user_rejected') {
        setState('signature_rejected');
        setDetail('Wallet connection was cancelled. Nothing was signed or recorded.');
      } else {
        setState('server_unavailable');
        setDetail(error instanceof Error ? error.message : 'The wallet could not connect.');
      }
    }
  }

  async function createChallenge(session: WalletSession) {
    setState('challenge_creating');
    setDetail('Binding the selected call to the current window and wallet.');
    try {
      const response = await fetch(toApiUrl(getApiBaseUrl(), '/v1/rh-pulse/calls/challenge'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: session.address,
          selected_outcome: selected.id
        })
      });
      const payload = await response.json();
      if (!response.ok) throw apiError(payload);
      const parsed = RhPulseCallChallengeResponseSchema.parse(payload);
      setChallenge(parsed.data);
      setState('message_ready');
      setDetail('Review the exact server-issued message. Your wallet will sign this text without a transaction.');
    } catch (error) {
      handleApiFailure(error);
    }
  }

  async function sign() {
    if (!walletModule || !walletSession || !challenge) return;
    setState('signature_requested');
    setDetail('Your wallet will ask for a personal signature. No chain switch is requested.');
    try {
      setState('signature_pending');
      const signature = await walletModule.signRhPulseMessage(walletSession, challenge.message);
      const response = await fetch(toApiUrl(getApiBaseUrl(), '/v1/rh-pulse/calls'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          signature
        })
      });
      const payload = await response.json();
      if (!response.ok) throw apiError(payload);
      setState('call_accepted');
      setDetail('The verified call has been committed atomically.');
      const parsed = RhPulseCallSubmissionResponseSchema.parse(payload);
      setAccepted(parsed.data);
      setState('receipt_loading');
      window.requestAnimationFrame(() => {
        setState('receipt_ready');
        setDetail('The immutable receipt is ready.');
      });
    } catch (error) {
      if (walletErrorCode(error) === 'user_rejected') {
        setState('signature_rejected');
        setDetail('The signature request was cancelled. Nothing was recorded.');
        return;
      }
      handleApiFailure(error);
    }
  }

  function handleApiFailure(error: unknown) {
    const code = apiErrorCode(error);
    if (code === 'challenge_expired' || code === 'challenge_used') {
      setState('challenge_expired');
      setDetail('The signing request expired or was already used. Start again to receive a new single-use challenge.');
    } else if (code === 'window_closed' || code === 'window_not_open' || code === 'no_active_window' || code === 'calls_disabled') {
      setState('window_closed');
      setDetail('The call window is not accepting new signatures.');
    } else if (code === 'duplicate_call') {
      setState('duplicate_call');
      setDetail('This wallet already has one verified call in the current window.');
    } else if (code === 'signature_invalid' || code === 'challenge_tampered' || code === 'contract_wallet_signature_unsupported') {
      setState('signature_invalid');
      setDetail(code === 'contract_wallet_signature_unsupported'
        ? 'Contract-wallet signatures are not supported in this phase.'
        : 'The signature did not match the exact stored challenge.');
    } else {
      setState('server_unavailable');
      setDetail('RH Pulse could not complete the request. No partial call or receipt was recorded.');
    }
  }

  const canRetry = ['account_unavailable', 'signature_rejected', 'challenge_expired', 'server_unavailable'].includes(state);
  const receipt = accepted;
  return <div className="rh-pulse-sheet-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !receipt) onClose();
  }}>
    <aside
      ref={sheetRef}
      className={`rh-pulse-signing-sheet rh-pulse-signing-${state}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rh-pulse-signing-title"
      tabIndex={-1}
    >
      <div className="rh-pulse-sheet-handle" aria-hidden="true" />
      <header className="rh-pulse-sheet-header">
        <div>
          <span>SIGN A PUBLIC CALL</span>
          <h2 id="rh-pulse-signing-title">{receipt ? 'Your call is on the record.' : selected.label}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close signing sheet">×</button>
      </header>

      {!receipt && <p className="rh-pulse-signing-trust">
        <span aria-hidden="true">✓</span>
        This signature records your prediction. It cannot move funds or approve transactions.
      </p>}

      <div className="rh-pulse-signing-status" role="status" aria-live="polite">
        <span className="rh-pulse-signing-status-mark" aria-hidden="true" />
        <p><strong>{stateLabel(state)}</strong>{detail}</p>
      </div>

      {state === 'wallet_module_loading' && <div className="rh-pulse-signing-skeleton" aria-hidden="true" />}

      {state === 'wallet_options' && walletModule && <div className="rh-pulse-wallet-options">
        <button type="button" onClick={() => connect('injected')} disabled={!walletModule.hasInjectedWallet()}>
          <span>INJECTED</span>
          <strong>{walletModule.hasInjectedWallet() ? 'Browser wallet' : 'No injected wallet found'}</strong>
          <small>MetaMask, Rabby or another EIP-1193 wallet</small>
        </button>
        <button type="button" onClick={() => connect('walletconnect')} disabled={!walletModule.walletConnectConfigured()}>
          <span>MOBILE HANDOFF</span>
          <strong>WalletConnect</strong>
          <small>{walletModule.walletConnectConfigured() ? 'Open a supported mobile wallet' : 'Unavailable — project ID not configured'}</small>
        </button>
      </div>}

      {state === 'message_ready' && challenge && <div className="rh-pulse-message-review">
        <div className="rh-pulse-message-review-meta">
          <span>EXACT EIP-191 MESSAGE</span>
          <span>Expires {formatUtc(challenge.expires_at)}</span>
        </div>
        <pre>{challenge.message}</pre>
        <button type="button" className="rh-pulse-sign-action" onClick={sign}>Sign exact message</button>
      </div>}

      {canRetry && <button type="button" className="rh-pulse-sheet-retry" onClick={() => {
        setChallenge(null);
        setWalletSession(null);
        setState(walletModule ? 'wallet_options' : 'wallet_module_loading');
        setDetail('Choose an available wallet path.');
      }}>Try again</button>}

      {receipt && <RhPulseAcceptedReceipt payload={receipt} state={state} />}
    </aside>
  </div>;
}

function RhPulseAcceptedReceipt({
  payload,
  state
}: {
  payload: NonNullable<AcceptedCall>;
  state: SigningState;
}) {
  const call = payload.call;
  return <div className={`rh-pulse-accepted-receipt${state === 'receipt_ready' ? ' is-sealed' : ''}`}>
    <div className="rh-pulse-receipt-seal" aria-hidden="true"><span>✓</span></div>
    <div className="rh-pulse-receipt-number">
      <span>PUBLIC CALL</span>
      <strong>#{String(call.public_call_number).padStart(4, '0')}</strong>
    </div>
    {call.genesis.is_genesis && <p className="rh-pulse-genesis-mark">
      <span>GENESIS CALL</span>
      <strong>#{String(call.genesis.rank).padStart(4, '0')} / 4663</strong>
    </p>}
    <dl>
      <div><dt>Call</dt><dd>{call.selected_outcome_label}</dd></div>
      <div><dt>Recorded</dt><dd>{formatUtc(call.recorded_at)}</dd></div>
      <div><dt>Window closes</dt><dd>{call.window.closes_at ? formatUtc(call.window.closes_at) : 'Unavailable'}</dd></div>
      <div><dt>Verification</dt><dd>EOA / EIP-191 verified</dd></div>
    </dl>
    <a className="rh-pulse-receipt-link" href={publicPath(call.call_id)}>Open immutable receipt</a>
    <RhPulseCommunityConviction
      outcomes={payload.community_distribution.outcomes}
      total={payload.community_distribution.total_verified_calls}
      observedAt={payload.community_distribution.observed_at}
      selected={call.selected_outcome}
    />
  </div>;
}

function RhPulseCommunityConviction({
  outcomes,
  total,
  observedAt,
  selected
}: {
  outcomes: Array<{ outcome: RhPulseCallOutcome; count: number; percentage: number }>;
  total: number;
  observedAt: string;
  selected: RhPulseCallOutcome;
}) {
  return <section className="rh-pulse-community" aria-labelledby="rh-pulse-community-title">
    <div>
      <span>REVEALED AFTER SUBMISSION</span>
      <h3 id="rh-pulse-community-title">Community conviction</h3>
      <p>{total === 0 ? 'No verified calls yet.' : `${total} verified ${total === 1 ? 'call' : 'calls'}. One wallet, one call.`}</p>
    </div>
    <ul>
      {outcomes.map((outcome) => <li key={outcome.outcome} className={outcome.outcome === selected ? 'is-your-call' : ''}>
        <span>{outcomeLabel(outcome.outcome)}{outcome.outcome === selected ? ' / YOUR CALL' : ''}</span>
        <strong>{formatPercentage(outcome.percentage)}</strong>
        <i aria-hidden="true" style={{ '--rh-pulse-conviction': `${outcome.percentage}%` } as React.CSSProperties} />
      </li>)}
    </ul>
    <small>Observed {formatUtc(observedAt)}. Verified calls only; balance and volume never add weight.</small>
  </section>;
}

function stateLabel(state: SigningState) {
  const labels: Record<SigningState, string> = {
    wallet_module_loading: 'Loading wallet module',
    wallet_options: 'Wallet options ready',
    wallet_connecting: 'Connecting wallet',
    account_unavailable: 'Account unavailable',
    challenge_creating: 'Creating single-use challenge',
    message_ready: 'Message ready for review',
    signature_requested: 'Signature requested',
    signature_pending: 'Waiting for wallet signature',
    signature_rejected: 'Request cancelled',
    signature_invalid: 'Signature not accepted',
    challenge_expired: 'Challenge expired',
    window_closed: 'Window closed',
    duplicate_call: 'Call already recorded',
    server_unavailable: 'Service unavailable',
    call_accepted: 'Call committed',
    receipt_loading: 'Sealing receipt',
    receipt_ready: 'Receipt sealed'
  };
  return labels[state];
}

function apiError(payload: unknown) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return Object.assign(new Error(String(record.message ?? record.error ?? 'rh_pulse_request_failed')), {
    code: String(record.error ?? 'rh_pulse_request_failed')
  });
}

function apiErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function walletErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

function outcomeLabel(outcome: RhPulseCallOutcome) {
  return {
    agents_to_rwas: 'Agents → RWAs',
    memes_to_agents: 'Memes → Agents',
    memes_to_rwas: 'Memes → RWAs',
    no_qualified_rotation: 'No Qualified Rotation'
  }[outcome];
}

function formatPercentage(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}%`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value)) + ' UTC';
}

function publicPath(callId: string) {
  const context = window.__RH_PULSE_CONTEXT__;
  return context?.surface === 'rh-pulse' && window.location.hostname === context.publicHost
    ? `/calls/${encodeURIComponent(callId)}`
    : `/rh-pulse/calls/${encodeURIComponent(callId)}`;
}

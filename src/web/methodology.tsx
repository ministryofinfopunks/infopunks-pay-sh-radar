import React, { useEffect, useRef } from 'react';

type MethodologySection = {
  title: string;
  meaning: string;
  inputs: string;
  calculation: string;
  window: string;
  limitations: string;
};

export const methodologySections: MethodologySection[] = [
  {
    title: 'Trust Score',
    meaning: 'A quick read on how reliable a provider appears based on the evidence Infopunks can see.',
    inputs: 'Catalog metadata, pricing clarity, endpoint counts, recent catalog freshness, safe service reachability checks, latency evidence, response validity evidence, and receipt reliability evidence when available.',
    calculation: 'Infopunks combines the available trust signals into a 0 to 100 score. Strong catalog detail, clear pricing, fresh data, and reachable service metadata improve the score. Missing or unknown evidence is shown instead of guessed.',
    window: 'Uses the latest catalog snapshot and the most recent safe monitoring evidence available for the selected provider.',
    limitations: 'It does not execute paid Pay.sh calls or prove the provider will succeed for every task. Unknown monitor or receipt fields can lower confidence.'
  },
  {
    title: 'Signal Score',
    meaning: 'A measure of current ecosystem momentum around a provider.',
    inputs: 'Provider category, tags, narrative matches, catalog change events, endpoint metadata, and activity detected in the event stream.',
    calculation: 'Infopunks scores how strongly the provider matches active narratives and how much recent catalog-derived activity is visible. The score is catalog-derived and normalized to 0 to 100.',
    window: 'Uses the latest scoring batch, with recent catalog changes contributing when they are present.',
    limitations: 'It is not a popularity count, revenue estimate, or transaction-volume metric. Quiet providers can still be useful even when signal is low.'
  },
  {
    title: 'Narrative Heat',
    meaning: 'A view of which provider themes are showing the strongest activity across the Pay.sh catalog.',
    inputs: 'Provider categories, tags, narrative keywords, provider membership in each narrative, and recent signal movement.',
    calculation: 'Infopunks groups providers into plain-language narratives, then estimates heat from matching providers and momentum signals in that group.',
    window: 'Reflects the current catalog and the latest narrative scoring pass.',
    limitations: 'Narratives are interpretive groupings. They help spot themes, but they are not market forecasts.'
  },
  {
    title: 'Risk Level',
    meaning: 'A simple warning label for uncertainty or operational concern around the selected provider.',
    inputs: 'Trust score, unknown telemetry, endpoint health, service monitor status, pricing clarity, and route eligibility notes.',
    calculation: 'Infopunks summarizes visible concerns into a risk level so non-specialists can scan quickly before choosing a provider.',
    window: 'Uses the latest provider intelligence response and the most recent safe monitor evidence.',
    limitations: 'Risk is based only on observable metadata and safe checks. It cannot see private provider incidents or paid-call behavior.'
  },
  {
    title: 'Unknown Telemetry',
    meaning: 'The list of important fields that Infopunks expected but could not confirm.',
    inputs: 'Missing or unavailable trust components, signal components, monitor fields, endpoint evidence, receipt evidence, pricing evidence, and route notes.',
    calculation: 'The app collects unknown fields from the scoring and intelligence responses and surfaces them as explicit uncertainty.',
    window: 'Updated whenever provider intelligence or route intelligence is refreshed.',
    limitations: 'An unknown is not automatically bad. It means the current feed does not provide enough evidence to make a confident statement.'
  },
  {
    title: 'Graph Layer',
    meaning: 'The relationship map connecting providers, categories, narratives, and deterministic catalog links.',
    inputs: 'Catalog provider records, category assignments, tags, endpoint metadata, and narrative relationships.',
    calculation: 'Infopunks builds nodes and edges from known catalog relationships only. Edges are deterministic, meaning they come from visible metadata instead of inferred behavior.',
    window: 'Reflects the current loaded graph from the latest catalog ingest.',
    limitations: 'The graph shows known relationships, not hidden dependencies or live payment flows.'
  },
  {
    title: 'Provider Activity',
    meaning: 'A count of visible catalog and intelligence events for each provider over a selected period.',
    inputs: 'Discovery, trust, monitoring, pricing, schema, and signal events from the pulse event stream.',
    calculation: 'Events are grouped by provider and counted inside the selected 1 hour, 24 hour, or 7 day window.',
    window: 'Controlled by the activity tabs: 1h, 24h, or 7d.',
    limitations: 'Activity counts are event-spine activity, not Pay.sh transaction volume, customer demand, or provider revenue.'
  },
  {
    title: 'Recent Degradations',
    meaning: 'Recent signs that a provider service may be unreachable, slow, or otherwise degraded from safe metadata checks.',
    inputs: 'Safe service reachability events, monitor status, response time, HTTP status when available, and recent failure summaries.',
    calculation: 'Infopunks lists monitoring events that indicate degraded or failed service reachability.',
    window: 'Shows the most recent degradation events available in the current pulse summary.',
    limitations: 'These checks do not execute paid API calls. A degradation means reachability looked concerning, not that every provider function failed.'
  }
];

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function MethodologyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return <div className="methodology-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <aside ref={drawerRef} className="methodology-drawer panel" role="dialog" aria-modal="true" aria-labelledby="methodology-title">
      <div className="methodology-header">
        <div>
          <p className="eyebrow">Scoring Transparency</p>
          <h2 id="methodology-title">Methodology</h2>
          <p className="panel-caption">Plain-English notes on what each major score or metric means, what it uses, and where confidence is limited.</p>
        </div>
        <button ref={closeButtonRef} className="methodology-close" type="button" onClick={onClose} aria-label="Close methodology drawer">Close</button>
      </div>
      <div className="methodology-content">
        {methodologySections.map((section) => <section className="methodology-section" key={section.title}>
          <h3>{section.title}</h3>
          <dl>
            <div><dt>What it means</dt><dd>{section.meaning}</dd></div>
            <div><dt>Inputs used</dt><dd>{section.inputs}</dd></div>
            <div><dt>Calculation summary</dt><dd>{section.calculation}</dd></div>
            <div><dt>Time window</dt><dd>{section.window}</dd></div>
            <div><dt>Known limitations</dt><dd>{section.limitations}</dd></div>
          </dl>
        </section>)}
      </div>
    </aside>
  </div>;
}

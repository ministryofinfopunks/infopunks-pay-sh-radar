import React, { useEffect, useRef } from 'react';
import { mountEconomicProof } from './economicProof.js';
import evidence from './economicEvidence.json';
import './economicOS.css';

export const economicScreens = [
  ['overview', 'Overview'], ['launch', 'Launch your agent'],
  ['constitution', 'Constitution'], ['research', 'RWA Evidence Check'],
  ['radar', 'Radar pre-spend'], ['orders', 'Service orders'],
  ['delivery', 'Delivery & acceptance'], ['receipts', 'Economic receipts'],
  ['activity', 'Economic activity']
] as const;

export function EconomicOSPage() {
  const screen = window.location.pathname.replace(/\/$/, '').split('/')[2] || 'overview';
  const current = economicScreens.find(([key]) => key === screen);
  const content = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuTrigger = useRef<HTMLElement>(null);
  useEffect(() => {
    if (current && content.current) return mountEconomicProof(content.current, screen, evidence);
  }, [screen, current]);
  const links = <nav aria-label="Economic OS screens">{economicScreens.map(([key, label], i) =>
    <a key={key} href={`/economic-os/${key}`} aria-current={key === screen ? 'page' : undefined}>
      <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{label}
    </a>)}<a href="/">← Back to Radar</a></nav>;
  return <div className="economic-os">
    <div className="economic-scope"><strong>READ-ONLY / RELEASE HOLD</strong><span>INDEPENDENT ACCEPTANCE PENDING</span></div>
    <p className="economic-evidence-key">REAL SOURCE DATA: historical captures · LOCAL FIXTURE: retained scenarios · SIMULATED TRANSACTION: MOCK only · HUMAN REVIEW PENDING: research draft</p>
    <details className="economic-mobile-nav" ref={menu} onKeyDown={event => {
      if (event.key === 'Escape' && menu.current) { menu.current.open = false; menuTrigger.current?.focus(); }
    }}><summary ref={menuTrigger}>Economic OS / {current?.[1] || 'Page unavailable'} — all screens</summary>{links}</details>
    <div className="economic-layout">
      <aside className="economic-sidebar">{links}<p>Human ownership.<br />Delegated agents.<br />Inspectable evidence.</p></aside>
      <main className="economic-proof" ref={content}>
        {!current && <><h1>Economic OS page unavailable</h1><p>Choose a screen from the navigation.</p><a href="/economic-os/overview">Open overview</a></>}
      </main>
    </div>
  </div>;
}

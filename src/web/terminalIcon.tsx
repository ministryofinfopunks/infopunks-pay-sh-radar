export type TerminalIconName = 'skull' | 'arrow' | 'eye' | 'judgment' | 'execution' | 'evaluation' | 'receipt' | 'solana' | 'rh' | 'menu' | 'close' | 'unknown';
const paths: Record<TerminalIconName, React.ReactNode> = {
  skull: <><path strokeDasharray="1.3 1.8" d="M7 3 12 1 17 3 20 8 20 13 17 17 17 20 14 23 10 23 7 20 7 17 4 13 4 8Z" /><path d="M7 10h3v3H7zm7 0h3v3h-3zm-3 5 1-2 1 2M9 19h6m-4 0v2m2-2v2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="4" /></>,
  judgment: <><path d="M12 3C8-1 4 3 5 6 1 6 1 11 4 12 1 16 4 20 8 19c0 4 4 5 4 1V3Zm0 0c4-4 8 0 7 3 4 0 4 5 1 6 3 4 0 8-4 7 0 4-4 5-4 1" /><path d="m7 7 2 2-2 3m10-5-2 2 2 3M7 15l2-1m8 1-2-1" /></>,
  execution: <path d="m14 1-10 13h7l-2 9 11-14h-7l1-8Z" />,
  evaluation: <><path d="M2 15h4v8H2zm8-7h4v15h-4zm8-7h4v22h-4z" /></>,
  receipt: <><path d="M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8M8 16h8M8 19h5" /></>,
  solana: <g fill="currentColor" stroke="none"><path d="m6 3-5 5h17l5-5H6Zm-5 7 5 5h17l-5-5H1Zm5 7-5 5h17l5-5H6Z" /></g>,
  rh: <><path fill="currentColor" stroke="none" d="m17 1 6 4-8 10-7 4-5 4 4-12 4-7Z" /><path stroke="var(--radar-bg)" d="M4 21 18 4m-8 7 3 5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  unknown: <><circle cx="12" cy="12" r="9" /><path d="M7 12h10" /></>
};
export function TerminalIcon({ name }: { name: TerminalIconName }) {
  return <svg className="terminal-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

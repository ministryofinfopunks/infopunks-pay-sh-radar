import type { RhPulseReadModel } from '../../shared/rhPulse';

const FALLBACK_HERO: RhPulseReadModel['hero'] = {
  eyebrow: 'INFOPUNKS / RH PULSE',
  question: 'The agent economy is live. What does it become next?',
  supporting_copy: 'Memes brought liquidity. Agents brought coordination and new markets. RWAs remain the structural destination.',
  cta_supporting_line: 'See the connections. Call the next twenty-four hours.'
};

export function RhPulseHero({ hero = FALLBACK_HERO }: { hero?: RhPulseReadModel['hero'] }) {
  return <section className="rh-pulse-hero" aria-labelledby="rh-pulse-hero-title">
    <p className="rh-pulse-kicker">Call the Rotation</p>
    <h1 id="rh-pulse-hero-title">{hero.question}</h1>
    <p className="rh-pulse-hero-copy">{hero.supporting_copy}</p>
    <p className="rh-pulse-hero-cta-line">{hero.cta_supporting_line}</p>
  </section>;
}

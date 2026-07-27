import type {
  RhPulseCallOptionSchema,
  RhPulseConnectionSnapshot,
  RhPulseReadModel
} from '../../shared/rhPulse';
import type { z } from 'zod';

export type RhPulseCallOption = z.infer<typeof RhPulseCallOptionSchema>;
export type RhPulseConnectionView = Pick<
  RhPulseConnectionSnapshot,
  'id' | 'label' | 'relative_strength' | 'evidence_type' | 'confidence' | 'freshness' | 'explanation' | 'supporting_observation_count' | 'under_watch' | 'is_strongest_current_signal'
>;
export type RhPulsePageData = RhPulseReadModel;

export const EMPTY_RH_PULSE_CONNECTIONS: RhPulseConnectionView[] = [
  {
    id: 'memes_to_agents',
    label: 'Memes ↔ Agents',
    relative_strength: null,
    evidence_type: 'insufficient_evidence',
    confidence: 'insufficient',
    freshness: 'unavailable',
    explanation: 'Checking reviewed evidence.',
    supporting_observation_count: 0,
    under_watch: false,
    is_strongest_current_signal: false
  },
  {
    id: 'memes_to_rwas',
    label: 'Memes ↔ RWAs',
    relative_strength: null,
    evidence_type: 'insufficient_evidence',
    confidence: 'insufficient',
    freshness: 'unavailable',
    explanation: 'Checking reviewed evidence.',
    supporting_observation_count: 0,
    under_watch: false,
    is_strongest_current_signal: false
  },
  {
    id: 'agents_to_rwas',
    label: 'Agents ↔ RWAs',
    relative_strength: null,
    evidence_type: 'insufficient_evidence',
    confidence: 'insufficient',
    freshness: 'unavailable',
    explanation: 'Checking reviewed evidence.',
    supporting_observation_count: 0,
    under_watch: true,
    is_strongest_current_signal: false
  }
];

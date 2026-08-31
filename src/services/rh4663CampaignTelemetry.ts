import { z } from 'zod';

/** Privacy-preserving campaign funnel telemetry. No wallet, signature, IP, or free-form data is accepted. */
export const Rh4663CampaignEventSchema = z.object({
  event: z.enum([
    '4663_print_viewed', '4663_print_provenance_opened', '4663_make_call_clicked', '4663_call_started',
    '4663_call_signed', '4663_call_accepted', '4663_call_share_clicked', '4663_call_share_completed',
    '4663_consensus_viewed', '4663_resolution_viewed', '4663_resolution_shared', '4663_returning_caller',
    '4663_print_candidate_generated', '4663_print_candidate_incomplete', '4663_print_frozen', '4663_print_provider_disagreement'
  ]),
  surface: z.enum(['print', 'pulse', 'call', 'consensus', 'resolution', 'home']).optional(),
  print_id: z.string().max(80).optional(),
  window_id: z.string().max(80).optional()
}).strict();
export type Rh4663CampaignEvent = z.infer<typeof Rh4663CampaignEventSchema>;

export class Rh4663CampaignTelemetry {
  private readonly totals = new Map<Rh4663CampaignEvent['event'], number>();
  constructor(private readonly log: (entry: Record<string, unknown>) => void = (entry) => console.log(JSON.stringify(entry))) {}

  record(input: Rh4663CampaignEvent) {
    const event = Rh4663CampaignEventSchema.parse(input);
    const total = (this.totals.get(event.event) ?? 0) + 1;
    this.totals.set(event.event, total);
    this.log({ event: 'rh4663_campaign_funnel', funnel_event: event.event, surface: event.surface ?? null, print_id: event.print_id ?? null, window_id: event.window_id ?? null, total });
    return { accepted: true as const };
  }

  metrics() { return Object.fromEntries(this.totals); }
}

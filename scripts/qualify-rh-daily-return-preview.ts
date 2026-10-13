/** Local synthetic visual evidence only. No provider collection or production flags. */
import { createApp } from '../src/api/app';
import { InMemoryRhChainMarketSnapshotStore } from '../src/services/rhChainMarketSnapshotService';
import { InMemoryAutomatedObservationStore, RhAutomatedObservationReceiptService } from '../src/services/rhAutomatedObservationReceiptService';
import { InMemoryRh4663UtcDayObservationStore } from '../src/services/rh4663UtcDayObservationService';
import { moverSamples } from '../tests/helpers/rhMoverObservations';
async function main() {
const market = new InMemoryRhChainMarketSnapshotStore(), store = new InMemoryAutomatedObservationStore();
const at = new Date(), yesterday = new Date(at.getTime() - 86400000).toISOString().slice(0, 10);
for (const [index, row] of moverSamples().entries()) {
  const observed = new Date(at.getTime() - (12 - index) * 5 * 60000).toISOString();
  await market.save({ ...row, snapshot_id: 'current-fixture-' + index, captured_at: observed, provider_timestamp: observed });
  const prior = `${yesterday}T${index < 10 ? '0' : ''}${index}:00:00.000Z`;
  await market.save({ ...row, snapshot_id: 'yesterday-fixture-' + index, captured_at: prior, provider_timestamp: prior });
}
const service = new RhAutomatedObservationReceiptService({ store, market, days: new InMemoryRh4663UtcDayObservationStore(), now: () => at });
const edition = await service.finalize(yesterday);
// An isolated memory fixture represents an already published record. Automatic activation stays off.
await store.publish(edition.edition_id, 'SYNTHETIC_VISUAL_FIXTURE_ONLY');
globalThis.fetch = async () => { throw new Error('preview_remote_provider_disabled'); };
const app = await createApp(undefined, undefined, { rhAutomatedObservationStore: store, rhChainMarketSnapshotStore: market, rhChainMarketSnapshotOptions: { enabled: false, storageEnabled: true } });
await app.listen({ host: '127.0.0.1', port: 5193 });

}
void main();

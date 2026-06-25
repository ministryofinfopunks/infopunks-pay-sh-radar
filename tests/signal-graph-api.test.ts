import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';

describe('signal graph API', () => {
  it('serves the full graph shape', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/graph' });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.tagline).toBe('Stop scrolling the feed. Read the graph.');
    expect(Array.isArray(response.json().data.nodes)).toBe(true);
    expect(Array.isArray(response.json().data.edges)).toBe(true);
    expect(response.json().data.evidence).toBeTruthy();
    expect(response.json().data.nodes.length).toBeGreaterThanOrEqual(25);
    expect(response.json().data.edges.length).toBeGreaterThanOrEqual(35);
    expect(response.json().data.stats.cluster_count).toBe(5);

    await app.close();
  });

  it('serves cluster detail, node detail, and ripples', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const clusters = await app.inject({ method: 'GET', url: '/v1/graph/clusters' });
    expect(clusters.statusCode).toBe(200);
    expect(clusters.json().data.clusters.some((cluster: any) => cluster.id === 'machine_markets')).toBe(true);

    const clusterDetail = await app.inject({ method: 'GET', url: '/v1/graph/clusters/machine_markets' });
    expect(clusterDetail.statusCode).toBe(200);
    expect(clusterDetail.json().data.cluster.id).toBe('machine_markets');
    expect(clusterDetail.json().data.nodes.some((node: any) => node.id === 'project_machine_markets')).toBe(true);

    const nodeDetail = await app.inject({ method: 'GET', url: '/v1/graph/nodes/project_pay_sh' });
    expect(nodeDetail.statusCode).toBe(200);
    expect(nodeDetail.json().data.node.label).toBe('Pay.sh');
    expect(nodeDetail.json().data.connected_edges.some((edge: any) => edge.id === 'edge_pay_sh_pre_spend')).toBe(true);

    const ripples = await app.inject({ method: 'GET', url: '/v1/graph/ripples' });
    expect(ripples.statusCode).toBe(200);
    expect(ripples.json().data.ripples.some((ripple: any) => ripple.id === 'ripple_pre_spend_24h')).toBe(true);

    await app.close();
  });

  it('returns consistent 404 behavior for unknown cluster and node', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const clusterMissing = await app.inject({ method: 'GET', url: '/v1/graph/clusters/missing_cluster' });
    expect(clusterMissing.statusCode).toBe(404);
    expect(clusterMissing.json().error).toBe('signal_graph_cluster_not_found');

    const nodeMissing = await app.inject({ method: 'GET', url: '/v1/graph/nodes/missing_node' });
    expect(nodeMissing.statusCode).toBe(404);
    expect(nodeMissing.json().error).toBe('signal_graph_node_not_found');

    await app.close();
  });

  it('returns deterministic signal graph check assessments', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({
      method: 'POST',
      url: '/v1/graph/check',
      payload: {
        label: 'Carbon credit claim thread',
        summary: 'Integrity dispute is spreading faster than the receipts.',
        source_url: 'https://example.com/carbon-thread',
        cluster_id: 'carbon_finance_2_0'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.generated_node_preview.id).toMatch(/^preview_/);
    expect(response.json().data.generated_node_preview.cluster_id).toBe('carbon_finance_2_0');
    expect(response.json().data.suggested_proof_state).toBe('disputed');
    expect(response.json().data.suggested_edges.some((edge: any) => edge.target_node_id === 'claim_carbon_credits_sensitive')).toBe(true);

    await app.close();
  });

  it('returns stable entity lookup nodes and empty arrays for unknown ids', async () => {
    const app = await createApp(emptyIntelligenceStore());

    const claimLookup = await app.inject({ method: 'GET', url: '/v1/graph/entities/claim/claim_001' });
    expect(claimLookup.statusCode).toBe(200);
    expect(claimLookup.json().data.entity_type).toBe('claim');
    expect(claimLookup.json().data.entity_id).toBe('claim_001');
    expect(claimLookup.json().data.nodes.some((node: any) => node.id === 'claim_route_memory')).toBe(true);

    const receiptLookup = await app.inject({ method: 'GET', url: '/v1/graph/entities/receipt/receipt_missing' });
    expect(receiptLookup.statusCode).toBe(200);
    expect(receiptLookup.json().data.nodes).toEqual([]);

    await app.close();
  });

  it('returns 400 for unsupported graph entity types', async () => {
    const app = await createApp(emptyIntelligenceStore());
    const response = await app.inject({ method: 'GET', url: '/v1/graph/entities/token/token_001' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('unsupported_signal_graph_entity_type');

    await app.close();
  });
});

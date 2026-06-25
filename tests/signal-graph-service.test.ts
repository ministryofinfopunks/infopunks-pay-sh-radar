import { describe, expect, it } from 'vitest';
import { checkSignalGraph, findSignalGraphNodesForEntity, getSignalGraph, getSignalGraphCluster, getSignalGraphNode, getSignalGraphRipples } from '../src/services/signalGraphService';

describe('signal graph service', () => {
  it('returns a rich seeded graph payload', () => {
    const graph = getSignalGraph();

    expect(graph.tagline).toBe('Stop scrolling the feed. Read the graph.');
    expect(graph.clusters).toHaveLength(5);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(25);
    expect(graph.edges.length).toBeGreaterThanOrEqual(35);
    expect(graph.ripples.length).toBeGreaterThanOrEqual(5);
    expect(graph.stats.node_count).toBe(graph.nodes.length);
    expect(graph.stats.edge_count).toBe(graph.edges.length);
    expect(graph.nodes.some((node) => node.label === 'Pay.sh')).toBe(true);
    expect(graph.nodes.some((node) => node.label === 'Pre-Spend Intelligence')).toBe(true);
    expect(graph.nodes.some((node) => node.label === 'No receipt, no trust')).toBe(true);
    expect(graph.edges.some((edge) => edge.type === 'proof_link')).toBe(true);
    expect(graph.edges.some((edge) => edge.type === 'amplification')).toBe(true);
  });

  it('returns cluster and node detail lookups', () => {
    const cluster = getSignalGraphCluster('pre_spend_intelligence');
    const node = getSignalGraphNode('project_pay_sh');

    expect(cluster?.cluster.id).toBe('pre_spend_intelligence');
    expect(cluster?.nodes.some((item) => item.id === 'project_pre_spend_intelligence')).toBe(true);
    expect(cluster?.ripples.some((item) => item.id === 'ripple_pre_spend_24h')).toBe(true);

    expect(node?.node.id).toBe('project_pay_sh');
    expect(node?.cluster.id).toBe('agentic_payments');
    expect(node?.connected_edges.some((edge) => edge.id === 'edge_pay_sh_pre_spend')).toBe(true);
    expect(node?.related_nodes.some((item) => item.id === 'project_pre_spend_intelligence')).toBe(true);
  });

  it('returns deterministic ripples and check results', () => {
    const ripples = getSignalGraphRipples();
    const result = checkSignalGraph({
      label: 'Agent wallets need route memory before autonomous spend.',
      summary: 'Receipt-backed route memory should control machine spend.'
    });

    expect(ripples.some((ripple) => ripple.cluster_id === 'ct_subcultures')).toBe(true);
    expect(result.generated_node_preview.id).toMatch(/^preview_/);
    expect(result.suggested_proof_state).toBe('validated');
    expect(result.suggested_edges.length).toBeGreaterThan(0);
    expect(result.suggested_edges.some((edge) => edge.target_node_id === 'claim_no_receipt_no_trust')).toBe(true);
  });

  it('finds explicit graph links for known receipt, claim, and loop entities', () => {
    const receipt = findSignalGraphNodesForEntity('receipt', 'receipt_001');
    const claim = findSignalGraphNodesForEntity('claim', 'claim_001');
    const loop = findSignalGraphNodesForEntity('loop', 'loop_pre_spend_route');

    expect(receipt.nodes.some((node) => node.id === 'claim_route_memory')).toBe(true);
    expect(claim.nodes.some((node) => node.id === 'claim_route_memory')).toBe(true);
    expect(loop.nodes.some((node) => node.id === 'project_pre_spend_intelligence')).toBe(true);
  });

  it('returns empty graph links for unknown entity ids', () => {
    const result = findSignalGraphNodesForEntity('route', 'route_missing');
    expect(result.entity_type).toBe('route');
    expect(result.entity_id).toBe('route_missing');
    expect(result.nodes).toEqual([]);
  });
});

const MACHINE_ID = process.env.HARNESS_MACHINE_ID ?? 'did:peaq:translation-bot-01';
const TRANSLATION_URL = process.env.ALIBABA_MACHINE_TRANSLATION_GENERAL_URL
  ?? 'https://machinetranslation.alibaba.gateway-402.com/api/translate/web/general';
const RADAR_BASE_URL = process.env.RADAR_BASE_URL ?? 'http://localhost:8787';
const RADAR_ADMIN_TOKEN = process.env.INFOPUNKS_ADMIN_TOKEN ?? '';

const payload = {
  FormatType: 'text',
  Scene: 'general',
  SourceLanguage: 'en',
  SourceText: 'Machines should not spend blind.',
  TargetLanguage: 'es'
};

function nowIso() {
  return new Date().toISOString();
}

function safePreview(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 280);
}

async function run() {
  const startedAt = nowIso();
  const startedMs = Date.now();
  let executionStatus = 'failed';
  let executionOccurred = false;
  let responseBody = null;
  let error = null;

  try {
    const response = await fetch(TRANSLATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    executionOccurred = true;
    responseBody = await response.json().catch(() => null);
    executionStatus = response.ok ? 'succeeded' : 'failed';
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const completedAt = nowIso();
  const artifact = {
    machine_id: MACHINE_ID,
    service_id: 'alibaba-machine-translation-general',
    fqn: 'solana-foundation/alibaba/machinetranslation',
    source_market: 'pay.sh',
    chain: 'solana',
    execution_status: executionStatus,
    execution_occurred: executionOccurred,
    payment_occurred: false,
    payment_evidence: null,
    execution_started_at: startedAt,
    execution_completed_at: completedAt,
    execution_latency_ms: Math.max(0, Date.now() - startedMs),
    request_summary: payload,
    response_summary: {
      translated_text_preview: safePreview(responseBody?.Data?.Translated),
      code: responseBody?.Code ?? null,
      request_id: responseBody?.RequestId ?? null,
      upstream_error: error
    },
    executor: {
      name: 'infopunks-pay-sh-agent-harness',
      version: 'local',
      mode: 'manual'
    },
    artifact_signature: null
  };

  let ingest = { attempted: false, ok: false, status: null, body: null };
  if (RADAR_ADMIN_TOKEN) {
    ingest.attempted = true;
    const response = await fetch(`${RADAR_BASE_URL}/v1/machine-execution/machine-translation-general/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RADAR_ADMIN_TOKEN}`
      },
      body: JSON.stringify(artifact)
    });
    ingest.status = response.status;
    ingest.body = await response.json().catch(() => null);
    ingest.ok = response.ok;
  }

  console.log(JSON.stringify({
    service_id: artifact.service_id,
    execution_status: artifact.execution_status,
    execution_occurred: artifact.execution_occurred,
    translated_text_preview: artifact.response_summary.translated_text_preview || null,
    ingest
  }, null, 2));
}

run().catch((error) => {
  console.error(`run-alibaba-machine-translation-general-harness failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

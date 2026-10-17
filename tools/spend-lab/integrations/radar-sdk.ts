import type { CreateInfopunksClientOptions } from '../../../src/sdk/judgmentClient';
import type { HttpLab } from '../successor/http-client';
/** Controller-only SDK seam. The lab supplies a disposable non-EVM payment adapter.
 * Agents cannot inject wallet callbacks, transports, credentials, or spending policy.
 */
export function radarSdkAssessment(
  lab: Pick<HttpLab, 'client'>,
  options: Pick<CreateInfopunksClientOptions, 'sessionStore' | 'onTransition'> = {},
) {
  const client = lab.client(options);
  return { requestJudgment: client.judge, resumeJudgment: client.resume };
}

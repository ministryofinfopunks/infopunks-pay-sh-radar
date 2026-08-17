export type PostgresFailureKind = 'connectivity' | 'schema' | 'query';

export function classifyPostgresFailure(error: unknown, fallback: PostgresFailureKind = 'query'): PostgresFailureKind {
  const code = postgresErrorCode(error);
  if (code && (code.startsWith('08') || ['53300', '57P01', '57P02', '57P03'].includes(code))) return 'connectivity';
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code ?? '')) return 'connectivity';
  if (code && ['3F000', '42P01', '42501', '42703', '42P07'].includes(code)) return 'schema';
  const message = postgresErrorMessage(error).toLowerCase();
  if (message.includes('connection') || message.includes('timeout') || message.includes('too many clients')) return 'connectivity';
  return fallback;
}

export function postgresErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function safeOperationalErrorMessage(error: unknown, maxLength = 320): string {
  const message = postgresErrorMessage(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(authorization|token|password|secret)=?\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, maxLength);
}

export function postgresErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'operational_failure';
}

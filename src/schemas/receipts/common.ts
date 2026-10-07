import { z } from 'zod';
export const ReceiptIdSchema = z.string().min(1).max(256);
export const ReceiptHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const ReceiptTimeSchema = z.string().datetime({ offset: true });
export const ReceiptMoneySchema = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
export const ReceiptVersionSchema = z.literal('canonical-receipts.v1');

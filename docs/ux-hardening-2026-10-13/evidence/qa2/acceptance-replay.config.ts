import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],test:{include:['docs/ux-hardening-2026-10-13/evidence/qa2/acceptance-cases.tsx'],environment:'jsdom',globals:true}});

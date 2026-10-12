import { createContext } from 'react';

/** Global chrome is owned by the entry shell; standalone page tests retain navigation. */
export const RadarShellContext = createContext(false);

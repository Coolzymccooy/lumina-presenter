// Vitest global setup — runs once per worker before tests load.
// Tells React it's running in an act() environment so test-time updates
// don't emit "not configured to support act(...)" warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import '@testing-library/jest-dom/vitest';

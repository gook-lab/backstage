import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetProgressCache } from '../lib/progress';

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  resetProgressCache();
});

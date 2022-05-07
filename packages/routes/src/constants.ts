export const PAGE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.md', '.mdx'];

export const DEFAULT_IGNORE = [
  '**/components/**',
  '**/hooks/**',
  '**/utils/**',
  '**/constants/**',
  '**/services/**',
  '**/apis/**',
  '**/styles/**',
  '**/assets/**',
  // types
  '**/types/**',
  '**/*.d.ts',
  // test
  '**/tests/**',
  '**/__tests__/**',
  '**/*{.test,.spec,.e2e}{.js,.jsx,.ts,.tsx}',
];

export const ROUTES_MODULE_ID = 'virtual:conventional-routes';
export const RESOLVED_ROUTES_MODULE_ID = '\0' + ROUTES_MODULE_ID;

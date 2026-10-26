import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['**/generated/**'],
  },
  ...baseConfig,
];

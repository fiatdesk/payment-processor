// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
// Integration lane: `npx nx run api:test-anvil` (needs Foundry's `anvil`).
export default {
  displayName: 'api-anvil',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/apps/api-anvil',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['**/*.anvil.spec.ts'],
};

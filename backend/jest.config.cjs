module.exports = {
  preset: 'ts-jest',
  transform: {
    // 排除 .d.ts 避免被當作測試檔案執行
    '^(?!.*\\.d\\.ts$).+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // 忽略所有 .d.ts 檔案，避免「Your test suite must contain at least one test」失敗
  testPathIgnorePatterns: ['\\.d\\.ts$'],
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './html-report',
      filename: 'report.html',
      expand: true,
    }],
  ],
};
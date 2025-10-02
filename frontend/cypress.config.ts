import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    reporter: 'cypress-mochawesome-reporter',
    reporterOptions: {
      charts: true,
      reportPageTitle: 'Snooker Scoreboard E2E Test Report',
      embeddedScreenshots: true,
      inlineAssets: true,
      saveAllAttempts: false,
    },
    setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
    },
  },
});

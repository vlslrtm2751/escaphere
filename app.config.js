/**
 * Extends app.json.
 *
 * A GitHub Pages project site is served from a subpath (/escaphere/), so the web
 * bundle must be built with a matching base URL. Expo's dev server reads the same
 * value, so hard-coding it in app.json would move local development to
 * localhost:8081/escaphere/ as a side effect. It comes from the environment
 * instead, and only the deploy workflow sets it.
 */
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.PAGES_BASE_URL ?? '',
  },
});

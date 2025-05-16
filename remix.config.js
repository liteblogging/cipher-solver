/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: `src`,
  ignoredRouteFiles: [`**/.*`],
  serverModuleFormat: "cjs",
  serverPlatform: "node",
  serverDependenciesToBundle: "all",
  future: {},
  // Set the Netlify adapter for deployment
  server: "./server.js",
}

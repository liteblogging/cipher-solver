/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: `src`,
  ignoredRouteFiles: [`**/.*`],
  serverModuleFormat: "esm",
  serverPlatform: "node",
  publicPath: "/build/",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  future: {
    v2_routeConvention: true,
    v2_errorBoundary: true,
    v2_normalizeFormMethod: true,
    v2_meta: true,
  },
} 
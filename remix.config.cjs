/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "src",
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "esm",
  serverPlatform: "node",
  publicPath: "/build/",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  server: process.env.NODE_ENV === "development" ? undefined : "./server.js",
  future: {},
  serverDependenciesToBundle: [
    /^(?!react|react-dom).*/,
    "@remix-run/node"
  ]
} 
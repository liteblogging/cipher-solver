const { createRequestHandler } = require("@remix-run/netlify");
const path = require("path");

const BUILD_DIR = path.join(process.cwd(), "public/build");

/**
 * @type {import('@netlify/functions').Handler}
 */
exports.handler = async function (event, context) {
  const requestHandler = createRequestHandler({
    build: require(BUILD_DIR),
    mode: process.env.NODE_ENV,
  });

  return requestHandler(event, context);
}; 
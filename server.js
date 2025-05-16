import { createRequestHandler } from "@remix-run/node";
import * as build from "./build/index.js";

// This creates a standard Node.js server handler
const remixHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export default remixHandler; 
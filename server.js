// This file is used by Vercel to run your Remix app

import { createRequestHandler } from "@vercel/remix";

// Import the built app
import * as build from "./build/index.js";

const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

export default handler; 
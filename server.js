// This file is used by Vercel to run your Remix app

import { createRequestHandler } from "@vercel/remix";
import * as build from "./build/index.js";

export default createRequestHandler({
  build,
  mode: process.env.NODE_ENV
}); 
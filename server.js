// This file is used by Vercel to run your Remix app

import { createRequestHandler } from "@vercel/remix";
import * as build from "@remix-run/dev/server-build";

export default createRequestHandler({
  build,
  mode: process.env.NODE_ENV
}); 
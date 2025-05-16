// This file is used by Vercel to run your Remix app

import { createRequestHandler } from "@vercel/remix";

// This is a Vercel server that uses the request handler from @vercel/remix
export default async function (request, context) {
  // Import the build dynamically - this won't happen at build time
  const build = await import('./build/index.js');
  
  const handler = createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  });

  return handler(request, context);
} 
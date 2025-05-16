// api/index.js - This is a special file that Vercel will use as the entry point
import { createRequestHandler } from "@vercel/remix";

// Use dynamic imports to avoid build-time errors
export default async function handler(request, context) {
  // This import happens at runtime, not build time
  const build = await import('../build/index.js');
  
  return createRequestHandler({
    build,
    mode: process.env.NODE_ENV
  })(request, context);
} 
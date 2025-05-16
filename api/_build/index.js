// Simplified API handler for Vercel
import { createRequestHandler } from "@vercel/remix";

// Import handling for ES modules and dynamic imports
export default async (request, context) => {
  try {
    // Dynamically import the build
    const build = await import('../../build/index.js').catch(e => {
      console.error('Failed to import build:', e);
      return null;
    });

    if (!build) {
      return new Response('Build not found', { status: 500 });
    }

    // Create the Remix request handler
    const handler = createRequestHandler({
      build,
      mode: process.env.NODE_ENV || 'production'
    });

    // Handle the request
    return handler(request, context);
  } catch (error) {
    console.error('Error in API handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}; 
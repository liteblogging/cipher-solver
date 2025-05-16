import { createRequestHandler } from "@remix-run/node";
import * as build from "../build/index.js";

// Handle HTTP requests
export default async function handler(request) {
  const requestHandler = createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  });
  
  return requestHandler(request);
} 
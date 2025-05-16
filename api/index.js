import { createRequestHandler } from "@remix-run/node";
import * as build from "../build/index.js";

// This is the standard Vercel serverless function handler
export default async function handler(req, res) {
  // Create the Remix request handler
  const requestHandler = createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  });

  // Get the method and url from the incoming request
  const { method, url } = req;

  try {
    // Convert the Node.js request to a fetch Request
    const remixRequest = new Request(
      `https://${req.headers.host}${url}`,
      {
        method,
        headers: new Headers(req.headers),
        body: 
          method !== "GET" && method !== "HEAD" 
            ? req
            : undefined
      }
    );

    // Call the Remix request handler
    const response = await requestHandler(remixRequest);
    
    // Convert the fetch Response to a Node.js response
    const data = await response.arrayBuffer();
    const headers = {};
    
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Send the response
    res.status(response.status);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    res.send(Buffer.from(data));
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).send("Internal Server Error");
  }
} 
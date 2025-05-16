// api/index.js - This is a special file that Vercel will use as the entry point for the serverless function
import { createRequestHandler } from "@vercel/remix";
import * as build from "../build/index.js";

// Create a request handler for Remix
export default createRequestHandler({ build, mode: process.env.NODE_ENV }); 
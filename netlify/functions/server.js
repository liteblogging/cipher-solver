import { createRequestHandler } from "@remix-run/node";
import * as serverBuild from "../../build/index.js";

export const handler = createRequestHandler({
  build: serverBuild,
  mode: process.env.NODE_ENV
}); 
/**
 * Inngest API Route Handler
 *
 * Serves as the endpoint for the Inngest framework to discover
 * and invoke background functions. Register all functions here.
 *
 * In development: Inngest Dev Server auto-discovers this endpoint
 * In production: Set INNGEST_SIGNING_KEY for secure communication
 *
 * @see https://www.inngest.com/docs/frameworks/nextjs
 */
import { serve } from "inngest/next";
import { inngest, functions } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

/**
 * This file provides compatibility helpers for packages that might
 * cause import issues when deploying to Deno.
 */

// Import the memoize package and re-export it with explicit exports
import memoizeOriginal from 'memoize';

// Re-export with a consistent interface
export const memoize = memoizeOriginal; 
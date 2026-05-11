// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Build configuration: defineCloudflareConfig returns an OpenNextConfig tailored
// for Cloudflare but ignores unknown top-level properties like `buildCommand`.
// To override buildCommand, compose a new OpenNextConfig object that spreads
// the cloud-specific defaults and adds buildCommand explicitly.
const cloudConfig = defineCloudflareConfig({
	// For best results consider enabling R2 caching
	// See https://opennext.js.org/cloudflare/caching for more details
	// incrementalCache: r2IncrementalCache,
});

export default {
	...cloudConfig,
	// Prevent recursion: when the OpenNext builder runs it should call the
	// Next.js `next build` command directly (not `npm run build`).
	buildCommand: "next build",
};

import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * The current AI Node SDK version.
 *
 * Source of truth: `aiNodeSdkVersion` field in this package's `package.json`.
 *
 * This version is sent to the Strapi API as `includeAiNodesSdkVersion` to fetch
 * AI community nodes compatible with the current n8n instance. Bump only on
 * significant breaking changes to the AI Node SDK (expected to be very rare).
 */
function readAiNodeSdkVersion(): number {
	const pkgPath = resolve(__dirname, '..', 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	return pkg.aiNodeSdkVersion;
}

export const AI_NODE_SDK_VERSION: number = readAiNodeSdkVersion();

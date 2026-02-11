import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const ROOT = resolve(import.meta.dirname);
// ROOT is packages/cli/src/modules/mcp/apps/ — go up 4 levels to packages/cli/
const CLI_ROOT = resolve(ROOT, '..', '..', '..', '..');

// Build a single app per invocation to avoid shared chunks that break vite-plugin-singlefile.
// The MCP_APP env var selects which app to build.
// The build:mcp-apps script runs this config once per app.
const appName = process.env.MCP_APP;
if (!appName) {
	throw new Error('MCP_APP env var is required. Set it to the app directory name.');
}

export default defineConfig({
	root: ROOT,
	plugins: [viteSingleFile()],
	build: {
		outDir: resolve(CLI_ROOT, 'dist', 'mcp-apps'),
		rollupOptions: {
			input: {
				[appName]: resolve(ROOT, appName, 'index.html'),
			},
		},
		emptyOutDir: false,
	},
});

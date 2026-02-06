/**
 * Question Quality Experiment - CLI Entry Point
 *
 * Usage:
 *   pnpm eval:questions --dataset "question-quality" --name "QQ-v1"
 *   pnpm eval:questions --local
 *   pnpm eval:questions --seed --dataset "question-quality"
 */
import { Client } from 'langsmith/client';

import { seedDataset } from './dataset.js';
import { runLocal, runLangSmith } from './runner.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
	dataset: string;
	name: string;
	local: boolean;
	seed: boolean;
	concurrency: number;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);

	let dataset = 'question-quality';
	let name = 'QQ';
	let local = false;
	let seed = false;
	let concurrency = 3;

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--dataset':
				dataset = args[++i] ?? dataset;
				break;
			case '--name':
				name = args[++i] ?? name;
				break;
			case '--local':
				local = true;
				break;
			case '--seed':
				seed = true;
				break;
			case '--concurrency': {
				const parsed = parseInt(args[++i], 10);
				if (!isNaN(parsed) && parsed > 0) {
					concurrency = parsed;
				}
				break;
			}
			default:
				if (args[i].startsWith('-')) {
					console.warn(`Unknown flag: ${args[i]}`);
				}
				break;
		}
	}

	return { dataset, name, local, seed, concurrency };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = parseArgs();

	// Handle --seed
	if (args.seed) {
		const apiKey = process.env.LANGSMITH_API_KEY;
		if (!apiKey) {
			throw new Error('LANGSMITH_API_KEY environment variable is required for --seed');
		}

		const client = new Client({ apiKey });
		await seedDataset(client, args.dataset);
		console.log('Dataset seeding complete.');

		// If only seeding was requested, exit
		if (args.local || (!args.local && args.seed)) {
			return;
		}
	}

	// Handle --local
	if (args.local) {
		await runLocal({ concurrency: args.concurrency });
		return;
	}

	// Default: LangSmith mode
	await runLangSmith({
		datasetName: args.dataset,
		experimentName: args.name,
		concurrency: args.concurrency,
	});
}

main().catch((error) => {
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	console.error(`Question quality evaluation failed: ${message}`);
	process.exit(1);
});

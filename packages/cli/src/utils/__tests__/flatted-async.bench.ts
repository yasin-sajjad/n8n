import { parse, stringify } from 'flatted';

import { parseAsync } from '../flatted-async';

function generateLargeExecutionData(targetSizeMB: number) {
	const data: Record<string, unknown> = {
		resultData: {
			runData: {} as Record<string, unknown[]>,
		},
	};

	// @ts-ignore
	const runData = data.resultData.runData as Record<string, unknown[]>;
	let nodeIndex = 0;

	let currentSize = 0;
	while (currentSize < targetSizeMB * 1_000_000) {
		const nodeName = `Node${nodeIndex++}`;
		runData[nodeName] = [];

		// Check size every 10 nodes
		if (nodeIndex % 10 === 0) currentSize = stringify(data).length;

		for (let exec = 0; exec < 10; exec++) {
			const items = [];
			for (let i = 0; i < 1000; i++) {
				items.push({
					json: {
						id: `${nodeName}-${exec}-${i}`,
						data: 'x'.repeat(100),
						nested: { a: 1, b: 2, c: { d: 3 } },
					},
				});
			}
			runData[nodeName].push({ data: { main: [items] } });
		}
	}

	return data;
}

async function benchmark() {
	const targetMB = 100;
	console.log(`Generating ${targetMB}MB execution data...`);
	const data = generateLargeExecutionData(targetMB);

	console.log('Stringifying with flatted...');
	const str = stringify(data);
	console.log(`String size: ${(str.length / 1_000_000).toFixed(1)} MB`);

	// Benchmark sync parse
	console.log('\n--- Sync parse---');
	const syncStart = performance.now();
	parse(str);
	const syncElapsed = performance.now() - syncStart;
	console.log(`Time: ${syncElapsed.toFixed(0)}ms`);

	// Benchmark async parse
	console.log('\n--- Async parse---');
	const asyncStart = performance.now();

	let yieldCount = 0;
	const progressInterval = setInterval(() => {
		console.log(
			`  ... ${yieldCount} yields, ${((performance.now() - asyncStart) / 1000).toFixed(1)}s elapsed`,
		);
	}, 2000);

	const originalSetTimeout = globalThis.setTimeout;
	globalThis.setTimeout = ((fn: () => void, delay: number) => {
		if (delay === 0) yieldCount++;
		return originalSetTimeout(fn, delay);
	}) as typeof setTimeout;

	await parseAsync(str, 1000);

	clearInterval(progressInterval);
	globalThis.setTimeout = originalSetTimeout;

	const asyncElapsed = performance.now() - asyncStart;

	console.log(`Time: ${asyncElapsed.toFixed(0)}ms`);
	console.log(`Yields: ${yieldCount}`);
	console.log(`Yield interval: ~${(asyncElapsed / yieldCount).toFixed(1)}ms per yield`);

	// Summary
	console.log('\n--- Summary ---');
	console.log(`Sync:  ${syncElapsed.toFixed(0)}ms`);
	console.log(
		`Async: ${asyncElapsed.toFixed(0)}ms (${(asyncElapsed / syncElapsed).toFixed(1)}x slower)`,
	);
}

benchmark().catch(console.error);

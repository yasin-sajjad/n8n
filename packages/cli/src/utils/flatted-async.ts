/* eslint-disable n8n-local-rules/no-uncaught-json-parse */

const Primitive = String;
const primitive = 'string';
const object = 'object';

const IGNORE = {};

const primitives = (value: unknown) => (value instanceof Primitive ? Primitive(value) : value);

const Primitives = (_: string, value: unknown) =>
	typeof value === primitive ? new Primitive(value as string) : value;

interface WorkItem {
	output: Record<string, unknown>;
	parentOutput?: Record<string, unknown>;
	parentKey?: string;
}

export const ASYNC_PARSE_THRESHOLD = 1_000_000; // 1MB

export async function parseAsync<T = unknown>(str: string, yieldInterval = 1000): Promise<T> {
	const input = (JSON.parse(str, Primitives) as unknown[]).map(primitives);
	const value = input[0];

	if (typeof value !== object || value === null) return value as T;

	const parsed = new Set([value]);
	const queue: WorkItem[] = [{ output: value as Record<string, unknown> }];
	let index = 0;
	let itemsProcessed = 0;

	while (index < queue.length) {
		const item = queue[index++];

		for (const key of Object.keys(item.output)) {
			const value = item.output[key];

			if (value instanceof Primitive) {
				const ref = input[value as unknown as number];

				if (typeof ref === object && ref !== null && !parsed.has(ref)) {
					parsed.add(ref);
					item.output[key] = IGNORE;
					queue.push({
						output: ref as Record<string, unknown>,
						parentOutput: item.output,
						parentKey: key,
					});
				} else {
					item.output[key] = ref;
				}
			}

			itemsProcessed++;
			if (itemsProcessed >= yieldInterval) {
				await new Promise((r) => setTimeout(r, 0));
				itemsProcessed = 0;
			}
		}

		if (item.parentOutput && item.parentKey !== undefined) {
			item.parentOutput[item.parentKey] = item.output;
		}
	}

	return value as T;
}

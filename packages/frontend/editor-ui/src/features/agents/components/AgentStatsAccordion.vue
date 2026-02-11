<script setup lang="ts">
import WorkerAccordion from '@/features/settings/orchestration.ee/components/WorkerAccordion.vue';
import type { AgentStatusData } from '../agents.types';

const props = defineProps<{
	stats: AgentStatusData['stats'];
}>();

function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${d}d ${h}h ${m}m`;
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}m ${s}s`;
}
</script>

<template>
	<WorkerAccordion icon="list-checks" icon-color="text-dark" :initial-expanded="true">
		<template #title>Stats</template>
		<template #content>
			<div :class="$style.content">
				<table :class="$style.table">
					<tbody>
						<tr>
							<th>Tasks Completed</th>
							<td>{{ props.stats.tasksCompleted }}</td>
						</tr>
						<tr>
							<th>Tasks Failed</th>
							<td :class="props.stats.tasksFailed > 0 ? $style.danger : undefined">
								{{ props.stats.tasksFailed }}
							</td>
						</tr>
						<tr>
							<th>Success Rate</th>
							<td>{{ props.stats.successRate }}%</td>
						</tr>
						<tr>
							<th>Avg Duration</th>
							<td>{{ formatDuration(props.stats.avgDuration) }}</td>
						</tr>
						<tr>
							<th>Uptime</th>
							<td>{{ formatUptime(props.stats.uptime) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</WorkerAccordion>
</template>

<style lang="scss" module>
.content {
	padding: var(--spacing--2xs);
	width: 100%;
}

.table {
	width: 100%;

	th,
	td {
		text-align: left;
		font-weight: normal;
		font-size: var(--font-size--sm);
		padding: var(--spacing--4xs) 0;
	}

	th {
		color: var(--color--text--tint-1);
	}

	td {
		font-variant-numeric: tabular-nums;
		color: var(--color--text);
		font-weight: var(--font-weight--bold);
		text-align: right;
	}
}

.danger {
	color: var(--color--danger) !important;
}
</style>

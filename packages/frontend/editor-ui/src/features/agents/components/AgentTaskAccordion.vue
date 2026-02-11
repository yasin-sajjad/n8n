<script setup lang="ts">
import WorkerAccordion from '@/features/settings/orchestration.ee/components/WorkerAccordion.vue';
import { N8nText } from '@n8n/design-system';
import type { AgentRunningTask } from '../agents.types';

const props = defineProps<{
	tasks: AgentRunningTask[];
}>();

function runningSince(started: Date): string {
	let seconds = Math.floor((new Date().getTime() - started.getTime()) / 1000);
	const hrs = Math.floor(seconds / 3600);
	seconds -= hrs * 3600;
	const mnts = Math.floor(seconds / 60);
	seconds -= mnts * 60;
	return `${hrs}h ${mnts}m ${Math.floor(seconds)}s`;
}
</script>

<template>
	<WorkerAccordion icon="list-checks" icon-color="text-dark" :initial-expanded="true">
		<template #title> Running Tasks ({{ props.tasks.length }}) </template>
		<template #content>
			<div v-if="props.tasks.length > 0" :class="$style.items">
				<div v-for="task in props.tasks" :key="task.executionId" :class="$style.item">
					<div :class="$style.taskName">{{ task.workflowName }}</div>
					<N8nText color="text-base" size="small">
						Execution {{ task.executionId }} | Running for
						{{ runningSince(task.startedAt) }}
					</N8nText>
				</div>
			</div>
			<div v-else :class="$style.items">
				<N8nText :class="$style.empty" color="text-light" size="small">
					No tasks currently running
				</N8nText>
			</div>
		</template>
	</WorkerAccordion>
</template>

<style lang="scss" module>
.items {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	width: 100%;
}

.item {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	text-align: left;
	margin-bottom: var(--spacing--2xs);
}

.taskName {
	font-size: var(--font-size--sm);
	font-weight: var(--font-weight--bold);
	color: var(--color--text);
}

.empty {
	display: block;
	text-align: left;
	margin-top: var(--spacing--2xs);
	margin-left: var(--spacing--4xs);
}
</style>

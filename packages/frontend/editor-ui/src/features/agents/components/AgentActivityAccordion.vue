<script setup lang="ts">
import WorkerAccordion from '@/features/settings/orchestration.ee/components/WorkerAccordion.vue';
import { N8nText } from '@n8n/design-system';
import type { AgentActivityEntry } from '../agents.types';

const props = defineProps<{
	activity: AgentActivityEntry[];
}>();

function formatTime(date: Date): string {
	return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}
</script>

<template>
	<WorkerAccordion icon="list-checks" icon-color="text-dark" :initial-expanded="false">
		<template #title> Recent Activity ({{ props.activity.length }}) </template>
		<template #content>
			<div v-if="props.activity.length > 0" :class="$style.items">
				<div v-for="(entry, i) in props.activity" :key="i" :class="$style.entry">
					<div :class="$style.entryHeader">
						<span
							:class="[$style.resultDot, entry.result === 'error' ? $style.error : $style.success]"
						/>
						<N8nText size="small" bold>{{ entry.action }}</N8nText>
						<span :class="$style.timeAgo">{{ timeAgo(entry.timestamp) }}</span>
					</div>
					<div v-if="entry.workflowName" :class="$style.entryDetail">
						{{ entry.workflowName }}
						<span v-if="entry.duration" :class="$style.duration">({{ entry.duration }}s)</span>
					</div>
					<N8nText :class="$style.timestamp" color="text-light" size="xsmall">
						{{ formatTime(entry.timestamp) }}
					</N8nText>
				</div>
			</div>
			<div v-else :class="$style.items">
				<N8nText :class="$style.empty" color="text-light" size="small">
					No recent activity
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
	gap: var(--spacing--2xs);
}

.entry {
	display: flex;
	flex-direction: column;
	gap: 1px;
	width: 100%;
}

.entryHeader {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.resultDot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}

.success {
	background: var(--color--success);
}

.error {
	background: var(--color--danger);
}

.timeAgo {
	margin-left: auto;
	font-size: var(--font-size--3xs);
	color: var(--color--text--tint-2);
	flex-shrink: 0;
}

.entryDetail {
	font-size: var(--font-size--2xs);
	color: var(--color--text--tint-1);
	padding-left: var(--spacing--xs);
}

.duration {
	color: var(--color--text--tint-2);
}

.timestamp {
	padding-left: var(--spacing--xs);
}

.empty {
	display: block;
	text-align: left;
	margin-top: var(--spacing--2xs);
	margin-left: var(--spacing--4xs);
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import type { AgentNode } from './agents.types';
import AgentAvatarComp from './components/AgentAvatar.vue';
import { useAgentPanelStore } from './agentPanel.store';

const props = defineProps<{
	agent: AgentNode;
	selected: boolean;
	zoneColor: string | null;
}>();

const emit = defineEmits<{
	dragStart: [id: string, event: PointerEvent];
}>();

const panelStore = useAgentPanelStore();

const mockData = computed(() => panelStore.getStatusDataForAgent(props.agent.firstName));

const workflowCount = computed(() => mockData.value.runningTasks.length);
const tasksCompleted = computed(() => mockData.value.stats.tasksCompleted);
const lastActive = computed(() => {
	const activity = mockData.value.recentActivity[0];
	if (!activity) return '-';
	const seconds = Math.floor((Date.now() - activity.timestamp.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
});

const statusConfig: Record<string, { color: string; label: string }> = {
	idle: { color: 'var(--color--text--tint-2)', label: 'Idle' },
	active: { color: 'var(--color--success)', label: 'Active' },
	busy: { color: 'var(--color--warning)', label: 'Busy' },
};

const agentStatus = computed(() => {
	if (mockData.value.runningTasks.length > 1) return 'busy';
	if (mockData.value.runningTasks.length === 1) return 'active';
	return 'idle';
});

const status = computed(() => statusConfig[agentStatus.value] ?? statusConfig.idle);

function onPointerDown(event: PointerEvent) {
	emit('dragStart', props.agent.id, event);
}
</script>

<template>
	<div
		:class="[$style.card, { [$style.selected]: selected }]"
		:style="{
			left: `${agent.position.x}px`,
			top: `${agent.position.y}px`,
			borderLeftColor: zoneColor ?? undefined,
			borderLeftWidth: zoneColor ? '3px' : undefined,
		}"
		data-testid="agent-card"
		@pointerdown="onPointerDown"
	>
		<!-- Top row: avatar + name + status -->
		<div :class="$style.topRow">
			<AgentAvatarComp :avatar="agent.avatar" size="medium" />
			<div :class="$style.info">
				<div :class="$style.name">{{ agent.firstName }}</div>
				<div :class="$style.role">{{ agent.role }}</div>
			</div>
			<div :class="$style.statusBadge" :style="{ '--status--color': status.color }">
				<span :class="$style.statusDot" />
				<span :class="$style.statusLabel">{{ status.label }}</span>
			</div>
		</div>

		<!-- Stats row -->
		<div :class="$style.statsRow">
			<div :class="$style.stat">
				<span :class="$style.statValue">{{ workflowCount }}</span>
				<span :class="$style.statLabel">running</span>
			</div>
			<div :class="$style.statDivider" />
			<div :class="$style.stat">
				<span :class="$style.statValue">{{ tasksCompleted }}</span>
				<span :class="$style.statLabel">tasks</span>
			</div>
			<div :class="$style.statDivider" />
			<div :class="$style.stat">
				<span :class="$style.statValue">{{ lastActive }}</span>
				<span :class="$style.statLabel">last active</span>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.card {
	position: absolute;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	background: var(--color--foreground--tint-2);
	border: 1px solid var(--color--foreground--tint-1);
	border-radius: var(--radius--lg);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	cursor: grab;
	user-select: none;
	z-index: 3;
	transition:
		box-shadow 0.15s ease,
		border-color 0.15s ease,
		transform 0.15s ease;
	min-width: 230px;
	max-width: 260px;

	&:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		border-color: var(--color--foreground);
		transform: translateY(-1px);
	}

	&:active {
		cursor: grabbing;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		transform: translateY(-2px);
	}
}

.selected {
	outline: 2px solid var(--color--primary);
	outline-offset: 2px;
	animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
	0%,
	100% {
		outline-color: var(--color--primary);
	}
	50% {
		outline-color: var(--color--primary--tint-2);
	}
}

.topRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.info {
	display: flex;
	flex-direction: column;
	gap: 1px;
	min-width: 0;
	flex: 1;
}

.name {
	font-size: var(--font-size--sm);
	font-weight: var(--font-weight--bold);
	color: var(--color--text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.role {
	font-size: var(--font-size--3xs);
	color: var(--color--text--tint-1);
	white-space: nowrap;
}

.statusBadge {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	padding: 2px var(--spacing--3xs);
	border-radius: var(--radius);
	background: color-mix(in srgb, var(--status--color) 15%, transparent);
	flex-shrink: 0;
	margin-left: auto;
}

.statusDot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--status--color);
}

.statusLabel {
	font-size: var(--font-size--3xs);
	font-weight: var(--font-weight--bold);
	color: var(--color--text--tint-1);
	text-transform: uppercase;
	letter-spacing: 0.3px;
}

.statsRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
	padding-top: var(--spacing--2xs);
	border-top: 1px solid var(--color--foreground);
}

.stat {
	display: flex;
	align-items: baseline;
	gap: 3px;
	min-width: 0;
}

.statValue {
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
	color: var(--color--text);
}

.statLabel {
	font-size: var(--font-size--3xs);
	color: var(--color--text--tint-1);
	white-space: nowrap;
}

.statDivider {
	width: 1px;
	height: 12px;
	background: var(--color--foreground);
	flex-shrink: 0;
}
</style>

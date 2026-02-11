import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useAgentsStore } from './agents.store';
import type {
	AgentCapabilitiesResponse,
	AgentTaskDispatchResponse,
	AgentStatusData,
} from './agents.types';

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		return (s >>> 0) / 0xffffffff;
	};
}

const MOCK_WORKFLOW_NAMES = [
	'Flaky Test Scanner',
	'PR Review Checker',
	'Triage Incoming Issues',
	'Deploy Staging',
	'Run E2E Suite',
	'Sync Docs to Notion',
	'Audit Security Alerts',
	'Generate Weekly Report',
	'Monitor Sentry Errors',
	'Update Changelog',
];

const MOCK_ACTIONS = [
	'Executed workflow',
	'Triaged issue',
	'Reviewed PR',
	'Updated documentation',
	'Scanned for flaky tests',
	'Synced data',
	'Generated report',
	'Ran health check',
	'Processed webhook',
	'Cleaned up stale runs',
];

function generateMockStatusData(agentName: string): AgentStatusData {
	const hash = hashString(agentName);
	const rand = seededRandom(hash);

	const tasksCompleted = Math.floor(rand() * 40) + 3;
	const tasksFailed = Math.floor(rand() * 4);
	const successRate =
		tasksCompleted + tasksFailed > 0
			? Math.round((tasksCompleted / (tasksCompleted + tasksFailed)) * 100)
			: 100;

	const runningCount = rand() > 0.4 ? Math.floor(rand() * 2) + 1 : 0;
	const now = new Date();

	const runningTasks = Array.from({ length: runningCount }, (_, i) => {
		const wfIndex = Math.floor(rand() * MOCK_WORKFLOW_NAMES.length);
		const minutesAgo = Math.floor(rand() * 15) + 1;
		return {
			executionId: String(1000 + Math.floor(rand() * 9000)),
			workflowId: `wf-${String(hash + i).slice(0, 8)}`,
			workflowName: MOCK_WORKFLOW_NAMES[wfIndex],
			startedAt: new Date(now.getTime() - minutesAgo * 60_000),
			status: 'running' as const,
		};
	});

	const activityCount = Math.floor(rand() * 6) + 5;
	const recentActivity = Array.from({ length: activityCount }, (_, i) => {
		const actionIndex = Math.floor(rand() * MOCK_ACTIONS.length);
		const wfIndex = Math.floor(rand() * MOCK_WORKFLOW_NAMES.length);
		const hoursAgo = i * (rand() * 3 + 0.5);
		const isError = rand() > 0.85;
		return {
			timestamp: new Date(now.getTime() - hoursAgo * 3_600_000),
			action: MOCK_ACTIONS[actionIndex],
			workflowName: rand() > 0.3 ? MOCK_WORKFLOW_NAMES[wfIndex] : undefined,
			result: isError ? ('error' as const) : ('success' as const),
			duration: Math.floor(rand() * 120) + 5,
		};
	});

	return {
		runningTasks,
		recentActivity,
		stats: {
			tasksCompleted,
			tasksFailed,
			successRate,
			avgDuration: Math.floor(rand() * 90) + 10,
			uptime: Math.floor(rand() * 172_800) + 3_600,
		},
	};
}

export const useAgentPanelStore = defineStore('agentPanel', () => {
	const panelOpen = ref(false);
	const panelAgentId = ref<string | null>(null);
	const capabilities = ref<AgentCapabilitiesResponse | null>(null);
	const statusData = ref<AgentStatusData | null>(null);
	const isLoading = ref(false);
	const taskResult = ref<AgentTaskDispatchResponse | null>(null);
	const isSubmitting = ref(false);

	const rootStore = useRootStore();
	const agentsStore = useAgentsStore();

	const selectedAgent = computed(() => {
		if (!panelAgentId.value) return null;
		return agentsStore.agents.find((a) => a.id === panelAgentId.value) ?? null;
	});

	const zoneName = computed(() => {
		const agent = selectedAgent.value;
		if (!agent?.zoneId) return null;
		const zone = agentsStore.zones.find((z) => z.projectId === agent.zoneId);
		return zone?.name ?? null;
	});

	const connectedAgents = computed(() => {
		if (!panelAgentId.value) return [];
		const id = panelAgentId.value;
		const connectedIds = new Set<string>();

		for (const conn of agentsStore.connections) {
			if (conn.fromAgentId === id) connectedIds.add(conn.toAgentId);
			if (conn.toAgentId === id) connectedIds.add(conn.fromAgentId);
		}

		return agentsStore.agents.filter((a) => connectedIds.has(a.id));
	});

	const openPanel = async (agentId: string) => {
		panelAgentId.value = agentId;
		panelOpen.value = true;
		taskResult.value = null;
		isLoading.value = true;

		const agent = agentsStore.agents.find((a) => a.id === agentId);
		statusData.value = generateMockStatusData(agent?.firstName ?? agentId);

		try {
			capabilities.value = await makeRestApiRequest<AgentCapabilitiesResponse>(
				rootStore.restApiContext,
				'GET',
				`/agents/${agentId}/capabilities`,
			);
		} catch {
			capabilities.value = null;
		} finally {
			isLoading.value = false;
		}
	};

	const closePanel = () => {
		panelOpen.value = false;
		panelAgentId.value = null;
		capabilities.value = null;
		statusData.value = null;
		taskResult.value = null;
		isLoading.value = false;
		isSubmitting.value = false;
	};

	const updateAgent = async (updates: { firstName?: string; avatar?: string | null }) => {
		if (!panelAgentId.value) return;
		await agentsStore.updateAgent(panelAgentId.value, updates);
	};

	const dispatchTask = async (prompt: string) => {
		if (!panelAgentId.value) return;

		isSubmitting.value = true;
		taskResult.value = null;

		try {
			taskResult.value = await makeRestApiRequest<AgentTaskDispatchResponse>(
				rootStore.restApiContext,
				'POST',
				`/agents/${panelAgentId.value}/task`,
				{ prompt },
			);
		} catch {
			taskResult.value = {
				status: 'error',
				message: 'Failed to dispatch task. Check agent worker configuration.',
			};
		} finally {
			isSubmitting.value = false;
		}
	};

	const getStatusDataForAgent = (agentName: string): AgentStatusData => {
		return generateMockStatusData(agentName);
	};

	return {
		panelOpen,
		panelAgentId,
		capabilities,
		statusData,
		isLoading,
		taskResult,
		isSubmitting,
		selectedAgent,
		zoneName,
		connectedAgents,
		openPanel,
		closePanel,
		updateAgent,
		dispatchTask,
		getStatusDataForAgent,
	};
});

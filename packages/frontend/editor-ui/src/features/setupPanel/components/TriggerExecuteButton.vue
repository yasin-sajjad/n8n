<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import {
	N8nActionDropdown,
	N8nButton,
	N8nText,
	N8nTooltip,
	type ActionDropdownItem,
} from '@n8n/design-system';
import { truncateBeforeLast } from '@n8n/utils/string/truncate';

import NodeIcon from '@/app/components/NodeIcon.vue';
import type { INodeUi } from '@/Interface';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useNodeExecution } from '@/app/composables/useNodeExecution';

const props = defineProps<{
	nodes: INodeUi[];
}>();

const emit = defineEmits<{
	executed: [];
}>();

const i18n = useI18n();
const nodeTypesStore = useNodeTypesStore();

const selectedNodeName = ref(props.nodes[0]?.name ?? '');

watch(
	() => props.nodes,
	(nodes) => {
		if (nodes.length > 0 && !nodes.some((n) => n.name === selectedNodeName.value)) {
			selectedNodeName.value = nodes[0].name;
		}
	},
);

const selectedNode = computed(
	() => props.nodes.find((n) => n.name === selectedNodeName.value) ?? null,
);

const { isExecuting, buttonLabel, buttonIcon, disabledReason, hasIssues, execute } =
	useNodeExecution(selectedNode);

const isButtonDisabled = computed(
	() => isExecuting.value || hasIssues.value || !!disabledReason.value,
);

const tooltipText = computed(() => {
	if (hasIssues.value) {
		return i18n.baseText('ndv.execute.requiredFieldsMissing');
	}
	return disabledReason.value;
});

const isSplitButton = computed(() => props.nodes.length > 1);

const actions = computed(() =>
	props.nodes.map<ActionDropdownItem<string>>((node) => ({
		label: truncateBeforeLast(node.name, 50),
		disabled: !!node.disabled || isExecuting.value,
		id: node.name,
		checked: selectedNodeName.value === node.name,
	})),
);

function getNodeTypeByName(name: string) {
	const node = props.nodes.find((n) => n.name === name);
	if (!node) return null;
	return nodeTypesStore.getNodeType(node.type, node.typeVersion);
}

const onSelectTrigger = (name: string) => {
	selectedNodeName.value = name;
};

const onTestClick = async () => {
	await execute();
	emit('executed');
};
</script>

<template>
	<div
		data-test-id="trigger-execute-button"
		:class="[$style.component, isSplitButton ? $style.split : '']"
	>
		<N8nTooltip :disabled="!tooltipText" placement="top">
			<template #content>{{ tooltipText }}</template>
			<N8nButton
				data-test-id="trigger-execute-btn"
				:class="$style.button"
				:label="buttonLabel"
				:disabled="isButtonDisabled"
				:loading="isExecuting"
				:icon="buttonIcon"
				size="small"
				@click="onTestClick"
			/>
		</N8nTooltip>
		<template v-if="isSplitButton">
			<div role="presentation" :class="$style.divider" />
			<N8nActionDropdown
				:class="$style.menu"
				:items="actions"
				:disabled="isButtonDisabled"
				@select="onSelectTrigger"
			>
				<template #activator>
					<N8nButton
						data-test-id="trigger-execute-dropdown"
						size="small"
						icon-size="small"
						:disabled="isButtonDisabled"
						:class="$style.chevron"
						aria-label="Select trigger node"
						icon="chevron-down"
					/>
				</template>
				<template #menuItem="item">
					<div :class="[$style['menu-item'], item.disabled ? $style.disabled : '']">
						<NodeIcon
							:class="$style['menu-icon']"
							:size="16"
							:node-type="getNodeTypeByName(item.id)"
						/>
						<N8nText size="small">{{ item.label }}</N8nText>
					</div>
				</template>
			</N8nActionDropdown>
		</template>
	</div>
</template>

<style module lang="scss">
.component {
	display: flex;
	align-items: stretch;
}

.button {
	.split & {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
}

.divider {
	width: 1px;
	background-color: var(--color--foreground);
}

.chevron {
	border-top-left-radius: 0;
	border-bottom-left-radius: 0;
	padding-inline: var(--spacing--3xs);
}

.menu :global(.el-dropdown) {
	height: 100%;
}

.menu-item {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
}

.menu-item.disabled .menu-icon {
	opacity: 0.2;
}
</style>

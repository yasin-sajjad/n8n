<script lang="ts" setup>
import type { AuditLogEvent } from '@n8n/api-types';
import { computed } from 'vue';
import { N8nText, N8nTooltip, N8nBadge } from '@n8n/design-system';

const props = defineProps<{
	eventName: string;
	payload: AuditLogEvent['payload'];
}>();

interface PayloadField {
	label: string;
	value: string;
	type?: 'text' | 'badge' | 'code';
}

// Determine field type based on field name patterns
function getFieldType(key: string): 'text' | 'badge' | 'code' {
	const lowerKey = key.toLowerCase();

	// IDs and keys should be monospace
	if (lowerKey.endsWith('id') || lowerKey.includes('key')) {
		return 'code';
	}

	// Roles and types should be badges
	if (lowerKey.includes('role') || lowerKey.includes('type') || lowerKey === 'status') {
		return 'badge';
	}

	return 'text';
}

// Format field name for display
function formatFieldName(key: string): string {
	// Remove underscore prefix if present
	const cleanKey = key.startsWith('_') ? key.substring(1) : key;

	// Convert camelCase to Title Case
	return cleanKey
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

const formattedPayload = computed<PayloadField[]>(() => {
	if (!props.payload) return [];

	const fields: PayloadField[] = [];
	const skipKeys = new Set(['userId']); // Skip fields already shown in other columns

	// Iterate through all payload fields
	Object.keys(props.payload).forEach((key) => {
		const value = props.payload![key];

		// Skip null/undefined values and excluded keys
		if (value === null || value === undefined || skipKeys.has(key)) {
			return;
		}

		// Skip complex objects (will be shown in JSON tooltip)
		if (typeof value === 'object') {
			return;
		}

		fields.push({
			label: formatFieldName(key),
			value: String(value),
			type: getFieldType(key),
		});
	});

	return fields;
});

const hasFormattedFields = computed(() => formattedPayload.value.length > 0);

const fullPayloadJson = computed(() => {
	if (!props.payload) return '';
	return JSON.stringify(props.payload, null, 2);
});
</script>

<template>
	<N8nTooltip v-if="payload" placement="top" :show-after="500">
		<template #content>
			<div :class="$style.tooltipContent">
				<N8nText size="small" bold class="mb-3xs">Full Payload:</N8nText>
				<pre :class="$style.jsonTooltip">{{ fullPayloadJson }}</pre>
			</div>
		</template>
		<div :class="$style.payloadContainer">
			<div v-if="hasFormattedFields" :class="$style.formattedPayload">
				<div v-for="(field, index) in formattedPayload" :key="index" :class="$style.fieldRow">
					<N8nText color="text-light" size="small" bold :class="$style.fieldLabel">
						{{ field.label }}:
					</N8nText>
					<N8nBadge v-if="field.type === 'badge'" theme="secondary">
						{{ field.value }}
					</N8nBadge>
					<N8nText
						v-else-if="field.type === 'code'"
						:class="$style.codeValue"
						color="text-base"
						size="small"
					>
						{{ field.value }}
					</N8nText>
					<N8nText v-else color="text-base" size="small">
						{{ field.value }}
					</N8nText>
				</div>
			</div>
			<div v-else :class="$style.rawPayload">
				<pre :class="$style.jsonContent">{{ fullPayloadJson }}</pre>
			</div>
		</div>
	</N8nTooltip>
	<N8nText v-else color="text-light" size="small" italic> — </N8nText>
</template>

<style lang="scss" module>
.payloadContainer {
	cursor: help;
}

.formattedPayload {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
}

.fieldRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
}

.fieldLabel {
	min-width: 100px;
	flex-shrink: 0;
}

.codeValue {
	font-family: var(--font-family--monospace, 'Courier New', monospace);
	background-color: var(--color--foreground--tint-2);
	padding: 0 var(--spacing--4xs);
	border-radius: var(--radius--sm);
}

.rawPayload {
	max-height: 100px;
	overflow: auto;
}

.jsonContent {
	margin: 0;
	padding: var(--spacing--xs);
	font-size: var(--font-size--2xs);
	line-height: var(--line-height--md);
	white-space: pre-wrap;
	word-break: break-word;
	background-color: var(--color--foreground--tint-2);
	border-radius: var(--radius--sm);
	font-family: var(--font-family--monospace, 'Courier New', monospace);
}

.tooltipContent {
	max-width: 400px;
	max-height: 400px;
	overflow: auto;
}

.jsonTooltip {
	margin: 0;
	padding: var(--spacing--xs);
	font-size: var(--font-size--2xs);
	line-height: var(--line-height--lg);
	white-space: pre-wrap;
	word-break: break-word;
	background-color: var(--color--background--shade-1);
	border-radius: var(--radius--sm);
	font-family: var(--font-family--monospace, 'Courier New', monospace);
	color: var(--color--text);
}
</style>

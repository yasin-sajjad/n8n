<script setup lang="ts">
import { computed, ref } from 'vue';
import { N8nButton, N8nText, N8nIcon, N8nPopover } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import CredentialIcon from '../CredentialIcon.vue';
import type { CredentialOption } from '../CredentialPicker/CredentialsDropdown.vue';

const props = defineProps<{
	appName: string;
	credentialType: string;
	selectedCredentialId: string | null;
	credentialOptions: CredentialOption[];
	disabled?: boolean;
}>();

const emit = defineEmits<{
	connect: [];
	select: [credentialId: string];
}>();

const i18n = useI18n();

// State
const showPopover = ref(false);

// Computed
const selectedCredential = computed(() => {
	if (!props.selectedCredentialId) return null;
	return props.credentialOptions.find((opt) => opt.id === props.selectedCredentialId) ?? null;
});

const otherCredentials = computed(() => {
	if (!props.selectedCredentialId) return props.credentialOptions;
	return props.credentialOptions.filter((opt) => opt.id !== props.selectedCredentialId);
});

const isConnected = computed(() => selectedCredential.value !== null);

// Methods
function onConnect() {
	emit('connect');
}

function onSelectCredential(id: string) {
	showPopover.value = false;
	emit('select', id);
}

function onConnectAnother() {
	showPopover.value = false;
	emit('connect');
}
</script>

<template>
	<div :class="$style.container">
		<!-- Disconnected State -->
		<N8nButton
			v-if="!isConnected"
			type="primary"
			size="small"
			:disabled="disabled"
			data-test-id="credential-connection-connect-button"
			@click="onConnect"
		>
			{{ i18n.baseText('credentialConnectionStatus.connect', { interpolate: { appName } }) }}
		</N8nButton>

		<!-- Connected State -->
		<N8nPopover
			v-else
			v-model:open="showPopover"
			:width="'220px'"
			:side="'bottom'"
			:align="'start'"
		>
			<template #trigger>
				<button
					type="button"
					:class="$style.connectionPill"
					:disabled="disabled"
					data-test-id="credential-connection-pill"
				>
					<CredentialIcon :credential-type-name="credentialType" :size="16" />
					<N8nText :class="$style.pillText" size="small" bold>
						{{ selectedCredential?.name }}
					</N8nText>
					<N8nIcon :class="$style.checkIcon" icon="check" size="small" />
					<N8nIcon :class="$style.chevron" icon="chevron-down" size="xsmall" />
				</button>
			</template>

			<template #content>
				<div :class="$style.popoverContent">
					<!-- Other credentials list -->
					<div v-if="otherCredentials.length > 0" :class="$style.credentialsList">
						<button
							v-for="credential in otherCredentials"
							:key="credential.id"
							type="button"
							:class="$style.credentialItem"
							data-test-id="credential-connection-select-item"
							@click="onSelectCredential(credential.id)"
						>
							<CredentialIcon :credential-type-name="credentialType" :size="16" />
							<div :class="$style.credentialInfo">
								<N8nText size="small" bold>{{ credential.name }}</N8nText>
								<N8nText v-if="credential.homeProject" size="xsmall" color="text-light">
									{{ credential.homeProject.name }}
								</N8nText>
							</div>
						</button>
					</div>

					<!-- Divider -->
					<div v-if="otherCredentials.length > 0" :class="$style.divider" />

					<!-- Connect Another button -->
					<button
						type="button"
						:class="$style.connectAnother"
						data-test-id="credential-connection-connect-another"
						@click="onConnectAnother"
					>
						<N8nIcon icon="plus" size="xsmall" />
						<N8nText size="small" bold color="primary">
							{{
								i18n.baseText('credentialConnectionStatus.connectAnother', {
									interpolate: { appName },
								})
							}}
						</N8nText>
					</button>
				</div>
			</template>
		</N8nPopover>
	</div>
</template>

<style lang="scss" module>
.container {
	display: inline-flex;
}

.connectionPill {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	padding: var(--spacing--4xs) var(--spacing--2xs);
	background-color: var(--color--success--tint-4);
	border: 1px solid var(--color--success--tint-1);
	border-radius: var(--radius--xl);
	cursor: pointer;
	transition: background-color 0.2s ease;

	&:hover:not([disabled]) {
		background-color: var(--color--success--tint-3);
	}

	&[disabled] {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.pillText {
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.checkIcon {
	color: var(--color--success);
}

.chevron {
	color: var(--color--text--tint-2);
}

.popoverContent {
	display: flex;
	flex-direction: column;
}

.credentialsList {
	display: flex;
	flex-direction: column;
	padding: var(--spacing--3xs);
}

.credentialItem {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
	padding: var(--spacing--2xs);
	background: transparent;
	border: none;
	border-radius: var(--radius);
	cursor: pointer;
	text-align: left;
	width: 100%;
	transition: background-color 0.2s ease;

	&:hover {
		background-color: var(--color--background--shade-1);
	}
}

.credentialInfo {
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;

	> * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}

.divider {
	height: 1px;
	background-color: var(--color--foreground);
	margin: 0;
}

.connectAnother {
	display: flex;
	align-items: center;
	gap: var(--spacing--3xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	background: transparent;
	border: none;
	cursor: pointer;
	transition: background-color 0.2s ease;

	&:hover {
		background-color: var(--color--background--shade-1);
	}
}
</style>

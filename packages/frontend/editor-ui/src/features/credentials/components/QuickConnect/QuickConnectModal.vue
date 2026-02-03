<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { N8nButton, N8nText, N8nIcon } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useTelemetry } from '@/app/composables/useTelemetry';
import { useUIStore } from '@/app/stores/ui.store';
import { useCredentialsStore } from '../../credentials.store';
import { useNDVStore } from '@/features/ndv/shared/ndv.store';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { QUICK_CONNECT_MODAL_KEY } from '../../credentials.constants';
import { getAppNameFromCredType } from '@/app/utils/nodeTypesUtils';
import { isOAuthCredential } from './essentialFields';
import CredentialIcon from '../CredentialIcon.vue';
import Modal from '@/app/components/Modal.vue';
import QuickConnectForm from './QuickConnectForm.vue';
import { createEventBus } from '@n8n/utils/event-bus';

defineProps<{
	modalName: string;
}>();

const emit = defineEmits<{
	credentialCreated: [credentialId: string];
}>();

const i18n = useI18n();
const telemetry = useTelemetry();
const uiStore = useUIStore();
const credentialsStore = useCredentialsStore();
const ndvStore = useNDVStore();
const workflowsStore = useWorkflowsStore();

const modalBus = createEventBus();

// State
const modalOpenedAt = ref<number>(0);
const state = ref<'form' | 'success' | 'error'>('form');
const errorMessage = ref<string>('');
const createdCredentialId = ref<string | null>(null);

// Computed
const modalData = computed(() => {
	return uiStore.modalsById[QUICK_CONNECT_MODAL_KEY]?.data as
		| { credentialType: string; mode: string }
		| undefined;
});

const credentialType = computed(() => {
	if (!modalData.value?.credentialType) return null;
	return credentialsStore.getCredentialTypeByName(modalData.value.credentialType);
});

const appName = computed(() => {
	if (!credentialType.value?.displayName) return '';
	return getAppNameFromCredType(credentialType.value.displayName);
});

const isOAuth = computed(() => {
	if (!modalData.value?.credentialType) return false;
	return isOAuthCredential(modalData.value.credentialType);
});

const activeNode = computed(() => ndvStore.activeNode);

// Lifecycle
onMounted(() => {
	modalOpenedAt.value = Date.now();
	telemetry.track('credential_quick_connect_modal_opened', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		workflow_id: workflowsStore.workflowId,
		is_oauth: isOAuth.value,
	});
});

onUnmounted(() => {
	if (state.value === 'form') {
		const timeSpentMs = Date.now() - modalOpenedAt.value;
		telemetry.track('credential_quick_connect_abandoned', {
			credential_type: modalData.value?.credentialType,
			node_type: activeNode.value?.type,
			workflow_id: workflowsStore.workflowId,
			time_spent_ms: timeSpentMs,
		});
	}
});

// Methods
function closeModal() {
	uiStore.closeModal(QUICK_CONNECT_MODAL_KEY);
}

function onSuccess(credentialId: string) {
	state.value = 'success';
	createdCredentialId.value = credentialId;
	const timeSpentMs = Date.now() - modalOpenedAt.value;
	telemetry.track('credential_quick_connect_completed', {
		credential_type: modalData.value?.credentialType,
		credential_id: credentialId,
		node_type: activeNode.value?.type,
		workflow_id: workflowsStore.workflowId,
		time_spent_ms: timeSpentMs,
		is_oauth: isOAuth.value,
	});
}

function onError(message: string) {
	state.value = 'error';
	errorMessage.value = message;
	telemetry.track('credential_quick_connect_failed', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		workflow_id: workflowsStore.workflowId,
		error_message: message,
	});
}

function onRetry() {
	state.value = 'form';
	errorMessage.value = '';
}

function openFullSettings() {
	telemetry.track('credential_quick_connect_open_full_settings', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		workflow_id: workflowsStore.workflowId,
		from_state: state.value,
	});
	closeModal();
	if (modalData.value?.credentialType) {
		uiStore.openNewCredential(modalData.value.credentialType);
	}
}

function onDone() {
	if (createdCredentialId.value) {
		emit('credentialCreated', createdCredentialId.value);
	}
	closeModal();
}

// Expose methods for QuickConnectForm (will be connected in Task 4)
defineExpose({
	onSuccess,
	onError,
});
</script>

<template>
	<Modal
		:name="QUICK_CONNECT_MODAL_KEY"
		:event-bus="modalBus"
		width="400px"
		max-width="400px"
		:center="true"
	>
		<template #header>
			<div :class="$style.header">
				<CredentialIcon :credential-type-name="modalData?.credentialType ?? null" :size="32" />
				<div :class="$style.headerText">
					<N8nText tag="h2" size="large" bold>
						{{ i18n.baseText('quickConnect.title', { interpolate: { appName } }) }}
					</N8nText>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('quickConnect.subtitle') }}
					</N8nText>
				</div>
			</div>
		</template>

		<template #content>
			<div :class="$style.content">
				<!-- Success State -->
				<div v-if="state === 'success'" :class="$style.successState">
					<N8nIcon :class="$style.successIcon" icon="circle-check" size="xlarge" color="success" />
					<N8nText tag="h3" size="large" bold>
						{{ i18n.baseText('quickConnect.success.title') }}
					</N8nText>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('quickConnect.success.subtitle', { interpolate: { appName } }) }}
					</N8nText>
				</div>

				<!-- Error State -->
				<template v-else-if="state === 'error'">
					<div :class="$style.errorBanner">
						<N8nIcon icon="triangle-alert" color="danger" />
						<N8nText size="small" color="danger">
							{{ errorMessage || i18n.baseText('quickConnect.error.default') }}
						</N8nText>
					</div>
					<QuickConnectForm
						v-if="credentialType && modalData?.credentialType"
						:credential-type="credentialType"
						:credential-type-name="modalData.credentialType"
						@success="onSuccess"
						@error="onError"
					/>
				</template>

				<!-- Form State -->
				<template v-else>
					<QuickConnectForm
						v-if="credentialType && modalData?.credentialType"
						:credential-type="credentialType"
						:credential-type-name="modalData.credentialType"
						@success="onSuccess"
						@error="onError"
					/>
				</template>
			</div>
		</template>

		<template #footer>
			<div :class="$style.footer">
				<!-- Success State Footer -->
				<template v-if="state === 'success'">
					<N8nButton
						:label="i18n.baseText('quickConnect.done')"
						type="primary"
						data-test-id="quick-connect-done-button"
						@click="onDone"
					/>
				</template>

				<!-- Error State Footer -->
				<template v-else-if="state === 'error'">
					<N8nButton
						:label="i18n.baseText('quickConnect.openFullSettings')"
						type="secondary"
						data-test-id="quick-connect-open-full-settings-button"
						@click="openFullSettings"
					/>
					<N8nButton
						:label="i18n.baseText('quickConnect.tryAgain')"
						type="primary"
						data-test-id="quick-connect-try-again-button"
						@click="onRetry"
					/>
				</template>

				<!-- Form State Footer -->
				<template v-else>
					<N8nButton
						:label="i18n.baseText('quickConnect.cancel')"
						type="secondary"
						data-test-id="quick-connect-cancel-button"
						@click="closeModal"
					/>
				</template>
			</div>
		</template>
	</Modal>
</template>

<style module lang="scss">
.modal :global(.el-dialog__body) {
	padding: var(--spacing--sm);
}

.header {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: var(--spacing--sm);
}

.headerText {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.content {
	display: flex;
	flex-direction: column;
}

.successState {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: var(--spacing--xl) var(--spacing--sm);
	text-align: center;
	gap: var(--spacing--2xs);
}

.successIcon {
	margin-bottom: var(--spacing--sm);
}

.errorBanner {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: var(--spacing--2xs);
	padding: var(--spacing--2xs) var(--spacing--sm);
	background-color: var(--color--danger--tint-4);
	border-radius: var(--radius);
	margin-bottom: var(--spacing--sm);
}

.footer {
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	gap: var(--spacing--2xs);
}
</style>

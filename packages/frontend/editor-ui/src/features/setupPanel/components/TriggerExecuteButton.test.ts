import { ref } from 'vue';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestNode } from '@/__tests__/mocks';
import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/vue';
import TriggerExecuteButton from './TriggerExecuteButton.vue';
import type { INodeUi } from '@/Interface';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import type { INodeTypeDescription } from 'n8n-workflow';
import { mockedStore } from '@/__tests__/utils';

const mockExecute = vi.fn().mockResolvedValue('executed');
const mockButtonLabel = ref('Test step');
const mockButtonIcon = ref('flask-conical');
const mockIsExecuting = ref(false);
const mockIsListening = ref(false);
const mockIsListeningForWorkflowEvents = ref(false);
const mockDisabledReason = ref('');
const mockHasIssues = ref(false);

vi.mock('@/app/composables/useNodeExecution', () => ({
	useNodeExecution: () => ({
		execute: mockExecute,
		buttonLabel: mockButtonLabel,
		buttonIcon: mockButtonIcon,
		isExecuting: mockIsExecuting,
		isListening: mockIsListening,
		isListeningForWorkflowEvents: mockIsListeningForWorkflowEvents,
		disabledReason: mockDisabledReason,
		hasIssues: mockHasIssues,
	}),
}));

const renderComponent = createComponentRenderer(TriggerExecuteButton);

const createNode = (): INodeUi =>
	createTestNode({
		name: 'SlackTrigger',
		type: 'n8n-nodes-base.slackTrigger',
		typeVersion: 1,
		position: [0, 0],
	}) as INodeUi;

describe('TriggerExecuteButton', () => {
	let nodeTypesStore: ReturnType<typeof mockedStore<typeof useNodeTypesStore>>;

	beforeEach(() => {
		createTestingPinia();
		nodeTypesStore = mockedStore(useNodeTypesStore);
		mockExecute.mockReset().mockResolvedValue('executed');
		mockIsExecuting.value = false;
		mockIsListening.value = false;
		mockIsListeningForWorkflowEvents.value = false;
		mockDisabledReason.value = '';
		mockHasIssues.value = false;
		mockButtonLabel.value = 'Test step';
		mockButtonIcon.value = 'flask-conical';
	});

	it('should render the execute button', () => {
		const { getByTestId } = renderComponent({
			props: { node: createNode() },
		});

		expect(getByTestId('trigger-execute-button')).toBeInTheDocument();
	});

	it('should call execute and emit executed on click', async () => {
		const { getByTestId, emitted } = renderComponent({
			props: { node: createNode() },
		});

		await userEvent.click(getByTestId('trigger-execute-button'));

		expect(mockExecute).toHaveBeenCalledTimes(1);
		expect(emitted('executed')).toHaveLength(1);
	});

	it('should be disabled when hasIssues is true', () => {
		mockHasIssues.value = true;

		const { getByTestId } = renderComponent({
			props: { node: createNode() },
		});

		expect(getByTestId('trigger-execute-button')).toBeDisabled();
	});

	it('should be disabled when isExecuting is true', () => {
		mockIsExecuting.value = true;

		const { getByTestId } = renderComponent({
			props: { node: createNode() },
		});

		expect(getByTestId('trigger-execute-button')).toBeDisabled();
	});

	it('should be disabled when disabledReason is set', () => {
		mockDisabledReason.value = 'Workflow is running';

		const { getByTestId } = renderComponent({
			props: { node: createNode() },
		});

		expect(getByTestId('trigger-execute-button')).toBeDisabled();
	});

	describe('listening state', () => {
		it('should show eventTriggerDescription tooltip when listening and node type has it', async () => {
			mockIsListening.value = true;
			nodeTypesStore.getNodeType = vi.fn().mockReturnValue({
				displayName: 'Webhook',
				eventTriggerDescription: 'Waiting for you to call the Test URL',
			} as Partial<INodeTypeDescription>);

			renderComponent({
				props: { node: createNode() },
			});

			await waitFor(() => {
				expect(document.body).toHaveTextContent('Waiting for you to call the Test URL');
			});
		});

		it('should show service-based fallback tooltip when listening and no eventTriggerDescription', async () => {
			mockIsListening.value = true;
			nodeTypesStore.getNodeType = vi.fn().mockReturnValue({
				displayName: 'Slack Trigger',
			} as Partial<INodeTypeDescription>);

			renderComponent({
				props: { node: createNode() },
			});

			await waitFor(() => {
				expect(document.body).toHaveTextContent('Go to Slack and create an event');
			});
		});

		it('should show service-based fallback tooltip when isListeningForWorkflowEvents', async () => {
			mockIsListeningForWorkflowEvents.value = true;
			nodeTypesStore.getNodeType = vi.fn().mockReturnValue({
				displayName: 'GitHub Trigger',
			} as Partial<INodeTypeDescription>);

			renderComponent({
				props: { node: createNode() },
			});

			await waitFor(() => {
				expect(document.body).toHaveTextContent('Go to GitHub and create an event');
			});
		});

		it('should not show listening tooltip when not listening', () => {
			nodeTypesStore.getNodeType = vi.fn().mockReturnValue({
				displayName: 'Slack Trigger',
			} as Partial<INodeTypeDescription>);

			renderComponent({
				props: { node: createNode() },
			});

			expect(document.body).not.toHaveTextContent('Go to Slack and create an event');
		});
	});
});

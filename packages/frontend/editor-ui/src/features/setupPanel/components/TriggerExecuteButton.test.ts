import { ref } from 'vue';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestNode } from '@/__tests__/mocks';
import { createTestingPinia } from '@pinia/testing';
import userEvent from '@testing-library/user-event';
import TriggerExecuteButton from './TriggerExecuteButton.vue';
import type { INodeUi } from '@/Interface';

const mockExecute = vi.fn().mockResolvedValue('executed');
const mockButtonLabel = ref('Test step');
const mockButtonIcon = ref('flask-conical');
const mockIsExecuting = ref(false);
const mockDisabledReason = ref('');
const mockHasIssues = ref(false);

vi.mock('@/app/composables/useNodeExecution', () => ({
	useNodeExecution: () => ({
		execute: mockExecute,
		buttonLabel: mockButtonLabel,
		buttonIcon: mockButtonIcon,
		isExecuting: mockIsExecuting,
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
	beforeEach(() => {
		createTestingPinia();
		mockExecute.mockReset().mockResolvedValue('executed');
		mockIsExecuting.value = false;
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
});

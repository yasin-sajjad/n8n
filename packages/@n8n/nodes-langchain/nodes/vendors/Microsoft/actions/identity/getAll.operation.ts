import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';
import { microsoftApiRequest, microsoftApiRequestAllItems } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
		},
		default: 50,
		description: 'Max number of results to return',
	},
];

const displayOptions = {
	show: {
		operation: ['getAll'],
		resource: ['identity'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', index) as boolean;

	const endpoint = '/beta/servicePrincipals/microsoft.graph.agentIdentity';

	const qs: IDataObject = {};

	let responseData: IDataObject[] = [];

	if (returnAll) {
		responseData = await microsoftApiRequestAllItems.call(this, 'GET', 'value', endpoint, {}, qs);
	} else {
		const limit = this.getNodeParameter('limit', index) as number;
		qs.$top = limit;

		const response = await microsoftApiRequest.call(this, 'GET', endpoint, {}, qs);

		responseData = response.value ?? [];
	}

	return this.helpers.returnJsonArray(responseData);
}

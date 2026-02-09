import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';
import { microsoftApiRequest } from '../../transport';

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
		resource: ['application'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', index) as boolean;

	const endpoint = '/beta/applications';

	const responseData: IDataObject[] = [];
	let uri: string | undefined;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', index) as number);

	do {
		const qs: IDataObject = uri ? {} : { $top: 100 };
		const response = await microsoftApiRequest.call(this, 'GET', endpoint, {}, qs, uri);

		const applications = response.value ?? [];

		const filtered = applications.filter(
			(app: IDataObject) => app['@odata.type'] === '#microsoft.graph.agentIdentityBlueprint',
		);

		responseData.push(...filtered);

		uri = response['@odata.nextLink'];

		if (!returnAll && responseData.length >= limit) break;
	} while (uri !== undefined);

	const finalData = returnAll ? responseData : responseData.slice(0, limit);

	return this.helpers.returnJsonArray(finalData);
}

import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	JsonObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * Make an authenticated API request to Microsoft Graph API
 */
export async function microsoftApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject | string = {},
	qs: IDataObject = {},
	uri?: string,
	option: IDataObject = {},
) {
	const credentials = await this.getCredentials('microsoftAgent365ManagementApi');

	const baseUrl = (
		typeof credentials.graphApiBaseUrl === 'string' && credentials.graphApiBaseUrl !== ''
			? credentials.graphApiBaseUrl
			: 'https://graph.microsoft.com'
	).replace(/\/+$/, '');

	let options: IHttpRequestOptions = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body,
		qs,
		url:
			uri ||
			(resource.startsWith('/beta') || resource.startsWith('/v1.0')
				? `${baseUrl}${resource}`
				: `${baseUrl}/v1.0${resource}`),
		json: true,
	};

	options = Object.assign({}, options, option);

	try {
		if (typeof body === 'object' && Object.keys(body).length === 0) {
			delete options.body;
		}

		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			'microsoftAgent365ManagementApi',
			options,
		);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Make an API request and return all items using pagination
 */
export async function microsoftApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	propertyName: string,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
) {
	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query, uri);
		uri = responseData['@odata.nextLink'];
		if (responseData[propertyName]) {
			returnData.push(...(responseData[propertyName] as IDataObject[]));
		}
	} while (responseData['@odata.nextLink'] !== undefined);

	return returnData;
}

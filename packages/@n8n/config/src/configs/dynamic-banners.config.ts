import { Config, Env } from '../decorators';

@Config
export class DynamicBannersConfig {
	/** Whether to fetch and show dynamic banners (e.g. announcements) from the endpoint. */
	@Env('N8N_DYNAMIC_BANNERS_ENABLED')
	enabled: boolean = true;

	/** URL to fetch dynamic banner content from (e.g. in-app announcements). */
	@Env('N8N_DYNAMIC_BANNERS_ENDPOINT')
	endpoint: string = 'https://api.n8n.io/api/banners';
}
import { SSMClient, GetParameterCommand, GetParameterCommandInput } from '@aws-sdk/client-ssm';

export const client = new SSMClient({});

export class SSMActions {
	public client = client;

	constructor() {}

	getParameter = async (params: GetParameterCommandInput) => {
		try {
			return (await this.client.send(new GetParameterCommand(params)))?.Parameter || {};
		} catch (err) {
			throw err;
		}
	};
}

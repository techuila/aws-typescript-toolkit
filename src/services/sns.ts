import { SNSClient, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';

export const client = new SNSClient({});

export class SNSActions {
  public client = client;

  constructor() {}

  publish = async (params: PublishCommandInput) => {
    try {
      return await this.client.send(new PublishCommand(params));
    } catch (err) {
      throw err;
    }
  };
}
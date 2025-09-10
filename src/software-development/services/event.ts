import { EventBridgeClient, PutEventsCommand, PutEventsCommandInput } from '@aws-sdk/client-eventbridge';

export const client = new EventBridgeClient({});
export class EventActions {
  public client = client;

  constructor() {}

  putEvents = async (params: PutEventsCommandInput) => {
    try {
      return await this.client.send(new PutEventsCommand(params));
    } catch (err) {
      throw err;
    }
  };
}

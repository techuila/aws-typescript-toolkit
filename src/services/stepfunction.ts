
import { SFNClient, StartExecutionCommand, StartExecutionCommandInput } from '@aws-sdk/client-sfn';

export const client = new SFNClient({});

export class StepFunctionActions {
  public client = client;

  constructor() {}

  startExecution = async (params: StartExecutionCommandInput) => {
    try {
      return await this.client.send(new StartExecutionCommand(params));
    } catch (err) {
      throw err;
    }
  };
}

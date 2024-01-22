
import { SchedulerClient, CreateScheduleCommand, CreateScheduleCommandInput } from '@aws-sdk/client-scheduler';

export const client = new SchedulerClient({});

export class SchedulerActions {
  public client = client;

  constructor() {}

  createSchedule = async (params: CreateScheduleCommandInput) => {
    try {
      return await this.client.send(new CreateScheduleCommand(params));
    } catch (err) {
      throw err;
    }
  };
}

import {
  PinpointClient,
  GetEmailTemplateCommand,
  GetEmailTemplateCommandInput,
  SendMessagesCommandInput,
  SendMessagesCommand,
  GetAppCommandInput,
  GetAppCommand
} from '@aws-sdk/client-pinpoint';


export const client = new PinpointClient({});
export class PinpointActions {
  public client = client;

  constructor() {}

  getApplication = async (params: GetAppCommandInput) => {
    try {
      return await this.client.send(new GetAppCommand(params));
    } catch (err) {
      throw err;
    }
  };

  getEmailTemplate = async (params: GetEmailTemplateCommandInput) => {
    try {
      return await this.client.send(new GetEmailTemplateCommand(params));
    } catch (err) {
      throw err;
    }
  };

  send = async (params: SendMessagesCommandInput) => {
    try {
      return await this.client.send(new SendMessagesCommand(params));
    } catch (err) {
      throw err;
    }
  };
}

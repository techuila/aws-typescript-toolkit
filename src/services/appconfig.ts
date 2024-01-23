import { 
  AppConfigDataClient, 
  GetLatestConfigurationCommand , 
  GetLatestConfigurationCommandInput, 
  StartConfigurationSessionCommand, 
  StartConfigurationSessionCommandInput 
} from "@aws-sdk/client-appconfigdata";

export const client = new AppConfigDataClient({});

export class AppConfigDataActions {
  public client = client;

  constructor() {}

  getLatestConfiguration = async (params: GetLatestConfigurationCommandInput) => {
    try {
      return await this.client.send( new GetLatestConfigurationCommand(params));
    } catch (err) {
      throw err;
    }
  }

  startConfigurationSession = async (params: StartConfigurationSessionCommandInput) => {
    try {
      return await this.client.send(new StartConfigurationSessionCommand(params));
    } catch (err) {
      throw err;
    }
  }

  getAppConfigData = async (params: StartConfigurationSessionCommandInput) => {
    try {
      const configurationSession = await this.startConfigurationSession(params);

      return await this.getLatestConfiguration({ ConfigurationToken: configurationSession.InitialConfigurationToken});
    } catch (err) {
      throw err;
    }
  }
}

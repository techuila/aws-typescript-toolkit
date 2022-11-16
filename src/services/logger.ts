import { ValueOf, levels } from './../types/index';
import { Context } from 'aws-lambda';

type LogData = {
  body: Record<string, string>;
  level: ValueOf<typeof levels>;
  service: string;
  response: string | Record<string, any> | unknown;
  stack?: string;
} & Context;

export class Logger {
  public filename: string;

  constructor() {}

  log(data: Record<string, any>, event?: string) {
    console[data.level === 'ERROR' ? 'error' : 'info'](JSON.stringify({ ...data, event }, null, 2));
  }
}

const logger = new Logger();

export const Log = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const method = descriptor.value;
  const log = logger.log;

  descriptor.value = async function (...args: any) {
    const [event, context] = args;
    const logData: LogData = {
      ...context,
      body: event,
      level: 'INFO',
      service: 'b2b-platform',
      response: ''
    };

    try {
      const result = await method.apply(this, args);

      logData.response = result;
      log(logData, 'TriggerHandler');

      return result;
    } catch (error) {
      logData.level = 'ERROR';
      logData.response = error;

      if (error instanceof Error) logData.stack = error.stack;

      log(logData);

      throw error;
    }
  };
};

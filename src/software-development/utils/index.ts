import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DatabaseError } from '../exceptions';


export const streamToString = (stream: any) =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

export const flattenInput = (obj: Record<string, any>) => {
  const { input, ...rest } = obj;
  return { ...input, ...rest };
};


export function CatchDatabaseException(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      if (!isConditionalException(error)) throw new DatabaseError(error);
      throw error;
    }
  };
}

export const isConditionalException = (error: unknown) => error instanceof ConditionalCheckFailedException;

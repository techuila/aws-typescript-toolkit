import { GetObjectCommand, GetObjectCommandInput, PutObjectCommand, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { streamToString } from '../utils';

export const client = new S3Client({});

export class BucketActions {
  public client = client;
  public streamToString = streamToString;

  constructor() {}

  sendObject = async (params: PutObjectCommandInput) => {
    try {
      return await this.client.send(new PutObjectCommand(params));
    } catch (err) {
      throw err;
    }
  };

  getObject = async (params: GetObjectCommandInput) => {
    try {
      return await this.client.send(new GetObjectCommand(params));
    } catch (err) {
      throw err;
    }
  };
}

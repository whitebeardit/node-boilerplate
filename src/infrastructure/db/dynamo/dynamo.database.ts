import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { Logger } from 'traceability';
import { IDatabase } from '../database.interface';
import { dynamoClient } from './dynamo.client';
import { USER_TABLE_NAME, userTableDefinition } from './tables/user.table';

const TABLE_CREATION_MAX_WAIT_SECONDS = 30;

/**
 * DynamoDB lifecycle adapter: ensures the tables exist on boot (idempotent —
 * in production they are usually provisioned by IaC and this becomes a
 * read-only check) and releases the client sockets on shutdown.
 */
export class DynamoDatabase implements IDatabase {
  async start(): Promise<void> {
    await this.ensureUserTable();
    Logger.info('Connected to DynamoDB', { eventName: 'database.connected' });
  }

  async close(): Promise<void> {
    dynamoClient.destroy();
    Logger.info('DynamoDB client closed', {
      eventName: 'database.disconnected',
    });
  }

  private async ensureUserTable(): Promise<void> {
    try {
      await dynamoClient.send(
        new DescribeTableCommand({ TableName: USER_TABLE_NAME }),
      );
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        throw error;
      }
      await dynamoClient.send(new CreateTableCommand(userTableDefinition));
      await waitUntilTableExists(
        { client: dynamoClient, maxWaitTime: TABLE_CREATION_MAX_WAIT_SECONDS },
        { TableName: USER_TABLE_NAME },
      );
      Logger.info('DynamoDB table created', {
        eventName: 'database.table_created',
        tableName: USER_TABLE_NAME,
      });
    }
  }
}

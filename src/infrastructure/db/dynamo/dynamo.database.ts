import {
  CreateTableCommand,
  CreateTableCommandInput,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { Logger } from 'traceability';
import { IDatabase } from '../database.interface';
import { dynamoClient } from './dynamo.client';
import { userTableDefinition } from './tables/user.table';
import { userEmailTableDefinition } from './tables/user-email.table';

const TABLE_CREATION_MAX_WAIT_SECONDS = 30;

const TABLE_DEFINITIONS: CreateTableCommandInput[] = [
  userTableDefinition,
  userEmailTableDefinition,
];

/**
 * DynamoDB lifecycle adapter: ensures the tables exist on boot (idempotent —
 * in production they are usually provisioned by IaC and this becomes a
 * read-only check) and releases the client sockets on shutdown.
 */
export class DynamoDatabase implements IDatabase {
  async start(): Promise<void> {
    for (const definition of TABLE_DEFINITIONS) {
      await this.ensureTable(definition);
    }
    Logger.info('Connected to DynamoDB', { eventName: 'database.connected' });
  }

  async close(): Promise<void> {
    dynamoClient.destroy();
    Logger.info('DynamoDB client closed', {
      eventName: 'database.disconnected',
    });
  }

  private async ensureTable(
    definition: CreateTableCommandInput,
  ): Promise<void> {
    try {
      await dynamoClient.send(
        new DescribeTableCommand({ TableName: definition.TableName }),
      );
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        throw error;
      }
      await dynamoClient.send(new CreateTableCommand(definition));
      await waitUntilTableExists(
        { client: dynamoClient, maxWaitTime: TABLE_CREATION_MAX_WAIT_SECONDS },
        { TableName: definition.TableName },
      );
      Logger.info('DynamoDB table created', {
        eventName: 'database.table_created',
        tableName: definition.TableName,
      });
    }
  }
}

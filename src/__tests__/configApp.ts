import path from 'path';
import { Server } from '../interfaces/http/server';
import { DynamoDatabase } from '../infrastructure/db/dynamo/dynamo.database';
import { UserControllerFactory } from '../infrastructure/config/factories/user.controller.factory';
import { OpsControllerFactory } from '../infrastructure/config/factories/ops.controller.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const app = new Server({
  port: Number(process.env.PORT) || 3000,
  controllers: [UserControllerFactory.create(), OpsControllerFactory.create()],
  database: new DynamoDatabase(),
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

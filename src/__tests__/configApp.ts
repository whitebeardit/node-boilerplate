import path from 'path';
import { Server } from '../domain/server/server';
import { UserControllerFactory } from '../configuration/factory/user.controller.factory';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const app = new Server({
  port: Number(process.env.PORT) || 3000,
  controllers: [UserControllerFactory.create()],
  databaseURI: process.env.DATABASE_URI,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

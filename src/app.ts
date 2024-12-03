import path from "path";
import { Server } from "./domain/server/server";
import { BoilerplateController } from "./application/controllers/boilerplate.controller";
import { BoilerplateService } from "./domain/boilerplate/boilerplate.service";
import { UserController } from "./application/controllers/user.controller";
import { UserService } from "./domain/user/user.service";
import { UserRepository } from "./infraestructure/repository/user.repository";

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  "./contracts/boilerplate.yaml"
);

const app = new Server({
  port: Number(process.env.PORT) || 3000,
  controllers: [
    new BoilerplateController(new BoilerplateService()),
    new UserController(new UserService(new UserRepository())),
  ],
  databaseURI: process.env.DATABASE_URI,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

async function start() {
  app.databaseSetup();
  app.listen();
}

start();

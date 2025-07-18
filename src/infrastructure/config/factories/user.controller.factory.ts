import { UserController } from '../../../interfaces/http/controllers/user.controller';
import { IController } from '../../../interfaces/http/controllers/IController';
import { UserServiceFactory } from './user.service.factory';

export class UserControllerFactory {
  static create(): IController {
    return new UserController(UserServiceFactory.create());
  }
}

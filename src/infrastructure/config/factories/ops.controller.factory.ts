import { OpsController } from '../../../interfaces/http/controllers/ops.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { OpsServiceFactory } from './ops.service.factory';

export class OpsControllerFactory {
  static create(): IController {
    return new OpsController(OpsServiceFactory.create());
  }
}

import { Router, Request, Response, NextFunction } from 'express';
import { IController } from './controller.interface';
import { IOpsService } from '../../../domain/ops/interfaces/ops.service.interface';

export class OpsController implements IController {
  router: Router;
  private readonly opsService: IOpsService;

  constructor(opsService: IOpsService) {
    this.opsService = opsService;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.post('/ops/user-new/redrive', this.redriveUserNewDlq);
    this.router.get('/ops/users', this.getUsersByCid);
  }

  /**
   * Start a redrive of the USER.NEW dead-letter queue
   */
  redriveUserNewDlq = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { taskHandle } = await this.opsService.redriveUserNewDlq();
      res.status(202).json({ message: 'DLQ redrive started', taskHandle });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Find the users created under a correlation id (cid coerced/required by
   * the OpenAPI validator)
   */
  getUsersByCid = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { cid } = req.query as { cid: string };
    try {
      const items = await this.opsService.findUsersByCid(cid);
      res.status(200).json({ cid, items });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get the router with all routes
   */
  public getRoutes(): Router {
    return this.router;
  }
}

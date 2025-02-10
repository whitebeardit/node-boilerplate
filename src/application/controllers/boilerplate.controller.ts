import { Router } from 'express';
import { IController } from '../../domain/server/interfaces/IController';
import { Request, Response } from 'express';
import { BoilerplateService } from '../../domain/boilerplate/boilerplate.service';

export class BoilerplateController implements IController {
  router: Router;
  private readonly boilerplateService: BoilerplateService;

  constructor(boilerplateService: BoilerplateService) {
    this.boilerplateService = boilerplateService;
    this.router = Router();
    this.initRoutes();
  }
  initRoutes() {
    this.router.get(`/boilerplate`, this.getBoilerplate);
  }

  getBoilerplate = (req: Request, res: Response) => {
    const message = this.boilerplateService.getBoilerplate();
    res.status(200).send(message);
  };

  public getRoutes() {
    return this.router;
  }
}

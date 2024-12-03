import { Router } from "express";

export interface IController {
  getRoutes(): Router;
}

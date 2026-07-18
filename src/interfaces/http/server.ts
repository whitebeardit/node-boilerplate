import express, {
  Request,
  Response,
  Application,
  NextFunction,
  RequestHandler,
} from 'express';
import { ContextAsyncHooks, Logger } from 'traceability';
import { Server as httpServer } from 'http';
import { IController } from './controllers/IController';
import mongoose from 'mongoose';
import * as OpenApiValidator from 'express-openapi-validator';
import helmet from 'helmet';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import { DomainError } from '../../domain/errors/domain.error';

export class Server {
  public app: Application;

  public port: number;

  public apiSpecLocation?: string;

  public DATABASE_URI?: string;

  private readonly timeoutMilliseconds?: number;

  private readonly defaultMiddlewares = [
    express.json({ limit: '3mb' }),
    express.urlencoded({ limit: '3mb', extended: true }),
    ContextAsyncHooks.getExpressMiddlewareTracking(),
    helmet(),
  ];
  constructor(appInit: {
    port: number;
    middlewaresToStart?: Array<RequestHandler>;
    controllers?: Array<IController>;
    apiSpecLocation?: string;
    databaseURI?: string;
    timeoutMilliseconds?: number;
  }) {
    this.app = express();
    this.port = appInit.port;
    this.apiSpecLocation = appInit.apiSpecLocation;
    this.DATABASE_URI = appInit.databaseURI;
    this.timeoutMilliseconds = appInit.timeoutMilliseconds;

    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'OK' });
    });

    this.middlewares([
      ...this.defaultMiddlewares,
      ...(appInit.middlewaresToStart || []),
    ]);

    this.routes(appInit.controllers || []);

    this.errorHandler();
  }

  private middlewares(middleWares: Array<RequestHandler>) {
    middleWares.forEach((middleWare) => this.app.use(middleWare));
    this.app.use(
      OpenApiValidator.middleware({
        apiSpec: this.apiSpecLocation || '',
        validateApiSpec: true,
        validateResponses: true,
      }),
    );
  }

  /**
   * Central error handler: the only place that translates errors into HTTP
   * responses, always matching the Error/ValidationError contract schemas.
   */
  private errorHandler() {
    this.app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof DomainError) {
          res.status(err.status).json({
            message: err.message,
            status: err.status,
          });
          return;
        }
        if (err instanceof HttpError) {
          if (err.status >= 500) {
            Logger.error(err.message, {
              eventName: 'server.http_error',
              status: err.status,
              errors: err.errors,
            });
          }
          res.status(err.status).json({
            message: err.message,
            status: err.status,
            errors: err.errors,
          });
          return;
        }
        Logger.error(err.message, {
          eventName: 'server.error',
          stack: err.stack,
        });
        res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        });
      },
    );
  }

  private routes(controllers: Array<IController>, pathRoute = '/') {
    controllers.forEach((controller) =>
      this.app.use(pathRoute, controller.getRoutes()),
    );
  }

  public async databaseSetup() {
    if (!this.DATABASE_URI) {
      throw new Error('Database URI not provided');
    }
    mongoose.connection.once('connected', () => {
      Logger.info('Connected to MongoDB', { eventName: 'database.connected' });
    });
    mongoose.connection?.on('error', (err) => {
      Logger.error(`Error connecting to MongoDB: ${err.message}`, {
        eventName: 'database.connection_error',
      });
    });
    await mongoose.connect(this.DATABASE_URI);
  }

  public async closeDatabase() {
    mongoose.connection.once('disconnected', () => {
      Logger.info('Mongoose disconnected', {
        eventName: 'database.disconnected',
      });
    });
    await mongoose.disconnect();
  }

  public listen(): httpServer {
    return this.app
      .listen(this.port, () => {
        Logger.info(`App listening on the http://localhost:${this.port}`, {
          eventName: 'start_listening',
          process: 'Application',
        });
      })
      .setTimeout(this.timeoutMilliseconds || 30000);
  }
}

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

export class Server {
  public app: Application;

  public port: number;

  public apiSpecLocation?: string;

  public DATABASE_URI?: string;

  private readonly timeoutMilliseconds?: number;

  private readonly middleWaresToStart = [
    express.json({ limit: '3mb' }),
    express.urlencoded({ limit: '3mb', extended: true }),
    ContextAsyncHooks.getExpressMiddlewareTracking(),
    helmet(),
  ];
  constructor(appInit: {
    port: number;
    originAllowed?: string[] | RegExp[];
    corsWithCredentials?: boolean;
    middlewaresToStart?: Array<RequestHandler>;
    controllers?: Array<IController>;
    apiSpecLocation?: string;
    databaseURI?: string;
    customizers?: Array<
      (application: Application, fileDestination: string) => void
    >;
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

    this.middlewares(this.middleWaresToStart);

    this.routes(appInit.controllers || []);

    this.customizers();
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
  private customizers() {
    this.app.use(
      (err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof HttpError) {
          if (err.status === 500) {
            Logger.error(JSON.stringify(err));
          }
          res.status(err.status).json({ message: err.message });
          return;
        }
        if (err instanceof Error) {
          Logger.error(
            JSON.stringify({
              eventName: 'server.error',
              message: err.message,
              stack: err.stack,
            }),
          );
        }
        res.status(500).json({
          message: 'Internal Server Error',
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
      Logger.error('Database URI not provided');
      return;
    }
    mongoose.connection.once('connected', () => {
      Logger.info('connect to MongoDB ');
    });
    mongoose.connection?.on('error', (err) => {
      Logger.info(`error to connect - MongoDB: Error: ${err.message}`);
    });
    await mongoose.connect(this.DATABASE_URI);
  }

  public async closeDatabase() {
    mongoose.connection.once('disconnected', () => {
      Logger.info(`Mongoose disconnected`);
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

import path from 'path';
import supertest from 'supertest';
import mongoose from 'mongoose';
import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express';
import { Server } from '../../interfaces/http/server';
import { IController } from '../../interfaces/http/controllers/controller.interface';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../../contracts/service.yaml',
);

class ThrowingController implements IController {
  private readonly router = Router();

  constructor() {
    this.router.get(
      '/users',
      (req: Request, res: Response, next: NextFunction) => {
        next(new Error('unexpected failure'));
      },
    );
    // Violates the contract on purpose: the 404 Error schema requires
    // message and status, so response validation raises a 500 HttpError
    this.router.get('/users/:id', (req: Request, res: Response) => {
      res.status(404).json({});
    });
  }

  getRoutes(): Router {
    return this.router;
  }
}

const passthroughMiddleware: RequestHandler = (req, res, next) => next();

const app = new Server({
  port: 0,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
  controllers: [new ThrowingController()],
  middlewaresToStart: [passthroughMiddleware],
  timeoutMilliseconds: 1000,
});

describe('When we check the health endpoint', () => {
  it('should return 200 with status OK', async () => {
    const { statusCode, body } = await supertest(app.app).get('/health');

    expect(statusCode).toBe(200);
    expect(body).toEqual({ status: 'OK' });
  });
});

describe('When an unexpected error reaches the central handler', () => {
  it('should respond 500 with the contract error shape', async () => {
    const { statusCode, body } = await supertest(app.app).get('/users');

    expect(statusCode).toBe(500);
    expect(body).toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    });
  });
});

describe('When a response violates the contract', () => {
  it('should log and respond 500 through the central handler', async () => {
    const { statusCode, body } = await supertest(app.app).get('/users/any-id');

    expect(statusCode).toBe(500);
    expect(body).toMatchObject({ status: 500 });
  });
});

describe('When we create a server without an api spec', () => {
  it('should fail at construction time', () => {
    expect(() => new Server({ port: 0 })).toThrow();
  });
});

describe('When we set up the database without a URI', () => {
  it('should fail fast with a clear message', async () => {
    await expect(app.databaseSetup()).rejects.toThrow(
      'Database URI not provided',
    );
  });
});

describe('When we set up and close the database with a URI', () => {
  it('should connect through mongoose and disconnect cleanly', async () => {
    const connectSpy = jest
      .spyOn(mongoose, 'connect')
      .mockImplementation(async () => mongoose);
    app.DATABASE_URI = 'mongodb://localhost/unit-test';

    await app.databaseSetup();
    expect(connectSpy).toHaveBeenCalledWith('mongodb://localhost/unit-test');

    await app.closeDatabase();

    connectSpy.mockRestore();
    app.DATABASE_URI = undefined;
  });
});

describe('When we start listening', () => {
  it('should open and close the http server', async () => {
    const httpServer = app.listen();
    await new Promise((resolve) => httpServer.once('listening', resolve));

    expect(httpServer.listening).toBe(true);

    await new Promise((resolve) => httpServer.close(resolve));
  });
});

import { Router, Request, Response, NextFunction } from 'express';
import { IController } from './controller.interface';
import { IUserService } from '../../../domain/user/interfaces/user.service.interface';

export class UserController implements IController {
  router: Router;
  private readonly userService: IUserService;

  constructor(userService: IUserService) {
    this.userService = userService;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.get('/users', this.getUsers);
    this.router.get('/users/:id', this.getUserById);
    this.router.post('/users', this.createUser);
    this.router.put('/users/:id', this.updateUser);
    this.router.delete('/users/:id', this.deleteUser);
  }

  /**
   * Fetch users with pagination (limit/offset coerced by the OpenAPI validator)
   */
  getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { limit, offset } = req.query as {
      limit?: number;
      offset?: number;
    };
    try {
      const users = await this.userService.listUsers({}, { limit, offset });
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Fetch a user by ID
   */
  getUserById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new user
   */
  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id, name, email, createdAt } = req.body;
    try {
      const newUser = await this.userService.createUser({
        id,
        name,
        email,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      });
      res.status(201).json(newUser);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a user's information by ID
   */
  updateUser = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { name, email } = req.body;
    try {
      const updatedUser = await this.userService.updateUserById({
        id: req.params.id,
        userData: { name, email },
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a user by ID
   */
  deleteUser = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.userService.deleteUserById(req.params.id);
      res.status(200).json({ message: 'User deleted successfully' });
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

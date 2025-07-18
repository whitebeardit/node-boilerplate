import { Router, Request, Response } from 'express';
import { IController } from './IController';
import { UserService } from '../../../domain/user/service/user.service';

export class UserController implements IController {
  router: Router;
  private readonly userService: UserService;

  constructor(userService: UserService) {
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
   * Fetch all users
   */
  getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.listUsers();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Fetch a user by ID
   */
  getUserById = async (
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    try {
      const user = await this.userService.getUserById(id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Create a new user
   */
  createUser = async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ error: (error as Error).message });
    }
  };

  /**
   * Update a user's information by ID
   */
  updateUser = async (
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    const updateData = req.body;
    try {
      const updatedUser = await this.userService.updateUserById(id, updateData);
      if (!updatedUser) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  };

  /**
   * Delete a user by ID
   */
  deleteUser = async (
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    try {
      const deletedUser = await this.userService.deleteUserById(id);
      if (!deletedUser) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Get the router with all routes
   */
  public getRoutes(): Router {
    return this.router;
  }
}

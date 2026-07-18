import { UserService } from '../../domain/user/service/user.service';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { IUserRepositoryWrite } from '../../domain/user/repository/user.repository.write';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { ConflictError } from '../../domain/errors/conflict.error';
import { NotFoundError } from '../../domain/errors/not-found.error';

const A_USER: IUser = {
  id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

let userRepositoryRead: jest.Mocked<IUserRepositoryRead>;
let userRepositoryWrite: jest.Mocked<IUserRepositoryWrite>;
let userService: UserService;

beforeEach(() => {
  userRepositoryRead = {
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    listUsers: jest.fn(),
  };
  userRepositoryWrite = {
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    deleteUserById: jest.fn(),
  };
  userService = new UserService({ userRepositoryRead, userRepositoryWrite });
});

describe('When we create a user', () => {
  it('should create the user when the email is not in use', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);
    userRepositoryWrite.createUser.mockResolvedValue(A_USER);

    const createdUser = await userService.createUser(A_USER);

    expect(createdUser).toEqual(A_USER);
    expect(userRepositoryWrite.createUser).toHaveBeenCalledWith(A_USER);
  });

  it('should throw ConflictError when the email is already in use', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);

    await expect(userService.createUser(A_USER)).rejects.toThrow(ConflictError);
    expect(userRepositoryWrite.createUser).not.toHaveBeenCalled();
  });
});

describe('When we get a user by ID', () => {
  it('should return the user when it exists', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);

    const user = await userService.getUserById(A_USER.id);

    expect(user).toEqual(A_USER);
    expect(userRepositoryRead.findUserById).toHaveBeenCalledWith(A_USER.id);
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(userService.getUserById('missing-id')).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('When we get a user by email', () => {
  it('should return the user when it exists', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);

    const user = await userService.getUserByEmail(A_USER.email);

    expect(user).toEqual(A_USER);
    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      A_USER.email,
    );
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);

    await expect(
      userService.getUserByEmail('missing@email.com'),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('When we update a user', () => {
  it('should update and return the user when it exists', async () => {
    const updatedUser = { ...A_USER, name: 'Edward Newgate' };
    userRepositoryWrite.updateUserById.mockResolvedValue(updatedUser);

    const result = await userService.updateUserById({
      id: A_USER.id,
      userData: { name: 'Edward Newgate' },
    });

    expect(result).toEqual(updatedUser);
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER.id, {
      name: 'Edward Newgate',
    });
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryWrite.updateUserById.mockResolvedValue(null);

    await expect(
      userService.updateUserById({ id: 'missing-id', userData: {} }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('When we delete a user', () => {
  it('should delete and return the user when it exists', async () => {
    userRepositoryWrite.deleteUserById.mockResolvedValue(A_USER);

    const result = await userService.deleteUserById(A_USER.id);

    expect(result).toEqual(A_USER);
    expect(userRepositoryWrite.deleteUserById).toHaveBeenCalledWith(A_USER.id);
  });

  it('should throw NotFoundError when the user does not exist', async () => {
    userRepositoryWrite.deleteUserById.mockResolvedValue(null);

    await expect(userService.deleteUserById('missing-id')).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('When we list users', () => {
  it('should apply default pagination when none is provided', async () => {
    userRepositoryRead.listUsers.mockResolvedValue([A_USER]);

    const users = await userService.listUsers({ name: A_USER.name });

    expect(users).toEqual([A_USER]);
    expect(userRepositoryRead.listUsers).toHaveBeenCalledWith(
      { name: A_USER.name },
      { limit: 20, offset: 0 },
    );
  });

  it('should forward the pagination provided by the caller', async () => {
    userRepositoryRead.listUsers.mockResolvedValue([]);

    await userService.listUsers({}, { limit: 5, offset: 10 });

    expect(userRepositoryRead.listUsers).toHaveBeenCalledWith(
      {},
      { limit: 5, offset: 10 },
    );
  });
});

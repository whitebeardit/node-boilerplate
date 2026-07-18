import { OpsService } from '../../domain/ops/service/ops.service';
import { IDlqRedriver } from '../../domain/ops/messaging/dlq.redriver';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';

const A_USER: IUser = {
  id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

let dlqRedriver: jest.Mocked<IDlqRedriver>;
let userRepositoryRead: jest.Mocked<IUserRepositoryRead>;
let opsService: OpsService;

beforeEach(() => {
  dlqRedriver = {
    redrive: jest.fn(),
  };
  userRepositoryRead = {
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    listUsers: jest.fn(),
    listUsersByCid: jest.fn(),
  };
  opsService = new OpsService({ dlqRedriver, userRepositoryRead });
});

describe('When we redrive the USER.NEW dead-letter queue', () => {
  it('should delegate to the redriver and return the task handle', async () => {
    dlqRedriver.redrive.mockResolvedValue({ taskHandle: 'task-1' });

    const result = await opsService.redriveUserNewDlq();

    expect(result).toEqual({ taskHandle: 'task-1' });
    expect(dlqRedriver.redrive).toHaveBeenCalledTimes(1);
  });
});

describe('When we find users by correlation id', () => {
  it('should return the users created under the cid', async () => {
    userRepositoryRead.listUsersByCid.mockResolvedValue([A_USER]);

    const users = await opsService.findUsersByCid('a-cid');

    expect(users).toEqual([A_USER]);
    expect(userRepositoryRead.listUsersByCid).toHaveBeenCalledWith('a-cid');
  });

  it('should return an empty list when no user matches', async () => {
    userRepositoryRead.listUsersByCid.mockResolvedValue([]);

    await expect(opsService.findUsersByCid('unknown-cid')).resolves.toEqual(
      [],
    );
  });
});

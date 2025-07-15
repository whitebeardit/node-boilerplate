import { UserService } from '../../domain/user/service/user.service';
import { UserRepositoryRead } from '../../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../infrastructure/repository/user/user.repository.write';

export class UserServiceFactory {
  static create() {
    const repoRead = new UserRepositoryRead();
    const repoWrite = new UserRepositoryWrite();

    return new UserService({
      userRepositoryRead: repoRead,
      userRepositoryWrite: repoWrite,
    });
  }
}

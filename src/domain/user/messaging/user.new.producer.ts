import { IUser } from '../interfaces/user.interface';

// Producer port: the domain publishes USER.NEW without knowing the transport
// (implemented by UserNewProducerSqs in infrastructure/messaging).
export interface IUserNewProducer {
  publishUserNew(user: IUser): Promise<void>;
}

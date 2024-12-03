export class User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  constructor(id: string, name: string, email: string, createdAt: Date) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.createdAt = createdAt;
  }
}

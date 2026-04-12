import { Entity, OneToMany } from 'typeorm';
import { RoleEntity } from '@nest-util/nest-auth';
import { UserRole } from './user-role.entity';

@Entity('roles')
export class Role extends RoleEntity {
  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles!: UserRole[];
}

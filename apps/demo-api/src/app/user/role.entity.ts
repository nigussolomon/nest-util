import { Entity, OneToMany } from 'typeorm';
import { RoleEntity } from '../../../../../libs/nest-auth/src/lib/entities/role.entity';
import { UserRole } from './user-role.entity';

@Entity('roles')
export class Role extends RoleEntity {
  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles!: UserRole[];
}

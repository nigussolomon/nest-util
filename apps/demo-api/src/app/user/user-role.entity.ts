import { Entity, JoinColumn, ManyToOne } from 'typeorm';
import { UserRoleEntity } from '../../../../../libs/nest-auth/src/lib/entities/user-role.entity';
import { Role } from './role.entity';
import { User } from './user.entity';

@Entity('user_roles')
export class UserRole extends UserRoleEntity {
  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Role, (role) => role.userRoles, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  override role!: Role;
}

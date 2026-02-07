import { Injectable, Inject, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AUTH_OPTIONS } from '../constants';
import type { AuthModuleOptions } from '../interfaces/auth-options';

@Injectable()
export class AuthService {
  private readonly userRepository: Repository<any>;

  constructor(
    @Inject(AUTH_OPTIONS) private readonly options: AuthModuleOptions,
    private readonly jwtService: JwtService,
    @Inject(DataSource) private readonly dataSource: DataSource
  ) {
    this.userRepository = this.dataSource.getRepository(this.options.userEntity);
  }

  async register(data: any) {
    const identifier = data[this.options.identifierField];
    const password = data[this.options.passkeyField];

    const existingUser = await this.userRepository.findOne({
      where: { [this.options.identifierField]: identifier },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = this.userRepository.create({
      ...data,
      [this.options.passkeyField]: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);
    return this.removeSensitiveData(savedUser);
  }

  async login(credentials: any) {
    const identifier = credentials[this.options.identifierField];
    const password = credentials[this.options.passkeyField];

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect(`user.${this.options.passkeyField}`)
      .where({ [this.options.identifierField]: identifier })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user[this.options.passkeyField]
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return await this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const secret = this.options.refreshTokenSecret || this.options.jwtSecret;

    try {
      const payload = this.jwtService.verify(refreshToken, { secret });
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect(`user.${refreshTokenField}`)
        .where({ id: payload.sub })
        .getOne();

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const storedHash = user[refreshTokenField];
      if (!storedHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isTokenValid = await bcrypt.compare(refreshToken, storedHash);
      if (!isTokenValid) {
        // Potential reuse attack: clear token and throw
        await this.userRepository.createQueryBuilder()
          .update(this.options.userEntity)
          .set({ [refreshTokenField]: null })
          .where('id = :id', { id: user.id })
          .execute();
          
        throw new UnauthorizedException('Refresh token reused or invalid');
      }

      // Explicitly nullify before generating new ones to ensure rotation
      const nullifyResult = await this.userRepository.createQueryBuilder()
        .update(this.options.userEntity)
        .set({ [refreshTokenField]: null })
        .where('id = :id', { id: user.id })
        .execute();

      if (nullifyResult.affected === 0) {
        throw new UnauthorizedException('Invalid refresh token or user not found');
      }
      
      return await this.generateTokens(user);
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: any) {
    const identifierField = this.options.identifierField;
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';
    const payload = { sub: user.id, [identifierField]: user[identifierField] };
    
    const refreshPayload = { 
      ...payload, 
      nonce: Math.random().toString(36).substring(7) 
    };

    const accessToken = this.jwtService.sign(payload);
    
    const refreshSecret = this.options.refreshTokenSecret || this.options.jwtSecret;
    const refreshExpiresIn = this.options.refreshTokenExpiresIn || '7d';
    
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn as any,
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    
    const updateResult = await this.userRepository.createQueryBuilder()
      .update(this.options.userEntity)
      .set({ [refreshTokenField]: hashedRefreshToken })
      .where('id = :id', { id: user.id })
      .execute();

    if (updateResult.affected === 0) {
      throw new UnauthorizedException('Failed to update session');
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.removeSensitiveData(user),
    };
  }

  private removeSensitiveData(user: any) {
    const { ...userData } = user;
    const passkeyField = this.options.passkeyField;
    const refreshTokenField = this.options.refreshTokenField || 'refreshToken';

    delete userData[passkeyField];
    delete userData[refreshTokenField];

    return userData;
  }

  async validateUser(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    return user ? this.removeSensitiveData(user) : null;
  }
}

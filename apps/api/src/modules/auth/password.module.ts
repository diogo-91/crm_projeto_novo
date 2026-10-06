import { Injectable, Module } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash: string | undefined;
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }
  hash(password: string) {
    return hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  }
  async verify(password: string, passwordHash: string | null): Promise<boolean> {
    const target = passwordHash ?? this.dummyHash;
    if (!target) throw new Error('Password service not initialized');
    const valid = await verify(target, password);
    return passwordHash !== null && valid;
  }
}
@Module({ providers: [PasswordService], exports: [PasswordService] })
export class PasswordModule {}

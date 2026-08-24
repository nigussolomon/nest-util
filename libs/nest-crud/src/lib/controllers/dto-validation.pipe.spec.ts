import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { DtoValidationPipe } from './dto-validation.pipe';

class CreateStubDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}

describe('DtoValidationPipe', () => {
  const pipe = new DtoValidationPipe(CreateStubDto);
  const meta = { type: 'body', metatype: Object, data: undefined } as any;

  it('passes a valid payload through unchanged (plain object)', async () => {
    const payload = { name: 'Jane', email: 'jane@example.com' };
    const result = await pipe.transform(payload, meta);
    expect(result).toBe(payload);
    expect(result).toEqual({ name: 'Jane', email: 'jane@example.com' });
  });

  it('throws BadRequestException for invalid payload', async () => {
    const payload = { name: '', email: 'not-an-email' };
    await expect(pipe.transform(payload, meta)).rejects.toThrow(
      BadRequestException
    );
  });

  it('passes through when DTO has no validators', async () => {
    class EmptyDto {}
    const noop = new DtoValidationPipe(EmptyDto);
    const payload = { anything: 'goes' };
    await expect(noop.transform(payload, meta)).resolves.toBe(payload);
  });
});

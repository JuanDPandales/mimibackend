import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ProcessPaymentInput } from '../../application/use-cases/process-payment.service';

export class ProcessPaymentDto implements ProcessPaymentInput {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  cardToken: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  customerName: string;

  @Matches(/^\+?[0-9]{7,15}$/)
  customerPhone: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  deliveryAddress: string;

  @IsString()
  @IsNotEmpty()
  deliveryCity: string;

  @IsString()
  @IsNotEmpty()
  deliveryDepartment: string;
}

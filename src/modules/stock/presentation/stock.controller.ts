import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetStockUseCase } from '../application/use-cases/get-stock.service';
import { StockResponseDto } from './dto/stock-response.dto';

@Controller('stock')
export class StockController {

  constructor(private readonly getStockUseCase: GetStockUseCase) { }

  @Get('product/:productId')
  @HttpCode(HttpStatus.OK)
  async getStockByProductId(
    @Param('productId') productId: string,
  ): Promise<StockResponseDto> {
    const result = await this.getStockUseCase.execute(productId);

    if (result.success) {
      return {
        productId: result.value.productId,
        quantity: result.value.quantity,
      };
    }

    // Manejo de errores específico para stock
    if (result.error.code === 'NOT_FOUND') {
      throw new NotFoundException(
        `Stock para el producto ${productId} no encontrado`,
      );
    }
    throw new InternalServerErrorException('Error al obtener stock');
  }
}

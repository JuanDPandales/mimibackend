import { Controller, Get, Param } from '@nestjs/common';
import { GetProductByIdUseCase } from '../application/use-cases/get-product-by-id.service';
import { GetProductsUseCase } from '../application/use-cases/get-products.service';

@Controller('products')
export class ProductsController {

  constructor(
    private readonly getProducts: GetProductsUseCase,
    private readonly getProductById: GetProductByIdUseCase,
  ) { }

  @Get()
  async findAll() {
    const result = await this.getProducts.execute();
    if (!result.success) throw result.error;
    return { success: true, data: result.value };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.getProductById.execute(id);
    if (!result.success) throw result.error;
    return { success: true, data: result.value };
  }
}

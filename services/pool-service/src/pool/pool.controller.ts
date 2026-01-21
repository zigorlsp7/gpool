import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PoolService } from './pool.service';

@Controller('pools')
export class PoolController {
  constructor(private readonly poolService: PoolService) {}

  @Get()
  async listPools() {
    return this.poolService.listPools();
  }

  @Post()
  async createPool(@Body() createData: any) {
    return this.poolService.createPool(createData);
  }

  @Get(':poolId')
  async getPool(@Param('poolId') poolId: string) {
    return this.poolService.getPool(poolId);
  }

  @Put(':poolId')
  async updatePool(@Param('poolId') poolId: string, @Body() updateData: any) {
    return this.poolService.updatePool(poolId, updateData);
  }

  @Delete(':poolId')
  async deletePool(@Param('poolId') poolId: string) {
    return this.poolService.deletePool(poolId);
  }
}

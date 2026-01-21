import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':userId')
  async getUser(@Param('userId') userId: string) {
    return this.userService.getUser(userId);
  }

  @Put(':userId')
  async updateUser(@Param('userId') userId: string, @Body() updateData: any) {
    return this.userService.updateUser(userId, updateData);
  }

  @Get(':userId/pools')
  async getUserPools(@Param('userId') userId: string) {
    return this.userService.getUserPools(userId);
  }

  @Post(':userId/pools/:poolId/request')
  async requestPoolAccess(
    @Param('userId') userId: string,
    @Param('poolId') poolId: string,
  ) {
    return this.userService.requestPoolAccess(userId, poolId);
  }

  @Put(':userId/preferences')
  async updatePreferences(@Param('userId') userId: string, @Body() preferences: any) {
    return this.userService.updatePreferences(userId, preferences);
  }
}

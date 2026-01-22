import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDBService {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly tableName: string;

  private readonly docClient: DynamoDBDocumentClient;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');
    this.tableName = this.configService.get<string>('DYNAMODB_TABLE_USERS', 'Users');
    
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      ...(endpoint && { endpoint }),
      credentials: endpoint
        ? {
            accessKeyId: 'dummy',
            secretAccessKey: 'dummy',
          }
        : undefined,
    });

    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async createUser(userData: {
    userId: string;
    email: string;
    name: string;
    picture?: string;
    role?: string;
    createdAt?: string;
    updatedAt?: string;
  }) {
    const now = new Date().toISOString();
    const item = {
      userId: userData.userId,
      email: userData.email,
      name: userData.name,
      picture: userData.picture || '',
      role: userData.role || 'user',
      createdAt: userData.createdAt || now,
      updatedAt: userData.updatedAt || now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        }),
      );
      this.logger.log(`User created: ${userData.userId}`);
      return item;
    } catch (error) {
      this.logger.error(`Error creating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUser(userId: string) {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { userId },
        }),
      );

      if (!result.Item) {
        return null;
      }

      return result.Item;
    } catch (error) {
      this.logger.error(`Error getting user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'email-index',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': email,
          },
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return result.Items[0];
    } catch (error) {
      this.logger.error(`Error getting user by email: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateUser(userId: string, updates: Record<string, any>) {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });

    // Always update updatedAt
    updateExpressions.push(`#updatedAt = :updatedAt`);
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    try {
      // For DynamoDB, we need to get the item first, then update it
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        throw new Error(`User ${userId} not found`);
      }

      const updatedUser = { ...existingUser, ...updates };
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: updatedUser,
        }),
      );

      this.logger.log(`User updated: ${userId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Refresh Token operations
  async saveRefreshToken(tokenId: string, userId: string, expiresAt: number) {
    const refreshTokensTable = this.configService.get<string>(
      'DYNAMODB_TABLE_REFRESH_TOKENS',
      'RefreshTokens',
    );

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: refreshTokensTable,
          Item: {
            tokenId,
            userId,
            expiresAt,
            createdAt: new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      this.logger.error(`Error saving refresh token: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getRefreshToken(tokenId: string) {
    const refreshTokensTable = this.configService.get<string>(
      'DYNAMODB_TABLE_REFRESH_TOKENS',
      'RefreshTokens',
    );

    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: refreshTokensTable,
          Key: { tokenId },
        }),
      );

      if (!result.Item) {
        return null;
      }

      return result.Item;
    } catch (error) {
      this.logger.error(`Error getting refresh token: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteRefreshToken(tokenId: string) {
    const refreshTokensTable = this.configService.get<string>(
      'DYNAMODB_TABLE_REFRESH_TOKENS',
      'RefreshTokens',
    );

    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: refreshTokensTable,
          Key: { tokenId },
        }),
      );
      this.logger.log(`Refresh token deleted: ${tokenId}`);
    } catch (error) {
      this.logger.error(`Error deleting refresh token: ${error.message}`, error.stack);
      throw error;
    }
  }
}

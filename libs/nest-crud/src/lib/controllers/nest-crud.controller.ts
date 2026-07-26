import {
  Body,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
  Type,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Message } from '../decorators/response-message.decorator';
import { CrudEndpoint, CrudInterface } from '../interfaces/crud.interface';
import { PaginationDto } from '../dtos/pagination.dto';
import { CursorPaginationDto } from '../dtos/cursor-pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { Audit } from '../decorators/audit-log.decorator';
import { ListAuditLogsDto } from '../dtos/list-audit-logs.dto';

export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions';

export type CrudEndpointPermissions = string | readonly string[];

export type CrudPermissionsMap = Partial<
  Record<CrudEndpoint, CrudEndpointPermissions>
>;

export interface CrudControllerFactoryOptions {
  permissions?: CrudPermissionsMap;
}

export interface IBaseController<CD, UD, RD> {
  service: CrudInterface<CD, UD, RD>;
  findAll(
    query: PaginationDto & FilterDto
  ): Promise<{ data: RD[]; meta?: unknown } | RD[]>;
  findOne(id: number): Promise<RD>;
  create(dto: CD): Promise<RD>;
  update(id: number, dto: UD): Promise<RD>;
  remove(id: number): Promise<boolean>;
  findAuditLogs?(query: ListAuditLogsDto): Promise<unknown>;
}

const toPermissionList = (
  permissionValue: CrudEndpointPermissions
): string[] => {
  if (Array.isArray(permissionValue)) {
    return [
      ...permissionValue.filter((permission): permission is string =>
        Boolean(permission)
      ),
    ];
  }

  return typeof permissionValue === 'string' && permissionValue
    ? [permissionValue]
    : [];
};

const applyPermissionMetadata = (
  controllerClass: Type<unknown>,
  permissions?: CrudPermissionsMap
): void => {
  if (!permissions) {
    return;
  }

  for (const endpoint of Object.keys(permissions) as CrudEndpoint[]) {
    const permissionValue = permissions[endpoint];

    if (!permissionValue) {
      continue;
    }

    const permissionList = toPermissionList(permissionValue);

    if (permissionList.length === 0) {
      continue;
    }

    const handler = (
      controllerClass as unknown as {
        prototype: Record<string, unknown>;
      }
    ).prototype[endpoint];

    if (typeof handler !== 'function') {
      continue;
    }

    Reflect.defineMetadata(
      AUTH_PERMISSIONS_METADATA_KEY,
      permissionList,
      handler
    );
  }
};

export function CreateNestedCrudController<CD, UD, RD>(
  createDto: Type<CD>,
  updateDto: Type<UD>,
  responseDto: Type<RD>,
  options?: CrudControllerFactoryOptions
): Type<IBaseController<CD, UD, RD>> {
  class BaseController implements IBaseController<CD, UD, RD> {
    constructor(public readonly service: CrudInterface<CD, UD, RD>) {}

    private ensureEndpointEnabled(endpoint: CrudEndpoint): void {
      if (this.service.disabledEndpoints?.includes(endpoint)) {
        throw new NotFoundException('Resource not found');
      }
    }

    @Get()
    @Message('fetched')
    @ApiResponse({ type: [responseDto] })
    @ApiQuery({
      name: 'filter',
      required: false,
      style: 'deepObject',
      explode: true,
      type: 'object',
      description:
        'Filters in format filter[field_operator]=value. Operators: eq, ne, cont, notcont, starts, ends, gte, lte, gt, lt, in, nin, isnull. Grouping keys: and, or',
      example: {
        name_cont: 'Bob',
        or: [{ name_eq: 'Bob' }, { name_eq: 'Carol' }],
      },
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'orderBy', required: false, type: String })
    @ApiQuery({
      name: 'orderDirection',
      required: false,
      enum: ['ASC', 'DESC'],
    })
    @ApiQuery({ name: 'cursor', required: false, type: String })
    @ApiQuery({ name: 'includeTotal', required: false, type: Boolean })
    findAll(@Query() query: PaginationDto & CursorPaginationDto & FilterDto) {
      this.ensureEndpointEnabled('findAll');

      // Cursor-based pagination: dispatch to cursor endpoint
      if (query.cursor !== undefined) {
        if (!this.service.findAllWithCursor) {
          throw new NotFoundException('Resource not found');
        }
        return this.service.findAllWithCursor(query);
      }

      return this.service.findAll(query);
    }

    @Post()
    @Message('created')
    @Audit({ action: 'CREATE' })
    @ApiBody({ type: createDto })
    @ApiResponse({ type: responseDto })
    create(@Body() dto: CD) {
      this.ensureEndpointEnabled('create');
      return this.service.create(dto);
    }

    @Patch(':id')
    @Message('updated')
    @Audit({ action: 'UPDATE' })
    @ApiBody({ type: updateDto })
    @ApiResponse({ type: responseDto })
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UD) {
      this.ensureEndpointEnabled('update');
      return this.service.update(id, dto);
    }

    @Delete(':id')
    @Message('deleted')
    @Audit({ action: 'DELETE' })
    remove(@Param('id', ParseIntPipe) id: number) {
      this.ensureEndpointEnabled('remove');
      return this.service.remove(id);
    }

    @Get('auditlogs')
    @Message('fetched')
    findAuditLogs(@Query() query: ListAuditLogsDto) {
      this.ensureEndpointEnabled('findAuditLogs');

      if (!this.service.findAuditLogs) {
        throw new NotFoundException('Resource not found');
      }

      return this.service.findAuditLogs(query);
    }

    @Get(':id')
    @Message('fetched')
    @ApiResponse({ type: responseDto })
    findOne(@Param('id', ParseIntPipe) id: number) {
      this.ensureEndpointEnabled('findOne');
      return this.service.findOne(id);
    }
  }

  applyPermissionMetadata(BaseController, options?.permissions);

  return BaseController as Type<IBaseController<CD, UD, RD>>;
}

import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseIntPipe,
  Type,
  HttpStatus,
} from '@nestjs/common';
import { keyed, ErrorKey } from '@nest-util/nest-error';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Message } from '../decorators/response-message.decorator';
import { CrudEndpoint, CrudInterface } from '../interfaces/crud.interface';
import { PaginationDto } from '../dtos/pagination.dto';
import { CursorPaginationDto } from '../dtos/cursor-pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { Audit } from '../decorators/audit-log.decorator';
import { ListAuditLogsDto } from '../dtos/list-audit-logs.dto';
import { StatusChangeDto } from '../dtos/status-change.dto';
import { RequestModificationDto } from '../dtos/request-modification.dto';
import { CurrentUser } from '@nest-util/nest-auth';
import type { OwnershipUser } from '../interfaces/find-mine.interface';
import type {
  ApprovalHistoryView,
  ApprovalStatusView,
  RequestModificationPayload,
} from '../interfaces/approval-pipeline.interface';

export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions';

export type CrudEndpointPermissions = string | readonly string[];

export type CrudPermissionsMap = Partial<
  Record<CrudEndpoint, CrudEndpointPermissions>
>;

export interface CrudControllerFactoryOptions {
  permissions?: CrudPermissionsMap;
  enableFindMine?: boolean;
}

export interface IBaseController<CD, UD, RD> {
  service: CrudInterface<CD, UD, RD>;
  findAll(
    query: PaginationDto & FilterDto
  ): Promise<{ data: RD[]; meta?: unknown } | RD[]>;
  findOne(id: number, user?: OwnershipUser): Promise<RD>;
  create(dto: CD, user?: OwnershipUser): Promise<RD>;
  update(id: number, dto: UD, user?: OwnershipUser): Promise<RD>;
  changeStatus?(
    id: number,
    dto: StatusChangeDto,
    user?: OwnershipUser
  ): Promise<RD>;
  remove(id: number, user?: OwnershipUser): Promise<boolean>;
  findAuditLogs?(query: ListAuditLogsDto): Promise<unknown>;

  getApproval?(
    id: number,
    user?: OwnershipUser
  ): Promise<{ approval: ApprovalStatusView; history: ApprovalHistoryView[] }>;
  approveApproval?(id: number, user?: OwnershipUser): Promise<ApprovalStatusView>;
  rejectApproval?(id: number, user?: OwnershipUser): Promise<ApprovalStatusView>;
  requestModification?(
    id: number,
    dto: RequestModificationPayload,
    user?: OwnershipUser
  ): Promise<ApprovalStatusView>;
  resubmitApproval?(id: number, user?: OwnershipUser): Promise<ApprovalStatusView>;
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
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
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
          throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
        }
        return this.service.findAllWithCursor(query);
      }

      return this.service.findAll(query);
    }

    @Get('mine')
    @Message('fetched')
    @ApiResponse({ type: [responseDto] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'orderBy', required: false, type: String })
    @ApiQuery({
      name: 'orderDirection',
      required: false,
      enum: ['ASC', 'DESC'],
    })
    findMine(
      @CurrentUser() user: { id: string | number },
      @Query() query: PaginationDto & FilterDto
    ) {
      this.ensureEndpointEnabled('findMine');

      if (!this.service.findMine) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.findMine(user.id, query);
    }

    @Post()
    @Message('created')
    @Audit({ action: 'CREATE' })
    @ApiBody({ type: createDto })
    @ApiResponse({ type: responseDto })
    create(@Body() dto: CD, @CurrentUser() user?: OwnershipUser) {
      this.ensureEndpointEnabled('create');
      return this.service.create(dto, user);
    }

    @Patch(':id')
    @Message('updated')
    @Audit({ action: 'UPDATE' })
    @ApiBody({ type: updateDto })
    @ApiResponse({ type: responseDto })
    update(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UD,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('update');
      return this.service.update(id, dto, user);
    }

    @Post(':id/status')
    @Message('updated')
    @Audit({ action: 'UPDATE' })
    @ApiBody({ type: StatusChangeDto })
    @ApiResponse({ type: responseDto })
    changeStatus(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: StatusChangeDto,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('changeStatus');

      if (!this.service.changeStatus) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.changeStatus(id, dto.status, user);
    }

    @Get(':id/approval')
    @Message('fetched approval')
    @ApiResponse({ description: 'Approval status and modification history' })
    getApproval(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('getApproval');

      if (!this.service.getApproval) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.getApproval(id, user);
    }

    @Post(':id/approval/approve')
    @Message('approved')
    @Audit({ action: 'APPROVE' })
    @ApiResponse({ description: 'The updated approval status' })
    approveApproval(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('approveApproval');

      if (!this.service.approveApproval) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.approveApproval(id, user);
    }

    @Post(':id/approval/reject')
    @Message('rejected')
    @Audit({ action: 'REJECT' })
    @ApiResponse({ description: 'The updated approval status' })
    rejectApproval(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('rejectApproval');

      if (!this.service.rejectApproval) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.rejectApproval(id, user);
    }

    @Post(':id/approval/request-modification')
    @Message('modification requested')
    @Audit({ action: 'REQUEST_MODIFICATION' })
    @ApiBody({ type: RequestModificationDto })
    @ApiResponse({ description: 'The updated approval status' })
    requestModification(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: RequestModificationDto,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('requestModification');

      if (!this.service.requestModification) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.requestModification(id, dto, user);
    }

    @Post(':id/approval/resubmit')
    @Message('resubmitted')
    @Audit({ action: 'RESUBMIT' })
    @ApiResponse({ description: 'The updated approval status' })
    resubmitApproval(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('resubmitApproval');

      if (!this.service.resubmitApproval) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.resubmitApproval(id, user);
    }

    @Delete(':id')
    @Message('deleted')
    @Audit({ action: 'DELETE' })
    remove(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('remove');
      return this.service.remove(id, user);
    }

    @Get('auditlogs')
    @Message('fetched')
    findAuditLogs(@Query() query: ListAuditLogsDto) {
      this.ensureEndpointEnabled('findAuditLogs');

      if (!this.service.findAuditLogs) {
        throw keyed(HttpStatus.NOT_FOUND, ErrorKey.CRUD_RESOURCE_NOT_FOUND);
      }

      return this.service.findAuditLogs(query);
    }

    @Get(':id')
    @Message('fetched')
    @ApiResponse({ type: responseDto })
    findOne(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user?: OwnershipUser
    ) {
      this.ensureEndpointEnabled('findOne');
      return this.service.findOne(id, user);
    }
  }

  applyPermissionMetadata(BaseController, options?.permissions);

  return BaseController as Type<IBaseController<CD, UD, RD>>;
}

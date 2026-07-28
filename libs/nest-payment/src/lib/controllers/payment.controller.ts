import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser, Public } from '@nest-util/nest-auth';
import { PaymentService } from '../services/payment.service';
import { SubscriptionService } from '../services/subscription.service';
import { RefundService } from '../services/refund.service';
import { CreateCheckoutDto } from '../dtos/create-checkout.dto';
import { CreateSubscriptionDto } from '../dtos/create-subscription.dto';
import { CreateRefundDto } from '../dtos/create-refund.dto';

export const AUTH_PERMISSIONS_METADATA_KEY = 'auth:permissions';

export interface PaymentControllerOptions {
  permissions?: {
    checkout?: string;
    list?: string;
    refund?: string;
    subscriptions?: string;
    reconcile?: string;
  };
}

export function CreatePaymentController(
  options?: PaymentControllerOptions
): abstract new (...args: any[]) => any {
  @ApiTags('payments')
  @ApiBearerAuth()
  abstract class PaymentControllerBase {
    constructor(
      protected readonly paymentService: PaymentService,
      protected readonly subscriptionService: SubscriptionService,
      protected readonly refundService: RefundService
    ) {}

    // ─── Webhook (PUBLIC — no auth) ──────────────────────────

    @Post('webhook/:provider')
    @Public()
    @ApiOperation({ summary: 'Payment provider webhook/callback endpoint' })
    @ApiParam({
      name: 'provider',
      description: 'Payment provider ID (e.g. stripe, chapa)',
    })
    async handleWebhook(
      @Param('provider') provider: string,
      @Req() req: any
    ) {
      const rawBody: Buffer = req.rawBody
        ? Buffer.isBuffer(req.rawBody)
          ? req.rawBody
          : Buffer.from(typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.rawBody))
        : Buffer.from(JSON.stringify(req.body));

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers ?? {})) {
        headers[key] = Array.isArray(value) ? value[0] : String(value ?? '');
      }

      const providerInstance = this.paymentService.getProvider(provider);

      // Verify signature if provider supports it
      if (providerInstance.verifyWebhookSignature) {
        const valid = providerInstance.verifyWebhookSignature(rawBody, headers);
        if (!valid) {
          throw new BadRequestException('Invalid webhook signature');
        }
      }

      // Parse into normalized event
      const event = await providerInstance.parseWebhookEvent(rawBody, headers);

      // Route to correct service based on event type
      if (event.isRefundEvent) {
        await this.refundService.handleWebhook(event);
      } else if (event.isSubscriptionEvent) {
        await this.subscriptionService.handleWebhook(event);
      } else {
        await this.paymentService.handleWebhook(event);
      }

      return { received: true };
    }

    // ─── Checkout (AUTH required) ────────────────────────────

    @Post('checkout')
    @ApiOperation({ summary: 'Create a checkout session' })
    async createCheckout(
      @Body() dto: CreateCheckoutDto,
      @CurrentUser() user: { id: string | number }
    ) {
      return this.paymentService.createCheckout(String(user.id), dto);
    }

    // ─── Payments (AUTH required) ────────────────────────────

    @Get()
    @ApiOperation({ summary: 'List all payments' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'provider', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String })
    async findAll(
      @Query('page') page?: number,
      @Query('limit') limit?: number,
      @Query('provider') provider?: string,
      @Query('status') status?: string
    ) {
      return this.paymentService.findAll({ page, limit, provider, status });
    }

    @Get('mine')
    @ApiOperation({ summary: 'Get current user payments' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, type: String })
    async findMine(
      @CurrentUser() user: { id: string | number },
      @Query('page') page?: number,
      @Query('limit') limit?: number,
      @Query('status') status?: string
    ) {
      return this.paymentService.findMine(String(user.id), {
        page,
        limit,
        status,
      });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment by ID' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.paymentService.findOne(id);
    }

    // ─── Refunds ─────────────────────────────────────────────

    @Post(':id/refund')
    @ApiOperation({ summary: 'Create a refund for a payment' })
    async createRefund(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() dto: Omit<CreateRefundDto, 'paymentId'>
    ) {
      return this.refundService.create({ ...dto, paymentId: id });
    }

    // ─── Subscriptions ───────────────────────────────────────

    @Get('subscriptions')
    @ApiOperation({ summary: 'List subscriptions' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, type: String })
    async findSubscriptions(
      @Query('page') page?: number,
      @Query('limit') limit?: number,
      @Query('status') status?: string
    ) {
      return this.subscriptionService.findAll({ page, limit, status });
    }

    @Post('subscriptions')
    @ApiOperation({ summary: 'Create a subscription' })
    async createSubscription(
      @Body() dto: CreateSubscriptionDto,
      @CurrentUser() user: { id: string | number }
    ) {
      return this.subscriptionService.create(String(user.id), dto);
    }

    @Delete('subscriptions/:id')
    @ApiOperation({ summary: 'Cancel a subscription' })
    async cancelSubscription(@Param('id', ParseUUIDPipe) id: string) {
      return this.subscriptionService.cancel(id);
    }

    // ─── Reconciliation ──────────────────────────────────────

    @Post('reconcile')
    @ApiOperation({ summary: 'Trigger reconciliation of stale payments' })
    async reconcile(@Query('staleAfterMs') staleAfterMs?: number) {
      return this.paymentService.reconcileStalePayments({ staleAfterMs });
    }

    @Post('reconcile/:id')
    @ApiOperation({ summary: 'Reconcile a single payment by ID' })
    @ApiParam({ name: 'id', description: 'Payment UUID' })
    async reconcileOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.paymentService.reconcilePayment(id);
    }
  }

  // Apply permissions metadata
  if (options?.permissions) {
    const perm = options.permissions;
    if (perm.checkout) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.checkout],
        PaymentControllerBase.prototype.createCheckout
      );
    }
    if (perm.list) {
      const listMethods = [
        PaymentControllerBase.prototype.findAll,
        PaymentControllerBase.prototype.findMine,
        PaymentControllerBase.prototype.findOne,
        PaymentControllerBase.prototype.findSubscriptions,
      ];
      for (const method of listMethods) {
        Reflect.defineMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          [perm.list],
          method
        );
      }
    }
    if (perm.refund) {
      Reflect.defineMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        [perm.refund],
        PaymentControllerBase.prototype.createRefund
      );
    }
    if (perm.subscriptions) {
      const subMethods = [
        PaymentControllerBase.prototype.createSubscription,
        PaymentControllerBase.prototype.cancelSubscription,
      ];
      for (const method of subMethods) {
        Reflect.defineMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          [perm.subscriptions],
          method
        );
      }
    }
    if (perm.reconcile) {
      const reconcileMethods = [
        PaymentControllerBase.prototype.reconcile,
        PaymentControllerBase.prototype.reconcileOne,
      ];
      for (const method of reconcileMethods) {
        Reflect.defineMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          [perm.reconcile],
          method
        );
      }
    }
  }

  return PaymentControllerBase;
}

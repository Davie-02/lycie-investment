import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { ITEM_CATEGORIES, PAYMENT_METHODS, PRICING_KINDS, PURCHASE_TYPES } from "./purchase-math";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);
/** Largest single amount accepted (guards against a typo with too many zeros). */
const MAX_MONEY = 1_000_000_000;
const SOURCE_TYPES = ["hire-request", "import-request", "clearing-request", "inquiry"] as const;

export class PurchaseItemDto {
  @IsIn(ITEM_CATEGORIES)
  category!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice!: number;
}

/** Pricing, dates, links and notes — shared by creating and editing a purchase. */
class PurchaseFieldsDto {
  @IsOptional()
  @IsIn(PRICING_KINDS)
  pricing?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  offerName?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(upper)
  @IsString()
  @MaxLength(40)
  promoCode?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  dealId?: string | null;

  @IsOptional()
  @IsIn(["amount", "percent"])
  discountType?: "amount" | "percent";

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  vehicleId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  caseId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsIn(SOURCE_TYPES)
  sourceType?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  sourceId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  customerNote?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  staffNote?: string | null;
}

export class RecordPaymentDto {
  @IsOptional()
  @IsIn(["payment", "refund"])
  kind?: "payment" | "refund";

  /** In the purchase's currency. Worked out from receivedAmount ÷ exchangeRate when left out. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY)
  amount?: number;

  @IsIn(PAYMENT_METHODS.filter((m) => m !== "account_balance"))
  method!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Paid in another currency (e.g. kwacha for a dollar purchase). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY * 10_000)
  receivedAmount?: number;

  @IsOptional()
  @Transform(upper)
  @IsString()
  @Length(3, 3)
  receivedCurrency?: string;

  /** Units of the received currency per 1 of the purchase currency. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRate?: number;

  /** Email/WhatsApp the customer a receipt (default yes). */
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;
}

export class CreatePurchaseDto extends PurchaseFieldsDto {
  @IsUUID()
  customerId!: string;

  @IsIn(PURCHASE_TYPES)
  type!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  @IsOptional()
  @Transform(upper)
  @IsIn(["USD", "MWK", "ZAR", "EUR", "GBP", "JPY"])
  currency?: string;

  /** A deposit taken when the sale was made. */
  @IsOptional()
  @ValidateNested()
  @Type(() => RecordPaymentDto)
  initialPayment?: RecordPaymentDto;

  /** Mark the linked vehicle as sold on the website. */
  @IsOptional()
  @IsBoolean()
  markVehicleSold?: boolean;

  /** Tell the customer it's in their account (default yes). */
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;
}

export class UpdatePurchaseDto extends PurchaseFieldsDto {
  @IsOptional()
  @IsIn(PURCHASE_TYPES)
  type?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];
}

export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class ApplyBalanceDto {
  /** In the account's currency (what leaves the balance). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY * 10_000)
  amount!: number;

  /** Staff may set the rate when the currencies differ; otherwise today's rate is used. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRate?: number;
}

export class PurchaseListQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn([...PURCHASE_TYPES]) type?: string;
  @IsOptional() @IsIn([...PRICING_KINDS, "offer"]) pricing?: string;
  @IsOptional() @IsIn(["unpaid", "partial", "paid", "overpaid", "overdue", "cancelled", "owing"]) payment?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}

/** A customer paying from their account balance for something they choose. */
export class PayFromBalanceDto {
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hireRequestId?: string;

  /** In the account's currency. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY * 10_000)
  amount!: number;
}

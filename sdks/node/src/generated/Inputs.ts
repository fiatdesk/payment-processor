/**
 * Generated from the API request schemas. Do not edit.
 *
 * These are plain object types so the published SDK does not import Zod.
 */

export interface MarketingFeature {
  name: string | null;
}

export type BroadcastPayoutsBatchInput = {
  signed_transaction: string;
  payouts: string[];
  blockhash?: string | undefined;
  last_valid_block_height?: number | undefined;
};

export type BuildPayoutsBatchInput = { payouts: string[] };

export type CancelPaymentIntentInput = {
  cancellation_reason?:
    | 'fraudulent'
    | 'duplicate'
    | 'requested_by_customer'
    | 'abandoned'
    | undefined;
  expand?: string[] | undefined;
};

export type CancelSubscriptionInput = {
  cancellation_details?:
    | {
        comment?: string | undefined;
        feedback?:
          | 'other'
          | 'customer_service'
          | 'low_quality'
          | 'missing_features'
          | 'switched_service'
          | 'too_complex'
          | 'too_expensive'
          | 'unused'
          | undefined;
      }
    | undefined;
  invoice_now?: boolean | undefined;
  prorate?: boolean | undefined;
  expand?: string[] | undefined;
};

export type CaptureChargeInput = {
  amount?: number | undefined;
  application_fee_amount?: number | undefined;
  receipt_email?: string | undefined;
  statement_descriptor?: string | undefined;
  statement_descriptor_suffix?: string | undefined;
  transfer_data?: { amount?: number | undefined } | undefined;
  transfer_group?: string | undefined;
  expand?: string[] | undefined;
};

export type CreateAccountInput = {
  type?: 'standard' | 'express' | 'custom' | 'none' | undefined;
  email?: string | undefined;
  business_type?:
    | 'individual'
    | 'company'
    | 'non_profit'
    | 'government_entity'
    | undefined;
  country?: string | undefined;
  default_currency?: string | undefined;
  business_profile?:
    | {
        mcc?: string | null | undefined;
        name?: string | null | undefined;
        product_description?: string | null | undefined;
        support_email?: string | null | undefined;
        support_phone?: string | null | undefined;
        support_url?: string | null | undefined;
        url?: string | null | undefined;
      }
    | undefined;
  capabilities?:
    | {
        transfers?: { requested?: boolean | undefined } | undefined;
        usdc_payouts?: { requested?: boolean | undefined } | undefined;
      }
    | undefined;
  tos_acceptance?:
    | {
        date?: number | undefined;
        ip?: string | undefined;
        service_agreement?: 'full' | 'recipient' | undefined;
        user_agent?: string | undefined;
      }
    | undefined;
  settings?:
    | {
        branding?:
          | {
              icon?: string | null | undefined;
              logo?: string | null | undefined;
              primary_color?: string | null | undefined;
              secondary_color?: string | null | undefined;
            }
          | undefined;
        dashboard?:
          | {
              display_name?: string | null | undefined;
              timezone?: string | null | undefined;
            }
          | undefined;
        payouts?:
          | {
              debit_negative_balances?: boolean | undefined;
              schedule?:
                | {
                    delay_days?: number | 'minimum' | undefined;
                    interval?:
                      | 'daily'
                      | 'weekly'
                      | 'monthly'
                      | 'manual'
                      | undefined;
                    monthly_anchor?: number | undefined;
                    weekly_anchor?:
                      | 'monday'
                      | 'tuesday'
                      | 'wednesday'
                      | 'thursday'
                      | 'friday'
                      | 'saturday'
                      | 'sunday'
                      | undefined;
                  }
                | undefined;
              statement_descriptor?: string | null | undefined;
            }
          | undefined;
        identity?:
          | {
              provider?: 'didit' | null | undefined;
              didit?:
                | {
                    api_key?: string | null | undefined;
                    workflow_id?: string | null | undefined;
                    kyb_workflow_id?: string | null | undefined;
                    webhook_secret?: string | null | undefined;
                  }
                | null
                | undefined;
              rules?:
                | {
                    payout_volume_threshold_cents?: number | null | undefined;
                    country_thresholds?:
                      | {
                          countries: string[];
                          payout_volume_threshold_cents: number;
                        }[]
                      | null
                      | undefined;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
        terms_url?: string | null | undefined;
        privacy_url?: string | null | undefined;
      }
    | undefined;
  controller?:
    | {
        fees?:
          | {
              payer:
                | 'account'
                | 'application'
                | 'application_custom'
                | 'application_express';
            }
          | undefined;
        losses?: { payments: 'application' | 'zoneless' } | undefined;
        requirement_collection?: 'application' | 'zoneless' | undefined;
        zoneless_dashboard?: { type: 'express' | 'none' | 'full' } | undefined;
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
};

export type CreateAccountLinkInput = {
  account: string;
  type: 'account_onboarding' | 'account_update';
  refresh_url: string;
  return_url: string;
};

export type CreateChargeInput = {
  amount: number;
  currency: string;
  application_fee_amount?: number | undefined;
  capture?: boolean | undefined;
  customer?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
  on_behalf_of?: string | undefined;
  radar_options?: { session?: string | undefined } | undefined;
  receipt_email?: string | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        carrier?: string | undefined;
        phone?: string | undefined;
        tracking_number?: string | undefined;
      }
    | undefined;
  source?: string | undefined;
  statement_descriptor?: string | undefined;
  statement_descriptor_suffix?: string | undefined;
  transfer_data?:
    | {
        destination: string;
        amount?: number | undefined;
        description?: string | undefined;
      }
    | undefined;
  transfer_group?: string | undefined;
  expand?: string[] | undefined;
};

export type CreateCheckoutSessionInput = {
  mode: 'payment' | 'setup' | 'subscription';
  adaptive_pricing?: { enabled?: boolean | undefined } | undefined;
  after_completion?:
    | {
        type: 'hosted_confirmation' | 'redirect';
        hosted_confirmation?:
          | { custom_message?: string | undefined }
          | undefined;
        redirect?: { url: string } | undefined;
      }
    | undefined;
  after_expiration?:
    | {
        recovery: {
          enabled: boolean;
          allow_promotion_codes?: boolean | undefined;
        };
      }
    | undefined;
  allow_promotion_codes?: boolean | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  billing_address_collection?: 'auto' | 'required' | undefined;
  branding_settings?:
    | {
        background_color?: string | undefined;
        border_style?: 'pill' | 'rectangular' | 'rounded' | undefined;
        button_color?: string | undefined;
        display_name?: string | undefined;
        font_family?: string | undefined;
        icon?:
          | {
              type: 'url' | 'file';
              file?: string | undefined;
              url?: string | undefined;
            }
          | undefined;
        logo?:
          | {
              type: 'url' | 'file';
              file?: string | undefined;
              url?: string | undefined;
            }
          | undefined;
      }
    | undefined;
  cancel_url?: string | undefined;
  client_reference_id?: string | undefined;
  consent_collection?:
    | {
        payment_method_reuse_agreement?:
          | { position: 'auto' | 'hidden' }
          | undefined;
        promotions?: 'none' | 'auto' | undefined;
        terms_of_service?: 'none' | 'required' | undefined;
      }
    | undefined;
  currency?: string | undefined;
  custom_fields?:
    | {
        key: string;
        label: { custom: string; type: 'custom' };
        type: 'dropdown' | 'numeric' | 'text';
        dropdown?:
          | {
              options: { label: string; value: string }[];
              default_value?: string | undefined;
            }
          | undefined;
        numeric?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
        optional?: boolean | undefined;
        text?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  custom_text?:
    | {
        after_submit?: { message: string } | undefined;
        shipping_address?: { message: string } | undefined;
        submit?: { message: string } | undefined;
        terms_of_service_acceptance?: { message: string } | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  customer_creation?: 'always' | 'if_required' | undefined;
  customer_email?: string | undefined;
  customer_update?:
    | {
        address?: 'never' | 'auto' | undefined;
        name?: 'never' | 'auto' | undefined;
        shipping?: 'never' | 'auto' | undefined;
      }
    | undefined;
  discounts?:
    | { coupon?: string | undefined; promotion_code?: string | undefined }[]
    | undefined;
  excluded_payment_method_types?: string[] | undefined;
  expires_at?: number | undefined;
  integration_identifier?: string | undefined;
  invoice_creation?:
    | {
        enabled: boolean;
        invoice_data?:
          | {
              account_tax_ids?: string[] | undefined;
              custom_fields?: { name: string; value: string }[] | undefined;
              description?: string | undefined;
              footer?: string | undefined;
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
              metadata?: Record<string, string> | undefined;
              rendering_options?:
                | {
                    amount_tax_display?:
                      | 'exclude_tax'
                      | 'include_inclusive_tax'
                      | undefined;
                    template?: string | undefined;
                  }
                | undefined;
            }
          | undefined;
      }
    | undefined;
  line_items?:
    | {
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
        dynamic_tax_rates?: string[] | undefined;
        metadata?: Record<string, string> | undefined;
        price?: string | undefined;
        price_data?:
          | {
              currency: string;
              product?: string | undefined;
              product_data?:
                | {
                    name: string;
                    description?: string | undefined;
                    images?: string[] | undefined;
                    metadata?: Record<string, string> | undefined;
                    tax_code?: string | undefined;
                    tax_details?:
                      | {
                          performance_location?: string | undefined;
                          tax_code?: string | undefined;
                        }
                      | undefined;
                    unit_label?: string | undefined;
                  }
                | undefined;
              recurring?:
                | {
                    interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                    interval_count?: number | undefined;
                  }
                | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              unit_amount?: number | undefined;
              unit_amount_decimal?: string | undefined;
            }
          | undefined;
        quantity?: number | undefined;
        tax_rates?: string[] | undefined;
      }[]
    | undefined;
  locale?: string | undefined;
  managed_payments?: { enabled?: boolean | undefined } | undefined;
  metadata?: Record<string, string> | undefined;
  name_collection?:
    | {
        business?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
        individual?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
      }
    | undefined;
  optional_items?:
    | {
        price: string;
        quantity: number;
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  origin_context?: 'mobile_app' | 'web' | undefined;
  payment_intent_data?:
    | {
        application_fee_amount?: number | undefined;
        capture_method?: 'manual' | 'automatic' | 'automatic_async' | undefined;
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        on_behalf_of?: string | undefined;
        receipt_email?: string | undefined;
        setup_future_usage?: 'off_session' | 'on_session' | undefined;
        shipping?:
          | {
              address: {
                line1: string;
                city?: string | undefined;
                country?: string | undefined;
                line2?: string | undefined;
                postal_code?: string | undefined;
                state?: string | undefined;
              };
              name: string;
              carrier?: string | undefined;
              phone?: string | undefined;
              tracking_number?: string | undefined;
            }
          | undefined;
        statement_descriptor?: string | undefined;
        statement_descriptor_suffix?: string | undefined;
        transfer_data?:
          | { destination: string; amount?: number | undefined }
          | undefined;
        transfer_group?: string | undefined;
      }
    | undefined;
  payment_method_collection?: 'always' | 'if_required' | undefined;
  payment_method_options?:
    | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
    | undefined;
  payment_method_types?: 'crypto'[] | undefined;
  permissions?:
    | { update_shipping_details?: 'client_only' | 'server_only' | undefined }
    | undefined;
  phone_number_collection?: { enabled: boolean } | undefined;
  redirect_on_completion?: 'never' | 'always' | 'if_required' | undefined;
  return_url?: string | undefined;
  saved_payment_method_options?:
    | {
        allow_redisplay_filters?:
          | ('unspecified' | 'always' | 'limited')[]
          | undefined;
        payment_method_remove?: 'enabled' | 'disabled' | undefined;
        payment_method_save?: 'enabled' | 'disabled' | undefined;
      }
    | undefined;
  setup_intent_data?:
    | {
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        on_behalf_of?: string | undefined;
      }
    | undefined;
  shipping_address_collection?: { allowed_countries: string[] } | undefined;
  shipping_options?:
    | {
        shipping_rate?: string | undefined;
        shipping_rate_data?:
          | {
              display_name: string;
              delivery_estimate?:
                | {
                    maximum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                    minimum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                  }
                | undefined;
              fixed_amount?:
                | {
                    amount: number;
                    currency: string;
                    currency_options?:
                      | Record<
                          string,
                          {
                            amount: number;
                            tax_behavior?:
                              | 'inclusive'
                              | 'exclusive'
                              | 'unspecified'
                              | undefined;
                          }
                        >
                      | undefined;
                  }
                | undefined;
              metadata?: Record<string, string> | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              tax_code?: string | undefined;
              type?: 'fixed_amount' | undefined;
            }
          | undefined;
      }[]
    | undefined;
  submit_type?: 'auto' | 'book' | 'donate' | 'pay' | 'subscribe' | undefined;
  subscription_data?:
    | {
        application_fee_percent?: number | undefined;
        billing_cycle_anchor?: number | undefined;
        description?: string | undefined;
        invoice_settings?:
          | {
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
            }
          | undefined;
        metadata?: Record<string, string> | undefined;
        on_behalf_of?: string | undefined;
        proration_behavior?: 'none' | 'create_prorations' | undefined;
        transfer_data?:
          | { destination: string; amount_percent?: number | undefined }
          | undefined;
        trial_end?: number | undefined;
        trial_period_days?: number | undefined;
        trial_settings?:
          | {
              end_behavior: {
                missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
              };
            }
          | undefined;
      }
    | undefined;
  success_url?: string | undefined;
  tax_id_collection?:
    | { enabled: boolean; required?: 'never' | 'if_supported' | undefined }
    | undefined;
  ui_mode?: 'elements' | 'embedded_page' | 'hosted_page' | undefined;
  wallet_options?:
    | { link?: { display?: 'never' | 'auto' | undefined } | undefined }
    | undefined;
  expand?: string[] | undefined;
};

export type CreateCustomerInput = {
  address?:
    | {
        city?: string | undefined;
        country?: string | undefined;
        line1?: string | undefined;
        line2?: string | undefined;
        postal_code?: string | undefined;
        state?: string | undefined;
      }
    | undefined;
  balance?: number | undefined;
  business_name?: string | undefined;
  cash_balance?:
    | {
        settings?:
          | { reconciliation_mode: 'manual' | 'automatic' | 'merchant_default' }
          | undefined;
      }
    | undefined;
  description?: string | undefined;
  email?: string | undefined;
  individual_name?: string | undefined;
  invoice_prefix?: string | undefined;
  invoice_settings?:
    | {
        custom_fields?: { name: string; value: string }[] | undefined;
        default_payment_method?: string | undefined;
        footer?: string | undefined;
        rendering_options?:
          | {
              amount_tax_display?:
                | 'exclude_tax'
                | 'include_inclusive_tax'
                | undefined;
              template?: string | undefined;
            }
          | undefined;
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
  name?: string | undefined;
  next_invoice_sequence?: number | undefined;
  payment_method?: string | undefined;
  phone?: string | undefined;
  preferred_locales?: string[] | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        phone?: string | undefined;
      }
    | undefined;
  source?: string | undefined;
  tax?:
    | {
        ip_address?: string | undefined;
        validate_location?: 'deferred' | 'immediately' | undefined;
      }
    | undefined;
  tax_exempt?: 'none' | 'exempt' | 'reverse' | undefined;
  tax_id_data?: { type: string; value: string }[] | undefined;
  test_clock?: string | undefined;
  expand?: string[] | undefined;
};

export type CreateExternalWalletInput = {
  wallet_address: string;
  network?: string | undefined;
  currency?: string | undefined;
  account_holder_name?: string | null | undefined;
  account_holder_type?: 'individual' | 'company' | null | undefined;
  default_for_currency?: boolean | null | undefined;
  metadata?: Record<string, string> | undefined;
};

export type CreateIdentityVerificationSessionInput = {
  type: 'address' | 'document' | 'id_number' | 'verification_flow';
  related_account: string;
  related_person?: string | undefined;
  metadata?: Record<string, string> | undefined;
  options?:
    | {
        document?:
          | {
              require_live_capture?: boolean | undefined;
              require_matching_selfie?: boolean | undefined;
              allowed_types?:
                | ('driving_license' | 'id_card' | 'passport')[]
                | undefined;
            }
          | undefined;
      }
    | undefined;
  provided_details?:
    | { email?: string | null | undefined; phone?: string | null | undefined }
    | undefined;
  return_url?: string | undefined;
};

export type CreateInvoiceInput = {
  account_tax_ids?: string[] | undefined;
  application_fee_amount?: number | undefined;
  auto_advance?: boolean | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  automatically_finalizes_at?: number | undefined;
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  currency?: string | undefined;
  custom_fields?: { name: string; value: string }[] | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  days_until_due?: number | undefined;
  default_payment_method?: string | undefined;
  default_source?: string | undefined;
  default_tax_rates?: string[] | undefined;
  description?: string | undefined;
  discounts?:
    | ''
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  due_date?: number | undefined;
  effective_at?: number | undefined;
  footer?: string | undefined;
  from_invoice?: { action: 'revision'; invoice: string } | undefined;
  issuer?:
    | { type: 'account' | 'self'; account?: string | undefined }
    | undefined;
  metadata?: Record<string, string> | undefined;
  number?: string | undefined;
  on_behalf_of?: string | undefined;
  payment_settings?:
    | {
        default_mandate?: string | undefined;
        payment_method_options?:
          | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
          | undefined;
        payment_method_types?: 'crypto'[] | undefined;
      }
    | undefined;
  pending_invoice_items_behavior?: 'exclude' | 'include' | undefined;
  rendering?:
    | {
        amount_tax_display?:
          | 'exclude_tax'
          | 'include_inclusive_tax'
          | undefined;
        pdf?: { page_size?: 'auto' | 'a4' | 'letter' | undefined } | undefined;
        template?: string | undefined;
        template_version?: number | undefined;
      }
    | undefined;
  shipping_cost?:
    | {
        shipping_rate?: string | undefined;
        shipping_rate_data?:
          | {
              display_name: string;
              type: 'fixed_amount';
              delivery_estimate?:
                | {
                    maximum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                    minimum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                  }
                | undefined;
              fixed_amount?:
                | {
                    amount: number;
                    currency: string;
                    currency_options?:
                      | Record<
                          string,
                          {
                            amount: number;
                            tax_behavior?:
                              | 'inclusive'
                              | 'exclusive'
                              | 'unspecified'
                              | undefined;
                          }
                        >
                      | undefined;
                  }
                | undefined;
              metadata?: Record<string, string> | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              tax_code?: string | undefined;
            }
          | undefined;
      }
    | undefined;
  shipping_details?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        phone?: string | undefined;
      }
    | undefined;
  statement_descriptor?: string | undefined;
  subscription?: string | undefined;
  transfer_data?:
    | { destination: string; amount?: number | undefined }
    | undefined;
  expand?: string[] | undefined;
};

export type CreateInvoiceItemInput = {
  amount?: number | undefined;
  currency?: string | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  description?: string | undefined;
  discountable?: boolean | undefined;
  discounts?:
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  invoice?: string | undefined;
  metadata?: Record<string, string> | undefined;
  period?: { end: number; start: number } | undefined;
  price_data?:
    | {
        currency: string;
        product: string;
        tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
        unit_amount?: number | undefined;
        unit_amount_decimal?: string | undefined;
      }
    | undefined;
  pricing?: { price?: string | undefined } | undefined;
  quantity?: number | undefined;
  quantity_decimal?: string | undefined;
  subscription?: string | undefined;
  tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
  tax_code?: string | undefined;
  tax_rates?: string[] | undefined;
  unit_amount_decimal?: string | undefined;
  expand?: string[] | undefined;
};

export type CreatePaymentIntentInput = {
  amount: number;
  currency: string;
  amount_details?:
    | {
        discount_amount?: number | undefined;
        enforce_arithmetic_validation?: boolean | undefined;
        line_items?:
          | {
              product_name: string;
              quantity: number;
              unit_cost: number;
              discount_amount?: number | undefined;
              product_code?: string | undefined;
              tax?: { total_tax_amount: number } | undefined;
              unit_of_measure?: string | undefined;
            }[]
          | undefined;
        shipping?:
          | {
              amount?: number | undefined;
              from_postal_code?: string | undefined;
              to_postal_code?: string | undefined;
            }
          | undefined;
        tax?: { total_tax_amount: number } | undefined;
      }
    | undefined;
  application_fee_amount?: number | undefined;
  automatic_payment_methods?:
    | { enabled: boolean; allow_redirects?: 'never' | 'always' | undefined }
    | undefined;
  capture_method?: 'manual' | 'automatic' | 'automatic_async' | undefined;
  confirm?: boolean | undefined;
  confirmation_method?: 'manual' | 'automatic' | undefined;
  confirmation_token?: string | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  description?: string | undefined;
  error_on_requires_action?: boolean | undefined;
  excluded_payment_method_types?: string[] | undefined;
  hooks?:
    | { inputs?: { tax?: { calculation: string } | undefined } | undefined }
    | undefined;
  mandate?: string | undefined;
  mandate_data?:
    | {
        customer_acceptance: {
          type: 'online' | 'offline';
          accepted_at?: number | undefined;
          offline?: Record<string, never> | undefined;
          online?: { ip_address: string; user_agent: string } | undefined;
        };
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
  off_session?: string | boolean | undefined;
  on_behalf_of?: string | undefined;
  payment_details?:
    | {
        customer_reference?: string | undefined;
        order_reference?: string | undefined;
      }
    | undefined;
  payment_method?: string | undefined;
  payment_method_configuration?: string | undefined;
  payment_method_data?:
    | {
        type?: 'crypto' | undefined;
        allow_redisplay?: 'unspecified' | 'always' | 'limited' | undefined;
        billing_details?:
          | {
              address?:
                | {
                    city?: string | undefined;
                    country?: string | undefined;
                    line1?: string | undefined;
                    line2?: string | undefined;
                    postal_code?: string | undefined;
                    state?: string | undefined;
                  }
                | undefined;
              email?: string | undefined;
              name?: string | undefined;
              phone?: string | undefined;
              tax_id?: string | undefined;
            }
          | undefined;
        crypto?: Record<string, never> | undefined;
        metadata?: Record<string, string> | undefined;
        shared_payment_granted_token?: string | undefined;
      }
    | undefined;
  payment_method_options?:
    | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
    | undefined;
  payment_method_types?: 'crypto'[] | undefined;
  radar_options?: { session?: string | undefined } | undefined;
  receipt_email?: string | undefined;
  return_url?: string | undefined;
  setup_future_usage?: 'off_session' | 'on_session' | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        carrier?: string | undefined;
        phone?: string | undefined;
        tracking_number?: string | undefined;
      }
    | undefined;
  statement_descriptor?: string | undefined;
  statement_descriptor_suffix?: string | undefined;
  transfer_data?:
    | {
        destination: string;
        amount?: number | undefined;
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        payment_data?:
          | {
              description?: string | undefined;
              metadata?: Record<string, string> | undefined;
            }
          | undefined;
      }
    | undefined;
  transfer_group?: string | undefined;
  use_stripe_sdk?: boolean | undefined;
  expand?: string[] | undefined;
};

export type CreatePaymentLinkInput = {
  line_items: {
    quantity: number;
    adjustable_quantity?:
      | {
          enabled: boolean;
          maximum?: number | undefined;
          minimum?: number | undefined;
        }
      | undefined;
    price?: string | undefined;
    price_data?:
      | {
          currency: string;
          product?: string | undefined;
          product_data?:
            | {
                name: string;
                description?: string | undefined;
                images?: string[] | undefined;
                metadata?: Record<string, string> | undefined;
                tax_code?: string | undefined;
                tax_details?:
                  | {
                      performance_location?: string | undefined;
                      tax_code?: string | undefined;
                    }
                  | undefined;
                unit_label?: string | undefined;
              }
            | undefined;
          recurring?:
            | {
                interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                interval_count?: number | undefined;
              }
            | undefined;
          tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
          unit_amount?: number | undefined;
          unit_amount_decimal?: string | undefined;
        }
      | undefined;
  }[];
  after_completion?:
    | {
        type: 'hosted_confirmation' | 'redirect';
        hosted_confirmation?:
          | { custom_message?: string | undefined }
          | undefined;
        redirect?: { url: string } | undefined;
      }
    | undefined;
  allow_promotion_codes?: boolean | undefined;
  application_fee_amount?: number | undefined;
  application_fee_percent?: number | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  billing_address_collection?: 'auto' | 'required' | undefined;
  consent_collection?:
    | {
        payment_method_reuse_agreement?:
          | { position: 'auto' | 'hidden' }
          | undefined;
        promotions?: 'none' | 'auto' | undefined;
        terms_of_service?: 'none' | 'required' | undefined;
      }
    | undefined;
  currency?: string | undefined;
  custom_fields?:
    | {
        key: string;
        label: { custom: string; type: 'custom' };
        type: 'dropdown' | 'numeric' | 'text';
        dropdown?:
          | {
              options: { label: string; value: string }[];
              default_value?: string | undefined;
            }
          | undefined;
        numeric?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
        optional?: boolean | undefined;
        text?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  custom_text?:
    | {
        after_submit?: { message: string } | undefined;
        shipping_address?: { message: string } | undefined;
        submit?: { message: string } | undefined;
        terms_of_service_acceptance?: { message: string } | undefined;
      }
    | undefined;
  customer_creation?: 'always' | 'if_required' | undefined;
  inactive_message?: string | undefined;
  invoice_creation?:
    | {
        enabled: boolean;
        invoice_data?:
          | {
              account_tax_ids?: string[] | undefined;
              custom_fields?: { name: string; value: string }[] | undefined;
              description?: string | undefined;
              footer?: string | undefined;
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
              metadata?: Record<string, string> | undefined;
              rendering_options?:
                | {
                    amount_tax_display?:
                      | 'exclude_tax'
                      | 'include_inclusive_tax'
                      | undefined;
                    template?: string | undefined;
                  }
                | undefined;
            }
          | undefined;
      }
    | undefined;
  managed_payments?: { enabled?: boolean | undefined } | undefined;
  metadata?: Record<string, string> | undefined;
  name_collection?:
    | {
        business?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
        individual?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
      }
    | undefined;
  on_behalf_of?: string | undefined;
  optional_items?:
    | {
        price: string;
        quantity: number;
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  payment_intent_data?:
    | {
        capture_method?: 'manual' | 'automatic' | 'automatic_async' | undefined;
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        setup_future_usage?: 'off_session' | 'on_session' | undefined;
        statement_descriptor?: string | undefined;
        statement_descriptor_suffix?: string | undefined;
        transfer_group?: string | undefined;
      }
    | undefined;
  payment_method_collection?: 'always' | 'if_required' | undefined;
  payment_method_options?:
    | {
        card?:
          | {
              restrictions?:
                | {
                    brands_blocked?:
                      | (
                          | 'american_express'
                          | 'discover_global_network'
                          | 'mastercard'
                          | 'visa'
                        )[]
                      | undefined;
                  }
                | undefined;
            }
          | undefined;
        crypto?: { setup_future_usage?: 'none' | undefined } | undefined;
      }
    | undefined;
  payment_method_types?: 'crypto'[] | undefined;
  phone_number_collection?: { enabled: boolean } | undefined;
  restrictions?: { completed_sessions: { limit: number } } | undefined;
  shipping_address_collection?: { allowed_countries: string[] } | undefined;
  shipping_options?: { shipping_rate?: string | undefined }[] | undefined;
  submit_type?: 'auto' | 'book' | 'donate' | 'pay' | 'subscribe' | undefined;
  subscription_data?:
    | {
        description?: string | undefined;
        invoice_settings?:
          | {
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
            }
          | undefined;
        metadata?: Record<string, string> | undefined;
        trial_period_days?: number | undefined;
        trial_settings?:
          | {
              end_behavior: {
                missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
              };
            }
          | undefined;
      }
    | undefined;
  tax_id_collection?:
    | { enabled: boolean; required?: 'never' | 'if_supported' | undefined }
    | undefined;
  transfer_data?:
    | { destination: string; amount?: number | undefined }
    | undefined;
  expand?: string[] | undefined;
};

export type CreatePayoutInput = {
  amount: number;
  currency: string;
  destination?: string | undefined;
  description?: string | undefined;
  method?: 'standard' | 'instant' | undefined;
  metadata?: Record<string, string> | undefined;
  statement_descriptor?: string | undefined;
};

export type CreatePersonInput = {
  address?:
    | {
        line1: string | null;
        city: string | null;
        postal_code: string | null;
        country: string | null;
        line2?: string | null | undefined;
        state?: string | null | undefined;
      }
    | undefined;
  dob?:
    | { day: number | null; month: number | null; year: number | null }
    | undefined;
  email?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  phone?: string | null | undefined;
  relationship?:
    | {
        authorizer?: boolean | null | undefined;
        director?: boolean | null | undefined;
        executive?: boolean | null | undefined;
        legal_guardian?: boolean | null | undefined;
        owner?: boolean | null | undefined;
        percent_ownership?: number | null | undefined;
        representative?: boolean | null | undefined;
        title?: string | null | undefined;
      }
    | undefined;
  ssn_last_4?: string | undefined;
  id_number?: string | undefined;
  metadata?: Record<string, string> | undefined;
  verification?:
    | {
        additional_document?:
          | { back?: string | undefined; front?: string | undefined }
          | undefined;
        document?:
          | { back?: string | undefined; front?: string | undefined }
          | undefined;
      }
    | undefined;
};

export type CreatePriceInput = {
  currency: string;
  unit_amount: number;
  active?: boolean | undefined;
  metadata?: Record<string, string> | undefined;
  nickname?: string | undefined;
  product?: string | undefined;
  recurring?:
    | {
        interval: 'hour' | 'day' | 'week' | 'month' | 'year';
        interval_count?: number | undefined;
        trial_period_days?: number | undefined;
        usage_type?: 'metered' | 'licensed' | undefined;
        meter?: string | undefined;
      }
    | undefined;
  tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
  billing_scheme?: 'per_unit' | 'tiered' | undefined;
  currency_options?:
    | Record<
        string,
        {
          custom_unit_amount?:
            | {
                enabled: boolean;
                maximum: number;
                minimum: number;
                preset: number;
              }
            | undefined;
          tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
          tiers?:
            | {
                flat_amount: number;
                up_to: number;
                flat_amount_decimal?: string | undefined;
                unit_amount?: number | undefined;
                unit_amount_decimal?: string | undefined;
              }[]
            | undefined;
          unit_amount?: number | undefined;
          unit_amount_decimal?: string | undefined;
        }
      >
    | undefined;
  custom_unit_amount?:
    | { enabled: boolean; maximum: number; minimum: number; preset: number }
    | undefined;
  lookup_key?: string | undefined;
  product_data?:
    | {
        name: string;
        active?: boolean | undefined;
        metadata?: Record<string, string> | undefined;
        statement_descriptor?: string | undefined;
        tax_code?: string | undefined;
        tax_details?:
          | {
              performance_locations?: string | undefined;
              tax_code?: string | undefined;
            }
          | undefined;
        unit_label?: string | undefined;
      }
    | undefined;
  tiers?:
    | {
        flat_amount: number;
        up_to: number;
        flat_amount_decimal?: string | undefined;
        unit_amount?: number | undefined;
        unit_amount_decimal?: string | undefined;
      }[]
    | undefined;
  tiers_mode?: 'graduated' | 'volume' | undefined;
  transfer_lookup_key?: boolean | undefined;
  transform_quantity?: { divide_by: number; round: 'up' | 'down' } | undefined;
  unit_amount_decimal?: string | undefined;
  expand?: string[] | undefined;
};

export type CreateProductInput = {
  name: string;
  active?: boolean | undefined;
  description?: string | undefined;
  id?: string | undefined;
  metadata?: Record<string, string> | undefined;
  tax_code?: string | undefined;
  tax_details?:
    | {
        performance_locations?: string | undefined;
        tax_code?: string | undefined;
      }
    | undefined;
  default_price_data?:
    | {
        currency: string;
        unit_amount: number;
        product?: string | undefined;
        currency_options?:
          | Record<
              string,
              {
                custom_unit_amount?:
                  | {
                      enabled: boolean;
                      maximum: number;
                      minimum: number;
                      preset: number;
                    }
                  | undefined;
                tax_behavior?:
                  | 'inclusive'
                  | 'exclusive'
                  | 'unspecified'
                  | undefined;
                tiers?:
                  | {
                      flat_amount: number;
                      up_to: number;
                      flat_amount_decimal?: string | undefined;
                      unit_amount?: number | undefined;
                      unit_amount_decimal?: string | undefined;
                    }[]
                  | undefined;
                unit_amount?: number | undefined;
                unit_amount_decimal?: string | undefined;
              }
            >
          | undefined;
        custom_unit_amount?:
          | {
              enabled: boolean;
              maximum: number;
              minimum: number;
              preset: number;
            }
          | undefined;
        metadata?: Record<string, string> | undefined;
        recurring?:
          | {
              interval: 'hour' | 'day' | 'week' | 'month' | 'year';
              interval_count?: number | undefined;
              trial_period_days?: number | undefined;
              usage_type?: 'metered' | 'licensed' | undefined;
              meter?: string | undefined;
            }
          | undefined;
        tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
        unit_amount_decimal?: string | undefined;
      }
    | undefined;
  identifiers?:
    | {
        ean?: string | undefined;
        gtin?: string | undefined;
        isbn?: string | undefined;
        jan?: string | undefined;
        mpn?: string | undefined;
        nsn?: string | undefined;
        upc?: string | undefined;
      }
    | undefined;
  images?: string[] | undefined;
  marketing_features?: MarketingFeature[] | undefined;
  package_dimensions?:
    | { height: number; length: number; weight: number; width: number }
    | undefined;
  shippable?: boolean | undefined;
  statement_descriptor?: string | undefined;
  unit_label?: string | undefined;
  url?: string | undefined;
  expand?: string[] | undefined;
};

export type CreateSubscriptionInput = {
  items: {
    billing_thresholds?: '' | { usage_gte: number } | undefined;
    discounts?:
      | {
          coupon?: string | undefined;
          discount?: string | undefined;
          promotion_code?: string | undefined;
        }[]
      | undefined;
    metadata?: Record<string, string> | undefined;
    price?: string | undefined;
    price_data?:
      | {
          currency: string;
          product: string;
          recurring: {
            interval: 'hour' | 'day' | 'week' | 'month' | 'year';
            interval_count?: number | undefined;
          };
          tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
          unit_amount?: number | undefined;
          unit_amount_decimal?: string | undefined;
        }
      | undefined;
    quantity?: number | undefined;
    tax_rates?: string[] | undefined;
  }[];
  add_invoice_items?:
    | {
        discountable?: boolean | undefined;
        discounts?:
          | {
              coupon?: string | undefined;
              discount?: string | undefined;
              promotion_code?: string | undefined;
            }[]
          | undefined;
        metadata?: Record<string, string> | undefined;
        period?:
          | {
              end: {
                type: 'timestamp' | 'min_item_period_end';
                timestamp?: number | undefined;
              };
              start: {
                type: 'timestamp' | 'max_item_period_start' | 'now';
                timestamp?: number | undefined;
              };
            }
          | undefined;
        price?: string | undefined;
        price_data?:
          | {
              currency: string;
              product: string;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              unit_amount?: number | undefined;
              unit_amount_decimal?: string | undefined;
            }
          | undefined;
        quantity?: number | undefined;
        tax_rates?: string[] | undefined;
      }[]
    | undefined;
  application_fee_percent?: number | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  backdate_start_date?: number | undefined;
  billing_cycle_anchor?: number | undefined;
  billing_cycle_anchor_config?:
    | {
        day_of_month: number;
        hour?: number | undefined;
        minute?: number | undefined;
        month?: number | undefined;
        second?: number | undefined;
      }
    | undefined;
  billing_mode?:
    | {
        type: 'classic' | 'flexible';
        flexible?:
          | { proration_discounts?: 'included' | 'itemized' | undefined }
          | undefined;
      }
    | undefined;
  billing_schedules?:
    | {
        bill_until: {
          type: 'duration' | 'timestamp';
          duration?:
            | {
                interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                interval_count?: number | undefined;
              }
            | undefined;
          timestamp?: number | undefined;
        };
        applies_to?:
          | { type: 'price'; price?: string | undefined }[]
          | undefined;
        key?: string | undefined;
      }[]
    | undefined;
  billing_thresholds?:
    | {
        amount_gte?: number | undefined;
        reset_billing_cycle_anchor?: boolean | undefined;
      }
    | undefined;
  cancel_at?:
    | number
    | 'max_billed_until'
    | 'max_period_end'
    | 'min_period_end'
    | undefined;
  cancel_at_period_end?: boolean | undefined;
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  currency?: string | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  days_until_due?: number | undefined;
  default_payment_method?: string | undefined;
  default_source?: string | undefined;
  default_tax_rates?: string[] | undefined;
  description?: string | undefined;
  discounts?:
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  invoice_settings?:
    | {
        account_tax_ids?: string[] | undefined;
        custom_fields?: { name: string; value: string }[] | undefined;
        description?: string | undefined;
        footer?: string | undefined;
        issuer?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
  off_session?: boolean | undefined;
  on_behalf_of?: string | undefined;
  payment_behavior?:
    | 'allow_incomplete'
    | 'default_incomplete'
    | 'error_if_incomplete'
    | undefined;
  payment_settings?:
    | {
        payment_method_options?:
          | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
          | undefined;
        payment_method_types?: 'crypto'[] | undefined;
        save_default_payment_method?: 'off' | 'on_subscription' | undefined;
      }
    | undefined;
  pending_invoice_item_interval?:
    | {
        interval: 'hour' | 'day' | 'week' | 'month' | 'year';
        interval_count?: number | undefined;
      }
    | undefined;
  proration_behavior?: 'none' | 'create_prorations' | undefined;
  transfer_data?:
    | { destination: string; amount_percent?: number | undefined }
    | undefined;
  trial_end?: number | 'now' | undefined;
  trial_from_plan?: boolean | undefined;
  trial_period_days?: number | undefined;
  trial_settings?:
    | {
        end_behavior: {
          missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
        };
      }
    | undefined;
  expand?: string[] | undefined;
};

export type CreateSubscriptionItemInput = {
  subscription: string;
  billing_thresholds?: '' | { usage_gte: number } | undefined;
  discounts?:
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  payment_behavior?:
    | 'allow_incomplete'
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'pending_if_incomplete'
    | undefined;
  price?: string | undefined;
  price_data?:
    | {
        currency: string;
        product: string;
        recurring: {
          interval: 'hour' | 'day' | 'week' | 'month' | 'year';
          interval_count?: number | undefined;
        };
        tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
        unit_amount?: number | undefined;
        unit_amount_decimal?: string | undefined;
      }
    | undefined;
  proration_behavior?:
    | 'none'
    | 'create_prorations'
    | 'always_invoice'
    | undefined;
  proration_date?: number | undefined;
  quantity?: number | undefined;
  tax_rates?: string[] | undefined;
  expand?: string[] | undefined;
};

export type CreateTopUpInput = {
  amount: number;
  currency: string;
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
  source?: string | undefined;
  statement_descriptor?: string | undefined;
  transfer_group?: string | undefined;
};

export type CreateTransferInput = {
  amount: number;
  currency: string;
  destination: string;
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
  source_transaction?: string | undefined;
  source_type?: 'wallet' | 'card' | 'fpx' | 'bank_account' | undefined;
  transfer_group?: string | undefined;
};

export type CreateWebhookEndpointInput = {
  enabled_events: string[];
  url: string;
  api_version?: string | undefined;
  connect?: boolean | undefined;
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type DeleteSubscriptionItemInput = {
  clear_usage?: boolean | undefined;
  payment_behavior?:
    | 'allow_incomplete'
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'pending_if_incomplete'
    | undefined;
  proration_behavior?:
    | 'none'
    | 'create_prorations'
    | 'always_invoice'
    | undefined;
  proration_date?: number | undefined;
};

export type ExpireCheckoutSessionInput = Record<string, never>;

export type FinalizeInvoiceInput = {
  auto_advance?: boolean | undefined;
  expand?: string[] | undefined;
};

export type ListAccountsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  status?: 'restricted' | 'in_review' | 'rejected' | 'enabled' | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
};

export type ListBalanceTransactionsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  type?:
    | 'adjustment'
    | 'advance'
    | 'advance_funding'
    | 'anticipation_repayment'
    | 'application_fee'
    | 'application_fee_refund'
    | 'charge'
    | 'connect_collection_transfer'
    | 'contribution'
    | 'payment'
    | 'payment_failure_refund'
    | 'payment_refund'
    | 'payment_reversal'
    | 'payout'
    | 'payout_cancel'
    | 'payout_failure'
    | 'refund'
    | 'refund_failure'
    | 'reserve_transaction'
    | 'reserved_funds'
    | 'stripe_fee'
    | 'stripe_fx_fee'
    | 'tax_fee'
    | 'topup'
    | 'topup_reversal'
    | 'transfer'
    | 'transfer_cancel'
    | 'transfer_failure'
    | 'transfer_refund'
    | undefined;
  source?: string | undefined;
  currency?: string | undefined;
  payout?: string | undefined;
};

export type ListChargesInput = {
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  payment_intent?: string | undefined;
  starting_after?: string | undefined;
  transfer_group?: string | undefined;
  expand?: string[] | undefined;
};

export type ListCheckoutSessionLineItemsInput = {
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListCheckoutSessionsInput = {
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  customer_details?: { email: string } | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  payment_intent?: string | undefined;
  payment_link?: string | undefined;
  starting_after?: string | undefined;
  status?: 'complete' | 'expired' | 'open' | undefined;
  subscription?: string | undefined;
  expand?: string[] | undefined;
};

export type ListCustomersInput = {
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  email?: string | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  test_clock?: string | undefined;
  expand?: string[] | undefined;
};

export type ListEventsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  related_object?: string | undefined;
  type?: string | undefined;
  types?: string[] | undefined;
};

export type ListExternalWalletsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
};

export type ListIdentityVerificationSessionsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  related_account?: string | undefined;
  status?:
    | 'verified'
    | 'processing'
    | 'requires_action'
    | 'canceled'
    | 'requires_input'
    | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
};

export type ListInvoiceItemsInput = {
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  ending_before?: string | undefined;
  invoice?: string | undefined;
  limit?: number | undefined;
  pending?: boolean | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListInvoicesInput = {
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  status?: 'void' | 'open' | 'paid' | 'draft' | 'uncollectible' | undefined;
  subscription?: string | undefined;
  expand?: string[] | undefined;
};

export type ListPaymentIntentLineItemsInput = {
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListPaymentIntentsInput = {
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  status?:
    | 'processing'
    | 'requires_action'
    | 'succeeded'
    | 'canceled'
    | 'requires_capture'
    | 'requires_confirmation'
    | 'requires_payment_method'
    | 'incomplete'
    | undefined;
  expand?: string[] | undefined;
};

export type ListPaymentLinkLineItemsInput = {
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListPaymentLinksInput = {
  active?: boolean | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListPayoutsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  destination?: string | undefined;
  status?:
    | 'pending'
    | 'failed'
    | 'canceled'
    | 'paid'
    | 'in_transit'
    | undefined;
  arrival_date?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
};

export type ListPersonsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  relationship?:
    | {
        authorizer?: boolean | undefined;
        director?: boolean | undefined;
        executive?: boolean | undefined;
        legal_guardian?: boolean | undefined;
        owner?: boolean | undefined;
        representative?: boolean | undefined;
      }
    | undefined;
};

export type ListPricesInput = {
  active?: boolean | undefined;
  currency?: string | undefined;
  product?: string | undefined;
  type?: 'recurring' | 'one_time' | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  lookup_keys?: string[] | undefined;
  recurring?:
    | {
        interval?: 'hour' | 'day' | 'week' | 'month' | 'year' | undefined;
        meter?: string | undefined;
        usage_type?: 'metered' | 'licensed' | undefined;
      }
    | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListProductsInput = {
  active?: boolean | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  ending_before?: string | undefined;
  ids?: string[] | undefined;
  limit?: number | undefined;
  shippable?: boolean | undefined;
  starting_after?: string | undefined;
  url?: string | undefined;
  expand?: string[] | undefined;
};

export type ListSubscriptionItemsInput = {
  subscription: string;
  ending_before?: string | undefined;
  limit?: number | undefined;
  starting_after?: string | undefined;
  expand?: string[] | undefined;
};

export type ListSubscriptionsInput = {
  automatic_tax?: { enabled: boolean } | undefined;
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  current_period_end?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  current_period_start?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  ending_before?: string | undefined;
  limit?: number | undefined;
  price?: string | undefined;
  starting_after?: string | undefined;
  status?:
    | 'all'
    | 'active'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'past_due'
    | 'unpaid'
    | 'paused'
    | 'ended'
    | undefined;
  test_clock?: string | undefined;
  expand?: string[] | undefined;
};

export type ListTopUpsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  status?:
    | 'pending'
    | 'succeeded'
    | 'failed'
    | 'canceled'
    | 'reversed'
    | undefined;
  amount?: { gt?: number; gte?: number; lt?: number; lte?: number } | undefined;
  created?:
    | { gt?: number; gte?: number; lt?: number; lte?: number }
    | undefined;
};

export type ListTransfersInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
  destination?: string | undefined;
  transfer_group?: string | undefined;
  created?:
    | {
        gt?: number | undefined;
        gte?: number | undefined;
        lt?: number | undefined;
        lte?: number | undefined;
      }
    | undefined;
};

export type ListWebhookEndpointsInput = {
  limit?: number | undefined;
  starting_after?: string | undefined;
  ending_before?: string | undefined;
};

export type MarkInvoiceUncollectibleInput = { expand?: string[] | undefined };

export type MigrateSubscriptionInput = {
  billing_mode: {
    type: 'flexible';
    flexible?:
      | { proration_discounts?: 'included' | 'itemized' | undefined }
      | undefined;
  };
  expand?: string[] | undefined;
};

export type PayInvoiceInput = {
  forgive?: boolean | undefined;
  mandate?: string | undefined;
  off_session?: boolean | undefined;
  paid_out_of_band?: boolean | undefined;
  payment_method?: string | undefined;
  source?: string | undefined;
  settlement_signature?: string | undefined;
  expand?: string[] | undefined;
};

export type RejectAccountInput = {
  reason: 'fraud' | 'terms_of_service' | 'other';
  pause_payouts?: boolean | undefined;
};

export type ResumeSubscriptionInput = {
  billing_cycle_anchor?: 'now' | 'unchanged' | undefined;
  proration_behavior?:
    | 'none'
    | 'create_prorations'
    | 'always_invoice'
    | undefined;
  proration_date?: number | undefined;
  expand?: string[] | undefined;
};

export type RetrieveChargeInput = { expand?: string[] | undefined };

export type RetrieveCheckoutSessionInput = { expand?: string[] | undefined };

export type RetrieveCustomerInput = { expand?: string[] | undefined };

export type RetrieveInvoiceInput = { expand?: string[] | undefined };

export type RetrieveInvoiceItemInput = { expand?: string[] | undefined };

export type RetrievePaymentIntentInput = {
  client_secret?: string | undefined;
  expand?: string[] | undefined;
};

export type RetrievePaymentLinkInput = { expand?: string[] | undefined };

export type RetrievePriceInput = { expand?: string[] | undefined };

export type RetrieveProductInput = { expand?: string[] | undefined };

export type RetrieveSubscriptionInput = { expand?: string[] | undefined };

export type RetrieveSubscriptionItemInput = { expand?: string[] | undefined };

export type RunBillingForPlatformInput = { batch_size?: number | undefined };

export type UpdateAccountInput = {
  email?: string | undefined;
  business_type?:
    | 'individual'
    | 'company'
    | 'non_profit'
    | 'government_entity'
    | undefined;
  default_currency?: string | undefined;
  business_profile?:
    | {
        mcc?: string | null | undefined;
        name?: string | null | undefined;
        product_description?: string | null | undefined;
        support_email?: string | null | undefined;
        support_phone?: string | null | undefined;
        support_url?: string | null | undefined;
        url?: string | null | undefined;
      }
    | undefined;
  capabilities?:
    | {
        transfers?: { requested?: boolean | undefined } | undefined;
        usdc_payouts?: { requested?: boolean | undefined } | undefined;
      }
    | undefined;
  tos_acceptance?:
    | {
        date?: number | undefined;
        ip?: string | undefined;
        service_agreement?: 'full' | 'recipient' | undefined;
        user_agent?: string | undefined;
      }
    | undefined;
  settings?:
    | {
        branding?:
          | {
              icon?: string | null | undefined;
              logo?: string | null | undefined;
              primary_color?: string | null | undefined;
              secondary_color?: string | null | undefined;
            }
          | undefined;
        dashboard?:
          | {
              display_name?: string | null | undefined;
              timezone?: string | null | undefined;
            }
          | undefined;
        payouts?:
          | {
              debit_negative_balances?: boolean | undefined;
              schedule?:
                | {
                    delay_days?: number | 'minimum' | undefined;
                    interval?:
                      | 'daily'
                      | 'weekly'
                      | 'monthly'
                      | 'manual'
                      | undefined;
                    monthly_anchor?: number | undefined;
                    weekly_anchor?:
                      | 'monday'
                      | 'tuesday'
                      | 'wednesday'
                      | 'thursday'
                      | 'friday'
                      | 'saturday'
                      | 'sunday'
                      | undefined;
                  }
                | undefined;
              statement_descriptor?: string | null | undefined;
            }
          | undefined;
        identity?:
          | {
              provider?: 'didit' | null | undefined;
              didit?:
                | {
                    api_key?: string | null | undefined;
                    workflow_id?: string | null | undefined;
                    kyb_workflow_id?: string | null | undefined;
                    webhook_secret?: string | null | undefined;
                  }
                | null
                | undefined;
              rules?:
                | {
                    payout_volume_threshold_cents?: number | null | undefined;
                    country_thresholds?:
                      | {
                          countries: string[];
                          payout_volume_threshold_cents: number;
                        }[]
                      | null
                      | undefined;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
        terms_url?: string | null | undefined;
        privacy_url?: string | null | undefined;
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
};

export type UpdateChargeInput = {
  customer?: string | undefined;
  description?: string | undefined;
  fraud_details?: { user_report: 'safe' | 'fraudulent' } | undefined;
  metadata?: Record<string, string> | undefined;
  receipt_email?: string | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        carrier?: string | undefined;
        phone?: string | undefined;
        tracking_number?: string | undefined;
      }
    | undefined;
  transfer_group?: string | undefined;
  expand?: string[] | undefined;
};

export type UpdateCheckoutSessionInput = {
  collected_information?:
    | {
        shipping_details?:
          | {
              address: {
                country: string;
                line1: string;
                city?: string | undefined;
                line2?: string | undefined;
                postal_code?: string | undefined;
                state?: string | undefined;
              };
              name: string;
            }
          | undefined;
      }
    | undefined;
  line_items?:
    | {
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
        id?: string | undefined;
        metadata?: Record<string, string> | undefined;
        price?: string | undefined;
        price_data?:
          | {
              currency: string;
              product?: string | undefined;
              product_data?:
                | {
                    name: string;
                    description?: string | undefined;
                    images?: string[] | undefined;
                    metadata?: Record<string, string> | undefined;
                    tax_code?: string | undefined;
                    tax_details?:
                      | {
                          performance_location?: string | undefined;
                          tax_code?: string | undefined;
                        }
                      | undefined;
                    unit_label?: string | undefined;
                  }
                | undefined;
              recurring?:
                | {
                    interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                    interval_count?: number | undefined;
                  }
                | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              unit_amount?: number | undefined;
              unit_amount_decimal?: string | undefined;
            }
          | undefined;
        quantity?: number | undefined;
        tax_rates?: string[] | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  shipping_options?:
    | {
        shipping_rate?: string | undefined;
        shipping_rate_data?:
          | {
              display_name: string;
              delivery_estimate?:
                | {
                    maximum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                    minimum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                  }
                | undefined;
              fixed_amount?:
                | {
                    amount: number;
                    currency: string;
                    currency_options?:
                      | Record<
                          string,
                          {
                            amount: number;
                            tax_behavior?:
                              | 'inclusive'
                              | 'exclusive'
                              | 'unspecified'
                              | undefined;
                          }
                        >
                      | undefined;
                  }
                | undefined;
              metadata?: Record<string, string> | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              tax_code?: string | undefined;
              type?: 'fixed_amount' | undefined;
            }
          | undefined;
      }[]
    | undefined;
  expand?: string[] | undefined;
};

export type UpdateCustomerInput = {
  address?:
    | {
        city?: string | undefined;
        country?: string | undefined;
        line1?: string | undefined;
        line2?: string | undefined;
        postal_code?: string | undefined;
        state?: string | undefined;
      }
    | undefined;
  balance?: number | undefined;
  business_name?: string | undefined;
  cash_balance?:
    | {
        settings?:
          | { reconciliation_mode: 'manual' | 'automatic' | 'merchant_default' }
          | undefined;
      }
    | undefined;
  default_source?: string | undefined;
  description?: string | undefined;
  email?: string | undefined;
  individual_name?: string | undefined;
  invoice_prefix?: string | undefined;
  invoice_settings?:
    | {
        custom_fields?: { name: string; value: string }[] | undefined;
        default_payment_method?: string | undefined;
        footer?: string | undefined;
        rendering_options?:
          | {
              amount_tax_display?:
                | 'exclude_tax'
                | 'include_inclusive_tax'
                | undefined;
              template?: string | undefined;
            }
          | undefined;
      }
    | undefined;
  metadata?: Record<string, string> | undefined;
  name?: string | undefined;
  next_invoice_sequence?: number | undefined;
  phone?: string | undefined;
  preferred_locales?: string[] | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        phone?: string | undefined;
      }
    | undefined;
  source?: string | undefined;
  tax?:
    | {
        ip_address?: string | undefined;
        validate_location?: 'auto' | 'deferred' | 'immediately' | undefined;
      }
    | undefined;
  tax_exempt?: 'none' | 'exempt' | 'reverse' | undefined;
  expand?: string[] | undefined;
};

export type UpdateExternalWalletInput = {
  account_holder_name?: string | null | undefined;
  account_holder_type?: 'individual' | 'company' | null | undefined;
  default_for_currency?: boolean | null | undefined;
  metadata?: Record<string, string> | undefined;
};

export type UpdateIdentityVerificationSessionInput = {
  metadata?: Record<string, string> | undefined;
  provided_details?:
    | { email?: string | null | undefined; phone?: string | null | undefined }
    | undefined;
  options?:
    | {
        document?:
          | {
              require_live_capture?: boolean | undefined;
              require_matching_selfie?: boolean | undefined;
              allowed_types?:
                | ('driving_license' | 'id_card' | 'passport')[]
                | undefined;
            }
          | undefined;
      }
    | undefined;
};

export type UpdateInvoiceInput = {
  account_tax_ids?: string[] | undefined;
  application_fee_amount?: number | undefined;
  auto_advance?: boolean | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  automatically_finalizes_at?: number | undefined;
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  custom_fields?: '' | { name: string; value: string }[] | undefined;
  days_until_due?: number | undefined;
  default_payment_method?: string | undefined;
  default_source?: string | undefined;
  default_tax_rates?: '' | string[] | undefined;
  description?: string | undefined;
  discounts?:
    | ''
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  due_date?: number | undefined;
  effective_at?: number | undefined;
  footer?: string | undefined;
  issuer?:
    | { type: 'account' | 'self'; account?: string | undefined }
    | undefined;
  metadata?: Record<string, string> | undefined;
  number?: string | undefined;
  on_behalf_of?: string | undefined;
  payment_settings?:
    | {
        default_mandate?: string | undefined;
        payment_method_options?:
          | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
          | undefined;
        payment_method_types?: 'crypto'[] | undefined;
      }
    | undefined;
  rendering?:
    | {
        amount_tax_display?:
          | 'exclude_tax'
          | 'include_inclusive_tax'
          | undefined;
        pdf?: { page_size?: 'auto' | 'a4' | 'letter' | undefined } | undefined;
        template?: string | undefined;
        template_version?: number | undefined;
      }
    | undefined;
  shipping_cost?:
    | {
        shipping_rate?: string | undefined;
        shipping_rate_data?:
          | {
              display_name: string;
              type: 'fixed_amount';
              delivery_estimate?:
                | {
                    maximum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                    minimum?:
                      | {
                          unit:
                            | 'hour'
                            | 'day'
                            | 'week'
                            | 'month'
                            | 'business_day';
                          value: number;
                        }
                      | undefined;
                  }
                | undefined;
              fixed_amount?:
                | {
                    amount: number;
                    currency: string;
                    currency_options?:
                      | Record<
                          string,
                          {
                            amount: number;
                            tax_behavior?:
                              | 'inclusive'
                              | 'exclusive'
                              | 'unspecified'
                              | undefined;
                          }
                        >
                      | undefined;
                  }
                | undefined;
              metadata?: Record<string, string> | undefined;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              tax_code?: string | undefined;
            }
          | undefined;
      }
    | undefined;
  shipping_details?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        phone?: string | undefined;
      }
    | undefined;
  statement_descriptor?: string | undefined;
  transfer_data?:
    | ''
    | { destination: string; amount?: number | undefined }
    | undefined;
  expand?: string[] | undefined;
};

export type UpdateInvoiceItemInput = {
  amount?: number | undefined;
  description?: string | undefined;
  discountable?: boolean | undefined;
  discounts?:
    | ''
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  period?: { end: number; start: number } | undefined;
  price_data?:
    | {
        currency: string;
        product: string;
        tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
        unit_amount?: number | undefined;
        unit_amount_decimal?: string | undefined;
      }
    | undefined;
  pricing?: { price?: string | undefined } | undefined;
  quantity?: number | undefined;
  quantity_decimal?: string | undefined;
  tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
  tax_code?: string | undefined;
  tax_rates?: '' | string[] | undefined;
  unit_amount_decimal?: string | undefined;
  expand?: string[] | undefined;
};

export type UpdatePaymentIntentInput = {
  amount?: number | undefined;
  amount_details?:
    | {
        discount_amount?: number | undefined;
        enforce_arithmetic_validation?: boolean | undefined;
        line_items?:
          | {
              product_name: string;
              quantity: number;
              unit_cost: number;
              discount_amount?: number | undefined;
              product_code?: string | undefined;
              tax?: { total_tax_amount: number } | undefined;
              unit_of_measure?: string | undefined;
            }[]
          | undefined;
        shipping?:
          | {
              amount?: number | undefined;
              from_postal_code?: string | undefined;
              to_postal_code?: string | undefined;
            }
          | undefined;
        tax?: { total_tax_amount: number } | undefined;
      }
    | undefined;
  application_fee_amount?: number | undefined;
  capture_method?: 'manual' | 'automatic' | 'automatic_async' | undefined;
  currency?: string | undefined;
  customer?: string | undefined;
  customer_account?: string | undefined;
  description?: string | undefined;
  excluded_payment_method_types?: string[] | undefined;
  hooks?:
    | { inputs?: { tax?: { calculation: string } | undefined } | undefined }
    | undefined;
  metadata?: Record<string, string> | undefined;
  payment_details?:
    | {
        customer_reference?: string | undefined;
        order_reference?: string | undefined;
      }
    | undefined;
  payment_method?: string | undefined;
  payment_method_configuration?: string | undefined;
  payment_method_data?:
    | {
        type?: 'crypto' | undefined;
        allow_redisplay?: 'unspecified' | 'always' | 'limited' | undefined;
        billing_details?:
          | {
              address?:
                | {
                    city?: string | undefined;
                    country?: string | undefined;
                    line1?: string | undefined;
                    line2?: string | undefined;
                    postal_code?: string | undefined;
                    state?: string | undefined;
                  }
                | undefined;
              email?: string | undefined;
              name?: string | undefined;
              phone?: string | undefined;
              tax_id?: string | undefined;
            }
          | undefined;
        crypto?: Record<string, never> | undefined;
        metadata?: Record<string, string> | undefined;
        shared_payment_granted_token?: string | undefined;
      }
    | undefined;
  payment_method_options?:
    | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
    | undefined;
  payment_method_types?: 'crypto'[] | undefined;
  receipt_email?: string | undefined;
  setup_future_usage?: 'off_session' | 'on_session' | undefined;
  shipping?:
    | {
        address: {
          city?: string | undefined;
          country?: string | undefined;
          line1?: string | undefined;
          line2?: string | undefined;
          postal_code?: string | undefined;
          state?: string | undefined;
        };
        name: string;
        carrier?: string | undefined;
        phone?: string | undefined;
        tracking_number?: string | undefined;
      }
    | undefined;
  statement_descriptor?: string | undefined;
  statement_descriptor_suffix?: string | undefined;
  transfer_data?:
    | {
        amount?: number | undefined;
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        payment_data?:
          | {
              description?: string | undefined;
              metadata?: Record<string, string> | undefined;
            }
          | undefined;
      }
    | undefined;
  transfer_group?: string | undefined;
  expand?: string[] | undefined;
};

export type UpdatePaymentLinkInput = {
  active?: boolean | undefined;
  after_completion?:
    | {
        type: 'hosted_confirmation' | 'redirect';
        hosted_confirmation?:
          | { custom_message?: string | undefined }
          | undefined;
        redirect?: { url: string } | undefined;
      }
    | undefined;
  allow_promotion_codes?: boolean | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  billing_address_collection?: 'auto' | 'required' | undefined;
  custom_fields?:
    | {
        key: string;
        label: { custom: string; type: 'custom' };
        type: 'dropdown' | 'numeric' | 'text';
        dropdown?:
          | {
              options: { label: string; value: string }[];
              default_value?: string | undefined;
            }
          | undefined;
        numeric?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
        optional?: boolean | undefined;
        text?:
          | {
              default_value?: string | undefined;
              maximum_length?: number | undefined;
              minimum_length?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  custom_text?:
    | {
        after_submit?: { message: string } | undefined;
        shipping_address?: { message: string } | undefined;
        submit?: { message: string } | undefined;
        terms_of_service_acceptance?: { message: string } | undefined;
      }
    | undefined;
  customer_creation?: 'always' | 'if_required' | undefined;
  inactive_message?: string | undefined;
  invoice_creation?:
    | {
        enabled: boolean;
        invoice_data?:
          | {
              account_tax_ids?: string[] | undefined;
              custom_fields?: { name: string; value: string }[] | undefined;
              description?: string | undefined;
              footer?: string | undefined;
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
              metadata?: Record<string, string> | undefined;
              rendering_options?:
                | {
                    amount_tax_display?:
                      | 'exclude_tax'
                      | 'include_inclusive_tax'
                      | undefined;
                    template?: string | undefined;
                  }
                | undefined;
            }
          | undefined;
      }
    | undefined;
  line_items?:
    | {
        id: string;
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
        quantity?: number | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  name_collection?:
    | {
        business?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
        individual?:
          | { enabled: boolean; optional?: boolean | undefined }
          | undefined;
      }
    | undefined;
  optional_items?:
    | {
        price: string;
        quantity: number;
        adjustable_quantity?:
          | {
              enabled: boolean;
              maximum?: number | undefined;
              minimum?: number | undefined;
            }
          | undefined;
      }[]
    | undefined;
  payment_intent_data?:
    | {
        description?: string | undefined;
        metadata?: Record<string, string> | undefined;
        statement_descriptor?: string | undefined;
        statement_descriptor_suffix?: string | undefined;
        transfer_group?: string | undefined;
      }
    | undefined;
  payment_method_collection?: 'always' | 'if_required' | undefined;
  payment_method_options?:
    | {
        card?:
          | {
              restrictions?:
                | {
                    brands_blocked?:
                      | (
                          | 'american_express'
                          | 'discover_global_network'
                          | 'mastercard'
                          | 'visa'
                        )[]
                      | undefined;
                  }
                | undefined;
            }
          | undefined;
        crypto?: { setup_future_usage?: 'none' | undefined } | undefined;
      }
    | undefined;
  payment_method_types?: 'crypto'[] | undefined;
  phone_number_collection?: { enabled: boolean } | undefined;
  restrictions?: { completed_sessions: { limit: number } } | undefined;
  shipping_address_collection?: { allowed_countries: string[] } | undefined;
  submit_type?: 'auto' | 'book' | 'donate' | 'pay' | 'subscribe' | undefined;
  subscription_data?:
    | {
        invoice_settings?:
          | {
              issuer?:
                | { type: 'account' | 'self'; account?: string | undefined }
                | undefined;
            }
          | undefined;
        metadata?: Record<string, string> | undefined;
        trial_period_days?: number | undefined;
        trial_settings?:
          | {
              end_behavior: {
                missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
              };
            }
          | undefined;
      }
    | undefined;
  tax_id_collection?:
    | { enabled: boolean; required?: 'never' | 'if_supported' | undefined }
    | undefined;
  expand?: string[] | undefined;
};

export type UpdatePayoutInput = {
  metadata?: Record<string, string> | undefined;
};

export type UpdatePersonInput = {
  address?:
    | {
        line1: string | null;
        city: string | null;
        postal_code: string | null;
        country: string | null;
        line2?: string | null | undefined;
        state?: string | null | undefined;
      }
    | undefined;
  dob?:
    | { day: number | null; month: number | null; year: number | null }
    | undefined;
  email?: string | undefined;
  first_name?: string | undefined;
  last_name?: string | undefined;
  phone?: string | null | undefined;
  relationship?:
    | {
        authorizer?: boolean | null | undefined;
        director?: boolean | null | undefined;
        executive?: boolean | null | undefined;
        legal_guardian?: boolean | null | undefined;
        owner?: boolean | null | undefined;
        percent_ownership?: number | null | undefined;
        representative?: boolean | null | undefined;
        title?: string | null | undefined;
      }
    | undefined;
  ssn_last_4?: string | undefined;
  id_number?: string | undefined;
  metadata?: Record<string, string> | undefined;
  verification?:
    | {
        additional_document?:
          | { back?: string | undefined; front?: string | undefined }
          | undefined;
        document?:
          | { back?: string | undefined; front?: string | undefined }
          | undefined;
      }
    | undefined;
};

export type UpdatePriceInput = {
  active?: boolean | undefined;
  metadata?: Record<string, string> | undefined;
  nickname?: string | undefined;
  tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
  currency_options?:
    | Record<
        string,
        {
          custom_unit_amount?:
            | {
                enabled: boolean;
                maximum: number;
                minimum: number;
                preset: number;
              }
            | undefined;
          tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
          tiers?:
            | {
                flat_amount: number;
                up_to: number;
                flat_amount_decimal?: string | undefined;
                unit_amount?: number | undefined;
                unit_amount_decimal?: string | undefined;
              }[]
            | undefined;
          unit_amount?: number | undefined;
          unit_amount_decimal?: string | undefined;
        }
      >
    | undefined;
  lookup_key?: string | undefined;
  transfer_lookup_key?: boolean | undefined;
  expand?: string[] | undefined;
};

export type UpdateProductInput = {
  active?: boolean | undefined;
  default_price?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
  name?: string | undefined;
  tax_code?: string | undefined;
  images?: string[] | undefined;
  marketing_features?: MarketingFeature[] | undefined;
  package_dimensions?:
    | { height: number; length: number; weight: number; width: number }
    | undefined;
  shippable?: boolean | undefined;
  statement_descriptor?: string | undefined;
  unit_label?: string | undefined;
  url?: string | undefined;
  expand?: string[] | undefined;
};

export type UpdateSubscriptionInput = {
  add_invoice_items?:
    | {
        discountable?: boolean | undefined;
        discounts?:
          | {
              coupon?: string | undefined;
              discount?: string | undefined;
              promotion_code?: string | undefined;
            }[]
          | undefined;
        metadata?: Record<string, string> | undefined;
        period?:
          | {
              end: {
                type: 'timestamp' | 'min_item_period_end';
                timestamp?: number | undefined;
              };
              start: {
                type: 'timestamp' | 'max_item_period_start' | 'now';
                timestamp?: number | undefined;
              };
            }
          | undefined;
        price?: string | undefined;
        price_data?:
          | {
              currency: string;
              product: string;
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              unit_amount?: number | undefined;
              unit_amount_decimal?: string | undefined;
            }
          | undefined;
        quantity?: number | undefined;
        tax_rates?: string[] | undefined;
      }[]
    | undefined;
  application_fee_percent?: number | undefined;
  automatic_tax?:
    | {
        enabled: boolean;
        liability?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  billing_cycle_anchor?: 'now' | 'unchanged' | undefined;
  billing_schedules?:
    | {
        bill_until?:
          | {
              type: 'duration' | 'timestamp';
              duration?:
                | {
                    interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                    interval_count?: number | undefined;
                  }
                | undefined;
              timestamp?: number | undefined;
            }
          | undefined;
        applies_to?:
          | { type: 'price'; price?: string | undefined }[]
          | undefined;
        key?: string | undefined;
      }[]
    | undefined;
  billing_thresholds?:
    | ''
    | {
        amount_gte?: number | undefined;
        reset_billing_cycle_anchor?: boolean | undefined;
      }
    | undefined;
  cancel_at?:
    | number
    | 'max_billed_until'
    | 'max_period_end'
    | 'min_period_end'
    | undefined;
  cancel_at_period_end?: boolean | undefined;
  cancellation_details?:
    | {
        comment?: string | undefined;
        feedback?:
          | 'other'
          | 'customer_service'
          | 'low_quality'
          | 'missing_features'
          | 'switched_service'
          | 'too_complex'
          | 'too_expensive'
          | 'unused'
          | undefined;
      }
    | undefined;
  collection_method?: 'charge_automatically' | 'send_invoice' | undefined;
  days_until_due?: number | undefined;
  default_payment_method?: string | undefined;
  default_source?: string | undefined;
  default_tax_rates?: '' | string[] | undefined;
  description?: string | undefined;
  discounts?:
    | ''
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  invoice_settings?:
    | {
        account_tax_ids?: string[] | undefined;
        custom_fields?: { name: string; value: string }[] | undefined;
        description?: string | undefined;
        footer?: string | undefined;
        issuer?:
          | { type: 'account' | 'self'; account?: string | undefined }
          | undefined;
      }
    | undefined;
  items?:
    | {
        id?: string | undefined;
        billing_thresholds?: '' | { usage_gte: number } | undefined;
        clear_usage?: boolean | undefined;
        deleted?: boolean | undefined;
        discounts?:
          | ''
          | {
              coupon?: string | undefined;
              discount?: string | undefined;
              promotion_code?: string | undefined;
            }[]
          | undefined;
        metadata?: Record<string, string> | undefined;
        price?: string | undefined;
        price_data?:
          | {
              currency: string;
              product: string;
              recurring: {
                interval: 'hour' | 'day' | 'week' | 'month' | 'year';
                interval_count?: number | undefined;
              };
              tax_behavior?:
                | 'inclusive'
                | 'exclusive'
                | 'unspecified'
                | undefined;
              unit_amount?: number | undefined;
              unit_amount_decimal?: string | undefined;
            }
          | undefined;
        quantity?: number | undefined;
        tax_rates?: '' | string[] | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  off_session?: boolean | undefined;
  on_behalf_of?: string | undefined;
  pause_collection?:
    | ''
    | {
        behavior: 'void' | 'keep_as_draft' | 'mark_uncollectible';
        resumes_at?: number | undefined;
      }
    | undefined;
  payment_behavior?:
    | 'allow_incomplete'
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'pending_if_incomplete'
    | undefined;
  payment_settings?:
    | {
        payment_method_options?:
          | { crypto?: { setup_future_usage?: 'none' | undefined } | undefined }
          | undefined;
        payment_method_types?: 'crypto'[] | undefined;
        save_default_payment_method?: 'off' | 'on_subscription' | undefined;
      }
    | undefined;
  pending_invoice_item_interval?:
    | {
        interval: 'hour' | 'day' | 'week' | 'month' | 'year';
        interval_count?: number | undefined;
      }
    | undefined;
  proration_behavior?:
    | 'none'
    | 'create_prorations'
    | 'always_invoice'
    | undefined;
  proration_date?: number | undefined;
  transfer_data?:
    | ''
    | { destination: string; amount_percent?: number | undefined }
    | undefined;
  trial_end?: number | 'now' | undefined;
  trial_from_plan?: boolean | undefined;
  trial_settings?:
    | {
        end_behavior: {
          missing_payment_method: 'cancel' | 'create_invoice' | 'pause';
        };
      }
    | undefined;
  expand?: string[] | undefined;
};

export type UpdateSubscriptionItemInput = {
  billing_thresholds?: '' | { usage_gte: number } | undefined;
  discounts?:
    | ''
    | {
        coupon?: string | undefined;
        discount?: string | undefined;
        promotion_code?: string | undefined;
      }[]
    | undefined;
  metadata?: Record<string, string> | undefined;
  off_session?: boolean | undefined;
  payment_behavior?:
    | 'allow_incomplete'
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'pending_if_incomplete'
    | undefined;
  price?: string | undefined;
  price_data?:
    | {
        currency: string;
        product: string;
        recurring: {
          interval: 'hour' | 'day' | 'week' | 'month' | 'year';
          interval_count?: number | undefined;
        };
        tax_behavior?: 'inclusive' | 'exclusive' | 'unspecified' | undefined;
        unit_amount?: number | undefined;
        unit_amount_decimal?: string | undefined;
      }
    | undefined;
  proration_behavior?:
    | 'none'
    | 'create_prorations'
    | 'always_invoice'
    | undefined;
  proration_date?: number | undefined;
  quantity?: number | undefined;
  tax_rates?: '' | string[] | undefined;
  expand?: string[] | undefined;
};

export type UpdateTopUpInput = {
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type UpdateTransferInput = {
  description?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type UpdateWebhookEndpointInput = {
  url?: string | undefined;
  enabled_events?: string[] | undefined;
  description?: string | null | undefined;
  disabled?: boolean | undefined;
  metadata?: Record<string, string> | undefined;
};

export type VoidInvoiceInput = { expand?: string[] | undefined };

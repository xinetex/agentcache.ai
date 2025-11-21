# Stripe Product Configuration for AgentCache

This document outlines how to configure Stripe products and prices for the AgentCache platform.

## Current Pricing Tiers

Based on the unified content strategy, we have:

1. **Free** - $0/month (10K requests/mo)
2. **Starter** - $29/month (100K requests/mo)
3. **Pro** - $99/month (500K requests/mo) [POPULAR]
4. **Business** - $299/month (2M requests/mo)
5. **Enterprise** - Custom pricing (contact sales)

## Add-On Services (Proposed)

1. **Moonshot Premium** - $99/mo (Dedicated reasoning cache pool)
2. **Cognitive Plus** - $149/mo (Advanced hallucination detection with LLM verifier)
3. **Custom Memory Models** - $499/mo (Domain-specific validation training)

## Stripe Setup Commands

### Test Mode Setup

```bash
# Set API key as environment variable (already in .env)
export STRIPE_SECRET_KEY=sk_test_51SIdRdAjvdndXr9TxL7aZv25jdlpikfHw58kPEzjxeewPii5W5VJKHxV9GSHbOFOKKUFiiTxUujvsebFTL0W6Evi00XZSuwsWG

# Create products (if not exist)
stripe products create \
  --name="AgentCache Starter" \
  --description="100K requests/mo with email support and analytics" \
  --api-key=$STRIPE_SECRET_KEY

stripe products create \
  --name="AgentCache Pro" \
  --description="500K requests/mo with priority support and custom cache rules" \
  --api-key=$STRIPE_SECRET_KEY

stripe products create \
  --name="AgentCache Business" \
  --description="2M requests/mo with dedicated support and SSO/SAML" \
  --api-key=$STRIPE_SECRET_KEY

# Create prices (monthly recurring)
# Get product IDs first with: stripe products list --api-key=$STRIPE_SECRET_KEY

# Starter tier
stripe prices create \
  --product=PRODUCT_ID_HERE \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY

# Pro tier
stripe prices create \
  --product=PRODUCT_ID_HERE \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY

# Business tier
stripe prices create \
  --product=PRODUCT_ID_HERE \
  --unit-amount=29900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY
```

### Add-On Products (Optional)

```bash
# Moonshot Premium Add-on
stripe products create \
  --name="Moonshot Premium" \
  --description="Dedicated reasoning cache pool for maximum performance" \
  --api-key=$STRIPE_SECRET_KEY

stripe prices create \
  --product=PRODUCT_ID_HERE \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY

# Cognitive Plus Add-on
stripe products create \
  --name="Cognitive Plus" \
  --description="Advanced hallucination detection with LLM verifier" \
  --api-key=$STRIPE_SECRET_KEY

stripe prices create \
  --product=PRODUCT_ID_HERE \
  --unit-amount=14900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY
```

## Updating the Checkout Endpoint

The `/api/checkout` endpoint in `api/checkout.js` needs to be updated with the correct price IDs:

```javascript
// Map tier names to Stripe price IDs
const PRICE_IDS = {
  starter: 'price_XXXXXXXXXX',  // $29/mo
  pro: 'price_XXXXXXXXXX',      // $99/mo
  business: 'price_XXXXXXXXXX'  // $299/mo
};
```

## Webhook Events

Ensure the webhook endpoint `/api/webhook` handles:

- `checkout.session.completed` - Generate API key
- `customer.subscription.deleted` - Revoke API key
- `invoice.payment_succeeded` - Confirm renewal
- `invoice.payment_failed` - Send warning email

## Next Steps

1. ✅ Verify existing products with `stripe products list`
2. ✅ Create missing products if needed
3. ⏳ Update `api/checkout.js` with price IDs
4. ⏳ Test checkout flow in sandbox mode
5. ⏳ Configure Vercel environment variables with price IDs
6. ⏳ Move to live mode when ready

## Current Status

Checking existing Stripe configuration...

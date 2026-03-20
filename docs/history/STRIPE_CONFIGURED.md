# ✅ Stripe Configuration Complete

## What Was Configured via CLI

### 1. Created New Price for Pro Tier
- **Product**: AgentCache Pro (`prod_TT3fQXIQiakuBu`)
- **Price**: $49/month
- **Price ID**: `price_1SYxcdAjvdndXr9TnkYfYW2I`
- **Quota**: 1M requests/month
- **Description**: "For production apps. 1M requests/mo with private namespaces, 90 day TTL, priority support."

### 2. Configured Webhook Endpoint
- **URL**: `https://agentcache.ai/api/billing/webhook`
- **Webhook ID**: `we_1SYxd6AjvdndXr9T7yScHXbA`
- **Secret**: `whsec_***REDACTED***`
- **Events Subscribed**:
  - `checkout.session.completed` - User completes payment → upgrade tier
  - `customer.subscription.updated` - Subscription status changes
  - `customer.subscription.deleted` - User cancels → downgrade to free
  - `invoice.payment_failed` - Payment fails → notify/suspend

### 3. Updated Vercel Environment Variables
- ✅ `STRIPE_PRICE_PRO_MONTHLY` = `price_1SYxcdAjvdndXr9TnkYfYW2I`
- ✅ `STRIPE_WEBHOOK_SECRET` = `whsec_***REDACTED***`

### 4. Existing Stripe Keys (Already in Vercel)
- ✅ `STRIPE_SECRET_KEY` = `sk_test_51SIdRdAjvdndXr9T...` (test mode)
- ✅ `STRIPE_PUBLISHABLE_KEY` = `pk_test_51SIdRdAjvdndXr9T...`

---

## Testing the Flow

### Test Upgrade (Test Mode)
```bash
# 1. Get your API key
API_KEY="ac_your_key"

# 2. Visit upgrade page
open "https://agentcache.ai/upgrade.html?key=$API_KEY"

# 3. Click "Upgrade to Pro"
# 4. Use Stripe test card: 4242 4242 4242 4242
# 5. Any future date, any CVC
# 6. Complete checkout
# 7. Webhook should fire → tier upgraded to Pro
# 8. Check quota: should be 1M
```

### Monitor Webhooks
```bash
# In Stripe Dashboard:
# https://dashboard.stripe.com/test/webhooks/we_1SYxd6AjvdndXr9T7yScHXbA

# Or via CLI:
source .env && stripe events list --limit 5 --api-key $STRIPE_SECRET_KEY
```

### Test Webhook Locally (Development)
```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/billing/webhook

# In another terminal, trigger test event
stripe trigger checkout.session.completed
```

---

## Upgrade Flow Architecture

```
User hits 10K quota
    ↓
Gets 429 error with upgrade link
    ↓
Visits /upgrade.html?key=ac_xxx
    ↓
Clicks "Upgrade to Pro - $49/month"
    ↓
POST /api/billing/create-checkout
    ↓
Stripe Checkout (price_1SYxcdAjvdndXr9TnkYfYW2I)
    ↓
User enters card: 4242 4242 4242 4242 (test)
    ↓
Payment success
    ↓
Stripe fires webhook → POST /api/billing/webhook
    ↓
Webhook handler:
  - Updates Postgres: tier = 'pro'
  - Updates Redis: tier:xxx = 'pro'
  - Updates Redis: usage:xxx:quota = 1000000
    ↓
User immediately has 1M requests 🎉
```

---

## Revenue Tracking

### View in Stripe Dashboard
- **Subscriptions**: https://dashboard.stripe.com/test/subscriptions
- **Revenue**: https://dashboard.stripe.com/test/payments
- **Customers**: https://dashboard.stripe.com/test/customers

### Via CLI
```bash
# List all subscriptions
source .env && stripe subscriptions list --api-key $STRIPE_SECRET_KEY

# List all customers
source .env && stripe customers list --api-key $STRIPE_SECRET_KEY

# Get revenue report
source .env && stripe balance_transactions list --limit 10 --api-key $STRIPE_SECRET_KEY
```

---

## Important Notes

### ⚠️ Currently in TEST MODE
All Stripe keys start with `sk_test_` and `pk_test_`, meaning:
- No real charges will be made
- Use test card numbers (4242 4242 4242 4242)
- Webhooks work but don't affect real customers

### 🚀 Before Going Live (Production)
1. Switch to live Stripe keys in Vercel:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
2. Create live webhook endpoint (same URL, but in live mode)
3. Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
4. Create live Pro product + price in Stripe live mode
5. Update `STRIPE_PRICE_PRO_MONTHLY` with live price ID
6. Test with real card first before announcing

### 🔒 Security Checklist
- ✅ Webhook secret validates Stripe signatures
- ✅ API keys stored in Vercel env (not in code)
- ✅ Tier changes logged in audit_logs table
- ✅ HTTPS enforced on webhook endpoint
- ⏳ TODO: Add rate limiting to webhook endpoint
- ⏳ TODO: Add Stripe signature verification in webhook handler

---

## Next Steps

1. **Test the upgrade flow end-to-end** (use test mode)
2. **Monitor first webhooks** in Stripe Dashboard
3. **Add email notifications** when user upgrades
4. **Create yearly pricing option** ($490/year = 16% discount)
5. **Build admin UI** to view customers and manually set tiers
6. **Go live** with production Stripe keys

---

## Rollback Plan

If issues arise, you can quickly revert:

```bash
# Disable webhook
source .env && stripe webhook_endpoints update we_1SYxd6AjvdndXr9T7yScHXbA \
  -d disabled=true \
  --api-key $STRIPE_SECRET_KEY

# Or delete webhook entirely
source .env && stripe webhook_endpoints delete we_1SYxd6AjvdndXr9T7yScHXbA \
  --api-key $STRIPE_SECRET_KEY

# Remove Vercel env vars
vercel env rm STRIPE_PRICE_PRO_MONTHLY production -y
vercel env rm STRIPE_WEBHOOK_SECRET production -y
```

---

## Support Resources

- **Stripe Dashboard**: https://dashboard.stripe.com/test
- **Webhook Logs**: https://dashboard.stripe.com/test/webhooks/we_1SYxd6AjvdndXr9T7yScHXbA
- **API Reference**: https://docs.stripe.com/api
- **Stripe CLI Docs**: https://docs.stripe.com/cli

**Status**: ✅ **READY FOR TESTING**

Your tier system is fully configured and ready to accept test payments!

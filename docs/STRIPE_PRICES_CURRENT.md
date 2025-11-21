# Stripe Price Configuration Summary

## Current Stripe Prices (TEST MODE)

### Monthly Recurring Plans:

| Tier | Price ID | Amount | Interval |
|------|----------|--------|----------|
| **Starter Monthly** | `price_1SL91wAjvdndXr9T4GLoIZBe` | **$14.99/mo** | month |
| **Pro Monthly** | `price_1SL94dAjvdndXr9TQ7OmKig0` | **$35.00/mo** | month |
| **Enterprise Monthly** | `price_1SL9WQAjvdndXr9TyC62zrWi` | **$99.00/mo** | month |

### One-Time/Yearly Plans:

| Tier | Price ID | Amount | Type |
|------|----------|--------|------|
| **Starter Yearly** | `price_1SL93MAjvdndXr9T5zToURHu` | **$160.00** | one-time |
| **Pro Yearly** | `price_1SL95GAjvdndXr9TqqjgMg1D` | **$375.00** | one-time |
| **Enterprise Yearly** | `price_1SL9WvAjvdndXr9TEMonGrcp` | **$999.00** | one-time |

---

## 🚨 Pricing Mismatch Detected

### **Landing Page Says:**
- Free: $0/mo
- Starter: $29/mo
- Pro: $99/mo
- Business: $299/mo
- Enterprise: Custom

### **Stripe Has:**
- Starter: **$14.99**/mo (50% lower)
- Pro: **$35**/mo (64% lower)
- Enterprise: **$99**/mo

### **Recommendation:**

**Option 1: Update Landing Page to Match Stripe** (Quick fix)
- Change pricing.html to show $14.99 / $35 / $99
- Update index.html stats accordingly

**Option 2: Update Stripe to Match Landing Page** (Preferred for positioning)
- Use Stripe CLI to create new prices at $29 / $99 / $299
- Better aligns with premium "Cognitive Memory OS" positioning
- Higher perceived value

**Option 3: Create "Business" Tier** (Missing)
- Add new product for $299/mo tier
- Keep current prices as-is for lower tiers

---

## Quick Fix Commands

### Create New Prices (Option 2):

```bash
# Set API key
export STRIPE_SECRET_KEY=sk_test_51SIdRdAjvdndXr9TxL7aZv25jdlpikfHw58kPEzjxeewPii5W5VJKHxV9GSHbOFOKKUFiiTxUujvsebFTL0W6Evi00XZSuwsWG

# Create $29/mo Starter
stripe prices create \
  --product=prod_THiStjAkXBip36 \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY

# Create $99/mo Pro
stripe prices create \
  --product=prod_THiVV8jxKxwBsb \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY

# Create Business tier product
stripe products create \
  --name="AgentCache Business" \
  --description="2M requests/mo with dedicated support and SSO/SAML" \
  --api-key=$STRIPE_SECRET_KEY

# Then create $299/mo price (get product ID from above)
stripe prices create \
  --product=PRODUCT_ID_FROM_ABOVE \
  --unit-amount=29900 \
  --currency=usd \
  --recurring[interval]=month \
  --api-key=$STRIPE_SECRET_KEY
```

---

## Update Checkout Code

Once you create new prices, update `/api/checkout.js`:

```javascript
const PRICE_IDS = {
  starter: 'price_NEW_STARTER_ID',     // $29/mo
  pro: 'price_NEW_PRO_ID',             // $99/mo
  business: 'price_NEW_BUSINESS_ID'    // $299/mo
};
```

---

## Next Action Required

**Decision needed from user:**

1. Should we raise prices to match the landing page ($29/$99/$299)?
2. OR lower landing page prices to match Stripe ($14.99/$35/$99)?
3. OR create "Business" tier and keep hybrid pricing?

**My recommendation:** Raise prices to $29/$99/$299 to match the premium "Cognitive Memory OS" positioning.

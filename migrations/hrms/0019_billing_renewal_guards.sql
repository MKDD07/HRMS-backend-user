CREATE TRIGGER billing_manual_renewal_guard BEFORE INSERT ON billing_orders
WHEN NEW.status IN ('creating','pending') AND EXISTS (
 SELECT 1 FROM billing_recurring r WHERE r.company_id=NEW.company_id AND r.mode=NEW.mode
 AND r.status NOT IN ('cancelled','completed','expired','failed'))
BEGIN SELECT RAISE(ABORT,'Turn off auto-renewal before making a manual purchase'); END;

CREATE TRIGGER billing_recurring_purchase_guard BEFORE INSERT ON billing_recurring
WHEN NEW.status NOT IN ('cancelled','completed','expired','failed') AND EXISTS (
 SELECT 1 FROM billing_orders o WHERE o.company_id=NEW.company_id AND o.mode=NEW.mode
 AND o.status IN ('creating','pending'))
BEGIN SELECT RAISE(ABORT,'Complete the pending purchase before enabling auto-renewal'); END;

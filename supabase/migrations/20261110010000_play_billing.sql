-- Google Play Billing (2026-11-10): the Play app sells Pro through Play
-- Billing; /api/play/verify and /api/play/rtdn mirror the state into the same
-- subscriptions rows the Stripe webhook writes. provider says which store owns
-- the row; play_purchase_token is the Play-side key (unique — one token binds
-- to exactly one user, replay protection in src/lib/site/play-sync.ts).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS play_purchase_token text,
  ADD COLUMN IF NOT EXISTS play_product_id text;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_play_token_key
  ON public.subscriptions (play_purchase_token)
  WHERE play_purchase_token IS NOT NULL;

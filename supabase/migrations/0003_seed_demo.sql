-- SPDX-License-Identifier: Apache-2.0
--
-- Demo seed data.
--
-- The public keys below are REAL outputs of the contract's deriveIssuerPk()
-- circuit, derived from clearly-labelled demo secret keys held in
-- lib/midnight/demo-issuer.ts. They correspond to no real healthcare provider
-- and carry no authority. See README, "Demo issuer".
--
-- Credentials are deliberately NOT seeded here. A credential's commitment must
-- exist in the on-chain Merkle tree for a proof to verify, so credentials are
-- created through the real issuance circuit when the app first runs. Seeding
-- them statically would produce rows that look valid but cannot be proven.

insert into issuers (name, public_key, is_demo) values
  ('Northside Community Clinic (DEMO)',
   '135ab17913ab570e026f2ee68d8faf03d25b545199107a4dc0a04b0747afb89e',
   true),
  ('Meridian Diagnostics Lab (DEMO)',
   'e60e389c375ccf8b07ddab0c71594f1bb60c96f37df98695bcb84ee4dad021fd',
   true),
  ('Harbour Health Insurance (DEMO)',
   'f6da1a0898ead393bf7b24033e5be1365d254a90aa9d4921bd1ba5599636273c',
   true)
on conflict (public_key) do nothing;

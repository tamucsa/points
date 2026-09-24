-- Parent is a dashboard role that can check in but never earns points.
-- Must be its own migration: Postgres cannot use a newly added enum value in
-- the same transaction as ALTER TYPE ... ADD VALUE.
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'parent';

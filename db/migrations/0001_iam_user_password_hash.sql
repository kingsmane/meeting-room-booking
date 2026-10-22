-- Login berbasis password: hash scrypt disimpan per user. Nullable, user tanpa hash tidak bisa login.
ALTER TABLE iam_user ADD COLUMN IF NOT EXISTS password_hash text;

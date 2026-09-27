ALTER TABLE companies ADD COLUMN logo_key TEXT;
ALTER TABLE companies ADD COLUMN welcome_text TEXT NOT NULL DEFAULT 'Your people. Your workplace. Together.';

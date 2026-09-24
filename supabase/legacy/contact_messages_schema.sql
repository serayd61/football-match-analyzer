-- Contact Messages Table
-- İletişim formundan gelen mesajları saklar

CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    type VARCHAR(50) DEFAULT 'general', -- general, bug, feature, complaint, praise
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    status VARCHAR(50) DEFAULT 'new', -- new, read, replied, archived
    admin_notes TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_type ON contact_messages(type);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);

-- updated_at otomatik güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_contact_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contact_messages_updated_at ON contact_messages;
CREATE TRIGGER trigger_contact_messages_updated_at
    BEFORE UPDATE ON contact_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_messages_updated_at();

-- RLS Policies
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Service role tam erişim
CREATE POLICY "Service role full access to contact_messages"
ON contact_messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anonim kullanıcılar sadece insert yapabilir (form gönderimi)
CREATE POLICY "Anyone can submit contact form"
ON contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Yorum: Bu SQL'i Supabase SQL Editor'da çalıştırın


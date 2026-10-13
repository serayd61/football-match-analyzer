import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabase';
import bcrypt from 'bcryptjs';

// Google ile giriş yalnız GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET tanımlıyken
// açılır; login sayfası düğmeyi aynı koşulla gösterir (lib/auth: googleEnabled).
// 2026-10-13'e kadar düğme vardı ama sağlayıcı yoktu: tıklayan /login?error=google'a
// dönüyordu, hiç kimse Google ile kayıt olamamıştı.
export const googleEnabled = (): boolean => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/**
 * OAuth ile gelen kullanıcıyı şifreli kayıtla aynı tablolara yazar: users
 * (webhook + checkout bu satırın id'siyle eşler), subscriptions (free),
 * profiles (trial_ends_at DB varsayılanı: now()+7 gün). Var olan e-posta ile
 * gelen Google girişi aynı hesaba bağlanır. users.id'yi döndürür.
 */
async function ensureOAuthUser(u: { email: string; name?: string | null; image?: string | null }): Promise<string | null> {
  const email = u.email.toLowerCase().trim();
  try {
    const { data: existing } = await supabaseAdmin.from('users').select('id').ilike('email', email).maybeSingle();
    if (existing?.id) return existing.id;
    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert({ email, name: u.name || null, image: u.image || null, email_verified: new Date().toISOString() })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[auth] oauth users insert failed', email, error?.message);
      return null;
    }
    await supabaseAdmin.from('subscriptions').insert({ user_id: created.id, status: 'free', plan: 'free' });
    return created.id;
  } catch (e) {
    console.error('[auth] ensureOAuthUser error', email, e);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleEnabled()
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Kullanıcıyı bul
          const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', credentials.email.toLowerCase().trim())
            .single();

          if (error || !user) {
            console.log('User not found:', credentials.email);
            return null;
          }

          // Şifre kontrolü - $2a$ ve $2b$ uyumluluğu
          const passwordHash = user.password_hash || '';
          let isValid = false;

          // Önce direkt dene
          try {
            isValid = await bcrypt.compare(credentials.password, passwordHash);
          } catch (e) {
            console.log('Direct compare failed, trying $2b$ conversion');
          }

          // $2a$ → $2b$ dönüşümü dene (pgcrypto uyumluluğu)
          if (!isValid && passwordHash.startsWith('$2a$')) {
            try {
              const convertedHash = '$2b$' + passwordHash.slice(4);
              isValid = await bcrypt.compare(credentials.password, convertedHash);
            } catch (e) {
              console.log('Converted compare also failed');
            }
          }

          if (!isValid) {
            console.log('Invalid password for:', credentials.email);
            return null;
          }

          console.log('Login successful:', credentials.email);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };

        } catch (err) {
          console.error('Auth error:', err);
          return null;
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Google: users + subscriptions satırı (şifreli kayıttaki /api/auth/register'ın karşılığı)
      if (account?.provider === 'google') {
        const id = await ensureOAuthUser({ email: user.email, name: user.name, image: user.image });
        if (!id) return false;
      }

      // Profil oluştur (yoksa)
      try {
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!existing) {
          // KART-ZORUNLU kural: kartsız kayıt 'free' başlar (günde 3 analiz).
          // 7 günlük trial yalnızca Stripe Checkout'tan (kart girilerek) başlar;
          // webhook profili 'active' yapar. Eski 'trial' başlangıcı 7 gün sonra
          // kullanıcıyı tamamen kilitliyordu (aktivasyon katili).
          await supabaseAdmin.from('profiles').insert({
            email: user.email,
            name: user.name || '',
            subscription_status: 'free',
            analyses_today: 0,
          });
        }
      } catch (e) {
        // Hata olsa bile login devam etsin
      }

      return true;
    },
    async session({ session, token }) {
      // users.id'yi oturuma taşı (checkout metadata, leaderboard vb. okur).
      if (session.user && token.id) (session.user as any).id = token.id;
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // Google'da user.id Google 'sub'ıdır; bizim users.id'yi e-postadan çöz.
        if (account?.provider === 'google' && user.email) {
          const { data } = await supabaseAdmin.from('users').select('id').ilike('email', user.email.toLowerCase().trim()).maybeSingle();
          if (data?.id) token.id = data.id;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

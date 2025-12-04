import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email ve şifre gerekli');
        }

        // Kullanıcıyı bul
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials.email)
          .single();

        if (error || !user) {
          throw new Error('Kullanıcı bulunamadı');
        }

        // Şifre kontrolü
        const isValid = await bcrypt.compare(credentials.password, user.password_hash || '');
        if (!isValid) {
          throw new Error('Geçersiz şifre');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }),
  ],
callbacks: {
  async signIn({ user }) {
    if (!user.email) return false;

    // Profil var mı kontrol et, yoksa oluştur
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!existingProfile) {
      // Yeni profil oluştur (7 gün trial)
      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 7);

      await supabaseAdmin.from('profiles').insert({
        email: user.email,
        name: user.name || '',
        subscription_status: 'trial',
        trial_start_date: new Date().toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        analyses_today: 0,
      });

      console.log(`✅ New profile created: ${user.email}`);
    }

    return true;
  },
    async session({ session, token }) {
      if (session.user?.email) {
        // Profil bilgilerini çek
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (profile) {
          const now = new Date();
          const trialEnds = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
          const isPro = profile.subscription_status === 'active';
          const isTrial = !isPro && trialEnds && trialEnds > now;

          (session.user as any).profile = {
            isPro,
            isTrial,
            trialDaysLeft: isTrial ? Math.ceil((trialEnds!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
            subscriptionStatus: profile.subscription_status,
          };
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 gün
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper: Subscription aktif mi?
export async function isSubscriptionActive(email: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('email', email)
    .single();

  if (!profile) return false;

  const now = new Date();

  // Pro aktif mi?
  if (profile.subscription_status === 'active') {
    return true;
  }

  // Trial aktif mi?
  if (profile.trial_ends_at) {
    return new Date(profile.trial_ends_at) > now;
  }

  return false;
}

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabaseAdmin } from './supabase';
import bcrypt from 'bcryptjs';

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

        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', credentials.email)
          .single();

        if (error || !user) {
          throw new Error('Kullanıcı bulunamadı');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash || '');
        if (!isValid) {
          throw new Error('Geçersiz şifre');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      }
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .single();

        if (user) {
          (session.user as any).id = user.id;

          const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

          (session.user as any).subscription = subscription;
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!subscription) return false;

  const now = new Date();

  if (subscription.status === 'trialing' && subscription.trial_end) {
    return new Date(subscription.trial_end) > now;
  }

  if (subscription.status === 'active' && subscription.current_period_end) {
    return new Date(subscription.current_period_end) > now;
  }

  return false;
}
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Kullanıcıyı kontrol et
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email)
          .single();

        if (user && user.password === credentials.password) {
          return { id: user.id, email: user.email, name: user.name };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (user?.email) {
        // Profil var mı kontrol et
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .single();

        // Yoksa oluştur (7 gün trial ile)
        if (!existingProfile) {
          const trialEnds = new Date();
          trialEnds.setDate(trialEnds.getDate() + 7);

          await supabase.from('profiles').insert({
            email: user.email,
            name: user.name || '',
            subscription_status: 'trial',
            trial_start_date: new Date().toISOString(),
            trial_ends_at: trialEnds.toISOString(),
            analyses_today: 0,
          });

          console.log(`✅ New profile created for: ${user.email}`);
        }
      }
      return true;
    },
    async session({ session, token }) {
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

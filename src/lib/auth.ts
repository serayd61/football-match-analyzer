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
    async signIn({ user }) {
      if (!user.email) return false;

      // Profil oluştur (yoksa)
      try {
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!existing) {
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
        }
      } catch (e) {
        // Hata olsa bile login devam etsin
      }

      return true;
    },
    async session({ session }) {
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
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

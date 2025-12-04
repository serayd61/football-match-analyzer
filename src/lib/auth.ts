import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Supabase client - her seferinde yeni oluştur
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    console.error('❌ Supabase credentials missing!');
    console.error('URL:', url ? 'exists' : 'MISSING');
    console.error('KEY:', key ? 'exists' : 'MISSING');
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('🔐 === AUTH START ===');
        
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log('❌ Missing email or password');
            return null;
          }

          console.log('📧 Email:', credentials.email);

          const supabase = getSupabase();

          // Kullanıcıyı bul
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          if (error) {
            console.log('❌ Supabase error:', error.message);
            return null;
          }

          if (!user) {
            console.log('❌ User not found');
            return null;
          }

          console.log('✅ User found:', user.email);
          console.log('🔑 Hash exists:', !!user.password_hash);
          console.log('🔑 Hash prefix:', user.password_hash?.substring(0, 10));

          // Şifre kontrolü - bcrypt ile
          let isValid = false;
          
          try {
            isValid = await bcrypt.compare(credentials.password, user.password_hash || '');
            console.log('🔐 Bcrypt compare result:', isValid);
          } catch (bcryptError) {
            console.error('❌ Bcrypt error:', bcryptError);
            
            // pgcrypto hash için alternatif kontrol
            // pgcrypto $2a$ kullanır, bcryptjs $2b$ bekler
            // Manuel kontrol deneyelim
            if (user.password_hash?.startsWith('$2a$')) {
              const hashWithB = user.password_hash.replace('$2a$', '$2b$');
              try {
                isValid = await bcrypt.compare(credentials.password, hashWithB);
                console.log('🔐 Bcrypt compare with $2b$:', isValid);
              } catch (e) {
                console.error('❌ Second bcrypt attempt failed:', e);
              }
            }
          }

          if (!isValid) {
            console.log('❌ Invalid password');
            return null;
          }

          console.log('✅ === AUTH SUCCESS ===');
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
          
        } catch (err) {
          console.error('❌ Auth error:', err);
          return null;
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      console.log('📝 SignIn callback for:', user.email);
      
      if (!user.email) return false;

      try {
        const supabase = getSupabase();
        
        // Profil var mı kontrol et
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!existingProfile) {
          // Yeni profil oluştur (7 gün trial)
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

          console.log('✅ New profile created for:', user.email);
        } else {
          console.log('✅ Profile exists for:', user.email);
        }
      } catch (err) {
        console.error('❌ Profile creation error:', err);
        // Profil oluşturma hatası login'i engellemesin
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
  debug: true, // Debug modunu aç
};

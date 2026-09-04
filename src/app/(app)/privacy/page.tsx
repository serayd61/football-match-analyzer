'use client';

import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Shield } from 'lucide-react';

// Son güncelleme tarihi — değişiklik yaparken elle güncelle.
const LAST_UPDATED = '2026-06-28';

type Section = { h: string; p: string[] };

export default function PrivacyPage() {
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: 'Gizlilik Politikası',
      updated: 'Son güncelleme',
      intro:
        'footballanalytics.pro ("Hizmet", "biz"), İsviçre merkezli swissdigital.life tarafından işletilmektedir. Bu politika, hangi kişisel verileri topladığımızı, neden topladığımızı ve haklarınızı açıklar. Gizliliğinize saygı duyuyoruz ve verilerinizi yalnızca hizmeti sunmak için kullanırız.',
      contactTitle: 'İletişim',
      contactText: 'Gizlilikle ilgili her türlü soru veya talep için bize ulaşın:',
      back: 'Ana Sayfaya Dön',
      sections: [
        { h: '1. Topladığımız Veriler', p: [
          'Hesap bilgileri: kayıt sırasında verdiğiniz e-posta adresi ve adınız.',
          'Reklam/iletişim formu: Google reklamlarımızdaki formu doldurursanız adınız ve e-posta adresiniz.',
          'Ödeme bilgileri: abonelik ödemeleri Stripe üzerinden işlenir; kart bilgilerinizi biz saklamayız, yalnızca abonelik durumunu tutarız.',
          'Kullanım verileri: sayfa görüntüleme, tıklama ve cihaz/tarayıcı bilgisi gibi anonim analiz verileri (Google Analytics).',
        ] },
        { h: '2. Verileri Nasıl Kullanırız', p: [
          'Hizmeti sunmak, hesabınızı yönetmek ve abonelikleri işlemek.',
          'Talep ettiğiniz ücretsiz deneme bağlantısını ve hizmetle ilgili e-postaları göndermek.',
          'Hizmeti iyileştirmek ve performansı ölçmek (toplu/anonim analiz).',
          'Yasal yükümlülüklere uymak.',
        ] },
        { h: '3. Yasal Dayanak (GDPR)', p: [
          'Sözleşmenin ifası: hesabınızı ve aboneliğinizi yönetmek.',
          'Açık rıza: pazarlama e-postaları ve form gönderimleri (istediğiniz zaman geri çekebilirsiniz).',
          'Meşru menfaat: hizmet güvenliği ve iyileştirilmesi.',
        ] },
        { h: '4. Verileri Paylaştığımız Hizmet Sağlayıcılar', p: [
          'Supabase — veritabanı ve kimlik doğrulama.',
          'Stripe — ödeme işleme.',
          'Google (Analytics & Ads) — analiz ve reklam ölçümü.',
          'Resend — e-posta gönderimi.',
          'Vercel — barındırma.',
          'Bu sağlayıcılar verilerinizi yalnızca bizim adımıza ve bu politikaya uygun olarak işler. Verilerinizi asla satmayız.',
        ] },
        { h: '5. Çerezler ve Analiz', p: [
          'Temel çerezleri oturum yönetimi için kullanırız. Google Analytics, anonim kullanım istatistikleri için çerez kullanır.',
          'Tarayıcı ayarlarınızdan çerezleri reddedebilir veya silebilirsiniz.',
        ] },
        { h: '6. Veri Saklama', p: [
          'Kişisel verilerinizi yalnızca hesabınız aktif olduğu sürece veya yasal olarak gerekli olduğu sürece saklarız. Hesabınızı silmek istediğinizde verileriniz makul bir süre içinde silinir.',
        ] },
        { h: '7. Haklarınız', p: [
          'Verilerinize erişme, düzeltme, silme ve işlemeyi kısıtlama hakkına sahipsiniz.',
          'Veri taşınabilirliği ve işlemeye itiraz hakkınız vardır.',
          'Pazarlama e-postalarından her e-postadaki abonelikten çık bağlantısıyla çıkabilirsiniz.',
          'Haklarınızı kullanmak için aşağıdaki e-posta adresinden bize ulaşın.',
        ] },
        { h: '8. Uluslararası Aktarımlar', p: [
          'Sağlayıcılarımız verileri AB/İsviçre dışında işleyebilir. Bu durumda uygun güvenceler (ör. standart sözleşme maddeleri) uygulanır.',
        ] },
        { h: '9. Çocukların Gizliliği', p: [
          'Hizmet 18 yaşından küçükler için tasarlanmamıştır ve bilerek çocuklardan veri toplamayız.',
        ] },
        { h: '10. Bu Politikadaki Değişiklikler', p: [
          'Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde sizi bilgilendiririz ve güncel sürümü her zaman bu sayfada yayınlarız.',
        ] },
      ] as Section[],
    },
    en: {
      title: 'Privacy Policy',
      updated: 'Last updated',
      intro:
        'footballanalytics.pro ("the Service", "we") is operated by swissdigital.life, based in Switzerland. This policy explains what personal data we collect, why we collect it, and your rights. We respect your privacy and use your data only to provide the Service.',
      contactTitle: 'Contact',
      contactText: 'For any privacy questions or requests, reach us at:',
      back: 'Back to Home',
      sections: [
        { h: '1. Data We Collect', p: [
          'Account information: the email address and name you provide when registering.',
          'Ad/contact form: if you complete the form in our Google ads, your name and email address.',
          'Payment information: subscription payments are processed by Stripe; we do not store your card details, only your subscription status.',
          'Usage data: anonymous analytics such as page views, clicks and device/browser information (Google Analytics).',
        ] },
        { h: '2. How We Use Data', p: [
          'To provide the Service, manage your account and process subscriptions.',
          'To send the free-trial link you requested and Service-related emails.',
          'To improve the Service and measure performance (aggregate/anonymous analytics).',
          'To comply with legal obligations.',
        ] },
        { h: '3. Legal Basis (GDPR)', p: [
          'Performance of a contract: managing your account and subscription.',
          'Consent: marketing emails and form submissions (you can withdraw at any time).',
          'Legitimate interest: securing and improving the Service.',
        ] },
        { h: '4. Service Providers We Share Data With', p: [
          'Supabase — database and authentication.',
          'Stripe — payment processing.',
          'Google (Analytics & Ads) — analytics and ad measurement.',
          'Resend — email delivery.',
          'Vercel — hosting.',
          'These providers process your data only on our behalf and in line with this policy. We never sell your data.',
        ] },
        { h: '5. Cookies and Analytics', p: [
          'We use essential cookies for session management. Google Analytics uses cookies for anonymous usage statistics.',
          'You can refuse or delete cookies in your browser settings.',
        ] },
        { h: '6. Data Retention', p: [
          'We keep your personal data only while your account is active or as legally required. When you ask to delete your account, your data is removed within a reasonable period.',
        ] },
        { h: '7. Your Rights', p: [
          'You have the right to access, correct, delete and restrict the processing of your data.',
          'You have the right to data portability and to object to processing.',
          'You can opt out of marketing emails via the unsubscribe link in every email.',
          'To exercise your rights, contact us at the email below.',
        ] },
        { h: '8. International Transfers', p: [
          'Our providers may process data outside the EU/Switzerland. Where this happens, appropriate safeguards (e.g. standard contractual clauses) apply.',
        ] },
        { h: '9. Children’s Privacy', p: [
          'The Service is not intended for anyone under 18, and we do not knowingly collect data from children.',
        ] },
        { h: '10. Changes to This Policy', p: [
          'We may update this policy from time to time. We will notify you of material changes and always publish the current version on this page.',
        ] },
      ] as Section[],
    },
    de: {
      title: 'Datenschutzerklärung',
      updated: 'Zuletzt aktualisiert',
      intro:
        'footballanalytics.pro ("der Dienst", "wir") wird von swissdigital.life mit Sitz in der Schweiz betrieben. Diese Erklärung beschreibt, welche personenbezogenen Daten wir erheben, warum wir sie erheben und welche Rechte Sie haben. Wir respektieren Ihre Privatsphäre und nutzen Ihre Daten ausschließlich zur Bereitstellung des Dienstes.',
      contactTitle: 'Kontakt',
      contactText: 'Bei Fragen oder Anliegen zum Datenschutz erreichen Sie uns unter:',
      back: 'Zurück zur Startseite',
      sections: [
        { h: '1. Welche Daten wir erheben', p: [
          'Kontodaten: die E-Mail-Adresse und der Name, die Sie bei der Registrierung angeben.',
          'Anzeigen-/Kontaktformular: Wenn Sie das Formular in unseren Google-Anzeigen ausfüllen, Ihren Namen und Ihre E-Mail-Adresse.',
          'Zahlungsdaten: Abonnementzahlungen werden über Stripe abgewickelt; wir speichern keine Kartendaten, nur Ihren Abonnementstatus.',
          'Nutzungsdaten: anonyme Analysedaten wie Seitenaufrufe, Klicks und Geräte-/Browserinformationen (Google Analytics).',
        ] },
        { h: '2. Wie wir Daten verwenden', p: [
          'Zur Bereitstellung des Dienstes, Verwaltung Ihres Kontos und Abwicklung von Abonnements.',
          'Zum Versand des angeforderten Testlinks und dienstbezogener E-Mails.',
          'Zur Verbesserung des Dienstes und Messung der Leistung (aggregierte/anonyme Analysen).',
          'Zur Erfüllung gesetzlicher Pflichten.',
        ] },
        { h: '3. Rechtsgrundlage (DSGVO)', p: [
          'Vertragserfüllung: Verwaltung Ihres Kontos und Abonnements.',
          'Einwilligung: Marketing-E-Mails und Formularübermittlungen (jederzeit widerrufbar).',
          'Berechtigtes Interesse: Sicherung und Verbesserung des Dienstes.',
        ] },
        { h: '4. Dienstleister, mit denen wir Daten teilen', p: [
          'Supabase — Datenbank und Authentifizierung.',
          'Stripe — Zahlungsabwicklung.',
          'Google (Analytics & Ads) — Analyse und Anzeigenmessung.',
          'Resend — E-Mail-Versand.',
          'Vercel — Hosting.',
          'Diese Anbieter verarbeiten Ihre Daten nur in unserem Auftrag und gemäß dieser Erklärung. Wir verkaufen Ihre Daten niemals.',
        ] },
        { h: '5. Cookies und Analyse', p: [
          'Wir verwenden essenzielle Cookies für die Sitzungsverwaltung. Google Analytics verwendet Cookies für anonyme Nutzungsstatistiken.',
          'Sie können Cookies in Ihren Browsereinstellungen ablehnen oder löschen.',
        ] },
        { h: '6. Speicherdauer', p: [
          'Wir speichern Ihre personenbezogenen Daten nur, solange Ihr Konto aktiv ist oder gesetzlich erforderlich. Wenn Sie die Löschung Ihres Kontos verlangen, werden Ihre Daten innerhalb einer angemessenen Frist entfernt.',
        ] },
        { h: '7. Ihre Rechte', p: [
          'Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer Daten.',
          'Sie haben das Recht auf Datenübertragbarkeit und Widerspruch gegen die Verarbeitung.',
          'Sie können Marketing-E-Mails über den Abmeldelink in jeder E-Mail abbestellen.',
          'Zur Ausübung Ihrer Rechte kontaktieren Sie uns unter der untenstehenden E-Mail-Adresse.',
        ] },
        { h: '8. Internationale Übermittlungen', p: [
          'Unsere Anbieter können Daten außerhalb der EU/Schweiz verarbeiten. In diesem Fall gelten geeignete Garantien (z. B. Standardvertragsklauseln).',
        ] },
        { h: '9. Datenschutz für Kinder', p: [
          'Der Dienst ist nicht für Personen unter 18 Jahren bestimmt, und wir erheben wissentlich keine Daten von Kindern.',
        ] },
        { h: '10. Änderungen dieser Erklärung', p: [
          'Wir können diese Erklärung von Zeit zu Zeit aktualisieren. Bei wesentlichen Änderungen informieren wir Sie und veröffentlichen die aktuelle Fassung stets auf dieser Seite.',
        ] },
      ] as Section[],
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-bold text-content tracking-tight flex items-center gap-2">
            <Shield size={28} className="text-brand-400" /> {l.title}
          </h1>
          <p className="text-content-subtle text-sm mt-3">{l.updated}: {LAST_UPDATED}</p>
          <p className="text-content-muted text-base mt-4 leading-relaxed">{l.intro}</p>
        </motion.div>

        <div className="space-y-6">
          {l.sections.map((s, idx) => (
            <motion.section
              key={idx}
              className="fa-card p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
            >
              <h2 className="text-lg font-semibold text-content mb-3">{s.h}</h2>
              <ul className="space-y-2">
                {s.p.map((para, i) => (
                  <li key={i} className="text-content-muted text-sm leading-relaxed flex gap-2">
                    <span className="text-brand-400 mt-1.5 w-1 h-1 rounded-full bg-brand-400 shrink-0" />
                    <span>{para}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}

          <div className="fa-card p-6">
            <h2 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
              <Mail size={18} className="text-brand-400" /> {l.contactTitle}
            </h2>
            <p className="text-content-muted text-sm mb-2">{l.contactText}</p>
            <a href="mailto:info@swissdigital.life" className="text-brand-400 hover:text-brand-300 text-sm">info@swissdigital.life</a>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content transition-colors">
            <ArrowLeft size={15} /> {l.back}
          </Link>
        </div>
      </div>
    </div>
  );
}

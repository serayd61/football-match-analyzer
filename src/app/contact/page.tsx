'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

type FeedbackType = 'general' | 'bug' | 'feature' | 'complaint' | 'praise';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    type: 'general' as FeedbackType,
    message: '',
    rating: 0,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: '📬 İletişim & Geri Bildirim',
      subtitle: 'Görüşleriniz bizim için değerli! Size nasıl yardımcı olabiliriz?',
      name: 'Adınız',
      namePlaceholder: 'Adınızı girin',
      email: 'E-posta',
      emailPlaceholder: 'ornek@email.com',
      subject: 'Konu',
      subjectPlaceholder: 'Mesajınızın konusu',
      type: 'Geri Bildirim Türü',
      types: {
        general: '💬 Genel Soru',
        bug: '🐛 Hata Bildirimi',
        feature: '💡 Özellik Önerisi',
        complaint: '😔 Şikayet',
        praise: '⭐ Övgü',
      },
      message: 'Mesajınız',
      messagePlaceholder: 'Mesajınızı buraya yazın...',
      rating: 'Deneyiminizi Puanlayın',
      send: 'Gönder',
      sending: 'Gönderiliyor...',
      success: '✅ Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.',
      error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      required: 'Bu alan zorunludur',
      contact: {
        title: '📞 Diğer İletişim Kanalları',
        email: 'E-posta',
        website: 'Web Sitesi',
        response: 'Ortalama yanıt süresi: 24 saat',
      },
      faq: {
        title: '❓ Sık Sorulan Sorular',
        items: [
          { q: 'Pro üyelik nasıl çalışıyor?', a: '7 gün ücretsiz deneme sonrası aylık abonelik başlar.' },
          { q: 'AI tahminleri ne kadar doğru?', a: 'AI Performans sayfamızda gerçek zamanlı istatistikleri görebilirsiniz.' },
          { q: 'İptal nasıl yapılır?', a: 'Profil > Ayarlar > Abonelik bölümünden anında iptal edebilirsiniz.' },
        ],
      },
    },
    en: {
      title: '📬 Contact & Feedback',
      subtitle: 'Your feedback is valuable to us! How can we help you?',
      name: 'Your Name',
      namePlaceholder: 'Enter your name',
      email: 'Email',
      emailPlaceholder: 'example@email.com',
      subject: 'Subject',
      subjectPlaceholder: 'Subject of your message',
      type: 'Feedback Type',
      types: {
        general: '💬 General Question',
        bug: '🐛 Bug Report',
        feature: '💡 Feature Request',
        complaint: '😔 Complaint',
        praise: '⭐ Praise',
      },
      message: 'Your Message',
      messagePlaceholder: 'Write your message here...',
      rating: 'Rate Your Experience',
      send: 'Send',
      sending: 'Sending...',
      success: '✅ Your message was sent successfully! We will get back to you soon.',
      error: 'An error occurred. Please try again.',
      required: 'This field is required',
      contact: {
        title: '📞 Other Contact Channels',
        email: 'Email',
        website: 'Website',
        response: 'Average response time: 24 hours',
      },
      faq: {
        title: '❓ Frequently Asked Questions',
        items: [
          { q: 'How does Pro membership work?', a: 'Monthly subscription starts after 7-day free trial.' },
          { q: 'How accurate are AI predictions?', a: 'You can see real-time statistics on our AI Performance page.' },
          { q: 'How to cancel?', a: 'You can cancel instantly from Profile > Settings > Subscription.' },
        ],
      },
    },
    de: {
      title: '📬 Kontakt & Feedback',
      subtitle: 'Ihr Feedback ist wertvoll für uns! Wie können wir Ihnen helfen?',
      name: 'Ihr Name',
      namePlaceholder: 'Geben Sie Ihren Namen ein',
      email: 'E-Mail',
      emailPlaceholder: 'beispiel@email.com',
      subject: 'Betreff',
      subjectPlaceholder: 'Betreff Ihrer Nachricht',
      type: 'Feedback-Typ',
      types: {
        general: '💬 Allgemeine Frage',
        bug: '🐛 Fehlerbericht',
        feature: '💡 Funktionswunsch',
        complaint: '😔 Beschwerde',
        praise: '⭐ Lob',
      },
      message: 'Ihre Nachricht',
      messagePlaceholder: 'Schreiben Sie Ihre Nachricht hier...',
      rating: 'Bewerten Sie Ihre Erfahrung',
      send: 'Senden',
      sending: 'Wird gesendet...',
      success: '✅ Ihre Nachricht wurde erfolgreich gesendet! Wir melden uns bald.',
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      required: 'Dieses Feld ist erforderlich',
      contact: {
        title: '📞 Andere Kontaktkanäle',
        email: 'E-Mail',
        website: 'Webseite',
        response: 'Durchschnittliche Antwortzeit: 24 Stunden',
      },
      faq: {
        title: '❓ Häufig gestellte Fragen',
        items: [
          { q: 'Wie funktioniert die Pro-Mitgliedschaft?', a: 'Nach 7-tägiger Testphase beginnt das monatliche Abo.' },
          { q: 'Wie genau sind die KI-Vorhersagen?', a: 'Echtzeit-Statistiken finden Sie auf unserer KI-Leistungsseite.' },
          { q: 'Wie kann ich kündigen?', a: 'Sofortige Kündigung unter Profil > Einstellungen > Abonnement.' },
        ],
      },
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setFormData({
          name: '',
          email: '',
          subject: '',
          type: 'general',
          message: '',
          rating: 0,
        });
      } else {
        setError(data.error || l.error);
      }
    } catch (err) {
      setError(l.error);
    } finally {
      setLoading(false);
    }
  };

  const StarRating = () => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setFormData({ ...formData, rating: star })}
          className={`text-3xl transition-all hover:scale-110 ${
            formData.rating >= star ? 'text-yellow-400' : 'text-gray-600'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-gray-900">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{l.title}</h1>
          <p className="text-gray-400 text-lg">{l.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 md:p-8">
              {/* Success Message */}
              {success && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl">
                  <p className="text-green-400">{l.success}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
                  <p className="text-red-400">{error}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">{l.name} *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={l.namePlaceholder}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">{l.email} *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={l.emailPlaceholder}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Feedback Type */}
              <div className="mt-6">
                <label className="block text-gray-300 mb-2 font-medium">{l.type}</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(l.types) as FeedbackType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type })}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        formData.type === type
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {l.types[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="mt-6">
                <label className="block text-gray-300 mb-2 font-medium">{l.subject} *</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder={l.subjectPlaceholder}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Message */}
              <div className="mt-6">
                <label className="block text-gray-300 mb-2 font-medium">{l.message} *</label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={l.messagePlaceholder}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Rating */}
              <div className="mt-6">
                <label className="block text-gray-300 mb-3 font-medium">{l.rating}</label>
                <StarRating />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`mt-8 w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {l.sending}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    📨 {l.send}
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">{l.contact.title}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <p className="text-gray-400 text-sm">{l.contact.email}</p>
                    <a href="mailto:info@swissdigital.life" className="text-blue-400 hover:underline">
                      info@swissdigital.life
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <p className="text-gray-400 text-sm">{l.contact.website}</p>
                    <a href="https://swissdigital.life" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      swissdigital.life
                    </a>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-gray-400 text-sm flex items-center gap-2">
                    <span>⏱️</span> {l.contact.response}
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">{l.faq.title}</h3>
              <div className="space-y-4">
                {l.faq.items.map((item, idx) => (
                  <div key={idx} className="border-b border-gray-700 pb-4 last:border-0 last:pb-0">
                    <p className="text-white font-medium mb-1">{item.q}</p>
                    <p className="text-gray-400 text-sm">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">🔗 {lang === 'tr' ? 'Hızlı Linkler' : 'Quick Links'}</h3>
              <div className="space-y-2">
                <Link href="/ai-performance" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50">
                  <span>🧠</span> AI {lang === 'tr' ? 'Performans' : 'Performance'}
                </Link>
                <Link href="/pricing" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50">
                  <span>💎</span> {lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}
                </Link>
                <Link href="/settings" className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50">
                  <span>⚙️</span> {lang === 'tr' ? 'Ayarlar' : 'Settings'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            ← {lang === 'tr' ? 'Ana Sayfaya Dön' : lang === 'de' ? 'Zurück zur Startseite' : 'Back to Home'}
          </Link>
        </div>
      </div>
    </div>
  );
}


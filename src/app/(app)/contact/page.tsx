'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import SiteNav from '@/components/SiteNav';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, Send, Mail, Globe, Clock, ArrowLeft, Brain, Gem, Settings as SettingsIcon } from 'lucide-react';
import { Spinner } from '@/components/ui';

type FeedbackType = 'general' | 'bug' | 'feature' | 'complaint' | 'praise';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '', email: '', subject: '', type: 'general' as FeedbackType, message: '', rating: 0,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: 'İletişim & Geri Bildirim', subtitle: 'Görüşleriniz bizim için değerli! Size nasıl yardımcı olabiliriz?',
      name: 'Adınız', namePlaceholder: 'Adınızı girin', email: 'E-posta', emailPlaceholder: 'ornek@email.com',
      subject: 'Konu', subjectPlaceholder: 'Mesajınızın konusu', type: 'Geri Bildirim Türü',
      types: { general: '💬 Genel Soru', bug: '🐛 Hata Bildirimi', feature: '💡 Özellik Önerisi', complaint: '😔 Şikayet', praise: '⭐ Övgü' },
      message: 'Mesajınız', messagePlaceholder: 'Mesajınızı buraya yazın...', rating: 'Deneyiminizi Puanlayın',
      send: 'Gönder', sending: 'Gönderiliyor...', success: '✅ Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.',
      error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      contact: { title: 'Diğer İletişim Kanalları', email: 'E-posta', website: 'Web Sitesi', response: 'Ortalama yanıt süresi: 24 saat' },
      faq: { title: 'Sık Sorulan Sorular', items: [
        { q: 'Pro üyelik nasıl çalışıyor?', a: '7 gün ücretsiz deneme sonrası aylık abonelik başlar.' },
        { q: 'AI tahminleri ne kadar doğru?', a: 'AI Performans sayfamızda gerçek zamanlı istatistikleri görebilirsiniz.' },
        { q: 'İptal nasıl yapılır?', a: 'Profil > Ayarlar > Abonelik bölümünden anında iptal edebilirsiniz.' },
      ] },
      quickLinks: 'Hızlı Linkler', perf: 'Performans', pricing: 'Fiyatlandırma', settings: 'Ayarlar', back: 'Ana Sayfaya Dön',
    },
    en: {
      title: 'Contact & Feedback', subtitle: 'Your feedback is valuable to us! How can we help you?',
      name: 'Your Name', namePlaceholder: 'Enter your name', email: 'Email', emailPlaceholder: 'example@email.com',
      subject: 'Subject', subjectPlaceholder: 'Subject of your message', type: 'Feedback Type',
      types: { general: '💬 General Question', bug: '🐛 Bug Report', feature: '💡 Feature Request', complaint: '😔 Complaint', praise: '⭐ Praise' },
      message: 'Your Message', messagePlaceholder: 'Write your message here...', rating: 'Rate Your Experience',
      send: 'Send', sending: 'Sending...', success: '✅ Your message was sent successfully! We will get back to you soon.',
      error: 'An error occurred. Please try again.',
      contact: { title: 'Other Contact Channels', email: 'Email', website: 'Website', response: 'Average response time: 24 hours' },
      faq: { title: 'Frequently Asked Questions', items: [
        { q: 'How does Pro membership work?', a: 'Monthly subscription starts after 7-day free trial.' },
        { q: 'How accurate are AI predictions?', a: 'You can see real-time statistics on our AI Performance page.' },
        { q: 'How to cancel?', a: 'You can cancel instantly from Profile > Settings > Subscription.' },
      ] },
      quickLinks: 'Quick Links', perf: 'Performance', pricing: 'Pricing', settings: 'Settings', back: 'Back to Home',
    },
    de: {
      title: 'Kontakt & Feedback', subtitle: 'Ihr Feedback ist wertvoll für uns! Wie können wir Ihnen helfen?',
      name: 'Ihr Name', namePlaceholder: 'Geben Sie Ihren Namen ein', email: 'E-Mail', emailPlaceholder: 'beispiel@email.com',
      subject: 'Betreff', subjectPlaceholder: 'Betreff Ihrer Nachricht', type: 'Feedback-Typ',
      types: { general: '💬 Allgemeine Frage', bug: '🐛 Fehlerbericht', feature: '💡 Funktionswunsch', complaint: '😔 Beschwerde', praise: '⭐ Lob' },
      message: 'Ihre Nachricht', messagePlaceholder: 'Schreiben Sie Ihre Nachricht hier...', rating: 'Bewerten Sie Ihre Erfahrung',
      send: 'Senden', sending: 'Wird gesendet...', success: '✅ Ihre Nachricht wurde erfolgreich gesendet! Wir melden uns bald.',
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      contact: { title: 'Andere Kontaktkanäle', email: 'E-Mail', website: 'Webseite', response: 'Durchschnittliche Antwortzeit: 24 Stunden' },
      faq: { title: 'Häufig gestellte Fragen', items: [
        { q: 'Wie funktioniert die Pro-Mitgliedschaft?', a: 'Nach 7-tägiger Testphase beginnt das monatliche Abo.' },
        { q: 'Wie genau sind die KI-Vorhersagen?', a: 'Echtzeit-Statistiken finden Sie auf unserer KI-Leistungsseite.' },
        { q: 'Wie kann ich kündigen?', a: 'Sofortige Kündigung unter Profil > Einstellungen > Abonnement.' },
      ] },
      quickLinks: 'Schnelllinks', perf: 'Leistung', pricing: 'Preise', settings: 'Einstellungen', back: 'Zurück zur Startseite',
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
        setFormData({ name: '', email: '', subject: '', type: 'general', message: '', rating: 0 });
      } else {
        setError(data.error || l.error);
      }
    } catch (err) {
      setError(l.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fa-shell min-h-screen">
      <SiteNav />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-bold text-content tracking-tight">📬 {l.title}</h1>
          <p className="text-content-muted text-lg mt-3">{l.subtitle}</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <motion.form onSubmit={handleSubmit} className="fa-card p-6 md:p-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {success && <div className="mb-6 p-4 rounded-xl bg-positive/10 border border-positive/30 text-positive text-sm">{l.success}</div>}
              {error && <div className="mb-6 p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative text-sm">{error}</div>}

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-2">{l.name} *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={l.namePlaceholder} className="fa-input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-2">{l.email} *</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={l.emailPlaceholder} className="fa-input w-full" />
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-content-muted mb-2">{l.type}</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(l.types) as FeedbackType[]).map((type) => (
                    <button key={type} type="button" onClick={() => setFormData({ ...formData, type })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${formData.type === type ? 'border-brand-500/50 bg-brand-500/10 text-brand-300' : 'border-line bg-surface-3 text-content-muted hover:text-content'}`}>
                      {l.types[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-content-muted mb-2">{l.subject} *</label>
                <input type="text" required value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder={l.subjectPlaceholder} className="fa-input w-full" />
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-content-muted mb-2">{l.message} *</label>
                <textarea required rows={5} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={l.messagePlaceholder} className="fa-input w-full resize-none" />
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-content-muted mb-3">{l.rating}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setFormData({ ...formData, rating: star })}
                      className={`transition-all hover:scale-110 ${formData.rating >= star ? 'text-amber-400' : 'text-content-subtle'}`}>
                      <Star size={26} fill={formData.rating >= star ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="fa-btn fa-btn-primary fa-btn-lg w-full mt-8">
                {loading ? <><Spinner size={16} /> {l.sending}</> : <><Send size={16} /> {l.send}</>}
              </button>
            </motion.form>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="fa-card p-6">
              <h3 className="text-base font-semibold text-content mb-4">📞 {l.contact.title}</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-surface-3 border border-line text-brand-400"><Mail size={16} /></span>
                  <div>
                    <p className="text-content-subtle text-xs">{l.contact.email}</p>
                    <a href="mailto:info@swissdigital.life" className="text-brand-400 hover:text-brand-300 text-sm">info@swissdigital.life</a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-surface-3 border border-line text-brand-400"><Globe size={16} /></span>
                  <div>
                    <p className="text-content-subtle text-xs">{l.contact.website}</p>
                    <a href="https://swissdigital.life" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 text-sm">swissdigital.life</a>
                  </div>
                </div>
                <div className="pt-3 border-t border-line">
                  <p className="text-content-subtle text-sm flex items-center gap-2"><Clock size={14} /> {l.contact.response}</p>
                </div>
              </div>
            </div>

            <div className="fa-card p-6">
              <h3 className="text-base font-semibold text-content mb-4">❓ {l.faq.title}</h3>
              <div className="space-y-4">
                {l.faq.items.map((item, idx) => (
                  <div key={idx} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <p className="text-content font-medium text-sm mb-1">{item.q}</p>
                    <p className="text-content-subtle text-sm">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="fa-card p-6">
              <h3 className="text-base font-semibold text-content mb-4">🔗 {l.quickLinks}</h3>
              <div className="space-y-1">
                <Link href="/ai-performance" className="flex items-center gap-2.5 text-sm text-content-muted hover:text-content transition-colors p-2 rounded-lg hover:bg-surface-3"><Brain size={15} className="text-brand-400" /> AI {l.perf}</Link>
                <Link href="/pricing" className="flex items-center gap-2.5 text-sm text-content-muted hover:text-content transition-colors p-2 rounded-lg hover:bg-surface-3"><Gem size={15} className="text-brand-400" /> {l.pricing}</Link>
                <Link href="/settings" className="flex items-center gap-2.5 text-sm text-content-muted hover:text-content transition-colors p-2 rounded-lg hover:bg-surface-3"><SettingsIcon size={15} className="text-brand-400" /> {l.settings}</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-content-subtle hover:text-content transition-colors"><ArrowLeft size={15} /> {l.back}</Link>
        </div>
      </div>
    </div>
  );
}

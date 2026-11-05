import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { buildWhatsAppUrl } from '../utils/formatters';
import { X, Send, CheckCircle2, AlertCircle, MessageSquare, Phone, MessageCircle } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const { user, signInWithGoogle, submitInquiry } = useAuth();
  const { settings } = useContent();
  const [subject, setSubject] = useState('Custom Brownie Order / Event Catering');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastWhatsappUrl, setLastWhatsappUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const whatsappNum = settings.whatsappNumber || '7339651529';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let activeUser = user;
    if (!activeUser) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setErrorMsg('Please sign in with Google to send your message.');
        return;
      }
      activeUser = signedInUser;
    }

    try {
      setIsSubmitting(true);
      const fullMessage = customerPhone
        ? `[Contact Phone: ${customerPhone}]\n\n${message}`
        : message;

      await submitInquiry(subject, fullMessage, {
        name: activeUser?.displayName || 'Customer',
        email: activeUser?.email || '',
        phone: customerPhone,
      });

      const waText = `Hello BrowineGirlCakes! I have an order / inquiry:
• Topic: ${subject}
• Name: ${activeUser?.displayName || 'Customer'}
• Email: ${activeUser?.email || ''}
• Phone: ${customerPhone || 'Not provided'}
• Message: ${message}`;

      const waUrl = buildWhatsAppUrl(whatsappNum, waText);
      setLastWhatsappUrl(waUrl);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setErrorMsg(null);
    setMessage('');
    setCustomerPhone('');
    onClose();
  };

  const defaultWaUrl = buildWhatsAppUrl(
    whatsappNum,
    `Hello BrowineGirlCakes! I would like to inquire about ${subject}.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#F8F0E5] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#C47B55]/30 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#3B211B] text-[#F8F0E5] p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#E5A962] shrink-0" />
            <div>
              <h3 className="font-editorial text-lg sm:text-xl font-bold tracking-tight">Get in Touch with BrowineGirlCakes</h3>
              <p className="text-xs text-[#E8D6C3]/80">Custom batches, wedding favors &amp; studio inquiries</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-[#F8F0E5] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Prominent Direct WhatsApp Callout */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#25D366]/40 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#25D366]">
                  Instant WhatsApp Inquiry
                </p>
                <p className="font-mono text-xs font-bold text-[#3B211B]">
                  +91 {whatsappNum}
                </p>
              </div>
            </div>
            <a
              href={defaultWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold shrink-0 transition-colors"
            >
              Chat on WhatsApp
            </a>
          </div>

          {/* Prominent Direct Phone Hotline Callout */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#C47B55]/30 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C47B55]/15 text-[#C47B55] flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55]">
                  Bakery Phone Hotline
                </p>
                <a
                  href={`tel:${settings.phoneRaw}`}
                  className="font-serif text-sm font-bold text-[#3B211B] hover:text-[#C47B55] transition-colors"
                >
                  {settings.phone} <span className="text-[11px] font-normal text-[#3B211B]/60">/ {settings.phoneRaw}</span>
                </a>
              </div>
            </div>
            <a
              href={`tel:${settings.phoneRaw}`}
              className="px-3.5 py-1.5 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-semibold shrink-0 transition-colors"
            >
              Call Now
            </a>
          </div>

          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="font-serif text-2xl font-bold text-[#3B211B]">
                Message Received!
              </h4>
              <p className="text-sm text-[#3B211B]/80 max-w-md mx-auto">
                Thank you for reaching out to BrowineGirlCakes. Your inquiry has been received and saved by our bakery team.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={lastWhatsappUrl || defaultWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send on WhatsApp ({whatsappNum})</span>
                </a>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-[#F8F0E5] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3B211B]/80 mb-1.5">
                  Inquiry Topic
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-sm text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                >
                  <option value="Custom Brownie Order / Event Catering">Custom Brownie Order / Event Catering</option>
                  <option value="Private Group Baking Masterclass">Private Group Baking Masterclass</option>
                  <option value="Corporate Gifting & Gift Boxes">Corporate Gifting &amp; Gift Boxes</option>
                  <option value="Dietary & Allergen Inquiries">Dietary &amp; Allergen Inquiries</option>
                  <option value="General Bakery Question">General Bakery Question</option>
                </select>
              </div>

              {/* Customer Phone Number field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3B211B]/80 mb-1.5 flex items-center justify-between">
                  <span>Your Phone / WhatsApp Number *</span>
                  <span className="text-[11px] text-[#C47B55] lowercase font-normal">for quick callback / WhatsApp update</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full p-3 pl-9 bg-white border border-[#E8D6C3] rounded-xl text-sm text-[#3B211B] placeholder-[#3B211B]/40 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                  />
                  <Phone className="w-4 h-4 text-[#3B211B]/50 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#3B211B]/80 mb-1.5">
                  Your Message
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you have in mind — dates, quantity of brownie boxes, flavor preferences..."
                  className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-sm text-[#3B211B] placeholder-[#3B211B]/40 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                  required
                  maxLength={1000}
                />
              </div>

              {/* Google Auth Status */}
              {user && (
                <div className="p-3 bg-[#E8D6C3]/40 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-[#3B211B]">
                      Submitting as <strong>{user.email}</strong>
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-[#F8F0E5] font-semibold text-sm tracking-wide shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending...' : 'Send Inquiry'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Cake, Clock, Heart, Instagram, MessageCircle, Mail, Phone } from 'lucide-react';
import { useContent } from '../context/ContentContext';
import { getInstagramUrl } from '../utils/formatters';

interface FooterProps {
  onOpenCreations: () => void;
  onOpenClasses: () => void;
  onOpenContact: () => void;
  onOpenCustomOrders?: () => void;
  onOpenMyActivity?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenCreations,
  onOpenClasses,
  onOpenContact,
  onOpenCustomOrders,
  onOpenMyActivity,
}) => {
  const { settings, bakingClasses } = useContent();

  return (
    <footer className="bg-[#23120E] text-[#E8D6C3] pt-16 pb-12 border-t border-[#3B211B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-[#3B211B]/80">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#C47B55] flex items-center justify-center text-white shadow-md">
                <Cake className="w-5 h-5 text-[#F8F0E5]" />
              </div>
              <span className="font-brand text-2xl font-bold tracking-wider text-[#F8F0E5]">
                BrowineGirlCakes
              </span>
            </div>
            <p className="text-xs text-[#E8D6C3]/80 leading-relaxed">
              Discover the pure joy of homemade artisan brownies, baked with single-origin cocoa, French butter, and deep passion in every batch.
            </p>
            <div className="flex items-center gap-3 pt-2 text-[#C47B55]">
              <a
                href={getInstagramUrl(settings.instagramId)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-[#3B211B] flex items-center justify-center hover:bg-[#C47B55] hover:text-white transition-colors"
                aria-label="Official Instagram @browniegirlcakes"
                title="Follow @browniegirlcakes on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about a custom order.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-[#3B211B] flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-colors"
                aria-label="WhatsApp Inquiry"
                title={`WhatsApp Inquiry: ${settings.whatsappNumber || '7339651529'}`}
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </a>
              <a
                href={`mailto:${settings.email}`}
                className="w-8 h-8 rounded-full bg-[#3B211B] flex items-center justify-center hover:bg-[#C47B55] hover:text-white transition-colors"
                aria-label="Email"
                title={settings.email}
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-footer text-sm font-semibold tracking-wider uppercase text-[#F8F0E5] mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs text-[#E8D6C3]/80">
              <li>
                <button onClick={onOpenCreations} className="hover:text-[#C47B55] transition-colors cursor-pointer">
                  Five Signature Brownies
                </button>
              </li>
              <li>
                <button onClick={onOpenClasses} className="hover:text-[#C47B55] transition-colors cursor-pointer">
                  Baking Masterclasses
                </button>
              </li>
              <li>
                <a href="#about-section" className="hover:text-[#C47B55] transition-colors">
                  The Baker Behind the Brand
                </a>
              </li>
              <li>
                <button onClick={onOpenCustomOrders || onOpenContact} className="hover:text-[#C47B55] text-[#E5A962] font-semibold transition-colors cursor-pointer">
                  Custom Orders & Catering
                </button>
              </li>
            </ul>
          </div>

          {/* Customizable Online & Class Time Slot */}
          <div>
            <h4 className="font-footer text-sm font-semibold tracking-wider uppercase text-[#F8F0E5] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C47B55]" />
              <span>Online Class Time Slot</span>
            </h4>
            {(() => {
              const customTime = (settings.onlineClassTime || '').trim();
              const isExplicitlyNotStarted = customTime === '__NOT_STARTED__';
              const scheduledSlots = (bakingClasses || []).flatMap((cls) =>
                (cls.dates || [])
                  .map((d) => d.trim())
                  .filter(Boolean)
                  .map((time) => ({
                    id: cls.id,
                    title: cls.title,
                    format: cls.format || 'Online',
                    time,
                  }))
              );

              if (isExplicitlyNotStarted || (!customTime && scheduledSlots.length === 0)) {
                return (
                  <div className="p-3.5 rounded-xl bg-[#2A1510] border border-[#3B211B] text-xs text-[#E8D6C3]/90 space-y-1.5">
                    <p className="font-semibold text-[#E5A962] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#C47B55] shrink-0" />
                      <span>The class is not yet started</span>
                    </p>
                    <p className="text-[11px] text-[#E8D6C3]/60">
                      Class timings will appear here automatically once updated in the admin panel.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5 text-xs text-[#E8D6C3]/80">
                  {customTime && (
                    <div className="p-3 rounded-xl bg-[#2A1510] border border-[#C47B55]/40 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5A962] block">
                        Scheduled Class Time
                      </span>
                      <p className="font-semibold text-[#F8F0E5] text-xs leading-relaxed whitespace-pre-line">
                        {customTime}
                      </p>
                    </div>
                  )}

                  {scheduledSlots.length > 0 && (
                    <div className="space-y-2">
                      {scheduledSlots.slice(0, 4).map((slot, idx) => (
                        <div
                          key={`${slot.id}-${idx}`}
                          className="p-2.5 rounded-xl bg-[#2A1510]/70 border border-[#3B211B] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#F8F0E5] truncate text-[11px]">
                              {slot.title}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                slot.format.toLowerCase().includes('offline') &&
                                !slot.format.toLowerCase().includes('online')
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {slot.format}
                            </span>
                          </div>
                          <p className="text-[#E5A962] font-semibold flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3 h-3 text-[#C47B55] shrink-0" />
                            <span>{slot.time}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Contact & Inquiries */}
          <div>
            <h4 className="font-footer text-sm font-semibold tracking-wider uppercase text-[#F8F0E5] mb-4">
              Direct Contact & Orders
            </h4>
            <div className="space-y-3 text-xs text-[#E8D6C3]/80">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                <a
                  href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about a custom order.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#25D366] transition-colors"
                >
                  WhatsApp: +91 {settings.whatsappNumber || '7339651529'}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#C47B55] shrink-0" />
                <a
                  href={`tel:${settings.phoneRaw || '+15553922253'}`}
                  className="hover:text-[#E5A962] transition-colors"
                >
                  {settings.phone} <span className="text-[#E8D6C3]/60">({settings.phoneRaw})</span>
                </a>
              </div>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#C47B55] shrink-0" />
                <a href={`mailto:${settings.email}`} className="hover:text-[#E5A962] transition-colors">
                  {settings.email}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#E8D6C3]/60 gap-4">
          <p>© {new Date().getFullYear()} BrowineGirlCakes. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="#admin"
              className="opacity-0 hover:opacity-40 transition-opacity text-[10px] cursor-default"
              title="Portal"
            >
              •
            </a>
            <p className="flex items-center gap-1">
              Handcrafted with <Heart className="w-3.5 h-3.5 text-[#C47B55] fill-[#C47B55]" /> by BrowineGirlCakes.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

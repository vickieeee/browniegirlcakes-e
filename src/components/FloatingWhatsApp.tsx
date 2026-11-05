import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface FloatingWhatsAppProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

export const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({
  phoneNumber = '7339651529',
  defaultMessage = 'Hello BrowineGirlCakes! I would like to inquire about a custom brownie order.',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  const internationalNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;
  const whatsappUrl = `https://wa.me/${internationalNumber}?text=${encodeURIComponent(
    defaultMessage
  )}`;

  return (
    <aside
      aria-label="WhatsApp quick inquiry widget"
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2"
    >
      {/* Tooltip speech bubble */}
      {showTooltip && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#23120E] text-[#F8F0E5] border border-[#C47B55]/50 px-4 py-2.5 rounded-2xl shadow-xl text-xs max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-bold text-[#E5A962] text-[11px] uppercase tracking-wider">
              Direct Baker WhatsApp
            </span>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-[#E8D6C3]/60 hover:text-white"
              aria-label="Close tooltip"
              type="button"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-[#E8D6C3]/90">
            Chat instantly with our head baker for custom batch orders, event catering, or class inquiries!
          </p>
          <p className="text-[10px] font-mono font-bold text-[#25D366] mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
            +91 {phoneNumber} &bull; Online Now
          </p>
        </div>
      )}

      {/* Main floating button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        className="group relative flex items-center gap-2 sm:gap-2.5 p-3.5 sm:px-4 sm:py-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xl hover:shadow-2xl hover:shadow-[#25D366]/30 transition-all duration-300 active:scale-95 cursor-pointer"
        aria-label="Inquire directly on WhatsApp (+91 7339651529)"
        title="Chat with Baker on WhatsApp: 7339651529"
      >
        {/* Pulse indicator */}
        <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white"></span>
        </span>

        {/* WhatsApp Icon */}
        <MessageCircle className="w-5 h-5 text-white" />

        <div className="hidden sm:flex flex-col text-left">
          <span className="text-[10px] uppercase font-bold tracking-wider text-white/90 leading-tight">
            WhatsApp Inquiry
          </span>
          <span className="text-xs font-mono font-bold tracking-tight text-white leading-tight">
            {phoneNumber}
          </span>
        </div>
      </a>
    </aside>
  );
};

export default FloatingWhatsApp;

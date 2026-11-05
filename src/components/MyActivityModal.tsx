import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { SIGNATURE_BROWNIES } from '../data/brownies';
import {
  X,
  Calendar,
  MessageSquare,
  Heart,
  Clock,
  User,
  CheckCircle2,
  Sparkles,
  Phone,
  ChefHat,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';

interface MyActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreCreations: () => void;
  onBookClass: () => void;
}

export const MyActivityModal: React.FC<MyActivityModalProps> = ({
  isOpen,
  onClose,
  onExploreCreations,
  onBookClass,
}) => {
  const { user, userProfile, userRegistrations, userInquiries } = useAuth();
  const { settings, customBrownies } = useContent();

  const [activeTab, setActiveTab] = useState<'classes' | 'inquiries' | 'favorites'>('classes');

  if (!isOpen) return null;

  const browniesList = customBrownies && customBrownies.length > 0 ? customBrownies : SIGNATURE_BROWNIES;
  const favBrownies = browniesList.filter((b) =>
    userProfile?.favorites?.includes(b.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#F8F0E5] rounded-3xl shadow-2xl border border-[#C47B55]/30 overflow-hidden max-h-[92vh] flex flex-col text-[#3B211B]">
        {/* Header */}
        <div className="bg-[#3B211B] text-[#F8F0E5] p-5 sm:p-6 flex items-center justify-between border-b border-[#C47B55]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C47B55] flex items-center justify-center text-white shadow-md">
              <ChefHat className="w-5 h-5 text-[#F8F0E5]" />
            </div>
            <div>
              <h3 className="font-editorial text-xl font-bold tracking-tight">
                My Bakery Account & Activity
              </h3>
              <p className="text-xs text-[#E8D6C3]/80">
                {user ? user.email : 'Guest Session & Saved Preferences'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-[#F8F0E5] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E8D6C3] bg-white px-4 sm:px-6 gap-2">
          <button
            onClick={() => setActiveTab('classes')}
            className={`py-3.5 px-3 sm:px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'classes'
                ? 'border-[#C47B55] text-[#C47B55]'
                : 'border-transparent text-[#3B211B]/60 hover:text-[#3B211B]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>My Masterclasses</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#E8D6C3]/60 text-[#3B211B]">
              {userRegistrations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inquiries')}
            className={`py-3.5 px-3 sm:px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'inquiries'
                ? 'border-[#C47B55] text-[#C47B55]'
                : 'border-transparent text-[#3B211B]/60 hover:text-[#3B211B]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Custom Inquiries</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#E8D6C3]/60 text-[#3B211B]">
              {userInquiries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`py-3.5 px-3 sm:px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'favorites'
                ? 'border-[#C47B55] text-[#C47B55]'
                : 'border-transparent text-[#3B211B]/60 hover:text-[#3B211B]'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Saved Recipes</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#E8D6C3]/60 text-[#3B211B]">
              {favBrownies.length}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* 1. MASTERCLASSES */}
          {activeTab === 'classes' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-gallery text-lg font-bold text-[#3B211B]">
                    Enrolled Baking Masterclasses
                  </h4>
                  <p className="text-xs text-[#3B211B]/70">
                    Your reserved studio sessions and online workshop bookings.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onBookClass();
                  }}
                  className="px-4 py-2 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Book New Class
                </button>
              </div>

              {userRegistrations.length === 0 ? (
                <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8D6C3] text-center space-y-3">
                  <Calendar className="w-10 h-10 text-[#C47B55]/60 mx-auto" />
                  <p className="text-sm font-bold text-[#3B211B]">No active class bookings yet</p>
                  <p className="text-xs text-[#3B211B]/70 max-w-sm mx-auto">
                    Master artisan brownies, caramel swirls, and temperature control in our hands-on workshops.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onBookClass();
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-semibold cursor-pointer"
                  >
                    <span>View Upcoming Schedule</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8D6C3] space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55]">
                            Confirmed Booking
                          </span>
                          <h5 className="font-serif text-base font-bold text-[#3B211B]">
                            {reg.className}
                          </h5>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                          {reg.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#3B211B]/80 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#C47B55]" />
                        <span>Date & Time: {reg.preferredDate}</span>
                      </div>
                      {reg.notes && (
                        <p className="text-xs text-[#3B211B]/70 italic bg-[#F8F0E5]/60 p-2.5 rounded-xl">
                          Special notes: {reg.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. CUSTOM INQUIRIES */}
          {activeTab === 'inquiries' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-gallery text-lg font-bold text-[#3B211B]">
                    Custom Order Inquiries
                  </h4>
                  <p className="text-xs text-[#3B211B]/70">
                    Bespoke event catering, gift hampers, and consultation requests.
                  </p>
                </div>
              </div>

              {userInquiries.length === 0 ? (
                <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8D6C3] text-center space-y-3">
                  <MessageSquare className="w-10 h-10 text-[#C47B55]/60 mx-auto" />
                  <p className="text-sm font-bold text-[#3B211B]">No inquiries sent yet</p>
                  <p className="text-xs text-[#3B211B]/70 max-w-sm mx-auto">
                    Planning a celebration, wedding, or corporate event? Send us a consultation request or chat on WhatsApp!
                  </p>
                  <a
                    href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about a custom order.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat on WhatsApp: {settings.whatsappNumber || '7339651529'}</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {userInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8D6C3] space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-sm font-bold text-[#3B211B]">
                          {inq.subject}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#E8D6C3] text-[#3B211B]">
                          {inq.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#3B211B]/80 font-mono bg-[#F8F0E5]/60 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                        {inq.message}
                      </p>
                      <p className="text-[10px] text-[#3B211B]/50 font-mono">
                        Submitted: {inq.createdAt ? new Date(inq.createdAt).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. FAVORITES */}
          {activeTab === 'favorites' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="font-gallery text-lg font-bold text-[#3B211B]">
                  Your Saved Favorite Brownies
                </h4>
                <p className="text-xs text-[#3B211B]/70">
                  Recipes you clicked the heart icon on across the website.
                </p>
              </div>

              {favBrownies.length === 0 ? (
                <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E8D6C3] text-center space-y-3">
                  <Heart className="w-10 h-10 text-[#C47B55]/60 mx-auto" />
                  <p className="text-sm font-bold text-[#3B211B]">No favorites saved yet</p>
                  <p className="text-xs text-[#3B211B]/70 max-w-sm mx-auto">
                    Tap the heart icon on any brownie square in our menu to save it here for quick reference.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onExploreCreations();
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-semibold cursor-pointer"
                  >
                    <span>Browse Brownie Menu</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favBrownies.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#E8D6C3] flex items-center gap-3 shadow-xs"
                    >
                      <img
                        src={b.image}
                        alt={b.name}
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-[#C47B55] uppercase">
                          {b.cocoaPercentage}
                        </span>
                        <h5 className="font-bold text-xs text-[#3B211B] truncate">{b.name}</h5>
                        <p className="text-[11px] text-[#3B211B]/70 line-clamp-1">
                          {b.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Contact bar */}
        <div className="p-4 bg-white border-t border-[#E8D6C3] flex items-center justify-between text-xs text-[#3B211B]/70">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-[#C47B55]" />
            <span>Hotline: {settings.phone}</span>
          </div>
          <a
            href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about an order.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#25D366] font-bold hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp: {settings.whatsappNumber || '7339651529'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default MyActivityModal;

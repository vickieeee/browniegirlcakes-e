import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useCart } from '../context/CartContext';
import { BrownieItem } from '../data/brownies';
import { GalleryMenuFilterId } from './BrownieGallery';
import {
  LogOut,
  Heart,
  CalendarCheck,
  Menu,
  X,
  ChevronDown,
  Cake,
  Phone,
  Instagram,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { getInstagramUrl } from '../utils/formatters';

interface NavbarProps {
  currentPage?: 'home' | 'custom-orders';
  onNavigateHome?: () => void;
  onOpenCreations: () => void;
  onSelectMenuCategory?: (categoryId: GalleryMenuFilterId) => void;
  onSelectMenuItem?: (item: BrownieItem) => void;
  activeMenuCategory?: GalleryMenuFilterId;
  onOpenClasses: () => void;
  onOpenContact: () => void;
  onOpenCustomOrders?: () => void;
  onOpenMyActivity?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage = 'home',
  onNavigateHome,
  onOpenCreations,
  onOpenClasses,
  onOpenContact,
  onOpenCustomOrders,
  onOpenMyActivity,
}) => {
  const { user, userProfile, signInWithGoogle, signOutUser, userRegistrations } = useAuth();
  const { settings, bakingClasses, adminEmails } = useContent();
  const { cartCount, setIsCartOpen, toastNotification } = useCart();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin =
    userProfile?.role === 'admin' ||
    user?.email?.toLowerCase() === 'vigneshsivan2001@gmail.com' ||
    user?.email?.toLowerCase() === 'preethipreethu712@gmail.com' ||
    (user?.email && adminEmails.some((e) => e.toLowerCase() === user.email?.toLowerCase()));

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#23120E] text-[#E8D6C3] text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-[#3B211B]/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <span className="inline-block w-2 h-2 rounded-full bg-[#C47B55] animate-pulse shrink-0"></span>
            <span className="font-medium tracking-wide truncate">
              Fresh handcrafted brownie batches baked daily
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-[11px] text-[#E8D6C3]/80">
            <a
              href={getInstagramUrl(settings.instagramId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#E5A962] text-[#E8D6C3] transition-colors"
              title="Official Instagram @browniegirlcakes"
            >
              <Instagram className="w-3.5 h-3.5 text-[#E5A962]" />
              <span className="font-medium">@browniegirlcakes</span>
            </a>
            <span className="text-[#C47B55]">•</span>
            <a
              href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about a custom order.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#25D366] text-[#E8D6C3] transition-colors font-medium"
              title="Chat with Baker on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span>WhatsApp: {settings.whatsappNumber || '7339651529'}</span>
            </a>
            <span className="text-[#C47B55]">•</span>
            <a
              href={`tel:${settings.phoneRaw || '+15553922253'}`}
              className="flex items-center gap-1.5 hover:text-[#E5A962] transition-colors"
            >
              <Phone className="w-3 h-3 text-[#C47B55]" /> {settings.phone}
            </a>
            <span className="text-[#C47B55]">•</span>
            <span>Artisan Bakery & Studio</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#F8F0E5]/95 backdrop-blur-md border-b border-[#E8D6C3]/60 transition-all shadow-xs">
        <div className="mobile-header-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              setDropdownOpen(false);
              if (onNavigateHome) {
                onNavigateHome();
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="mobile-header-brand flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#C47B55] rounded-lg p-1 cursor-pointer"
            aria-label="BrowineGirlCakes Home"
          >
            <div className="mobile-header-logo w-11 h-11 rounded-full bg-[#3B211B] flex items-center justify-center text-[#F8F0E5] shadow-md group-hover:bg-[#C47B55] transition-colors duration-300">
              <Cake className="mobile-header-logo-icon w-6 h-6 text-[#E8D6C3] group-hover:scale-110 transition-transform" />
            </div>
            <div className="mobile-header-text flex flex-col">
              <span className="mobile-header-title font-brand text-xl sm:text-2xl font-bold tracking-wider text-[#3B211B] leading-none group-hover:text-[#C47B55] transition-colors">
                BrowineGirlCakes
              </span>
              <span className="mobile-header-tagline text-[10px] uppercase tracking-[0.25em] text-[#C47B55] font-semibold mt-1">
                Artisan Brownies & Studio
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              type="button"
              onClick={onOpenClasses}
              className="text-[#3B211B]/85 hover:text-[#C47B55] font-medium text-sm tracking-wide transition-colors cursor-pointer py-1 border-b-2 border-transparent hover:border-[#C47B55] flex items-center gap-1.5"
            >
              <span>Baking Classes</span>
              {bakingClasses && bakingClasses.length === 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E8D6C3] text-[#3B211B]/70 font-semibold">
                  Waitlist
                </span>
              )}
            </button>
            <a
              href="#about-section"
              onClick={(e) => {
                if (currentPage !== 'home' && onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                  setTimeout(() => {
                    document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 150);
                }
              }}
              className="text-[#3B211B]/85 hover:text-[#C47B55] font-medium text-sm tracking-wide transition-colors cursor-pointer py-1 border-b-2 border-transparent hover:border-[#C47B55]"
            >
              Our Story
            </a>
            <button
              type="button"
              onClick={onOpenCustomOrders || onOpenContact}
              className="px-4 py-2 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Custom Orders
            </button>
          </nav>

          {/* Cart + User Account / Auth Actions */}
          <div className="mobile-header-actions flex items-center gap-2 sm:gap-3">
            {/* Shopping Cart Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="mobile-cart-btn relative flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[38px]"
              aria-label="Open shopping cart"
            >
              <ShoppingBag className="mobile-cart-icon w-4 h-4 text-[#E5A962]" />
              <span className="hidden sm:inline">Cart</span>
              <span className="mobile-cart-badge px-1.5 py-0.2 rounded-full bg-[#E5A962] text-[#23120E] text-[10px] font-bold font-mono">
                {cartCount}
              </span>
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="mobile-profile-btn flex items-center gap-1.5 sm:gap-2 p-1.5 sm:pl-3 sm:pr-2.5 rounded-full bg-[#E8D6C3]/50 hover:bg-[#E8D6C3] border border-[#C47B55]/30 text-[#3B211B] transition-all cursor-pointer shadow-xs min-h-[40px]"
                  aria-expanded={dropdownOpen}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="mobile-profile-avatar w-7 h-7 rounded-full object-cover border border-[#C47B55]"
                    />
                  ) : (
                    <div className="mobile-profile-avatar w-7 h-7 rounded-full bg-[#3B211B] text-[#F8F0E5] flex items-center justify-center text-xs font-bold">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  {userRegistrations.length > 0 && (
                    <span className="mobile-profile-badge w-4 h-4 bg-[#C47B55] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {userRegistrations.length}
                    </span>
                  )}
                  <ChevronDown className="mobile-profile-chevron w-3.5 h-3.5 text-[#3B211B]/70" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div
                    className="mobile-profile-dropdown absolute right-0 mt-2 w-64 bg-[#F8F0E5] rounded-2xl shadow-xl border border-[#C47B55]/20 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-4 py-3 border-b border-[#E8D6C3]">
                      <p className="text-xs text-[#3B211B]/60">Signed in as</p>
                      <p className="text-sm font-semibold text-[#3B211B] truncate">{user.email}</p>
                      {isAdmin && (
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#E8D6C3]/50">
                          <span className="inline-block px-2 py-0.5 text-[10px] bg-[#3B211B] text-[#E8D6C3] rounded-md font-semibold uppercase tracking-wider">
                            Owner / Admin
                          </span>
                          <a
                            href="#admin"
                            onClick={() => setDropdownOpen(false)}
                            className="text-[11px] font-bold text-[#C47B55] hover:underline"
                          >
                            Open Admin &rarr;
                          </a>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setIsCartOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-[#C47B55]" />
                        My Shopping Cart
                      </span>
                      <span className="text-[11px] font-bold text-[#C47B55]">{cartCount}</span>
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenMyActivity?.();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-[#C47B55]" />
                        My Class Bookings
                      </span>
                      <span className="text-[11px] font-bold text-[#C47B55]">
                        {userRegistrations.length}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreations();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-[#C47B55]" />
                        Favorite Brownies
                      </span>
                      <span className="text-[11px] font-bold text-[#C47B55]">
                        {userProfile?.favorites?.length || 0}
                      </span>
                    </button>

                    <div className="border-t border-[#E8D6C3] my-1"></div>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        signOutUser();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-red-700 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="mobile-signin-btn flex items-center gap-1.5 sm:gap-2 bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] px-3 sm:px-4 py-2 rounded-full text-xs font-semibold tracking-wide shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-[#3B211B] min-h-[38px]"
              >
                <svg className="mobile-signin-icon w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="mobile-signin-text">Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-menu-btn md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-[#3B211B] hover:bg-[#E8D6C3] focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="mobile-menu-icon w-6 h-6" />
              ) : (
                <Menu className="mobile-menu-icon w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Cart Toast Notification */}
        {toastNotification && (
          <div className="bg-[#23120E] text-[#F8F0E5] px-4 py-2 text-xs font-semibold flex items-center justify-between border-t border-[#E5A962]/30 animate-in slide-in-from-top-2">
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-3.5 h-3.5 text-[#E5A962]" />
              <span>{toastNotification}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="text-[#E5A962] font-bold hover:underline cursor-pointer"
            >
              View Cart ({cartCount}) &rarr;
            </button>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#F8F0E5] border-t border-[#E8D6C3] px-4 py-4 space-y-3 shadow-xl max-h-[82vh] overflow-y-auto animate-in slide-in-from-top-4">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setIsCartOpen(true);
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl font-medium text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between"
            >
              <span>Shopping Cart</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#3B211B] text-[#E5A962] font-bold">
                {cartCount} items
              </span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenClasses();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl font-medium text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between"
            >
              <span>Baking Classes</span>
              {bakingClasses && bakingClasses.length === 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8D6C3] text-[#3B211B]/70 font-semibold">
                  Waitlist
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenMyActivity?.();
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl font-medium text-[#3B211B] hover:bg-[#E8D6C3]/60 flex items-center justify-between"
            >
              <span>My Activity & Bookings</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>
            <a
              href="#about-section"
              onClick={(e) => {
                setMobileMenuOpen(false);
                if (currentPage !== 'home' && onNavigateHome) {
                  e.preventDefault();
                  onNavigateHome();
                  setTimeout(() => {
                    document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 150);
                }
              }}
              className="block py-2.5 px-3 rounded-xl font-medium text-[#3B211B] hover:bg-[#E8D6C3]/60"
            >
              Our Story
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setDropdownOpen(false);
                if (onOpenCustomOrders) onOpenCustomOrders();
                else onOpenContact();
              }}
              className="block w-full text-left py-2.5 px-3 rounded-xl font-bold text-[#C47B55] hover:bg-[#E8D6C3]/60 touch-manipulation cursor-pointer"
            >
              Custom Orders & Catering
            </button>

            <div className="pt-2 border-t border-[#E8D6C3] grid grid-cols-2 gap-2">
              <a
                href={`tel:${settings.phoneRaw || '+15553922253'}`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#3B211B] text-[#F8F0E5] text-xs font-semibold shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-[#C47B55]" />
                <span>Call Bakery</span>
              </a>
              <a
                href={`https://wa.me/91${(settings.whatsappNumber || '7339651529').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello BrowineGirlCakes! I would like to inquire about an order.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-semibold shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Fixed Mobile Bottom Thumb-Zone Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#23120E]/95 backdrop-blur-md border-t border-[#C47B55]/30 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setDropdownOpen(false);
            onOpenCreations();
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl active:scale-95 transition-all cursor-pointer touch-manipulation min-w-[64px] ${
            currentPage === 'home'
              ? 'text-[#E5A962] bg-white/10'
              : 'text-[#E8D6C3] hover:text-[#E5A962]'
          }`}
        >
          <Cake className="w-4 h-4 text-[#C47B55] mb-0.5" />
          <span className="text-[10px] font-semibold">Brownie &amp; Cakes</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setDropdownOpen(false);
            onOpenClasses();
          }}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#E8D6C3] hover:text-[#E5A962] active:scale-95 transition-all cursor-pointer touch-manipulation min-w-[60px]"
        >
          <CalendarCheck className="w-4 h-4 text-[#C47B55] mb-0.5" />
          <span className="text-[10px] font-semibold">Classes</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setDropdownOpen(false);
            if (onOpenCustomOrders) {
              onOpenCustomOrders();
            } else {
              onOpenContact();
            }
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer touch-manipulation min-w-[64px] ${
            currentPage === 'custom-orders'
              ? 'bg-[#E5A962] text-[#23120E] ring-2 ring-white/30'
              : 'bg-[#C47B55] text-white hover:bg-[#D98B5F]'
          }`}
        >
          <Heart className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-bold">Custom</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setDropdownOpen(false);
            setIsCartOpen(true);
          }}
          className="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#E8D6C3] hover:text-[#E5A962] active:scale-95 transition-all cursor-pointer touch-manipulation min-w-[60px]"
        >
          <ShoppingBag className="w-4 h-4 text-[#E5A962] mb-0.5" />
          <span className="text-[10px] font-semibold">Cart ({cartCount})</span>
        </button>
      </nav>
    </>
  );
};

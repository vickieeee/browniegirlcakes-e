import React, { useState, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';
import { ContentProvider } from './context/ContentContext';
import { CartProvider } from './context/CartContext';
import { SEOHead } from './components/SEOHead';
import { Navbar } from './components/Navbar';
import { HeroCarousel } from './components/HeroCarousel';
import { BakeryStoryShowcase } from './components/BakeryStoryShowcase';
import { BrownieGallery, GalleryMenuFilterId } from './components/BrownieGallery';
import { AboutSection } from './components/AboutSection';
import { AchievementSection } from './components/AchievementSection';
import { ClassModal } from './components/ClassModal';
import { ContactModal } from './components/ContactModal';
import { CreationsDrawer } from './components/CreationsDrawer';
import { CartDrawer } from './components/CartDrawer';
import { MyActivityModal } from './components/MyActivityModal';
import { AdminApp } from './admin/AdminApp';
import { CustomOrdersPage } from './components/CustomOrdersPage';
import { Footer } from './components/Footer';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { BrownieItem } from './data/brownies';

function MainBakeryWebsite() {
  const [currentPage, setCurrentPage] = useState<'home' | 'custom-orders'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#custom-orders' || hash.startsWith('#custom-orders') || hash === '#/custom-orders') {
        return 'custom-orders';
      }
    }
    return 'home';
  });

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [creationsDrawerOpen, setCreationsDrawerOpen] = useState(false);
  const [selectedBrownie, setSelectedBrownie] = useState<BrownieItem | null>(null);
  const [selectedInitialWeight, setSelectedInitialWeight] = useState<'½ KG' | '1 KG'>('½ KG');
  const [myActivityOpen, setMyActivityOpen] = useState(false);
  const [activeMenuFilter, setActiveMenuFilter] = useState<GalleryMenuFilterId>('all');

  // Sync hash with custom-orders page
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#custom-orders' || hash.startsWith('#custom-orders') || hash === '#/custom-orders') {
        setCurrentPage('custom-orders');
      } else if (!hash.includes('admin')) {
        setCurrentPage('home');
      }
    };

    window.addEventListener('hashchange', handleHashSync);
    window.addEventListener('popstate', handleHashSync);
    return () => {
      window.removeEventListener('hashchange', handleHashSync);
      window.removeEventListener('popstate', handleHashSync);
    };
  }, []);

  const closeAllOverlays = () => {
    setClassModalOpen(false);
    setContactModalOpen(false);
    setCreationsDrawerOpen(false);
    setMyActivityOpen(false);
    document.body.classList.remove('overflow-hidden');
  };

  const scrollToMenuSection = () => {
    closeAllOverlays();
    if (currentPage !== 'home') {
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }
      setCurrentPage('home');
      setTimeout(() => {
        const menuEl = document.getElementById('brownie-gallery');
        if (menuEl) {
          menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    } else {
      const menuEl = document.getElementById('brownie-gallery');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleSelectMenuCategory = (categoryId: GalleryMenuFilterId) => {
    setActiveMenuFilter(categoryId);
    scrollToMenuSection();
  };

  const scrollToFrostedBrowniesSection = () => {
    closeAllOverlays();
    setActiveMenuFilter('all');
    if (currentPage !== 'home') {
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }
      setCurrentPage('home');
      setTimeout(() => {
        const el =
          document.getElementById('frosted-brownies-section') ||
          document.getElementById('brownie-gallery');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } else {
      const el =
        document.getElementById('frosted-brownies-section') ||
        document.getElementById('brownie-gallery');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleOpenCustomOrders = () => {
    closeAllOverlays();
    if (currentPage === 'custom-orders') {
      const formEl = document.getElementById('custom-order-form');
      if (formEl && window.scrollY < 250) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    setCurrentPage('custom-orders');
    try {
      window.location.hash = '#custom-orders';
    } catch {}
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  const handleBackToHome = () => {
    closeAllOverlays();
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
    setCurrentPage('home');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  // Navigate directly to the main page Menu section (Brownies & Cakes)
  const handleExploreCreations = () => {
    scrollToMenuSection();
  };

  const handleJoinClass = () => {
    closeAllOverlays();
    setSelectedClassId('brownie-mastery');
    setClassModalOpen(true);
  };

  const handleGetInTouch = () => {
    closeAllOverlays();
    setContactModalOpen(true);
  };

  const handleRegisterInterest = () => {
    closeAllOverlays();
    setSelectedClassId('artisan-caramels-swirls');
    setClassModalOpen(true);
  };

  // Handler for gallery brownie click
  const handleSelectBrownie = (brownie: BrownieItem, initialWeight?: '½ KG' | '1 KG') => {
    setSelectedBrownie(brownie);
    setSelectedInitialWeight(initialWeight === '1 KG' ? '1 KG' : '½ KG');
    setCreationsDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F0E5] text-[#3B211B] flex flex-col relative pb-16 md:pb-0">
      {/* Floating WhatsApp Quick Action Button */}
      <FloatingWhatsApp phoneNumber="7339651529" />

      {/* 1. Header & Navigation Bar (Pristine Customer Storefront) */}
      <Navbar
        currentPage={currentPage}
        onNavigateHome={handleBackToHome}
        onOpenCreations={handleExploreCreations}
        onSelectMenuCategory={handleSelectMenuCategory}
        onSelectMenuItem={(item) => handleSelectBrownie(item, '½ KG')}
        activeMenuCategory={activeMenuFilter}
        onOpenClasses={handleJoinClass}
        onOpenContact={handleGetInTouch}
        onOpenCustomOrders={handleOpenCustomOrders}
        onOpenMyActivity={() => {
          closeAllOverlays();
          setMyActivityOpen(true);
        }}
      />

      <main className="flex-1">
        {currentPage === 'custom-orders' ? (
          <CustomOrdersPage
            onBackToHome={handleBackToHome}
            onNavigateToMenu={scrollToMenuSection}
            onOpenClasses={handleJoinClass}
          />
        ) : (
          <>
            {/* 2. HERO SECTION — FULL-WIDTH HERO BANNER CAROUSEL */}
            <HeroCarousel
              onExploreCreations={handleExploreCreations}
              onJoinClass={handleJoinClass}
              onGetInTouch={handleGetInTouch}
              onRegisterInterest={handleRegisterInterest}
              onOpenCustomOrders={handleOpenCustomOrders}
            />

            {/* 2B. EDITORIAL BAKERY ILLUSTRATION, AUTHENTIC RECIPES & BAKED WITH LOVE */}
            <BakeryStoryShowcase
              onExploreCreations={handleExploreCreations}
              onOpenCustomOrders={handleOpenCustomOrders}
            />

            {/* 3. MENU SECTION — BROWNIE, ASSORTED BOXES, FROSTED BROWNIES & BENTO CAKES */}
            <BrownieGallery
              onSelectBrownie={handleSelectBrownie}
              onViewAllCreations={handleExploreCreations}
              onOpenCustomOrders={handleOpenCustomOrders}
              activeMenuFilter={activeMenuFilter}
              onMenuFilterChange={setActiveMenuFilter}
            />

            {/* 4. ACHIEVEMENTS & MILESTONES SECTION */}
            <AchievementSection
              onOpenContact={handleGetInTouch}
              onOpenClasses={handleJoinClass}
            />

            {/* 5. THE BAKER BEHIND THE BRAND & BAKING STUDIO */}
            <AboutSection
              onJoinClass={handleJoinClass}
              onExploreCreations={handleExploreCreations}
            />
          </>
        )}
      </main>

      {/* 6. Footer (Pristine Customer Storefront) */}
      <Footer
        onOpenCreations={handleExploreCreations}
        onOpenClasses={handleJoinClass}
        onOpenContact={handleGetInTouch}
        onOpenCustomOrders={handleOpenCustomOrders}
        onOpenMyActivity={() => {
          closeAllOverlays();
          setMyActivityOpen(true);
        }}
      />

      {/* Interactive Modals & Drawers */}
      <ClassModal
        isOpen={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        selectedClassId={selectedClassId}
      />

      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />

      <CreationsDrawer
        isOpen={creationsDrawerOpen}
        onClose={() => setCreationsDrawerOpen(false)}
        selectedBrownie={selectedBrownie}
        initialWeight={selectedInitialWeight}
        onSelectBrownie={(b, w) => {
          setSelectedBrownie(b);
          if (w) setSelectedInitialWeight(w);
        }}
        onOrderNow={handleOpenCustomOrders}
        onOpenCustomOrders={handleOpenCustomOrders}
        onNavigateToFrostedSection={scrollToFrostedBrowniesSection}
      />

      <CartDrawer
        onNavigateToFrostedBrownies={scrollToFrostedBrowniesSection}
        onContinueShopping={scrollToMenuSection}
      />

      <MyActivityModal
        isOpen={myActivityOpen}
        onClose={() => setMyActivityOpen(false)}
        onExploreCreations={handleExploreCreations}
        onBookClass={handleJoinClass}
      />
    </div>
  );
}

function RootApp() {
  const checkIsAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();

    return (
      path === '/admin' ||
      path.startsWith('/admin') ||
      hash === '#admin' ||
      hash.startsWith('#admin') ||
      hash.startsWith('#/admin') ||
      search.includes('admin=true') ||
      search.includes('view=admin')
    );
  };

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminRoute);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    // Keyboard shortcut for bakery owners to easily access /#admin (Ctrl+Shift+A or Cmd+Shift+A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.location.hash = '#admin';
        setIsAdminRoute(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navigateToWebsite = () => {
    window.location.hash = '';
    if (window.location.pathname.startsWith('/admin')) {
      window.history.pushState(null, '', '/');
    }
    setIsAdminRoute(false);
  };

  return (
    <>
      <SEOHead isAdmin={isAdminRoute} />
      {isAdminRoute ? (
        <AdminApp onBackToWebsite={navigateToWebsite} />
      ) : (
        <MainBakeryWebsite />
      )}
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ContentProvider>
          <CartProvider>
            <RootApp />
          </CartProvider>
        </ContentProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

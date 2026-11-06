import React, { useState, useEffect } from 'react';
import {
  useContent,
  SiteSettings,
  AchievementSettings,
  DEFAULT_SETTINGS,
  DEFAULT_ADMIN_PASSWORD,
} from '../context/ContentContext';
import { BrownieItem, BakingClassInfo, MenuCategory, MENU_CATEGORY_LABELS } from '../data/brownies';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  Settings,
  Image as ImageIcon,
  UtensilsCrossed,
  Calendar,
  Trophy,
  Phone,
  Mail,
  Instagram,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  RefreshCw,
  Users,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Check,
  Gift,
  Clock,
  MapPin,
  FolderUp,
  Upload,
  Eye,
  EyeOff,
  CheckCheck,
  Filter,
  TrendingUp,
  AlertTriangle,
  Search,
  MessageCircle,
  BarChart3,
  CalendarDays,
  Lock,
  KeyRound,
} from 'lucide-react';
import {
  compressImageFile,
  OFFICIAL_INSTAGRAM_URL,
  getInstagramUrl,
  formatRupee,
  buildWhatsAppUrl,
} from '../utils/formatters';
import { StructuredClassDescription } from '../components/StructuredClassDescription';

interface AdminDashboardProps {
  adminEmail: string;
  onLogout: () => void;
  onViewWebsite: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface MonthInfo {
  key: string;
  label: string;
  shortLabel: string;
  year: number;
  monthIndex: number;
}

const parseBookingMonth = (preferredDate?: string, createdAt?: string): MonthInfo => {
  const currentYear = new Date().getFullYear();
  let matchedMonthIdx = -1;
  let year = currentYear;

  if (preferredDate) {
    const yrMatch = preferredDate.match(/\b(202[4-9])\b/);
    if (yrMatch) year = parseInt(yrMatch[1], 10);

    const lower = preferredDate.toLowerCase();
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const full = MONTH_NAMES[i].toLowerCase();
      const short = full.slice(0, 3);
      if (lower.includes(full) || lower.includes(short)) {
        matchedMonthIdx = i;
        break;
      }
    }
  }

  if (matchedMonthIdx === -1 && createdAt) {
    try {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        matchedMonthIdx = d.getMonth();
        year = d.getFullYear();
      }
    } catch {
      // ignore
    }
  }

  if (matchedMonthIdx === -1) {
    const now = new Date();
    matchedMonthIdx = now.getMonth();
    year = now.getFullYear();
  }

  const label = `${MONTH_NAMES[matchedMonthIdx]} ${year}`;
  const shortLabel = `${MONTH_NAMES[matchedMonthIdx].slice(0, 3)} ${year}`;
  const key = `${year}-${String(matchedMonthIdx + 1).padStart(2, '0')}`;

  return { key, label, shortLabel, year, monthIndex: matchedMonthIdx };
};

const IMAGE_PRESETS = {
  hero1: [
    {
      label: 'Warm Kitchen Artisan Baker',
      url: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Pastry Chef Pouring Chocolate',
      url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Baker Whisking Brownie Batter',
      url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=85&w=2400&auto=format&fit=crop',
    },
  ],
  hero2: [
    {
      label: 'Ultra Fudgy Brownie Stack',
      url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Decadent Ganache Drizzle',
      url: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Crusty Dark Cocoa Squares',
      url: 'https://images.unsplash.com/photo-1515037893149-de7f840978e2?q=85&w=2400&auto=format&fit=crop',
    },
  ],
  hero3: [
    {
      label: 'Clean Studio Baking Workshop',
      url: 'https://images.unsplash.com/photo-1581299894007-aaa50297cf16?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Students Learning Pastry Art',
      url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=85&w=2400&auto=format&fit=crop',
    },
    {
      label: 'Baking Table with Cocoa & Trays',
      url: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?q=85&w=2400&auto=format&fit=crop',
    },
  ],
  about: [
    {
      label: 'Elena in Bakery Kitchen',
      url: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=1600&auto=format&fit=crop',
    },
    {
      label: 'Master Chocolatier at Counter',
      url: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?q=85&w=1600&auto=format&fit=crop',
    },
    {
      label: 'Artisan Pastry Maker Smile',
      url: 'https://images.unsplash.com/photo-1607637508097-4089cfa6d5e7?q=85&w=1600&auto=format&fit=crop',
    },
  ],
};

interface LocalImageUploaderProps {
  label?: string;
  onImageSelected: (dataUrl: string) => void;
  className?: string;
  maxWidth?: number;
  quality?: number;
}

const LocalImageUploader: React.FC<LocalImageUploaderProps> = ({
  label = 'Upload from Device',
  onImageSelected,
  className = '',
  maxWidth = 900,
  quality = 0.78,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Select JPG, PNG, or WebP');
      return;
    }

    try {
      setUploadError(null);
      setIsProcessing(true);
      // Automatically compress and resize client-side for fast Firestore and localStorage sync
      const compressedDataUrl = await compressImageFile(file, maxWidth, quality);
      onImageSelected(compressedDataUrl);
    } catch (err) {
      console.error('Local photo processing error:', err);
      setUploadError('Failed to process photo');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3B211B] hover:bg-[#23120E] text-[#E8D6C3] hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 ${className}`}
        title="Upload photo directly from local device storage"
      >
        <FolderUp className="w-3.5 h-3.5 text-[#E5A962]" />
        <span>{isProcessing ? 'Optimizing Photo...' : label}</span>
      </button>
      {uploadError && (
        <span className="text-[9px] text-red-600 font-semibold mt-0.5">{uploadError}</span>
      )}
    </div>
  );
};

const ImagePixelSizeHint: React.FC<{
  imageUrl?: string;
  recommendedPx?: string;
  recommendedSize?: string;
}> = ({
  imageUrl,
  recommendedPx = '1200 × 900 px',
  recommendedSize = 'Max 5 MB (auto-optimized < 150 KB)',
}) => {
  const [dimensions, setDimensions] = useState<string | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl || !imageUrl.trim()) {
      setDimensions(null);
      setFileSizeStr(null);
      return;
    }

    if (imageUrl.startsWith('data:image/')) {
      const base64Length = imageUrl.split(',')[1]?.length || 0;
      const bytes = Math.round((base64Length * 3) / 4);
      const kb = (bytes / 1024).toFixed(1);
      setFileSizeStr(`${kb} KB`);
    } else {
      setFileSizeStr(null);
    }

    let isMounted = true;
    const img = new window.Image();
    img.onload = () => {
      if (isMounted && img.naturalWidth && img.naturalHeight) {
        setDimensions(`${img.naturalWidth} × ${img.naturalHeight} px`);
      }
    };
    img.onerror = () => {
      if (isMounted) setDimensions(null);
    };
    img.src = imageUrl;

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return (
    <p className="text-[10px] leading-tight text-[#3B211B]/60 mt-1 flex items-center justify-between gap-2 flex-wrap">
      <span>
        Recommended: <strong>{recommendedPx}</strong> &bull; Size: <strong>{recommendedSize}</strong>
      </span>
      {(dimensions || fileSizeStr) && (
        <span className="font-mono text-[10px] text-[#C47B55] font-semibold">
          Current: {dimensions || 'Auto px'}
          {fileSizeStr ? ` (${fileSizeStr})` : ''}
        </span>
      )}
    </p>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminEmail,
  onLogout,
  onViewWebsite,
}) => {
  const {
    settings,
    achievements,
    menuItems,
    bakingClasses,
    customBrownies,
    adminList,
    adminPassword,
    updateAdminPassword,
    addAdminUser,
    removeAdminUser,
    updateSettings,
    updateAchievements,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addClass,
    updateClass,
    deleteClass,
    addCustomBrownie,
    updateCustomBrownie,
    deleteCustomBrownie,
    resetToDefaults,
  } = useContent();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'contact' | 'images' | 'menu' | 'classes' | 'custom' | 'achievements' | 'bookings' | 'admins'
  >('overview');

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Admin Team Management & Strong Password form states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'co-admin' | 'manager'>('co-admin');
  const [newAdminCustomPassword, setNewAdminCustomPassword] = useState('');
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [revokingAdminEmail, setRevokingAdminEmail] = useState<string | null>(null);

  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [confirmPwdInput, setConfirmPwdInput] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Draft states
  const [contactForm, setContactForm] = useState<SiteSettings>(settings);
  const [imageForm, setImageForm] = useState<SiteSettings>(settings);
  const [achForm, setAchForm] = useState<AchievementSettings>(achievements);

  const [expandedBrownieId, setExpandedBrownieId] = useState<string | null>(null);
  const [expandedCustomBrownieId, setExpandedCustomBrownieId] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [classDateInputs, setClassDateInputs] = useState<Record<string, string>>({});

  // Inline deletion confirmation states (completely bypasses blocked window.confirm in iframes)
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [deletingBrownieId, setDeletingBrownieId] = useState<string | null>(null);
  const [deletingCustomId, setDeletingCustomId] = useState<string | null>(null);
  const [deletingInquiryId, setDeletingInquiryId] = useState<string | null>(null);
  const [deletingRegistrationId, setDeletingRegistrationId] = useState<string | null>(null);
  const [deletingCartOrderId, setDeletingCartOrderId] = useState<string | null>(null);
  const [confirmingResetDefaults, setConfirmingResetDefaults] = useState(false);

  // Persistent deleted tracking so deleted records never resurrect in snapshot listener
  const [deletedInquiryIds, setDeletedInquiryIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('browinegirl_deleted_inquiries') || '[]');
    } catch {
      return [];
    }
  });

  const [deletedRegistrationIds, setDeletedRegistrationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('browinegirl_deleted_registrations') || '[]');
    } catch {
      return [];
    }
  });

  const [deletedCartOrderIds, setDeletedCartOrderIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('browinegirl_deleted_cart_orders') || '[]');
    } catch {
      return [];
    }
  });

  // Customer order (inquiries) filters & search
  const [inquiryFilter, setInquiryFilter] = useState<'all' | 'unread' | 'read' | 'replied'>('all');
  const [inquirySearch, setInquirySearch] = useState('');

  // Customer bookings monthly early assessment states
  const [selectedBookingMonth, setSelectedBookingMonth] = useState<string>('all');
  const [bookingViewMode, setBookingViewMode] = useState<'monthly_assess' | 'list'>('monthly_assess');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'all' | 'registered' | 'waitlist' | 'cancelled'>('all');
  const [bookingsSubTab, setBookingsSubTab] = useState<'all' | 'bookings' | 'inquiries'>('all');

  useEffect(() => {
    setContactForm(settings);
    setImageForm(settings);
  }, [settings]);

  useEffect(() => {
    setAchForm(achievements);
  }, [achievements]);

  // Real-time & Server-persisted records
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [allInquiries, setAllInquiries] = useState<any[]>([]);
  const [allCartOrders, setAllCartOrders] = useState<any[]>([]);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchAllBackendRecords = async (showToast = false) => {
    try {
      setIsRefreshingOrders(true);
      const [ordersRes, inqsRes, regsRes] = await Promise.all([
        fetch('/api/orders').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/inquiries').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/registrations').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (ordersRes?.success && Array.isArray(ordersRes.orders)) {
        const serverOrders = ordersRes.orders;
        setAllCartOrders((prev) => {
          const byId = new Map<string, any>();
          for (const o of prev) {
            const oid = o.orderId || o.id;
            if (oid) byId.set(oid, o);
          }
          // Server orders are authoritative
          for (const srv of serverOrders) {
            const oid = srv.orderId || srv.id;
            if (oid) byId.set(oid, srv);
          }
          // Filter out any IDs deleted on the server (only keep items present in serverOrders or brand new)
          const serverIds = new Set(serverOrders.map((s: any) => s.orderId || s.id));
          const merged = Array.from(byId.values())
            .filter((item) => serverIds.has(item.orderId || item.id))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          try {
            localStorage.setItem('browinegirl_cart_orders_v1', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      if (inqsRes?.success && Array.isArray(inqsRes.inquiries)) {
        setAllInquiries(inqsRes.inquiries);
      }

      if (regsRes?.success && Array.isArray(regsRes.registrations)) {
        setAllRegistrations(regsRes.registrations);
      }

      if (showToast) {
        setSaveSuccess('Refreshed latest customer orders and bookings from production database!');
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.warn('Error fetching records from backend API:', err);
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  // Fetch from production backend database on mount and whenever switching to overview/bookings tab
  useEffect(() => {
    fetchAllBackendRecords(false);
  }, [activeTab]);

  useEffect(() => {
    const unsubRegs = onSnapshot(
      collection(db, 'class_registrations'),
      (snapshot) => {
        const remoteRegs: any[] = [];
        snapshot.forEach((d) => remoteRegs.push({ id: d.id, ...d.data() }));
        if (remoteRegs.length === 0) return;
        setAllRegistrations((prev) => {
          const byId = new Map<string, any>();
          for (const p of prev) if (p.id) byId.set(p.id, p);
          for (const r of remoteRegs) if (r.id && !deletedRegistrationIds.includes(r.id)) byId.set(r.id, r);
          return Array.from(byId.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        });
      },
      (err) => console.warn('Registrations snapshot fallback:', err)
    );

    const unsubInqs = onSnapshot(
      collection(db, 'inquiries'),
      (snapshot) => {
        const remoteInqs: any[] = [];
        snapshot.forEach((d) => remoteInqs.push({ id: d.id, ...d.data() }));
        if (remoteInqs.length === 0) return;
        setAllInquiries((prev) => {
          const byId = new Map<string, any>();
          for (const p of prev) if (p.id) byId.set(p.id, p);
          for (const i of remoteInqs) if (i.id && !deletedInquiryIds.includes(i.id)) byId.set(i.id, i);
          return Array.from(byId.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        });
      },
      (err) => console.warn('Inquiries snapshot fallback:', err)
    );

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const remoteOrders: any[] = [];
        snapshot.forEach((d) => remoteOrders.push({ id: d.id, ...d.data() }));
        if (remoteOrders.length === 0) return;
        setAllCartOrders((prev) => {
          const byId = new Map<string, any>();
          for (const p of prev) {
            const oid = p.orderId || p.id;
            if (oid) byId.set(oid, p);
          }
          for (const rem of remoteOrders) {
            const oid = rem.orderId || rem.id;
            if (oid && !deletedCartOrderIds.includes(oid) && !byId.has(oid)) {
              byId.set(oid, rem);
            }
          }
          return Array.from(byId.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        });
      },
      (err) => console.warn('Orders snapshot fallback:', err)
    );

    return () => {
      unsubRegs();
      unsubInqs();
      unsubOrders();
    };
  }, []);

  // New custom showcase brownie state
  const [isAddingCustomBrownie, setIsAddingCustomBrownie] = useState(false);
  const [newCustomBrownie, setNewCustomBrownie] = useState<Omit<BrownieItem, 'id'>>({
    name: '',
    subtitle: '',
    description: '',
    price: '',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=800&auto=format&fit=crop',
    badge: 'Artisan Custom',
    cocoaPercentage: '70% Dark',
    flavorNotes: ['Single Origin Belgian Cocoa', 'Flaky Sea Salt'],
  });

  // Menu section filter & New item state
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<'all' | MenuCategory>('all');
  const [isAddingBrownie, setIsAddingBrownie] = useState(false);
  const [newBrownieError, setNewBrownieError] = useState<string | null>(null);
  const [isSavingNewBrownie, setIsSavingNewBrownie] = useState(false);
  const [newBrownie, setNewBrownie] = useState<Omit<BrownieItem, 'id'>>({
    name: '',
    subtitle: '',
    description: '',
    price: '₹490',
    priceHalfKg: '₹490',
    priceOneKg: '₹950',
    category: 'brownie',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop',
    badge: 'Bestseller',
    cocoaPercentage: '72% Dark',
    flavorNotes: ['Madagascar Vanilla', 'Rich Cocoa nibs'],
  });

  // Isolated draft state per existing menu item so typing or uploading an image never resets or gets overwritten
  const [menuDrafts, setMenuDrafts] = useState<Record<string, BrownieItem>>({});
  const [dirtyMenuIds, setDirtyMenuIds] = useState<Record<string, boolean>>({});
  const [savingMenuIds, setSavingMenuIds] = useState<Record<string, boolean>>({});
  const [savedMenuIds, setSavedMenuIds] = useState<Record<string, boolean>>({});
  const [menuItemErrors, setMenuItemErrors] = useState<Record<string, string | null>>({});

  // Isolated draft state per existing baking class so typing multi-line descriptions never resets or gets overwritten
  const [classDrafts, setClassDrafts] = useState<Record<string, BakingClassInfo>>({});
  const [dirtyClassIds, setDirtyClassIds] = useState<Record<string, boolean>>({});
  const [savingClassIds, setSavingClassIds] = useState<Record<string, boolean>>({});
  const [savedClassIds, setSavedClassIds] = useState<Record<string, boolean>>({});

  // New class state
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassInitialSlot, setNewClassInitialSlot] = useState('');
  const [newClass, setNewClass] = useState<Omit<BakingClassInfo, 'id'>>({
    title: '',
    level: 'Beginner to Intermediate',
    duration: '2.5 Hours',
    price: '₹1,999 / person',
    description: '',
    dates: [],
    format: 'Online',
  });

  const triggerSuccess = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  const handleClassDraftChange = (cls: BakingClassInfo, changes: Partial<BakingClassInfo>) => {
    setClassDrafts((prev) => {
      const currentDraft: BakingClassInfo = prev[cls.id]
        ? { ...cls, ...prev[cls.id] }
        : { ...cls };
      return {
        ...prev,
        [cls.id]: {
          ...currentDraft,
          ...changes,
        },
      };
    });
    setDirtyClassIds((prev) => ({ ...prev, [cls.id]: true }));
    setSavedClassIds((prev) => ({ ...prev, [cls.id]: false }));
  };

  const handleResetClassDraft = (classId: string) => {
    setClassDrafts((prev) => {
      const next = { ...prev };
      delete next[classId];
      return next;
    });
    setDirtyClassIds((prev) => ({ ...prev, [classId]: false }));
  };

  const handleSaveClass = async (cls: BakingClassInfo) => {
    const draft: BakingClassInfo = classDrafts[cls.id]
      ? { ...cls, ...classDrafts[cls.id] }
      : cls;

    const trimmedTitle = (draft.title || '').trim();
    if (!trimmedTitle) {
      triggerSuccess('Please enter a valid class title before saving.');
      return;
    }

    try {
      setSavingClassIds((prev) => ({ ...prev, [cls.id]: true }));
      await updateClass(cls.id, {
        title: trimmedTitle,
        level: (draft.level || '').trim() || 'All Levels',
        duration: (draft.duration || '').trim() || '2.5 Hours',
        price: (draft.price || '').trim() || '₹1,999',
        format: draft.format || 'Online',
        description: typeof draft.description === 'string' ? draft.description.replace(/\r\n?/g, '\n') : '',
        dates: draft.dates || cls.dates || [],
      });

      setClassDrafts((prev) => {
        const next = { ...prev };
        delete next[cls.id];
        return next;
      });
      setDirtyClassIds((prev) => ({ ...prev, [cls.id]: false }));
      setSavedClassIds((prev) => ({ ...prev, [cls.id]: true }));
      setTimeout(() => {
        setSavedClassIds((prev) => ({ ...prev, [cls.id]: false }));
      }, 3000);

      triggerSuccess(`Saved changes to "${trimmedTitle}"! Public website updated.`);
    } catch (err) {
      console.error('Failed to save class changes:', err);
    } finally {
      setSavingClassIds((prev) => ({ ...prev, [cls.id]: false }));
    }
  };

  const handleMenuDraftChange = (brownie: BrownieItem, changes: Partial<BrownieItem>) => {
    setMenuDrafts((prev) => {
      const currentDraft: BrownieItem = prev[brownie.id]
        ? { ...brownie, ...prev[brownie.id] }
        : { ...brownie };
      return {
        ...prev,
        [brownie.id]: {
          ...currentDraft,
          ...changes,
        },
      };
    });
    setDirtyMenuIds((prev) => ({ ...prev, [brownie.id]: true }));
    setSavedMenuIds((prev) => ({ ...prev, [brownie.id]: false }));
    setMenuItemErrors((prev) => ({ ...prev, [brownie.id]: null }));
  };

  const handleResetMenuDraft = (brownieId: string) => {
    setMenuDrafts((prev) => {
      const next = { ...prev };
      delete next[brownieId];
      return next;
    });
    setDirtyMenuIds((prev) => ({ ...prev, [brownieId]: false }));
    setMenuItemErrors((prev) => ({ ...prev, [brownieId]: null }));
  };

  const handleSaveMenuItem = async (brownie: BrownieItem) => {
    const draft: BrownieItem = menuDrafts[brownie.id]
      ? { ...brownie, ...menuDrafts[brownie.id] }
      : brownie;

    const trimmedName = (draft.name || '').trim();
    if (!trimmedName) {
      setMenuItemErrors((prev) => ({
        ...prev,
        [brownie.id]: 'Product name cannot be empty. Please enter a valid cake or brownie name.',
      }));
      return;
    }

    const cat = draft.category || brownie.category || 'brownie';
    const isNoKg = cat === 'assorted_box' || cat === 'frosted_brownie';
    const rawHalf = (draft.priceHalfKg || '').trim();
    const rawOne = (draft.priceOneKg || '').trim();
    const rawSinglePrice = (draft.price || '').trim();

    if (isNoKg && !rawSinglePrice) {
      setMenuItemErrors((prev) => ({
        ...prev,
        [brownie.id]: 'Please enter a valid price for this product.',
      }));
      return;
    }

    if (!isNoKg && !rawHalf && !rawSinglePrice) {
      setMenuItemErrors((prev) => ({
        ...prev,
        [brownie.id]: 'Please enter the ½ KG and 1 KG prices for this product.',
      }));
      return;
    }

    const trimmedImage = (draft.image || '').trim();
    if (!trimmedImage) {
      setMenuItemErrors((prev) => ({
        ...prev,
        [brownie.id]: 'Please upload a product photo or enter a valid image URL.',
      }));
      return;
    }

    try {
      setSavingMenuIds((prev) => ({ ...prev, [brownie.id]: true }));
      setMenuItemErrors((prev) => ({ ...prev, [brownie.id]: null }));

      const payload: Partial<BrownieItem> = {
        name: trimmedName,
        subtitle: (draft.subtitle || '').trim(),
        description: (draft.description || '').trim(),
        category: cat,
        badge: draft.badge ? draft.badge.trim() : '',
        cocoaPercentage: (draft.cocoaPercentage || '').trim(),
        image: trimmedImage,
        price: isNoKg ? rawSinglePrice : rawHalf || rawSinglePrice,
        priceHalfKg: isNoKg ? undefined : rawHalf || rawSinglePrice,
        priceOneKg: isNoKg ? undefined : rawOne || rawSinglePrice,
        enabled: draft.enabled !== false,
      };

      await updateMenuItem(brownie.id, payload);

      setMenuDrafts((prev) => {
        const next = { ...prev };
        delete next[brownie.id];
        return next;
      });
      setDirtyMenuIds((prev) => ({ ...prev, [brownie.id]: false }));
      setSavedMenuIds((prev) => ({ ...prev, [brownie.id]: true }));
      setTimeout(() => {
        setSavedMenuIds((prev) => ({ ...prev, [brownie.id]: false }));
      }, 3000);

      triggerSuccess(`Saved changes to "${trimmedName}"! Updated live on customer menu.`);
    } catch (err) {
      console.error('Failed to save menu item:', err);
      setMenuItemErrors((prev) => ({
        ...prev,
        [brownie.id]: 'Failed to save changes. Please check your input or image size and try again.',
      }));
    } finally {
      setSavingMenuIds((prev) => ({ ...prev, [brownie.id]: false }));
    }
  };

  // Customer order (inquiries) deletion & mark-as-read handlers
  const handleDeleteInquiry = async (inquiryId: string, customerName?: string) => {
    try {
      const updated = [...deletedInquiryIds, inquiryId];
      setDeletedInquiryIds(updated);
      localStorage.setItem('browinegirl_deleted_inquiries', JSON.stringify(updated));
      setAllInquiries((prev) => prev.filter((item) => item.id !== inquiryId));
      setDeletingInquiryId(null);

      await fetch(`/api/inquiries/${encodeURIComponent(inquiryId)}`, {
        method: 'DELETE',
      });
      await deleteDoc(doc(db, 'inquiries', inquiryId)).catch(() => {});
      triggerSuccess(`Permanently deleted customer inquiry from ${customerName || 'customer'}`);
    } catch (err) {
      console.warn('Delete inquiry error:', err);
      setDeletingInquiryId(null);
      triggerSuccess(`Deleted customer inquiry from ${customerName || 'customer'}`);
    }
  };

  const handleToggleInquiryRead = async (inq: any) => {
    const isCurrentlyRead = inq.status === 'read' || inq.isRead === true;
    const nextStatus = isCurrentlyRead ? 'new' : 'read';
    const nextIsRead = !isCurrentlyRead;
    const readAt = nextIsRead ? new Date().toISOString() : null;

    setAllInquiries((prev) =>
      prev.map((item) =>
        item.id === inq.id
          ? {
              ...item,
              status: nextStatus,
              isRead: nextIsRead,
              readAt,
            }
          : item
      )
    );

    try {
      await fetch(`/api/inquiries/${encodeURIComponent(inq.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, isRead: nextIsRead, readAt }),
      });
      await updateDoc(doc(db, 'inquiries', inq.id), {
        status: nextStatus,
        isRead: nextIsRead,
        readAt,
      }).catch(() => {});
      triggerSuccess(nextIsRead ? 'Order marked as Read ✓' : 'Order marked as New / Unread');
    } catch (err) {
      console.warn('Update inquiry read error:', err);
      triggerSuccess(nextIsRead ? 'Order marked as Read' : 'Order marked as Unread');
    }
  };

  const handleUpdateInquiryStatus = async (inquiryId: string, newStatus: string) => {
    const isRead = newStatus === 'read' || newStatus === 'replied' || newStatus === 'closed';
    const readAt = isRead ? new Date().toISOString() : null;
    setAllInquiries((prev) =>
      prev.map((item) =>
        item.id === inquiryId
          ? {
              ...item,
              status: newStatus,
              isRead,
              readAt,
            }
          : item
      )
    );

    try {
      await fetch(`/api/inquiries/${encodeURIComponent(inquiryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, isRead, readAt }),
      });
      await updateDoc(doc(db, 'inquiries', inquiryId), {
        status: newStatus,
        isRead,
        readAt,
      }).catch(() => {});
      triggerSuccess(`Order status updated to "${newStatus}"`);
    } catch (err) {
      console.warn('Error updating inquiry status:', err);
    }
  };

  const handleMarkAllInquiriesAsRead = async () => {
    const unread = allInquiries.filter((inq) => inq.status !== 'read' && !inq.isRead);
    if (unread.length === 0) {
      triggerSuccess('All customer orders are already marked as read!');
      return;
    }

    const readAt = new Date().toISOString();
    setAllInquiries((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'read',
        isRead: true,
        readAt,
      }))
    );

    try {
      await Promise.all(
        unread.map((inq) =>
          fetch(`/api/inquiries/${encodeURIComponent(inq.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read', isRead: true, readAt }),
          })
        )
      );
      triggerSuccess(`Marked ${unread.length} customer order(s) as read!`);
    } catch (err) {
      console.warn('Bulk update error:', err);
      triggerSuccess(`Marked ${unread.length} customer order(s) as read`);
    }
  };

  // Customer booking deletion handler
  const handleDeleteRegistration = async (regId: string, studentName?: string) => {
    try {
      const updated = [...deletedRegistrationIds, regId];
      setDeletedRegistrationIds(updated);
      localStorage.setItem('browinegirl_deleted_registrations', JSON.stringify(updated));
      setAllRegistrations((prev) => prev.filter((item) => item.id !== regId));
      setDeletingRegistrationId(null);

      await fetch(`/api/registrations/${encodeURIComponent(regId)}`, {
        method: 'DELETE',
      });
      await deleteDoc(doc(db, 'class_registrations', regId)).catch(() => {});
      triggerSuccess(`Permanently removed booking for ${studentName || 'student'}`);
    } catch (err) {
      console.warn('Delete registration error:', err);
      setDeletingRegistrationId(null);
      triggerSuccess(`Removed booking for ${studentName || 'student'}`);
    }
  };

  // Sample seeders for testing
  const handleAddSampleBooking = async (monthName: string, year = 2026) => {
    const sampleNames = ['Aarav Sharma', 'Priya Menon', 'Kavita Patel', 'Rohan Iyer', 'Ananya Deshmukh'];
    const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
    const randomClass = bakingClasses[Math.floor(Math.random() * bakingClasses.length)] || {
      title: 'The Ultimate Fudgy Brownie Masterclass',
    };
    const sampleId = `sample_reg_${Date.now()}`;
    const newReg = {
      id: sampleId,
      userId: `user_${Date.now()}`,
      userName: randomName,
      userEmail: `${randomName.toLowerCase().replace(' ', '.')}@example.com`,
      className: randomClass.title,
      preferredDate: `Saturday, ${monthName} 14, ${year} @ 10:00 AM`,
      notes: 'Gift booking from family; wants to master shiny crinkly crust technique.',
      status: 'registered',
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReg),
      });
      const data = await res.json();
      if (res.ok && data?.registration) {
        setAllRegistrations((prev) => [data.registration, ...prev]);
      } else {
        setAllRegistrations((prev) => [newReg, ...prev]);
      }
      await setDoc(doc(db, 'class_registrations', newReg.id), newReg).catch(() => {});
      triggerSuccess(`Added test booking for ${monthName} ${year} (${randomName})`);
    } catch {
      setAllRegistrations((prev) => [newReg, ...prev]);
      triggerSuccess(`Added test booking for ${monthName} ${year}`);
    }
  };

  const handleAddSampleInquiry = async () => {
    const samplePayload = {
      userId: `guest_${Date.now()}`,
      customerName: 'Ananya Krishnan',
      customerEmail: 'ananya.k@example.com',
      customerPhone: '9840123456',
      deliveryAddress: '14 Anna Nagar East, Chennai - 600102',
      specialInstructions: 'Please pack the Frosted Brownie add-on with a birthday ribbon.',
      items: [
        {
          productId: 'brownie-kitkat',
          name: 'KitKat Brownie (½ KG)',
          category: 'brownie',
          quantity: 1,
          unitPrice: 550,
          unitPriceFormatted: '₹550',
          lineTotal: 550,
          lineTotalFormatted: '₹550',
          variantLabel: '½ KG',
          weight: '½ KG',
          isAddon: false,
        },
        {
          productId: 'frosted-belgian-ganache',
          name: 'Belgian Ganache Frosted Brownie',
          category: 'frosted_brownie',
          quantity: 1,
          unitPrice: 160,
          unitPriceFormatted: '₹160',
          lineTotal: 160,
          lineTotalFormatted: '₹160',
          isAddon: true,
        },
      ],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });
      const data = await res.json();
      if (!res.ok || !data?.order) {
        throw new Error(data?.error || 'Failed to create sample order');
      }
      const savedOrder = data.order;
      setAllCartOrders((prev) => [savedOrder, ...prev.filter((o) => o.orderId !== savedOrder.orderId)]);
      await fetchAllBackendRecords(false);
      triggerSuccess(
        `Persisted combined order ${savedOrder.orderId} (KitKat Brownie ½ KG ₹550 + Belgian Ganache Frosted Brownie ₹160 = ₹710)!`
      );
    } catch (err) {
      console.error('Error creating sample order:', err);
    }
  };

  const handleUpdateCartOrderStatus = async (orderId: string, newStatus: string) => {
    const nowIso = new Date().toISOString();
    setAllCartOrders((prev) => {
      const updated = prev.map((o) =>
        (o.orderId || o.id) === orderId
          ? { ...o, status: newStatus, updatedAt: nowIso }
          : o
      );
      try {
        localStorage.setItem('browinegirl_cart_orders_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error('Failed to update order status in database');
      }
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: nowIso,
      }).catch(() => {});
      triggerSuccess(`Order ${orderId} status permanently updated to "${newStatus}"`);
    } catch (err) {
      console.warn('Error updating order status:', err);
      triggerSuccess(`Order ${orderId} status updated to "${newStatus}"`);
    }
  };

  const handleDeleteCartOrder = async (orderId: string) => {
    const nextDeleted = [...deletedCartOrderIds, orderId];
    setDeletedCartOrderIds(nextDeleted);
    try {
      localStorage.setItem('browinegirl_deleted_cart_orders', JSON.stringify(nextDeleted));
    } catch {}

    setAllCartOrders((prev) => {
      const updated = prev.filter((o) => (o.orderId || o.id) !== orderId);
      try {
        localStorage.setItem('browinegirl_cart_orders_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setDeletingCartOrderId(null);

    try {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
      await deleteDoc(doc(db, 'orders', orderId)).catch(() => {});
      await fetchAllBackendRecords(false);
      triggerSuccess(`Permanently deleted order ${orderId} from database`);
    } catch {
      triggerSuccess(`Deleted order ${orderId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#2A1612] text-[#F8F0E5] flex flex-col font-sans overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="bg-[#1F0F0C] border-b border-[#3B211B] px-3 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-[#E8D6C3] flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#C47B55] flex items-center justify-center text-white shadow-md shrink-0">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-sm sm:text-xl font-bold tracking-tight text-[#F8F0E5] truncate">
                BROWNIEGIRLCAKES Admin
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#E5A962] text-[#23120E] shrink-0">
                Authenticated
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#E8D6C3]/70 truncate">
              <strong className="text-white">{adminEmail}</strong>
              <span className="hidden sm:inline"> &bull; Changes update public website immediately</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {confirmingResetDefaults ? (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-950/80 border border-red-500 text-xs text-white">
              <span className="font-bold text-[11px]">Reset all to defaults?</span>
              <button
                type="button"
                onClick={() => {
                  resetToDefaults();
                  setConfirmingResetDefaults(false);
                  triggerSuccess('Reset to default bakery content successfully!');
                }}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-[10px] cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmingResetDefaults(false)}
                className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded font-semibold text-[10px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingResetDefaults(true)}
              title="Reset to factory defaults"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-[#E8D6C3] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          )}

          {/* Quick Security / Password Button */}
          <button
            onClick={() => setActiveTab('admins')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-[#E5A962] text-xs font-semibold transition-all cursor-pointer border border-[#E5A962]/30"
            title="Manage Admin Password & Team Access"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Password &amp; Admins</span>
          </button>

          {/* View Live Storefront Button */}
          <button
            onClick={onViewWebsite}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer border border-[#C47B55]/40 min-h-[38px]"
          >
            <Globe className="w-3.5 h-3.5 text-[#C47B55] shrink-0" />
            <span className="hidden sm:inline">View Public Website</span>
            <span className="sm:hidden">Store</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-700/50 text-red-200 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            title="Sign out of Admin Dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Horizontally Scrollable Quick-Tab Bar */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#23120E] border-b border-[#3B211B] sticky top-[57px] z-30">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'bookings', label: `Orders & Bookings (${allCartOrders.length + allRegistrations.length + allInquiries.length})` },
            { id: 'admins', label: 'Password & Admins' },
            { id: 'menu', label: 'Menu' },
            { id: 'classes', label: 'Classes' },
            { id: 'contact', label: 'Contact' },
            { id: 'images', label: 'Images' },
            { id: 'achievements', label: 'Awards' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setMobileSidebarOpen(false);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#C47B55] text-white shadow-xs'
                : 'bg-white/5 text-[#E8D6C3]/80 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Save Notification Banner */}
      {saveSuccess && (
        <div className="bg-emerald-600 text-white px-4 sm:px-6 py-2.5 text-xs font-semibold flex items-center justify-between sticky top-[98px] md:top-[61px] z-30 animate-in slide-in-from-top-2 shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{saveSuccess}</span>
          </span>
          <span className="hidden sm:inline text-[11px] text-emerald-100 font-mono">Synced Live</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop Overlay */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-20 md:hidden animate-in fade-in"
            aria-hidden="true"
          />
        )}

        {/* Left Navigation Sidebar */}
        <aside
          className={`${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } fixed md:static inset-y-0 left-0 top-[57px] z-30 w-64 bg-[#1F0F0C] border-r border-[#3B211B] flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto`}
        >
          <div className="space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#C47B55]">
              Management Navigation
            </div>

            <button
              onClick={() => {
                setActiveTab('overview');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview & Statistics</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('images');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'images'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Hero & Section Images</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('contact');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'contact'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Phone, Email & Socials</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('menu');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'menu'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span className="flex-1 text-left">Brownie Menu & Prices</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10">
                {menuItems.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('classes');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'classes'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="flex-1 text-left">Online Class Times</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10">
                {bakingClasses.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('achievements');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'achievements'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Achievements Section</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('bookings');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'bookings'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="flex-1 text-left">Orders &amp; Bookings</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10">
                {allCartOrders.length + allRegistrations.length + allInquiries.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('admins');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-[#C47B55] text-white shadow-md'
                  : 'text-[#E8D6C3]/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#E5A962]" />
              <span className="flex-1 text-left">Admin Team & Access</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 font-bold">
                {adminList.length}
              </span>
            </button>
          </div>

          <div className="pt-4 border-t border-[#3B211B] space-y-2">
            <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1">
              <p className="text-[#E8D6C3]/60 text-[10px] uppercase font-bold tracking-wider">
                Current URL Route
              </p>
              <p className="text-[#F8F0E5] font-mono text-[11px] truncate">
                /admin (Dedicated Dashboard)
              </p>
            </div>
            <button
              onClick={onViewWebsite}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-[#E8D6C3] transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#C47B55]" />
              <span>Open Customer Storefront</span>
            </button>
          </div>
        </aside>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-[#F8F0E5] text-[#3B211B] p-5 sm:p-8">
          {/* TAB 0: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                  Bakery Administration Suite
                </span>
                <h2 className="font-serif text-3xl font-bold text-[#3B211B] mt-1">
                  BrowineGirlCakes Storefront Control Center
                </h2>
                <p className="text-sm text-[#3B211B]/70 mt-1">
                  Configure your bakery photography, prices, class time slots, phone numbers, email, and social IDs. All adjustments save instantly to your live website.
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-[#C47B55]">
                    <UtensilsCrossed className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Live
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#3B211B]">{menuItems.length} Brownies</p>
                  <p className="text-xs text-[#3B211B]/60">Menu items displayed on website</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-[#C47B55]">
                    <Calendar className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55] bg-[#F8F0E5] px-2 py-0.5 rounded-full">
                      Online & Studio
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#3B211B]">{bakingClasses.length} Masterclasses</p>
                  <p className="text-xs text-[#3B211B]/60">Configured with live date schedules</p>
                </div>

                <div
                  onClick={() => {
                    setActiveTab('bookings');
                    setBookingsSubTab('inquiries');
                  }}
                  className="bg-white p-5 rounded-2xl border border-[#E8D6C3] hover:border-[#C47B55] shadow-xs space-y-2 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-[#C47B55]">
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      Persistent DB
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#3B211B]">
                    {allCartOrders.length} Orders &bull; {allRegistrations.length} Bookings
                  </p>
                  <p className="text-xs text-[#3B211B]/60">
                    Click to view all customer orders &amp; class bookings
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-[#C47B55]">
                    <Phone className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      Hotline
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[#3B211B] truncate">{settings.phone}</p>
                  <p className="text-xs text-[#3B211B]/60">Email: {settings.email}</p>
                </div>
              </div>

              {/* Quick Jump Modules */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  onClick={() => setActiveTab('images')}
                  className="bg-white p-6 rounded-2xl border border-[#E8D6C3] shadow-xs hover:border-[#C47B55] transition-all cursor-pointer space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#F8F0E5] group-hover:bg-[#C47B55] group-hover:text-white text-[#C47B55] flex items-center justify-center transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#3B211B]">
                    Change Images
                  </h3>
                  <p className="text-xs text-[#3B211B]/70">
                    Update high-res photographs for all 3 hero slides, close-up chocolate textures, and about section baker photos.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('menu')}
                  className="bg-white p-6 rounded-2xl border border-[#E8D6C3] shadow-xs hover:border-[#C47B55] transition-all cursor-pointer space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#F8F0E5] group-hover:bg-[#C47B55] group-hover:text-white text-[#C47B55] flex items-center justify-center transition-colors">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#3B211B]">
                    Add Menu Items & Prices
                  </h3>
                  <p className="text-xs text-[#3B211B]/70">
                    Add new brownies, alter prices in real time, edit origin stories, descriptions, and cocoa percentages.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('classes')}
                  className="bg-white p-6 rounded-2xl border border-[#E8D6C3] shadow-xs hover:border-[#C47B55] transition-all cursor-pointer space-y-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#F8F0E5] group-hover:bg-[#C47B55] group-hover:text-white text-[#C47B55] flex items-center justify-center transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-[#3B211B]">
                    Online Class Times
                  </h3>
                  <p className="text-xs text-[#3B211B]/70">
                    Update scheduled class times, online workshop slots, student fees, durations, and curriculum details.
                  </p>
                </div>
              </div>

              {/* Admin Team Quick Access Banner */}
              <div className="bg-[#2A1612] text-[#F8F0E5] p-6 rounded-3xl border border-[#3B211B] shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#E5A962]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#E5A962]">
                      Admin Team & Access Control
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#F8F0E5]">
                    {adminList.length} Authorized Administrators Active
                  </h3>
                  <p className="text-xs text-[#E8D6C3]/75">
                    Official email: <strong className="text-white">{settings.email}</strong> &bull; Add another person by email to grant dashboard access.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('admins')}
                  className="px-5 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add / Manage Admins</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: CHANGE IMAGES */}
          {activeTab === 'images' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                  Visual Assets & Local Storage
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                  Change Hero Carousel & Bakery Section Images
                </h3>
                <p className="text-xs text-[#3B211B]/70 mt-1">
                  Upload photos directly from your computer or phone local storage, paste an image URL, or pick from curated bakery presets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hero Slide 1 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider block">
                      Hero Slide 1: The Baker Behind the Brand
                    </span>
                    <LocalImageUploader
                      label="Upload Local Photo"
                      onImageSelected={(dataUrl) => {
                        setImageForm((prev) => ({ ...prev, heroSlide1Image: dataUrl }));
                        triggerSuccess('Loaded local photo for Hero Slide 1! Remember to save changes.');
                      }}
                    />
                  </div>
                  <div className="h-48 w-full rounded-2xl overflow-hidden bg-black/10 border border-[#E8D6C3] relative group">
                    <img
                      src={imageForm.heroSlide1Image}
                      alt="Hero Slide 1"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_SETTINGS.heroSlide1Image;
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#3B211B] block mb-1">
                      Direct Photo URL or Local Upload Data:
                    </label>
                    <input
                      type="text"
                      value={imageForm.heroSlide1Image}
                      onChange={(e) => setImageForm({ ...imageForm, heroSlide1Image: e.target.value })}
                      placeholder="Paste URL or use Upload button above"
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-mono text-[#3B211B]"
                    />
                    <ImagePixelSizeHint
                      imageUrl={imageForm.heroSlide1Image}
                      recommendedPx="1920 × 1080 px (16:9)"
                    />
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] text-[#3B211B]/60 font-semibold block mb-1">
                      Quick Preset Options:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.hero1.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageForm({ ...imageForm, heroSlide1Image: p.url })}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            imageForm.heroSlide1Image === p.url
                              ? 'bg-[#3B211B] text-[#E8D6C3] border-[#3B211B]'
                              : 'bg-[#F8F0E5] text-[#3B211B] border-[#E8D6C3] hover:bg-[#E8D6C3]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hero Slide 2 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider block">
                      Hero Slide 2: The Chocolate Experience
                    </span>
                    <LocalImageUploader
                      label="Upload Local Photo"
                      onImageSelected={(dataUrl) => {
                        setImageForm((prev) => ({ ...prev, heroSlide2Image: dataUrl }));
                        triggerSuccess('Loaded local photo for Hero Slide 2! Remember to save changes.');
                      }}
                    />
                  </div>
                  <div className="h-48 w-full rounded-2xl overflow-hidden bg-black/10 border border-[#E8D6C3]">
                    <img
                      src={imageForm.heroSlide2Image}
                      alt="Hero Slide 2"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_SETTINGS.heroSlide2Image;
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#3B211B] block mb-1">
                      Direct Photo URL or Local Upload Data:
                    </label>
                    <input
                      type="text"
                      value={imageForm.heroSlide2Image}
                      onChange={(e) => setImageForm({ ...imageForm, heroSlide2Image: e.target.value })}
                      placeholder="Paste URL or use Upload button above"
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-mono text-[#3B211B]"
                    />
                    <ImagePixelSizeHint
                      imageUrl={imageForm.heroSlide2Image}
                      recommendedPx="1920 × 1080 px (16:9)"
                    />
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] text-[#3B211B]/60 font-semibold block mb-1">
                      Quick Preset Options:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.hero2.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageForm({ ...imageForm, heroSlide2Image: p.url })}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            imageForm.heroSlide2Image === p.url
                              ? 'bg-[#3B211B] text-[#E8D6C3] border-[#3B211B]'
                              : 'bg-[#F8F0E5] text-[#3B211B] border-[#E8D6C3] hover:bg-[#E8D6C3]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hero Slide 3 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider block">
                      Hero Slide 3: Baking Studio Workshop
                    </span>
                    <LocalImageUploader
                      label="Upload Local Photo"
                      onImageSelected={(dataUrl) => {
                        setImageForm((prev) => ({ ...prev, heroSlide3Image: dataUrl }));
                        triggerSuccess('Loaded local photo for Hero Slide 3! Remember to save changes.');
                      }}
                    />
                  </div>
                  <div className="h-48 w-full rounded-2xl overflow-hidden bg-black/10 border border-[#E8D6C3]">
                    <img
                      src={imageForm.heroSlide3Image}
                      alt="Hero Slide 3"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_SETTINGS.heroSlide3Image;
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#3B211B] block mb-1">
                      Direct Photo URL or Local Upload Data:
                    </label>
                    <input
                      type="text"
                      value={imageForm.heroSlide3Image}
                      onChange={(e) => setImageForm({ ...imageForm, heroSlide3Image: e.target.value })}
                      placeholder="Paste URL or use Upload button above"
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-mono text-[#3B211B]"
                    />
                    <ImagePixelSizeHint
                      imageUrl={imageForm.heroSlide3Image}
                      recommendedPx="1920 × 1080 px (16:9)"
                    />
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] text-[#3B211B]/60 font-semibold block mb-1">
                      Quick Preset Options:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.hero3.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageForm({ ...imageForm, heroSlide3Image: p.url })}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            imageForm.heroSlide3Image === p.url
                              ? 'bg-[#3B211B] text-[#E8D6C3] border-[#3B211B]'
                              : 'bg-[#F8F0E5] text-[#3B211B] border-[#E8D6C3] hover:bg-[#E8D6C3]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* About Section Baker Photo */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider block">
                      Our Story: Artisan Baker Portrait
                    </span>
                    <LocalImageUploader
                      label="Upload Local Photo"
                      onImageSelected={(dataUrl) => {
                        setImageForm((prev) => ({ ...prev, aboutImage: dataUrl }));
                        triggerSuccess('Loaded local photo for Baker Story! Remember to save changes.');
                      }}
                    />
                  </div>
                  <div className="h-48 w-full rounded-2xl overflow-hidden bg-black/10 border border-[#E8D6C3]">
                    <img
                      src={imageForm.aboutImage}
                      alt="About Baker"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_SETTINGS.aboutImage;
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#3B211B] block mb-1">
                      Direct Photo URL or Local Upload Data:
                    </label>
                    <input
                      type="text"
                      value={imageForm.aboutImage}
                      onChange={(e) => setImageForm({ ...imageForm, aboutImage: e.target.value })}
                      placeholder="Paste URL or use Upload button above"
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-mono text-[#3B211B]"
                    />
                    <ImagePixelSizeHint
                      imageUrl={imageForm.aboutImage}
                      recommendedPx="1200 × 900 px (4:3)"
                    />
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] text-[#3B211B]/60 font-semibold block mb-1">
                      Quick Preset Options:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.about.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImageForm({ ...imageForm, aboutImage: p.url })}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                            imageForm.aboutImage === p.url
                              ? 'bg-[#3B211B] text-[#E8D6C3] border-[#3B211B]'
                              : 'bg-[#F8F0E5] text-[#3B211B] border-[#E8D6C3] hover:bg-[#E8D6C3]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={async () => {
                    await updateSettings(imageForm);
                    triggerSuccess('Hero and section images updated live on the website!');
                  }}
                  className="px-6 py-3 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Image Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PHONE, EMAIL, INSTAGRAM, FACEBOOK */}
          {activeTab === 'contact' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                  Contact & Socials
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                  Bakery Phone Numbers, Email & Social Media Handles
                </h3>
                <p className="text-xs text-[#3B211B]/70 mt-1">
                  Updates made here immediately propagate to the website top announcement bar, header, contact modals, and footer.
                </p>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Display Phone */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#C47B55]" />
                      Display Phone Number
                    </label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="(555) 392-CAKE"
                      className="w-full p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                    <p className="text-[11px] text-[#3B211B]/60 mt-1.5">Visible on customer header & footer</p>
                  </div>

                  {/* Click-to-call Phone */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#C47B55]" />
                      Click-to-Call Phone (Tel link)
                    </label>
                    <input
                      type="text"
                      value={contactForm.phoneRaw}
                      onChange={(e) => setContactForm({ ...contactForm, phoneRaw: e.target.value })}
                      placeholder="+15553922253"
                      className="w-full p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                    <p className="text-[11px] text-[#3B211B]/60 mt-1.5">Used for direct mobile dialer links</p>
                  </div>

                  {/* Bakery Email */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#3B211B] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#C47B55]" />
                        Official Bakery Contact Email
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setContactForm({ ...contactForm, email: 'preethipreethu712@gmail.com' });
                          triggerSuccess('Applied official bakery email: preethipreethu712@gmail.com!');
                        }}
                        className="text-[10px] text-[#C47B55] hover:underline font-bold cursor-pointer"
                      >
                        Set Official Mail (preethipreethu712@gmail.com)
                      </button>
                    </div>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="preethipreethu712@gmail.com"
                      className="w-full p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                  </div>

                  {/* Instagram ID or Full URL */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#3B211B] flex items-center gap-1.5">
                        <Instagram className="w-3.5 h-3.5 text-[#C47B55]" />
                        Instagram URL or Profile ID
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setContactForm({ ...contactForm, instagramId: OFFICIAL_INSTAGRAM_URL });
                          triggerSuccess('Applied official working Instagram profile URL!');
                        }}
                        className="text-[10px] text-[#C47B55] hover:underline font-bold cursor-pointer"
                        title="Click to paste the verified official Instagram URL"
                      >
                        Set Official URL
                      </button>
                    </div>
                    <input
                      type="text"
                      value={contactForm.instagramId}
                      onChange={(e) => setContactForm({ ...contactForm, instagramId: e.target.value })}
                      placeholder="e.g. https://www.instagram.com/browniegirlcakes?exln=dTU4eXBuMjNmYmJr"
                      className="w-full p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-mono text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#3B211B]/70">
                      <span className="truncate">
                        Resolves to: <a href={getInstagramUrl(contactForm.instagramId)} target="_blank" rel="noopener noreferrer" className="text-[#C47B55] font-semibold underline truncate inline-block max-w-[240px] align-bottom">{getInstagramUrl(contactForm.instagramId)}</a>
                      </span>
                      <ExternalLink className="w-3 h-3 text-[#C47B55] shrink-0 ml-1" />
                    </div>
                  </div>

                  {/* WhatsApp Inquiry Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp Inquiry Phone Number
                    </label>
                    <input
                      type="text"
                      value={contactForm.whatsappNumber || '7339651529'}
                      onChange={(e) => setContactForm({ ...contactForm, whatsappNumber: e.target.value })}
                      placeholder="7339651529"
                      className="w-full p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                    <p className="text-[11px] text-[#3B211B]/60 mt-1.5">
                      Customer chats route directly to WhatsApp (+91 {contactForm.whatsappNumber || '7339651529'})
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#F8F0E5] flex justify-end">
                  <button
                    onClick={async () => {
                      await updateSettings(contactForm);
                      triggerSuccess('Phone numbers, email, and social IDs saved and updated live on the website!');
                    }}
                    className="px-6 py-3 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Contact & Socials</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BROWNIE & BENTO CAKES MENU & PRICES */}
          {activeTab === 'menu' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                    Menu &amp; Catalog Access Control
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                    Cake Menu (Normal &amp; Premium), Brownies, Boxes, Frosted &amp; Bento Cakes
                  </h3>
                  <p className="text-xs text-[#3B211B]/70 mt-1">
                    Add or edit cakes &amp; brownies, update ½ KG and 1 KG prices, upload/replace photos with live preview, enable/disable products, and click Save / Update.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const targetCat: MenuCategory =
                      menuCategoryFilter !== 'all' ? menuCategoryFilter : 'cake_normal';
                    const isNoKg =
                      targetCat === 'assorted_box' || targetCat === 'frosted_brownie';
                    setNewBrownie({
                      name: '',
                      subtitle: '',
                      description: '',
                      price:
                        targetCat === 'assorted_box'
                          ? '₹650'
                          : targetCat === 'frosted_brownie'
                          ? '₹150'
                          : targetCat === 'cake_premium'
                          ? '₹650'
                          : '₹500',
                      priceHalfKg:
                        isNoKg
                          ? undefined
                          : targetCat === 'cake_premium'
                          ? '₹650'
                          : '₹500',
                      priceOneKg:
                        isNoKg
                          ? undefined
                          : targetCat === 'cake_premium'
                          ? '₹1,200'
                          : '₹900',
                      category: targetCat,
                      image:
                        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=900&auto=format&fit=crop',
                      badge: 'Bestseller',
                      cocoaPercentage:
                        targetCat === 'cake_normal'
                          ? 'Normal Flavour'
                          : targetCat === 'cake_premium'
                          ? 'Premium Flavour'
                          : targetCat === 'bento_cake'
                          ? 'Per Kg'
                          : '72% Dark',
                      flavorNotes: ['Artisan Handcrafted'],
                      enabled: true,
                    });
                    setNewBrownieError(null);
                    setIsAddingBrownie(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-bold transition-all shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 text-[#E5A962]" />
                  <span>+ Add New Cake / Menu Item</span>
                </button>
              </div>

              {/* Section Filter Tabs */}
              <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-[#E8D6C3] shadow-xs">
                {(
                  [
                    { id: 'all', label: `All Sections (${menuItems.length})` },
                    {
                      id: 'cake_normal',
                      label: `Cake Menu: Normal Flavours (${menuItems.filter((i) => i.category === 'cake_normal').length})`,
                    },
                    {
                      id: 'cake_premium',
                      label: `Cake Menu: Premium Flavours (${menuItems.filter((i) => i.category === 'cake_premium').length})`,
                    },
                    {
                      id: 'brownie',
                      label: `Brownie (${menuItems.filter((i) => !i.category || i.category === 'brownie').length})`,
                    },
                    {
                      id: 'assorted_box',
                      label: `Assorted Brownie Boxes (${menuItems.filter((i) => i.category === 'assorted_box').length})`,
                    },
                    {
                      id: 'frosted_brownie',
                      label: `Frosted Brownies (${menuItems.filter((i) => i.category === 'frosted_brownie').length})`,
                    },
                    {
                      id: 'bento_cake',
                      label: `Bento Cakes (${menuItems.filter((i) => i.category === 'bento_cake').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMenuCategoryFilter(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      menuCategoryFilter === tab.id
                        ? 'bg-[#3B211B] text-[#E5A962] shadow-xs'
                        : 'bg-[#F8F0E5]/70 text-[#3B211B] hover:bg-[#E8D6C3]/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add New Menu Item Form */}
              {isAddingBrownie && (
                <div className="p-6 bg-white rounded-3xl border-2 border-[#C47B55] shadow-lg space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-lg font-bold text-[#3B211B] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C47B55]" />
                      Add New Cake or Brownie Product to Menu
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBrownie(false);
                        setNewBrownieError(null);
                      }}
                      className="text-xs text-[#3B211B]/60 hover:text-black font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {newBrownieError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{newBrownieError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Menu Section / Category *</label>
                      <select
                        value={newBrownie.category || 'cake_normal'}
                        onChange={(e) => {
                          const nextCat = e.target.value as MenuCategory;
                          const isNoKg =
                            nextCat === 'assorted_box' || nextCat === 'frosted_brownie';
                          setNewBrownie((prev) => ({
                            ...prev,
                            category: nextCat,
                            priceHalfKg: isNoKg ? undefined : prev.priceHalfKg || prev.price || '₹500',
                            priceOneKg: isNoKg ? undefined : prev.priceOneKg || '₹900',
                            cocoaPercentage:
                              nextCat === 'cake_normal'
                                ? 'Normal Flavour'
                                : nextCat === 'cake_premium'
                                ? 'Premium Flavour'
                                : nextCat === 'bento_cake'
                                ? 'Per Kg'
                                : '72% Dark',
                          }));
                          setNewBrownieError(null);
                        }}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B]"
                      >
                        <option value="cake_normal">1. Cake Menu — Normal Flavours (½ KG &amp; 1 KG)</option>
                        <option value="cake_premium">2. Cake Menu — Premium Flavours (½ KG &amp; 1 KG)</option>
                        <option value="brownie">3. Brownie (½ KG &amp; 1 KG)</option>
                        <option value="assorted_box">4. Assorted Brownie Boxes</option>
                        <option value="frosted_brownie">5. Frosted Brownies</option>
                        <option value="bento_cake">6. Bento Cakes (½ KG &amp; 1 KG)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Product Name *</label>
                      <input
                        type="text"
                        value={newBrownie.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBrownie((prev) => ({ ...prev, name: val }));
                          setNewBrownieError(null);
                        }}
                        placeholder="e.g. Classic Vanilla Cake / Lotus Biscoff Cake"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-semibold focus:outline-none focus:border-[#C47B55]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Badge (Optional)</label>
                      <input
                        type="text"
                        value={newBrownie.badge || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBrownie((prev) => ({ ...prev, badge: val }));
                        }}
                        placeholder="Bestseller / Chef Special"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>

                    {(newBrownie.category || 'cake_normal') === 'cake_normal' ||
                    newBrownie.category === 'cake_premium' ||
                    newBrownie.category === 'brownie' ||
                    newBrownie.category === 'bento_cake' ? (
                      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-[#3B211B] block mb-1">
                            ½ KG Price (₹) *
                          </label>
                          <input
                            type="text"
                            value={newBrownie.priceHalfKg || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewBrownie((prev) => ({
                                ...prev,
                                priceHalfKg: val,
                                price: val,
                              }));
                              setNewBrownieError(null);
                            }}
                            placeholder="₹500"
                            className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#3B211B] block mb-1">
                            1 KG Price (₹) *
                          </label>
                          <input
                            type="text"
                            value={newBrownie.priceOneKg || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewBrownie((prev) => ({
                                ...prev,
                                priceOneKg: val,
                              }));
                              setNewBrownieError(null);
                            }}
                            placeholder="₹900"
                            className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-[#3B211B] block mb-1">
                          {newBrownie.category === 'assorted_box'
                            ? 'Assorted Box Price (₹) *'
                            : 'Frosted Brownie Price (₹) *'}
                        </label>
                        <input
                          type="text"
                          value={newBrownie.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBrownie((prev) => ({
                              ...prev,
                              price: val,
                              priceHalfKg: undefined,
                              priceOneKg: undefined,
                            }));
                            setNewBrownieError(null);
                          }}
                          placeholder={newBrownie.category === 'assorted_box' ? '₹650' : '₹150'}
                          className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B]"
                        />
                      </div>
                    )}

                    {/* Product Image Upload + Live Preview Before Saving */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#3B211B]">
                          Product Photo (Upload from Device or Paste URL) *
                        </label>
                        <LocalImageUploader
                          label="Upload Photo from Device"
                          maxWidth={800}
                          quality={0.78}
                          className="py-1 px-2.5 text-[10px]"
                          onImageSelected={(dataUrl) => {
                            setNewBrownie((prev) => ({ ...prev, image: dataUrl }));
                            setNewBrownieError(null);
                            triggerSuccess('Photo loaded in preview! Click "Save Item to Menu" below to publish.');
                          }}
                        />
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={
                              newBrownie.image ||
                              'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop'
                            }
                            alt={newBrownie.name || 'New product preview'}
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-[#C47B55] bg-[#F8F0E5]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop';
                            }}
                          />
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#3B211B] text-[#E5A962] text-[8px] font-bold uppercase whitespace-nowrap">
                            Preview
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={newBrownie.image}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewBrownie((prev) => ({ ...prev, image: val }));
                              setNewBrownieError(null);
                            }}
                            placeholder="Paste image URL or click Upload Photo above"
                            className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-mono"
                          />
                          <ImagePixelSizeHint
                            imageUrl={newBrownie.image}
                            recommendedPx="800 × 800 px (Square)"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Subtitle / Note</label>
                      <input
                        type="text"
                        value={newBrownie.subtitle}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBrownie((prev) => ({ ...prev, subtitle: val }));
                        }}
                        placeholder="e.g. 70% Belgian Dark Chocolate"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={newBrownie.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBrownie((prev) => ({ ...prev, description: val }));
                        }}
                        placeholder="Rich description of flavor notes, frosting, or sponge layers..."
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBrownie(false);
                        setNewBrownieError(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-[#3B211B] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingNewBrownie}
                      onClick={async () => {
                        const cleanName = (newBrownie.name || '').trim();
                        if (!cleanName) {
                          setNewBrownieError('Please enter a valid product name before saving.');
                          return;
                        }
                        const cat = newBrownie.category || 'brownie';
                        const isNoKg = cat === 'assorted_box' || cat === 'frosted_brownie';
                        if (isNoKg && !(newBrownie.price || '').trim()) {
                          setNewBrownieError('Please enter a valid price for this product.');
                          return;
                        }
                        if (!isNoKg && !(newBrownie.priceHalfKg || newBrownie.price || '').trim()) {
                          setNewBrownieError('Please enter the ½ KG and 1 KG prices for this product.');
                          return;
                        }
                        if (!(newBrownie.image || '').trim()) {
                          setNewBrownieError('Please upload a product photo or enter an image URL.');
                          return;
                        }

                        try {
                          setIsSavingNewBrownie(true);
                          setNewBrownieError(null);
                          await addMenuItem({
                            ...newBrownie,
                            name: cleanName,
                          });
                          setIsAddingBrownie(false);
                          triggerSuccess(
                            `Added "${cleanName}" to ${MENU_CATEGORY_LABELS[cat]}!`
                          );
                        } catch {
                          setNewBrownieError('Could not save new product. Please try again.');
                        } finally {
                          setIsSavingNewBrownie(false);
                        }
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] disabled:opacity-60 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingNewBrownie ? 'Saving...' : 'Save Item to Menu'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Grouped Sections List */}
              {(
                [
                  {
                    key: 'cake_normal' as MenuCategory,
                    title: '1. CAKE MENU — NORMAL FLAVOURS (½ KG & 1 KG Weight Pricing)',
                    subtitle: '12 classic & fruit cake flavours with ½ KG and 1 KG weight options',
                  },
                  {
                    key: 'cake_premium' as MenuCategory,
                    title: '2. CAKE MENU — PREMIUM FLAVOURS (½ KG & 1 KG Weight Pricing)',
                    subtitle: '11 luxury, fusion & viral cake flavours with ½ KG and 1 KG weight options',
                  },
                  {
                    key: 'brownie' as MenuCategory,
                    title: '3. BROWNIE (½ KG & 1 KG Weight Pricing)',
                    subtitle: 'Main brownie varieties with ½ KG and 1 KG weight options',
                  },
                  {
                    key: 'assorted_box' as MenuCategory,
                    title: '4. ASSORTED BROWNIE BOXES',
                    subtitle: 'Curated multi-flavor assorted brownie gift & tasting boxes (Box Pricing)',
                  },
                  {
                    key: 'frosted_brownie' as MenuCategory,
                    title: '5. FROSTED BROWNIES (Standalone & Optional Add-Ons)',
                    subtitle: 'Ganache, praline, Biscoff & Kunafa topped brownies (Piece Pricing — No KG)',
                  },
                  {
                    key: 'bento_cake' as MenuCategory,
                    title: '6. BENTO CAKES (½ KG & 1 KG Weight Pricing)',
                    subtitle: 'Celebration & bento cakes with ½ KG and 1 KG weight options',
                  },
                ] as const
              )
                .filter((sec) => menuCategoryFilter === 'all' || menuCategoryFilter === sec.key)
                .map((section) => {
                  const sectionItems = menuItems.filter((item) =>
                    section.key === 'brownie'
                      ? !item.category || item.category === 'brownie'
                      : item.category === section.key
                  );

                  return (
                    <div key={section.key} className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E8D6C3]">
                        <div>
                          <h4 className="font-serif text-lg font-bold text-[#3B211B] flex items-center gap-2">
                            <span>{section.title}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs bg-[#3B211B] text-[#E5A962] font-mono">
                              {sectionItems.length} items
                            </span>
                          </h4>
                          <p className="text-xs text-[#3B211B]/70">{section.subtitle}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const isNoKg =
                              section.key === 'assorted_box' || section.key === 'frosted_brownie';
                            setNewBrownie((prev) => ({
                              ...prev,
                              category: section.key,
                              name: '',
                              subtitle: '',
                              description: '',
                              price:
                                section.key === 'assorted_box'
                                  ? '₹650'
                                  : section.key === 'frosted_brownie'
                                  ? '₹150'
                                  : section.key === 'cake_premium'
                                  ? '₹650'
                                  : '₹500',
                              priceHalfKg:
                                isNoKg
                                  ? undefined
                                  : section.key === 'cake_premium'
                                  ? '₹650'
                                  : '₹500',
                              priceOneKg:
                                isNoKg
                                  ? undefined
                                  : section.key === 'cake_premium'
                                  ? '₹1,200'
                                  : '₹900',
                              enabled: true,
                            }));
                            setNewBrownieError(null);
                            setIsAddingBrownie(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] border border-[#E8D6C3] text-xs font-bold cursor-pointer self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#C47B55]" />
                          <span>Add to {MENU_CATEGORY_LABELS[section.key]}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectionItems.map((brownie, idx) => {
                          const draft: BrownieItem = menuDrafts[brownie.id]
                            ? { ...brownie, ...menuDrafts[brownie.id] }
                            : brownie;
                          const isDirty = Boolean(dirtyMenuIds[brownie.id]);
                          const isSaving = Boolean(savingMenuIds[brownie.id]);
                          const isJustSaved = Boolean(savedMenuIds[brownie.id]);
                          const itemError = menuItemErrors[brownie.id];
                          const isExpanded = expandedBrownieId === brownie.id;
                          const itemCategory = draft.category || brownie.category || 'brownie';
                          const hasNewImagePreview = draft.image !== brownie.image;
                          const isEnabled = draft.enabled !== false;

                          return (
                            <div
                              key={brownie.id}
                              className={`bg-white p-5 rounded-3xl border shadow-sm flex flex-col justify-between gap-4 transition-colors ${
                                !isEnabled
                                  ? 'opacity-70 border-stone-300 bg-stone-50/70'
                                  : isDirty
                                  ? 'border-2 border-[#C47B55] ring-2 ring-[#C47B55]/15'
                                  : 'border-[#E8D6C3]'
                              }`}
                            >
                              <div className="flex gap-4">
                                <div className="relative shrink-0">
                                  <img
                                    src={draft.image}
                                    alt={draft.name || brownie.name}
                                    className={`w-20 h-20 rounded-2xl object-cover border-2 ${
                                      hasNewImagePreview
                                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                        : 'border-[#E5A962]/60'
                                    }`}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop';
                                    }}
                                  />
                                  <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#3B211B] text-[#E5A962] text-[10px] font-bold flex items-center justify-center shadow-xs">
                                    #{idx + 1}
                                  </span>
                                  {hasNewImagePreview && (
                                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[8px] font-bold uppercase whitespace-nowrap shadow-xs">
                                      Preview
                                    </span>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55]">
                                      {MENU_CATEGORY_LABELS[itemCategory]}
                                    </span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const nextEnabled = !isEnabled;
                                          handleMenuDraftChange(brownie, { enabled: nextEnabled });
                                          await updateMenuItem(brownie.id, { enabled: nextEnabled });
                                          triggerSuccess(
                                            `"${draft.name || brownie.name}" is now ${
                                              nextEnabled ? 'Enabled (Visible on Menu)' : 'Disabled (Hidden on Menu)'
                                            }`
                                          );
                                        }}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                                          isEnabled
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                            : 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'
                                        }`}
                                        title="Click to enable or disable this product on the customer menu"
                                      >
                                        {isEnabled ? (
                                          <>
                                            <Eye className="w-2.5 h-2.5" />
                                            <span>Enabled</span>
                                          </>
                                        ) : (
                                          <>
                                            <EyeOff className="w-2.5 h-2.5" />
                                            <span>Disabled</span>
                                          </>
                                        )}
                                      </button>
                                      {isDirty && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                          Unsaved Edits
                                        </span>
                                      )}
                                      {isJustSaved && !isDirty && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          Saved ✓
                                        </span>
                                      )}
                                      {draft.badge && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#3B211B] text-[#E8D6C3]">
                                          {draft.badge}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <label className="text-[10px] font-bold text-[#3B211B]/70 block mb-0.5">
                                    Product Name
                                  </label>
                                  <input
                                    type="text"
                                    value={draft.name}
                                    onChange={(e) =>
                                      handleMenuDraftChange(brownie, { name: e.target.value })
                                    }
                                    placeholder="Enter cake or brownie name"
                                    className="font-serif font-bold text-sm sm:text-base text-[#3B211B] w-full px-2.5 py-1.5 rounded-xl bg-[#F8F0E5]/60 border border-[#E8D6C3] hover:border-[#C47B55] focus:border-[#C47B55] focus:bg-white focus:outline-none transition-colors"
                                    title="Edit product name and click Save / Update below"
                                  />
                                  <p className="text-xs text-[#3B211B]/70 line-clamp-1 mt-1">
                                    {draft.description}
                                  </p>
                                </div>
                              </div>

                              {itemError && (
                                <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{itemError}</span>
                                </div>
                              )}

                              {/* Direct Price & Photo Access Control */}
                              <div className="pt-3 border-t border-[#F8F0E5] space-y-3">
                                {itemCategory === 'assorted_box' || itemCategory === 'frosted_brownie' ? (
                                  /* NO KG OPTIONS FOR ASSORTED BOXES OR FROSTED BROWNIES */
                                  <div>
                                    <label className="text-[10px] font-bold text-[#3B211B] block mb-0.5">
                                      {itemCategory === 'assorted_box'
                                        ? 'Assorted Box Price (₹)'
                                        : 'Frosted Brownie Price (₹)'}
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.price}
                                      onChange={(e) =>
                                        handleMenuDraftChange(brownie, {
                                          price: e.target.value,
                                          priceHalfKg: undefined,
                                          priceOneKg: undefined,
                                        })
                                      }
                                      placeholder={itemCategory === 'assorted_box' ? '₹650' : '₹150'}
                                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                                    />
                                  </div>
                                ) : (
                                  /* WEIGHT-BASED PRICING (CAKE MENU, BROWNIE & BENTO CAKES): ONLY ½ KG & 1 KG */
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block mb-0.5">
                                        ½ KG Price (₹)
                                      </label>
                                      <input
                                        type="text"
                                        value={
                                          draft.priceHalfKg !== undefined
                                            ? draft.priceHalfKg
                                            : draft.price || ''
                                        }
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, {
                                            priceHalfKg: e.target.value,
                                            price: e.target.value,
                                          })
                                        }
                                        placeholder="₹500"
                                        className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block mb-0.5">
                                        1 KG Price (₹)
                                      </label>
                                      <input
                                        type="text"
                                        value={draft.priceOneKg !== undefined ? draft.priceOneKg : ''}
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, {
                                            priceOneKg: e.target.value,
                                          })
                                        }
                                        placeholder="₹900"
                                        className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Photo Upload & URL Box with Pixel/Size Hint */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-bold text-[#3B211B]">
                                      Item Photo (Upload from Device or Paste URL)
                                    </label>
                                    <LocalImageUploader
                                      label="Upload / Replace Photo"
                                      maxWidth={800}
                                      quality={0.78}
                                      className="py-1 px-2.5 text-[10px]"
                                      onImageSelected={(dataUrl) => {
                                        handleMenuDraftChange(brownie, { image: dataUrl });
                                        triggerSuccess(
                                          `Photo preview loaded for "${draft.name || brownie.name}". Click "Save / Update" to publish!`
                                        );
                                      }}
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={draft.image}
                                    onChange={(e) =>
                                      handleMenuDraftChange(brownie, { image: e.target.value })
                                    }
                                    placeholder="Paste image URL or click Upload / Replace Photo"
                                    className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-[11px] font-mono text-[#3B211B] truncate"
                                  />
                                  <ImagePixelSizeHint
                                    imageUrl={draft.image}
                                    recommendedPx="800 × 800 px"
                                    recommendedSize="< 150 KB"
                                  />
                                </div>
                              </div>

                              {/* Expandable fields */}
                              {isExpanded && (
                                <div className="p-3 bg-[#F8F0E5]/50 rounded-xl space-y-2 border border-[#E8D6C3] animate-in fade-in">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block">
                                        Section Category
                                      </label>
                                      <select
                                        value={itemCategory}
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, {
                                            category: e.target.value as MenuCategory,
                                          })
                                        }
                                        className="w-full p-1.5 bg-white border border-[#E8D6C3] rounded-md text-xs font-semibold"
                                      >
                                        <option value="cake_normal">Cake Menu — Normal Flavours</option>
                                        <option value="cake_premium">Cake Menu — Premium Flavours</option>
                                        <option value="brownie">Brownie</option>
                                        <option value="assorted_box">Assorted Brownie Boxes</option>
                                        <option value="frosted_brownie">Frosted Brownies</option>
                                        <option value="bento_cake">Bento Cakes</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block">
                                        Badge
                                      </label>
                                      <input
                                        type="text"
                                        value={draft.badge || ''}
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, { badge: e.target.value })
                                        }
                                        className="w-full p-1.5 bg-white border border-[#E8D6C3] rounded-md text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block">
                                        Subtitle
                                      </label>
                                      <input
                                        type="text"
                                        value={draft.subtitle}
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, { subtitle: e.target.value })
                                        }
                                        className="w-full p-1.5 bg-white border border-[#E8D6C3] rounded-md text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[#3B211B] block">
                                        Tag / Label
                                      </label>
                                      <input
                                        type="text"
                                        value={draft.cocoaPercentage}
                                        onChange={(e) =>
                                          handleMenuDraftChange(brownie, {
                                            cocoaPercentage: e.target.value,
                                          })
                                        }
                                        className="w-full p-1.5 bg-white border border-[#E8D6C3] rounded-md text-xs"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-[#3B211B] block">
                                      Description
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={draft.description}
                                      onChange={(e) =>
                                        handleMenuDraftChange(brownie, {
                                          description: e.target.value,
                                        })
                                      }
                                      className="w-full p-1.5 bg-white border border-[#E8D6C3] rounded-md text-xs"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Card Footer: Extra Fields Toggle, Save/Update & Delete */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F8F0E5]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedBrownieId(isExpanded ? null : brownie.id)
                                  }
                                  className="text-xs text-[#C47B55] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                  <span>
                                    {isExpanded ? 'Hide Extra Fields' : 'Edit Section & Description'}
                                  </span>
                                </button>

                                <div className="flex items-center gap-2">
                                  {isDirty && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetMenuDraft(brownie.id)}
                                      className="px-2.5 py-1.5 rounded-xl bg-[#F8F0E5] hover:bg-[#E8D6C3] text-[#3B211B] text-[11px] font-semibold cursor-pointer transition-colors"
                                      title="Discard unsaved changes"
                                    >
                                      Reset
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleSaveMenuItem(brownie)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                                      isDirty
                                        ? 'bg-[#C47B55] hover:bg-[#D98B5F] text-white shadow-sm'
                                        : 'bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5]'
                                    } disabled:opacity-50`}
                                    title="Save product name, image, and price updates to database"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>
                                      {isSaving
                                        ? 'Saving...'
                                        : isDirty
                                        ? 'Save / Update'
                                        : 'Update'}
                                    </span>
                                  </button>

                                  {deletingBrownieId === brownie.id ? (
                                    <div className="flex items-center gap-1.5 p-1 bg-red-50 border border-red-300 rounded-xl animate-in fade-in">
                                      <span className="text-[10px] font-bold text-red-700 px-1">
                                        Delete?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          await deleteMenuItem(brownie.id);
                                          setDeletingBrownieId(null);
                                          handleResetMenuDraft(brownie.id);
                                          triggerSuccess(`Deleted "${brownie.name}"`);
                                        }}
                                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold cursor-pointer"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setDeletingBrownieId(null);
                                        }}
                                        className="px-2 py-0.5 bg-white text-[#3B211B] rounded-md text-[10px] font-semibold cursor-pointer border border-[#E8D6C3]"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeletingBrownieId(brownie.id);
                                      }}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs flex items-center gap-1 cursor-pointer font-semibold"
                                      title="Delete item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* TAB 4: BAKING CLASS SCHEDULE & TIMES */}
          {activeTab === 'classes' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                    Studio & Online Masterclasses
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                    Manage Online Class Times & Batch Dates
                  </h3>
                  <p className="text-xs text-[#3B211B]/70 mt-1">
                    Update scheduled class batch times, online masterclasses, durations, skill levels, and booking fees.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingClass(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-bold transition-all shadow-md cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4 text-[#E5A962]" />
                  <span>+ Add New Class</span>
                </button>
              </div>

              {/* Customizable Footer Online Class Time Slot Card */}
              <div className="p-5 sm:p-6 bg-white rounded-3xl border border-[#E8D6C3] shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Public Website Footer Time Slot (Customizable)
                    </span>
                    <h4 className="font-serif text-base font-bold text-[#3B211B]">
                      Online Class Time Shown in Website Footer
                    </h4>
                    <p className="text-xs text-[#3B211B]/70">
                      Update the online class time to display in the website footer. If no time is mentioned (or marked not started), the footer automatically shows <strong>&ldquo;The class is not yet started&rdquo;</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...settings, onlineClassTime: '__NOT_STARTED__' };
                      setContactForm(updated);
                      await updateSettings(updated);
                      triggerSuccess('Footer time slot set to "The class is not yet started"!');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    Show &ldquo;The class is not yet started&rdquo;
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <input
                    type="text"
                    value={
                      contactForm.onlineClassTime === '__NOT_STARTED__'
                        ? ''
                        : contactForm.onlineClassTime || ''
                    }
                    onChange={(e) =>
                      setContactForm({ ...contactForm, onlineClassTime: e.target.value })
                    }
                    placeholder='e.g. Saturday & Sunday: 11:00 AM – 2:00 PM (Leave empty if class is not yet started)'
                    className="flex-1 p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmed = (contactForm.onlineClassTime || '').trim();
                      const nextVal = trimmed ? trimmed : '__NOT_STARTED__';
                      const updated = { ...settings, onlineClassTime: nextVal };
                      setContactForm(updated);
                      await updateSettings(updated);
                      triggerSuccess(
                        trimmed
                          ? `Updated footer online class time to "${trimmed}"!`
                          : 'No time mentioned — Footer now shows "The class is not yet started"!'
                      );
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Update Footer Time</span>
                  </button>
                </div>
              </div>

              {/* Add Class Form */}
              {isAddingClass && (
                <div className="p-6 bg-white rounded-3xl border-2 border-[#C47B55] shadow-lg space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-lg font-bold text-[#3B211B] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#C47B55]" />
                      Create New Baking Masterclass
                    </h4>
                    <button
                      onClick={() => setIsAddingClass(false)}
                      className="text-xs text-[#3B211B]/60 hover:text-black font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Class Title *</label>
                      <input
                        type="text"
                        value={newClass.title}
                        onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                        placeholder="e.g. Live Online Holiday Ganache & Brownie Workshop"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Price / Fee *</label>
                      <input
                        type="text"
                        value={newClass.price}
                        onChange={(e) => setNewClass({ ...newClass, price: e.target.value })}
                        placeholder="₹1,999 / person"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Duration</label>
                      <input
                        type="text"
                        value={newClass.duration}
                        onChange={(e) => setNewClass({ ...newClass, duration: e.target.value })}
                        placeholder="2.5 Hours"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">Skill Level</label>
                      <input
                        type="text"
                        value={newClass.level}
                        onChange={(e) => setNewClass({ ...newClass, level: e.target.value })}
                        placeholder="All Levels (Beginner to Advanced)"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">
                        Class Format (Online / Offline) *
                      </label>
                      <select
                        value={newClass.format || 'Online'}
                        onChange={(e) => setNewClass({ ...newClass, format: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                      >
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                        <option value="Online & Offline">Online &amp; Offline</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-xs font-bold text-[#3B211B] block mb-1">
                        Scheduled Class Time Slot (Optional — leave blank if class is not yet started)
                      </label>
                      <input
                        type="text"
                        value={newClassInitialSlot}
                        onChange={(e) => setNewClassInitialSlot(e.target.value)}
                        placeholder="e.g. Saturday, Nov 15 @ 11:00 AM (Leave blank if not yet started)"
                        className="w-full p-2.5 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <label className="text-xs font-bold text-[#3B211B] block">
                          Class Description &amp; Curriculum (Shown to customers when booking) *
                        </label>
                        <span className="text-[11px] text-[#C47B55] font-semibold">
                          Supports uppercase headings, paragraphs, bullet points (&bull; / -), numbered lists &amp; blank lines
                        </span>
                      </div>
                      <textarea
                        rows={10}
                        value={newClass.description}
                        onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                        placeholder={`ARTISAN BAKING CLASSES\n\nCAKE BAKING\n• Chocolate Cake\n• Red Velvet\n• Black Forest\n\nDREAM CAKE\nA rich chocolate cake with layers of chocolate mousse, moist cake and chocolate crumbs.`}
                        className="w-full p-3 bg-[#F8F0E5]/50 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm text-[#3B211B] leading-relaxed whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                      />
                      {newClass.description.trim().length > 0 && (
                        <div className="p-4 rounded-2xl bg-[#F8F0E5]/40 border border-[#E8D6C3] space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55] block">
                            Public Website Structured Preview
                          </span>
                          <StructuredClassDescription description={newClass.description} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setIsAddingClass(false)}
                      className="px-4 py-2 text-xs font-semibold text-[#3B211B] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newClass.title.trim()) {
                          triggerSuccess('Please enter a class title.');
                          return;
                        }
                        const initialDates = newClassInitialSlot.trim()
                          ? [newClassInitialSlot.trim()]
                          : [];
                        await addClass({
                          ...newClass,
                          format: newClass.format || 'Online',
                          dates: initialDates,
                        });
                        if (newClassInitialSlot.trim()) {
                          const updatedSettings = {
                            ...settings,
                            onlineClassTime: newClassInitialSlot.trim(),
                          };
                          setContactForm(updatedSettings);
                          await updateSettings(updatedSettings);
                        }
                        setNewClassInitialSlot('');
                        setIsAddingClass(false);
                        triggerSuccess(`Added masterclass "${newClass.title}" (${newClass.format || 'Online'})!`);
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs font-bold shadow-md cursor-pointer"
                    >
                      Save New Class
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Classes List */}
              <div className="space-y-4">
                {bakingClasses.map((cls) => {
                  const draft: BakingClassInfo = classDrafts[cls.id]
                    ? { ...cls, ...classDrafts[cls.id] }
                    : cls;
                  const isDirty = Boolean(dirtyClassIds[cls.id]);
                  const isSaving = Boolean(savingClassIds[cls.id]);
                  const isSaved = Boolean(savedClassIds[cls.id]);
                  const isExpanded = expandedClassId === cls.id;
                  const currentAddDate = classDateInputs[cls.id] || '';
                  const clsFormat = draft.format || 'Online';

                  return (
                    <div
                      key={cls.id}
                      className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55] bg-[#F8F0E5] px-2.5 py-0.5 rounded-md">
                              {draft.level} &bull; {draft.duration}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                clsFormat.toLowerCase().includes('offline') &&
                                !clsFormat.toLowerCase().includes('online')
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {clsFormat}
                            </span>
                            {isDirty && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                Unsaved Changes
                              </span>
                            )}
                          </div>
                          <h4 className="font-serif text-lg font-bold text-[#3B211B] mt-1">
                            {draft.title}
                          </h4>
                          <p className="text-xs text-[#3B211B]/70 mt-1 line-clamp-2 whitespace-pre-line">
                            {draft.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                          <div>
                            <span className="text-[10px] font-bold text-[#3B211B] block">
                              Format (Public Site)
                            </span>
                            <select
                              value={clsFormat}
                              onChange={(e) => {
                                handleClassDraftChange(cls, { format: e.target.value });
                              }}
                              className="p-2 px-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B] cursor-pointer"
                            >
                              <option value="Online">Online</option>
                              <option value="Offline">Offline</option>
                              <option value="Online & Offline">Online &amp; Offline</option>
                            </select>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold text-[#3B211B] block">Fee / Person</span>
                            <input
                              type="text"
                              value={draft.price}
                              onChange={(e) => handleClassDraftChange(cls, { price: e.target.value })}
                              className="p-2 px-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-bold text-[#3B211B] w-28 text-right"
                            />
                          </div>
                          {deletingClassId === cls.id ? (
                            <div className="flex items-center gap-1.5 p-1.5 bg-red-50 border border-red-300 rounded-xl animate-in fade-in shadow-xs">
                              <span className="text-[11px] font-bold text-red-700 px-1">Delete class?</span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await deleteClass(cls.id);
                                  setDeletingClassId(null);
                                  triggerSuccess(`Permanently deleted class "${cls.title}"`);
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Yes, Delete
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeletingClassId(null);
                                }}
                                className="px-2 py-1 bg-white hover:bg-stone-100 text-[#3B211B] rounded-lg text-[11px] font-semibold cursor-pointer border border-[#E8D6C3] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeletingClassId(cls.id);
                              }}
                              className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                              title="Delete masterclass"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scheduled Class Times & Dates */}
                      <div className="p-4 sm:p-5 bg-[#F8F0E5]/50 rounded-2xl border border-[#E8D6C3] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#3B211B] uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#C47B55]" />
                            Scheduled Class Times ({(draft.dates || []).length} Available Slots):
                          </span>
                        </div>

                        <div className="space-y-2">
                          {(draft.dates || []).map((dateStr, dIdx) => (
                            <div key={dIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={dateStr}
                                onChange={(e) => {
                                  const newDates = [...(draft.dates || [])];
                                  newDates[dIdx] = e.target.value;
                                  handleClassDraftChange(cls, { dates: newDates });
                                }}
                                className="flex-1 p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-medium"
                              />
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newDates = (draft.dates || []).filter((_, idx) => idx !== dIdx);
                                  handleClassDraftChange(cls, { dates: newDates });
                                  await updateClass(cls.id, { dates: newDates });
                                  triggerSuccess('Removed scheduled class time slot');
                                }}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg text-xs cursor-pointer transition-colors"
                                title="Remove scheduled class time slot"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add new date slot for this class */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="e.g. Every Thursday @ 7:00 PM (Live Online) or Saturday @ 2:00 PM"
                            value={currentAddDate}
                            onChange={(e) =>
                              setClassDateInputs({ ...classDateInputs, [cls.id]: e.target.value })
                            }
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!currentAddDate.trim()) return;
                                const newDates = [...(draft.dates || []), currentAddDate.trim()];
                                handleClassDraftChange(cls, { dates: newDates });
                                await updateClass(cls.id, { dates: newDates });
                                setClassDateInputs({ ...classDateInputs, [cls.id]: '' });
                                triggerSuccess('Added new class session time!');
                              }
                            }}
                            className="flex-1 p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                          />
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!currentAddDate.trim()) return;
                              const newDates = [...(draft.dates || []), currentAddDate.trim()];
                              handleClassDraftChange(cls, { dates: newDates });
                              await updateClass(cls.id, { dates: newDates });
                              setClassDateInputs({ ...classDateInputs, [cls.id]: '' });
                              triggerSuccess('Added new class session time!');
                            }}
                            className="px-4 py-2.5 bg-[#C47B55] hover:bg-[#D98B5F] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                          >
                            + Add Time Slot
                          </button>
                        </div>
                      </div>

                      {/* Class Title, Details & Multi-Line Structured Description Editor */}
                      <div className="p-4 sm:p-5 bg-[#F8F0E5]/35 rounded-2xl border border-[#E8D6C3] space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-[#3B211B] block mb-1">Class Title *</label>
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(e) => handleClassDraftChange(cls, { title: e.target.value })}
                              className="w-full p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-semibold focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-[#3B211B] block mb-1">Skill Level</label>
                            <input
                              type="text"
                              value={draft.level}
                              onChange={(e) => handleClassDraftChange(cls, { level: e.target.value })}
                              className="w-full p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-[#3B211B] block mb-1">Duration</label>
                            <input
                              type="text"
                              value={draft.duration}
                              onChange={(e) => handleClassDraftChange(cls, { duration: e.target.value })}
                              className="w-full p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                            />
                          </div>
                          <div className="sm:col-span-3 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <label className="text-xs font-bold text-[#3B211B] block">
                                Class Description &amp; Curriculum (Shown in Public Artisan Baking Classes Popup)
                              </label>
                              <span className="text-[11px] text-[#C47B55] font-semibold">
                                Line breaks, UPPERCASE headings, bullet points &amp; blank lines are preserved
                              </span>
                            </div>
                            <textarea
                              rows={10}
                              value={draft.description}
                              onChange={(e) => handleClassDraftChange(cls, { description: e.target.value })}
                              placeholder="Enter headings (e.g. CAKE BAKING), subheadings, paragraphs, bullet points, or numbered lists..."
                              className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs sm:text-sm text-[#3B211B] leading-relaxed whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                            />
                          </div>
                        </div>

                        {/* Live Structured Preview Toggle */}
                        <div className="pt-1 border-t border-[#E8D6C3]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedClassId(isExpanded ? null : cls.id)}
                            className="text-xs text-[#C47B55] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? 'Hide Public Website Preview' : 'Preview Formatted Public Popup Display'}</span>
                          </button>

                          <div className="flex items-center gap-2.5 self-end sm:self-auto">
                            {isDirty && (
                              <button
                                type="button"
                                onClick={() => handleResetClassDraft(cls.id)}
                                className="px-3.5 py-2 rounded-full bg-white hover:bg-stone-100 text-[#3B211B] border border-[#E8D6C3] text-xs font-semibold cursor-pointer transition-colors"
                              >
                                Discard Changes
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveClass(cls)}
                              className={`px-5 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSaved
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#C47B55] hover:bg-[#D98B5F] text-white'
                              }`}
                            >
                              {isSaved ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Saved to Website!</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-3.5 h-3.5" />
                                  <span>{isSaving ? 'Saving...' : 'Save Class Changes'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 bg-white rounded-2xl border border-[#C47B55]/40 space-y-2.5 animate-in fade-in">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C47B55] block border-b border-[#E8D6C3] pb-1.5">
                              Live Public Popup Preview
                            </span>
                            <StructuredClassDescription description={draft.description} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: ACHIEVEMENTS & MILESTONES */}
          {activeTab === 'achievements' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                  Accolades & Milestones
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                  Edit Achievements & Milestones Section
                </h3>
                <p className="text-xs text-[#3B211B]/70 mt-1">
                  Update statistics, baking class graduate counters, review ratings, and industry certifications.
                </p>
              </div>

              {/* 4 Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stat 1 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-2">
                  <span className="text-[11px] font-bold text-[#C47B55] uppercase">Statistic #1</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Number / Stat</label>
                      <input
                        type="text"
                        value={achForm.stat1Value}
                        onChange={(e) => setAchForm({ ...achForm, stat1Value: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-bold text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Label</label>
                      <input
                        type="text"
                        value={achForm.stat1Label}
                        onChange={(e) => setAchForm({ ...achForm, stat1Label: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#3B211B] block">Description</label>
                    <input
                      type="text"
                      value={achForm.stat1Desc}
                      onChange={(e) => setAchForm({ ...achForm, stat1Desc: e.target.value })}
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                    />
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-2">
                  <span className="text-[11px] font-bold text-[#C47B55] uppercase">Statistic #2</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Number / Stat</label>
                      <input
                        type="text"
                        value={achForm.stat2Value}
                        onChange={(e) => setAchForm({ ...achForm, stat2Value: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-bold text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Label</label>
                      <input
                        type="text"
                        value={achForm.stat2Label}
                        onChange={(e) => setAchForm({ ...achForm, stat2Label: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#3B211B] block">Description</label>
                    <input
                      type="text"
                      value={achForm.stat2Desc}
                      onChange={(e) => setAchForm({ ...achForm, stat2Desc: e.target.value })}
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                    />
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-2">
                  <span className="text-[11px] font-bold text-[#C47B55] uppercase">Statistic #3</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Number / Stat</label>
                      <input
                        type="text"
                        value={achForm.stat3Value}
                        onChange={(e) => setAchForm({ ...achForm, stat3Value: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-bold text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Label</label>
                      <input
                        type="text"
                        value={achForm.stat3Label}
                        onChange={(e) => setAchForm({ ...achForm, stat3Label: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#3B211B] block">Description</label>
                    <input
                      type="text"
                      value={achForm.stat3Desc}
                      onChange={(e) => setAchForm({ ...achForm, stat3Desc: e.target.value })}
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                    />
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="bg-white p-6 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-2">
                  <span className="text-[11px] font-bold text-[#C47B55] uppercase">Statistic #4</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Number / Stat</label>
                      <input
                        type="text"
                        value={achForm.stat4Value}
                        onChange={(e) => setAchForm({ ...achForm, stat4Value: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-sm font-bold text-[#3B211B]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#3B211B] block">Label</label>
                      <input
                        type="text"
                        value={achForm.stat4Label}
                        onChange={(e) => setAchForm({ ...achForm, stat4Label: e.target.value })}
                        className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#3B211B] block">Description</label>
                    <input
                      type="text"
                      value={achForm.stat4Desc}
                      onChange={(e) => setAchForm({ ...achForm, stat4Desc: e.target.value })}
                      className="w-full p-2.5 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B]"
                    />
                  </div>
                </div>
              </div>

              {/* Awards and Honors */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#3B211B] block">
                  Industry Awards & Accreditations (3 Cards)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Award 1 */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] space-y-2">
                    <label className="text-[10px] font-bold text-[#3B211B] block">Award 1 Title</label>
                    <input
                      type="text"
                      value={achForm.award1Title}
                      onChange={(e) => setAchForm({ ...achForm, award1Title: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Organization</label>
                    <input
                      type="text"
                      value={achForm.award1Org}
                      onChange={(e) => setAchForm({ ...achForm, award1Org: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Highlight Note</label>
                    <input
                      type="text"
                      value={achForm.award1Note}
                      onChange={(e) => setAchForm({ ...achForm, award1Note: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                  </div>

                  {/* Award 2 */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] space-y-2">
                    <label className="text-[10px] font-bold text-[#3B211B] block">Award 2 Title</label>
                    <input
                      type="text"
                      value={achForm.award2Title}
                      onChange={(e) => setAchForm({ ...achForm, award2Title: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Organization</label>
                    <input
                      type="text"
                      value={achForm.award2Org}
                      onChange={(e) => setAchForm({ ...achForm, award2Org: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Highlight Note</label>
                    <input
                      type="text"
                      value={achForm.award2Note}
                      onChange={(e) => setAchForm({ ...achForm, award2Note: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                  </div>

                  {/* Award 3 */}
                  <div className="bg-white p-5 rounded-2xl border border-[#E8D6C3] space-y-2">
                    <label className="text-[10px] font-bold text-[#3B211B] block">Award 3 Title</label>
                    <input
                      type="text"
                      value={achForm.award3Title}
                      onChange={(e) => setAchForm({ ...achForm, award3Title: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Organization</label>
                    <input
                      type="text"
                      value={achForm.award3Org}
                      onChange={(e) => setAchForm({ ...achForm, award3Org: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                    <label className="text-[10px] font-bold text-[#3B211B] block">Highlight Note</label>
                    <input
                      type="text"
                      value={achForm.award3Note}
                      onChange={(e) => setAchForm({ ...achForm, award3Note: e.target.value })}
                      className="w-full p-2 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-lg text-xs text-[#3B211B]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={async () => {
                    await updateAchievements(achForm);
                    triggerSuccess('Achievements & Awards updated live on the website!');
                  }}
                  className="px-6 py-3 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Achievements Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: CUSTOMER BOOKINGS & CUSTOMER ORDERS */}
          {activeTab === 'bookings' && (() => {
            // Helper to get class price estimate
            const getPriceNum = (classNameStr: string) => {
              const match = bakingClasses.find(
                (c) =>
                  c.title.toLowerCase().includes((classNameStr || '').toLowerCase()) ||
                  (classNameStr || '').toLowerCase().includes(c.title.toLowerCase())
              );
              if (match) {
                const parsed = parseInt(match.price.replace(/[^0-9]/g, ''), 10);
                return isNaN(parsed) ? 1999 : parsed;
              }
              return 1999;
            };

            // Map and group bookings by month
            const monthMap: Record<string, { info: MonthInfo; bookings: any[] }> = {};

            // Ensure current month and next 2 upcoming months are always represented for early assessment
            const now = new Date();
            for (let offset = 0; offset <= 2; offset++) {
              const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
              const mIdx = d.getMonth();
              const yr = d.getFullYear();
              const mKey = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
              monthMap[mKey] = {
                info: {
                  key: mKey,
                  label: `${MONTH_NAMES[mIdx]} ${yr}`,
                  shortLabel: `${MONTH_NAMES[mIdx].slice(0, 3)} ${yr}`,
                  year: yr,
                  monthIndex: mIdx,
                },
                bookings: [],
              };
            }

            // Populate with actual registrations
            allRegistrations.forEach((reg) => {
              const mInfo = parseBookingMonth(reg.preferredDate, reg.createdAt);
              if (!monthMap[mInfo.key]) {
                monthMap[mInfo.key] = { info: mInfo, bookings: [] };
              }
              monthMap[mInfo.key].bookings.push(reg);
            });

            // Sort months chronologically
            const sortedMonthEntries = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));

            // Filter bookings by selected month
            let filteredRegistrations =
              selectedBookingMonth === 'all'
                ? allRegistrations
                : (monthMap[selectedBookingMonth]?.bookings || []);

            // Apply search
            if (bookingSearch.trim()) {
              const q = bookingSearch.toLowerCase();
              filteredRegistrations = filteredRegistrations.filter(
                (r) =>
                  (r.userName || '').toLowerCase().includes(q) ||
                  (r.userEmail || '').toLowerCase().includes(q) ||
                  (r.className || '').toLowerCase().includes(q) ||
                  (r.notes || '').toLowerCase().includes(q)
              );
            }

            // Apply status filter
            if (bookingStatusFilter !== 'all') {
              filteredRegistrations = filteredRegistrations.filter(
                (r) => (r.status || 'registered') === bookingStatusFilter
              );
            }

            // Calculate assessment metrics for currently viewed month or all
            const assessedRegistrations =
              selectedBookingMonth === 'all'
                ? allRegistrations
                : (monthMap[selectedBookingMonth]?.bookings || []);
            const regCount = assessedRegistrations.filter((r) => (r.status || 'registered') === 'registered').length;
            const waitCount = assessedRegistrations.filter((r) => r.status === 'waitlist').length;
            const cancelCount = assessedRegistrations.filter((r) => r.status === 'cancelled').length;
            const projectedRevenue = assessedRegistrations
              .filter((r) => (r.status || 'registered') === 'registered')
              .reduce((sum, r) => sum + getPriceNum(r.className), 0);

            let demandBadge = '⚪ Schedule Open';
            let demandColor = 'bg-stone-100 text-stone-700 border-stone-200';
            let adviceMessage = 'No reservations yet recorded for this scheduled period.';

            if (regCount >= 6) {
              demandBadge = '🔥 High Demand / Near Capacity';
              demandColor = 'bg-amber-100 text-amber-900 border-amber-300';
              adviceMessage =
                'Early Assessment: High interest! This masterclass batch is nearly full. Consider opening an additional weekend session.';
            } else if (regCount >= 3) {
              demandBadge = '🟢 Healthy Booking Pace';
              demandColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
              adviceMessage =
                'Early Assessment: Steady enrollments. Minimum class threshold reached, ready to run smoothly.';
            } else if (regCount >= 1) {
              demandBadge = '🟡 Early Alert: Under-Booked';
              demandColor = 'bg-yellow-100 text-yellow-900 border-yellow-300';
              adviceMessage =
                'Early Assessment: Under 3 students registered. Early notice recommends promoting this batch on Instagram Stories or sending an email blast.';
            }

            // Filter Customer Orders (Inquiries)
            let filteredInquiries = [...allInquiries];
            if (inquiryFilter === 'unread') {
              filteredInquiries = filteredInquiries.filter(
                (i) => i.status !== 'read' && !i.isRead && i.status !== 'replied' && i.status !== 'closed'
              );
            } else if (inquiryFilter === 'read') {
              filteredInquiries = filteredInquiries.filter(
                (i) => i.status === 'read' || i.isRead === true
              );
            } else if (inquiryFilter === 'replied') {
              filteredInquiries = filteredInquiries.filter(
                (i) => i.status === 'replied' || i.status === 'closed'
              );
            }

            if (inquirySearch.trim()) {
              const q = inquirySearch.toLowerCase();
              filteredInquiries = filteredInquiries.filter(
                (i) =>
                  (i.userName || '').toLowerCase().includes(q) ||
                  (i.userEmail || '').toLowerCase().includes(q) ||
                  (i.userPhone || '').toLowerCase().includes(q) ||
                  (i.subject || '').toLowerCase().includes(q) ||
                  (i.message || '').toLowerCase().includes(q)
              );
            }

            const unreadInquiriesCount = allInquiries.filter(
              (i) => i.status !== 'read' && !i.isRead && i.status !== 'replied' && i.status !== 'closed'
            ).length;

            return (
              <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-16">
                {/* Header with Sub-Navigation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3B211B]/40 pb-5">
                  <div>
                    <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#C47B55]" />
                      Live Storefront Records & Early Demand Intelligence
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-[#3B211B] mt-0.5">
                      Customer Bookings & Custom Orders
                    </h3>
                    <p className="text-xs text-[#3B211B]/70 mt-1">
                      Assess workshop bookings month-by-month for early capacity planning, manage registered students, and review/delete customer inquiries.
                    </p>
                  </div>

                  {/* Top Switcher & Refresh */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => fetchAllBackendRecords(true)}
                      disabled={isRefreshingOrders}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-[#C47B55] text-[#3B211B] text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                      title="Refresh orders from production database"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#C47B55] ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingOrders ? 'Syncing...' : 'Refresh DB'}</span>
                    </button>

                    <div className="inline-flex p-1 bg-[#E8D6C3]/60 rounded-2xl border border-[#E8D6C3]">
                      <button
                        type="button"
                        onClick={() => setBookingsSubTab('all')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          bookingsSubTab === 'all'
                            ? 'bg-[#3B211B] text-white shadow-xs'
                            : 'text-[#3B211B]/70 hover:text-[#3B211B]'
                        }`}
                      >
                        All Records ({allCartOrders.length + allRegistrations.length + allInquiries.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingsSubTab('inquiries')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          bookingsSubTab === 'inquiries'
                            ? 'bg-[#3B211B] text-white shadow-xs'
                            : 'text-[#3B211B]/70 hover:text-[#3B211B]'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#C47B55]" />
                        <span>Customer Orders ({allCartOrders.length + allInquiries.length})</span>
                        {(unreadInquiriesCount > 0 || allCartOrders.some((o) => o.status === 'received')) && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingsSubTab('bookings')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          bookingsSubTab === 'bookings'
                            ? 'bg-[#3B211B] text-white shadow-xs'
                            : 'text-[#3B211B]/70 hover:text-[#3B211B]'
                        }`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-[#C47B55]" />
                        <span>Class Bookings ({allRegistrations.length})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 1: MASTERCLASS BOOKINGS & MONTHLY EARLY ASSESSMENT      */}
                {/* ============================================================== */}
                {(bookingsSubTab === 'all' || bookingsSubTab === 'bookings') && (
                  <div className="space-y-6 bg-[#F8F0E5]/60 p-5 sm:p-7 rounded-3xl border border-[#E8D6C3] shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C47B55] flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Early Assessment Module
                        </span>
                        <h4 className="font-serif text-xl font-bold text-[#3B211B] flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-[#C47B55]" />
                          Monthly-Wise Customer Bookings
                        </h4>
                        <p className="text-xs text-[#3B211B]/70 mt-0.5">
                          Evaluate enrollment density per month early so you can adjust baking supplies, schedule extra sessions, or promote under-booked batches in advance.
                        </p>
                      </div>

                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className="inline-flex p-1 bg-white rounded-xl border border-[#E8D6C3] shadow-2xs text-xs">
                          <button
                            type="button"
                            onClick={() => setBookingViewMode('monthly_assess')}
                            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                              bookingViewMode === 'monthly_assess'
                                ? 'bg-[#C47B55] text-white'
                                : 'text-[#3B211B]/70 hover:text-[#3B211B]'
                            }`}
                          >
                            Monthly Assess View
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingViewMode('list')}
                            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                              bookingViewMode === 'list'
                                ? 'bg-[#C47B55] text-white'
                                : 'text-[#3B211B]/70 hover:text-[#3B211B]'
                            }`}
                          >
                            All Bookings List
                          </button>
                        </div>

                        {/* Test simulation button */}
                        <button
                          type="button"
                          onClick={() => handleAddSampleBooking('November', 2026)}
                          className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#C47B55]/40 text-[#C47B55] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Simulate a test student booking for November to preview early assessment"
                        >
                          + Simulate Nov Booking
                        </button>
                      </div>
                    </div>

                    {/* Month Filter Selector Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedBookingMonth('all')}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                          selectedBookingMonth === 'all'
                            ? 'bg-[#3B211B] text-white border-[#3B211B] shadow-xs'
                            : 'bg-white text-[#3B211B]/80 border-[#E8D6C3] hover:border-[#C47B55]'
                        }`}
                      >
                        All Months ({allRegistrations.length})
                      </button>

                      {sortedMonthEntries.map(([mKey, mData]) => {
                        const isSelected = selectedBookingMonth === mKey;
                        const count = mData.bookings.length;
                        return (
                          <button
                            key={mKey}
                            type="button"
                            onClick={() => setSelectedBookingMonth(mKey)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#C47B55] text-white border-[#C47B55] shadow-xs'
                                : 'bg-white text-[#3B211B]/80 border-[#E8D6C3] hover:border-[#C47B55]'
                            }`}
                          >
                            <span>{mData.info.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                isSelected ? 'bg-white/25 text-white' : 'bg-[#E8D6C3]/60 text-[#3B211B]'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Early Assessment Intelligence KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* Metric 1: Confirmed Seats */}
                      <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B211B]/60">
                          Confirmed Student Seats
                        </span>
                        <div className="flex items-baseline justify-between">
                          <p className="font-serif text-2xl font-bold text-[#3B211B]">{regCount}</p>
                          <span className="text-[11px] text-[#3B211B]/60 font-mono">
                            {selectedBookingMonth === 'all' ? 'Across all months' : 'This Month'}
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-[#C47B55] h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (regCount / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Metric 2: Waitlisted & Cancelled */}
                      <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B211B]/60">
                          Waitlist & Cancellations
                        </span>
                        <div className="flex items-baseline justify-between">
                          <p className="font-serif text-2xl font-bold text-[#3B211B]">
                            {waitCount} <span className="text-xs font-normal text-amber-700">Waitlist</span>
                          </p>
                          <span className="text-xs text-red-600 font-semibold">{cancelCount} Cancelled</span>
                        </div>
                        <p className="text-[11px] text-[#3B211B]/60 mt-1">
                          {waitCount > 0 ? 'Excess demand present for this schedule' : 'No pending overflow'}
                        </p>
                      </div>

                      {/* Metric 3: Estimated Revenue */}
                      <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B211B]/60">
                          Projected Class Revenue
                        </span>
                        <div className="flex items-baseline justify-between">
                          <p className="font-serif text-2xl font-bold text-[#2E7D32]">
                            {formatRupee(projectedRevenue)}
                          </p>
                          <span className="text-[10px] font-mono text-[#3B211B]/60">Est. Fee</span>
                        </div>
                        <p className="text-[11px] text-[#3B211B]/60 mt-1">
                          Calculated from confirmed workshop enrollments
                        </p>
                      </div>

                      {/* Metric 4: Early Demand Status */}
                      <div className="bg-white p-4 rounded-2xl border border-[#E8D6C3] shadow-2xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B211B]/60 block mb-1">
                            Early Demand Assessment
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${demandColor}`}
                          >
                            {demandBadge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#3B211B]/75 leading-tight mt-2 line-clamp-2">
                          {adviceMessage}
                        </p>
                      </div>
                    </div>

                    {/* Early Assessment Strategic Recommendation Banner */}
                    <div className="p-4 rounded-2xl bg-[#E5A962]/15 border border-[#E5A962]/40 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-[#C47B55] shrink-0 mt-0.5" />
                      <div className="text-xs text-[#3B211B] space-y-0.5">
                        <strong className="font-bold text-[#3B211B]">
                          Baker Early Assessment Advisory for{' '}
                          {selectedBookingMonth === 'all'
                            ? 'All Upcoming Months'
                            : monthMap[selectedBookingMonth]?.info.label || 'Selected Month'}
                          :
                        </strong>
                        <p className="text-[#3B211B]/80 leading-relaxed">
                          {adviceMessage} Keep class ratios to 6-8 students maximum per batch for the best hands-on fudge texture coaching.
                        </p>
                      </div>
                    </div>

                    {/* Search & Status Filter Bar for Bookings */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-[#3B211B]/40 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={bookingSearch}
                          onChange={(e) => setBookingSearch(e.target.value)}
                          placeholder="Search student name, email, or class title..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] placeholder-[#3B211B]/40 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#3B211B]/70 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5" /> Filter:
                        </span>
                        <select
                          value={bookingStatusFilter}
                          onChange={(e) => setBookingStatusFilter(e.target.value as any)}
                          className="p-2 bg-white border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B] focus:outline-none"
                        >
                          <option value="all">All Statuses</option>
                          <option value="registered">Confirmed Registered</option>
                          <option value="waitlist">Waitlisted</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* MONTHLY GROUPED VIEW */}
                    {bookingViewMode === 'monthly_assess' && (
                      <div className="space-y-5">
                        {sortedMonthEntries
                          .filter(
                            ([mKey]) => selectedBookingMonth === 'all' || selectedBookingMonth === mKey
                          )
                          .map(([mKey, mData]) => {
                            const monthBookings = mData.bookings.filter((b) => {
                              if (bookingStatusFilter !== 'all' && (b.status || 'registered') !== bookingStatusFilter)
                                return false;
                              if (bookingSearch.trim()) {
                                const q = bookingSearch.toLowerCase();
                                return (
                                  (b.userName || '').toLowerCase().includes(q) ||
                                  (b.userEmail || '').toLowerCase().includes(q) ||
                                  (b.className || '').toLowerCase().includes(q)
                                );
                              }
                              return true;
                            });

                            return (
                              <div
                                key={mKey}
                                className="bg-white rounded-2xl border border-[#E8D6C3] overflow-hidden shadow-2xs"
                              >
                                {/* Month Header Bar */}
                                <div className="bg-[#3B211B] text-[#F8F0E5] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <CalendarDays className="w-4 h-4 text-[#E5A962]" />
                                    <h5 className="font-serif text-base font-bold text-[#F8F0E5]">
                                      {mData.info.label} Schedule
                                    </h5>
                                    <span className="px-2 py-0.5 rounded-full bg-white/15 text-[#E8D6C3] text-[10px] font-mono">
                                      {monthBookings.length} bookings
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#E8D6C3]/80 flex items-center gap-3">
                                    <span>
                                      Confirmed:{' '}
                                      <strong className="text-white">
                                        {monthBookings.filter((b) => (b.status || 'registered') === 'registered').length}
                                      </strong>
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                      Est. Rev:{' '}
                                      <strong className="text-[#E5A962]">
                                        {formatRupee(
                                          monthBookings
                                            .filter((b) => (b.status || 'registered') === 'registered')
                                            .reduce((acc, b) => acc + getPriceNum(b.className), 0)
                                        )}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                {/* Bookings inside Month */}
                                <div className="p-4 space-y-3">
                                  {monthBookings.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-[#3B211B]/60">
                                      No student registrations recorded for {mData.info.label} yet.
                                    </div>
                                  ) : (
                                    monthBookings.map((reg) => {
                                      const regPhone =
                                        reg.userPhone ||
                                        reg.notes?.match(/\[Phone:\s*([^\]]+)\]/)?.[1]?.trim() ||
                                        reg.notes?.match(/Tel:\s*([^.,\n\r]+)/)?.[1]?.trim() ||
                                        '';
                                      const targetWaPhone = regPhone || settings.whatsappNumber || '7339651529';
                                      const regWaUrl = buildWhatsAppUrl(
                                        targetWaPhone,
                                        regPhone
                                          ? `Hello ${reg.userName || 'Student'}, thank you for registering for "${reg.className}" (${reg.preferredDate}) at BrowineGirlCakes! Here are your class confirmation details.`
                                          : `New Class Request Alert:\n• Class: ${reg.className}\n• Batch: ${reg.preferredDate}\n• Student: ${reg.userName} (${reg.userEmail})\n• Notes: ${reg.notes || 'None'}`
                                      );

                                      return (
                                        <div
                                          key={reg.id}
                                          className="p-4 rounded-xl bg-[#F8F0E5]/50 border border-[#E8D6C3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8F0E5] transition-colors"
                                        >
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-bold text-xs text-[#3B211B]">
                                                {reg.className}
                                              </span>
                                              <span className="text-[11px] font-mono px-2 py-0.2 rounded-md bg-[#C47B55]/15 text-[#C47B55] font-semibold">
                                                {reg.preferredDate}
                                              </span>
                                            </div>
                                            <p className="text-xs text-[#3B211B]/80">
                                              Student: <strong>{reg.userName}</strong> &bull;{' '}
                                              <a
                                                href={`mailto:${reg.userEmail}`}
                                                className="text-[#C47B55] hover:underline"
                                              >
                                                {reg.userEmail}
                                              </a>
                                              {regPhone && (
                                                <>
                                                  {' '}&bull; <span className="font-mono font-semibold">Tel: {regPhone}</span>
                                                </>
                                              )}
                                            </p>
                                            {reg.notes && (
                                              <p className="text-[11px] text-[#3B211B]/70 italic bg-white p-2 rounded-lg border border-[#E8D6C3]/60">
                                                Note: {reg.notes}
                                              </p>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            <a
                                              href={regWaUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-bold transition-all shadow-2xs"
                                              title={
                                                regPhone
                                                  ? `Send WhatsApp message to ${regPhone}`
                                                  : `Send class details to WhatsApp (${settings.whatsappNumber || '7339651529'})`
                                              }
                                            >
                                              <MessageCircle className="w-3.5 h-3.5 text-white" />
                                              <span>{regPhone ? 'WhatsApp Student' : 'Send WhatsApp'}</span>
                                            </a>

                                            <select
                                              value={reg.status || 'registered'}
                                              onChange={async (e) => {
                                                try {
                                                  await updateDoc(doc(db, 'class_registrations', reg.id), {
                                                    status: e.target.value,
                                                  });
                                                  setAllRegistrations((prev) =>
                                                    prev.map((item) =>
                                                      item.id === reg.id ? { ...item, status: e.target.value } : item
                                                    )
                                                  );
                                                  triggerSuccess(`Updated status to ${e.target.value}`);
                                                } catch (err) {
                                                  console.warn(err);
                                                }
                                              }}
                                              className="p-1.5 px-2 bg-white border border-[#E8D6C3] rounded-lg text-xs font-semibold text-[#3B211B]"
                                            >
                                              <option value="registered">registered</option>
                                              <option value="waitlist">waitlist</option>
                                              <option value="cancelled">cancelled</option>
                                            </select>

                                            {/* Delete Booking Facility */}
                                            {deletingRegistrationId === reg.id ? (
                                              <div className="flex items-center gap-1 p-1 bg-red-50 border border-red-300 rounded-lg animate-in fade-in">
                                                <span className="text-[10px] font-bold text-red-700 px-1">
                                                  Delete?
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteRegistration(reg.id, reg.userName)}
                                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                                >
                                                  Yes
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setDeletingRegistrationId(null)}
                                                  className="px-1.5 py-0.5 bg-white text-[#3B211B] rounded text-[10px] border border-[#E8D6C3] cursor-pointer"
                                                >
                                                  No
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => setDeletingRegistrationId(reg.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                                title="Delete booking record"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* FLAT LIST VIEW */}
                    {bookingViewMode === 'list' && (
                      <div className="space-y-3">
                        {filteredRegistrations.length === 0 ? (
                          <div className="p-8 bg-white rounded-3xl text-center text-xs text-[#3B211B]/60 border border-[#E8D6C3]">
                            No class registrations match your search filters.
                          </div>
                        ) : (
                          filteredRegistrations.map((reg) => {
                            const regPhone =
                              reg.userPhone ||
                              reg.notes?.match(/\[Phone:\s*([^\]]+)\]/)?.[1]?.trim() ||
                              reg.notes?.match(/Tel:\s*([^.,\n\r]+)/)?.[1]?.trim() ||
                              '';
                            const targetWaPhone = regPhone || settings.whatsappNumber || '7339651529';
                            const regWaUrl = buildWhatsAppUrl(
                              targetWaPhone,
                              regPhone
                                ? `Hello ${reg.userName || 'Student'}, thank you for registering for "${reg.className}" (${reg.preferredDate}) at BrowineGirlCakes! Here are your class confirmation details.`
                                : `New Class Request Alert:\n• Class: ${reg.className}\n• Batch: ${reg.preferredDate}\n• Student: ${reg.userName} (${reg.userEmail})\n• Notes: ${reg.notes || 'None'}`
                            );

                            return (
                              <div
                                key={reg.id}
                                className="bg-white p-5 rounded-2xl border border-[#E8D6C3] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-[#3B211B]">{reg.className}</span>
                                    <span className="text-xs text-[#C47B55] font-semibold">
                                      &bull; {reg.preferredDate}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#3B211B]/80">
                                    Customer: <strong>{reg.userName}</strong> ({reg.userEmail})
                                    {regPhone && (
                                      <>
                                        {' '}&bull; <span className="font-mono font-semibold">Tel: {regPhone}</span>
                                      </>
                                    )}
                                  </p>
                                  {reg.notes && (
                                    <p className="text-xs text-[#3B211B]/60 italic">Notes: {reg.notes}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                  <a
                                    href={regWaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition-all shadow-2xs"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                                    <span>{regPhone ? 'WhatsApp Student' : 'Send WhatsApp'}</span>
                                  </a>

                                  <select
                                    value={reg.status || 'registered'}
                                    onChange={async (e) => {
                                      try {
                                        await updateDoc(doc(db, 'class_registrations', reg.id), {
                                          status: e.target.value,
                                        });
                                        setAllRegistrations((prev) =>
                                          prev.map((item) =>
                                            item.id === reg.id ? { ...item, status: e.target.value } : item
                                          )
                                        );
                                        triggerSuccess(`Updated booking status to ${e.target.value}`);
                                      } catch (err) {
                                        console.warn(err);
                                      }
                                    }}
                                    className="p-2 bg-[#F8F0E5] border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B]"
                                  >
                                    <option value="registered">registered</option>
                                    <option value="waitlist">waitlist</option>
                                    <option value="cancelled">cancelled</option>
                                  </select>

                                  {/* Delete Facility */}
                                  {deletingRegistrationId === reg.id ? (
                                    <div className="flex items-center gap-1.5 p-1 bg-red-50 border border-red-300 rounded-xl animate-in fade-in">
                                      <span className="text-[11px] font-bold text-red-700 px-1">Delete?</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRegistration(reg.id, reg.userName)}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingRegistrationId(null)}
                                        className="px-2 py-1 bg-white text-[#3B211B] rounded-lg text-[10px] border border-[#E8D6C3] cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeletingRegistrationId(reg.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                                      title="Delete booking"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 2: STOREFRONT CART ORDERS (REGULAR + FROSTED ADD-ONS)  */}
                {/* ============================================================== */}
                {(bookingsSubTab === 'all' || bookingsSubTab === 'inquiries') && (
                  <div className="space-y-5 bg-[#F8F0E5]/60 p-5 sm:p-7 rounded-3xl border border-[#E8D6C3] shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C47B55] flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" />
                          Storefront Cart &amp; Add-On Orders
                        </span>
                        <h4 className="font-serif text-xl font-bold text-[#3B211B]">
                          Multi-Product Storefront Orders ({allCartOrders.length})
                        </h4>
                        <p className="text-xs text-[#3B211B]/70 mt-0.5">
                          Displays regular brownies and optional Frosted Brownie add-ons ordered together under the same Order ID (e.g., BGC1025) with individual quantities, prices, and Grand Total.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => fetchAllBackendRecords(true)}
                          disabled={isRefreshingOrders}
                          className="px-3 py-2 bg-white hover:bg-stone-50 border border-[#C47B55] text-[#3B211B] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-[#C47B55] ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                          <span>Refresh Orders</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSampleInquiry}
                          className="px-3.5 py-2 bg-[#3B211B] hover:bg-[#23120E] text-[#E5A962] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          + Simulate Order (Brownie + Frosted Add-on)
                        </button>
                      </div>
                    </div>

                    {allCartOrders.length === 0 ? (
                      <div className="p-8 bg-white rounded-3xl text-center text-xs text-[#3B211B]/65 border border-[#E8D6C3] space-y-2">
                        <Gift className="w-7 h-7 text-[#C47B55]/50 mx-auto" />
                        <p className="font-bold text-sm text-[#3B211B]">
                          No Storefront Cart Orders Yet
                        </p>
                        <p className="max-w-md mx-auto">
                          When customers order a regular brownie (with or without optional Frosted Brownie add-ons) from the menu, both products appear here under a single Order ID.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {allCartOrders.map((order) => {
                          const oid = order.orderId || order.id;
                          const itemsList: any[] = Array.isArray(order.items) ? order.items : [];
                          const hasFrosted =
                            order.hasFrostedAddon ||
                            itemsList.some((i) => i.category === 'frosted_brownie' || i.isAddon);

                          const waOrderSummary = [
                            `Hello ${order.customerName || 'Customer'}, regarding your BrownieGirlCakes Order ID: ${oid}:`,
                            `Products:`,
                            ...itemsList.map(
                              (i) => {
                                const wLabel = i.weight || i.variantLabel;
                                const catTag =
                                  i.category === 'cake_normal'
                                    ? ' [Cake Menu - Normal Flavours]'
                                    : i.category === 'cake_premium'
                                    ? ' [Cake Menu - Premium Flavours]'
                                    : '';
                                return `${i.name}${catTag}${wLabel ? ` (${wLabel})` : ''} – ${i.quantity} × ${
                                  i.unitPriceFormatted || formatRupee(i.unitPrice || 0)
                                }`;
                              }
                            ),
                            `Grand Total: ${order.totalAmount}`,
                          ].join('\n');

                          return (
                            <div
                              key={oid}
                              className="p-5 bg-white rounded-2xl border-2 border-[#E8D6C3] hover:border-[#C47B55] shadow-xs space-y-4 transition-all"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8D6C3] pb-3">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="px-3 py-1 rounded-lg bg-[#3B211B] text-[#E5A962] font-mono text-xs font-bold">
                                    Order ID: {oid}
                                  </span>
                                  {hasFrosted && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                      Includes Frosted Brownie Add-on
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-[#3B211B]">
                                    Customer: {order.customerName || 'Guest'}
                                  </span>
                                  {order.customerPhone && (
                                    <span className="text-xs font-mono text-[#C47B55] font-semibold">
                                      &bull; Tel: {order.customerPhone}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] font-mono text-[#3B211B]/60">
                                  {order.createdAt
                                    ? new Date(order.createdAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                      })
                                    : 'Just now'}
                                </div>
                              </div>

                              {/* Itemized Products Under Same Order ID */}
                              <div className="bg-[#F8F0E5]/70 p-4 rounded-xl border border-[#E8D6C3] space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C47B55]">
                                  Products Ordered Together ({itemsList.length}):
                                </p>
                                <div className="divide-y divide-[#E8D6C3]/60">
                                  {itemsList.map((prod, pIdx) => {
                                    const uPrice =
                                      prod.unitPriceFormatted || formatRupee(prod.unitPrice || 0);
                                    const lTotal =
                                      prod.lineTotalFormatted ||
                                      formatRupee((prod.unitPrice || 0) * (prod.quantity || 1));
                                    const selectedWeight = prod.weight || prod.variantLabel;
                                    return (
                                      <div
                                        key={pIdx}
                                        className="py-2 flex items-center justify-between text-xs sm:text-sm text-[#23120E]"
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold">
                                            {prod.name} &ndash; {prod.quantity} &times; {uPrice}
                                          </span>
                                          {(prod.category === 'cake_normal' || prod.category === 'cake_premium') && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C47B55]/20 text-[#3B211B] border border-[#C47B55]/40 font-bold">
                                              {prod.category === 'cake_normal'
                                                ? 'Cake Menu • Normal Flavours'
                                                : 'Cake Menu • Premium Flavours'}
                                            </span>
                                          )}
                                          {selectedWeight && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B211B] text-[#E5A962] font-bold">
                                              Weight: {selectedWeight}
                                            </span>
                                          )}
                                          {(prod.category === 'frosted_brownie' || prod.isAddon) && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C47B55]/15 text-[#C47B55] font-bold">
                                              Frosted Brownie Add-on
                                            </span>
                                          )}
                                        </div>
                                        <span className="font-bold text-[#1A0B08]">{lTotal}</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="pt-2.5 border-t border-[#3B211B]/20 flex items-center justify-between text-sm sm:text-base font-bold text-[#1A0B08]">
                                  <span>Grand Total:</span>
                                  <span className="text-[#C47B55] text-lg">
                                    {order.totalAmount}
                                  </span>
                                </div>
                              </div>

                              {(order.deliveryAddress || order.specialInstructions) && (
                                <div className="text-xs text-[#3B211B]/80 space-y-1 bg-stone-50 p-3 rounded-xl border border-[#E8D6C3]/60">
                                  {order.deliveryAddress && (
                                    <p>
                                      <strong>Delivery / Pickup:</strong> {order.deliveryAddress}
                                    </p>
                                  )}
                                  {order.specialInstructions && (
                                    <p>
                                      <strong>Special Notes:</strong> {order.specialInstructions}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Order Status & Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-xs text-[#3B211B]/70">
                                  Email: <strong>{order.customerEmail || 'N/A'}</strong>
                                </span>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <a
                                    href={buildWhatsAppUrl(
                                      order.customerPhone || settings.whatsappNumber || '7339651529',
                                      waOrderSummary
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-2xs"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>WhatsApp Customer</span>
                                  </a>

                                  <select
                                    value={order.status || 'received'}
                                    onChange={(e) =>
                                      handleUpdateCartOrderStatus(oid, e.target.value)
                                    }
                                    className="p-1.5 px-2.5 bg-[#F8F0E5] border border-[#E8D6C3] rounded-lg text-xs font-bold text-[#3B211B]"
                                  >
                                    <option value="received">received</option>
                                    <option value="baking">baking</option>
                                    <option value="finishing">finishing</option>
                                    <option value="out_for_delivery">out_for_delivery</option>
                                    <option value="delivered">delivered</option>
                                    <option value="cancelled">cancelled</option>
                                  </select>

                                  {deletingCartOrderId === oid ? (
                                    <div className="flex items-center gap-1 p-1 bg-red-50 border border-red-300 rounded-lg">
                                      <span className="text-[10px] font-bold text-red-700 px-1">
                                        Delete {oid}?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCartOrder(oid)}
                                        className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingCartOrderId(null)}
                                        className="px-2 py-0.5 bg-white text-[#3B211B] rounded text-[10px] border border-[#E8D6C3] cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeletingCartOrderId(oid)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                      title="Delete order"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 3: CUSTOM ORDER INQUIRIES (DELETE & MARK AS READ)      */}
                {/* ============================================================== */}
                {(bookingsSubTab === 'all' || bookingsSubTab === 'inquiries') && (
                  <div className="space-y-5 bg-[#F8F0E5]/60 p-5 sm:p-7 rounded-3xl border border-[#E8D6C3] shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C47B55] flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Custom Orders &amp; Bespoke Inquiries
                        </span>
                        <h4 className="font-serif text-xl font-bold text-[#3B211B]">
                          Customer Orders &amp; Bespoke Inquiries ({allInquiries.length})
                        </h4>
                        <p className="text-xs text-[#3B211B]/70 mt-0.5">
                          Manage custom orders, review requested brownie flavors, mark items as read or replied, chat with customers on WhatsApp, and permanently delete fulfilled/test records.
                        </p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {unreadInquiriesCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllInquiriesAsRead}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-[#C47B55] text-[#C47B55] text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark All Read ({unreadInquiriesCount})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      {/* Status Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setInquiryFilter('all')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            inquiryFilter === 'all'
                              ? 'bg-[#3B211B] text-white border-[#3B211B]'
                              : 'bg-white text-[#3B211B]/70 border-[#E8D6C3] hover:border-[#C47B55]'
                          }`}
                        >
                          All Orders ({allInquiries.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInquiryFilter('unread')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            inquiryFilter === 'unread'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-[#3B211B]/70 border-[#E8D6C3] hover:border-amber-400'
                          }`}
                        >
                          {unreadInquiriesCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          )}
                          <span>Unread ({unreadInquiriesCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInquiryFilter('read')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            inquiryFilter === 'read'
                              ? 'bg-[#C47B55] text-white border-[#C47B55]'
                              : 'bg-white text-[#3B211B]/70 border-[#E8D6C3] hover:border-[#C47B55]'
                          }`}
                        >
                          Read ({allInquiries.filter((i) => i.status === 'read' || i.isRead).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInquiryFilter('replied')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            inquiryFilter === 'replied'
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-white text-[#3B211B]/70 border-[#E8D6C3] hover:border-blue-400'
                          }`}
                        >
                          Replied / Closed
                        </button>
                      </div>

                      {/* Search */}
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-[#3B211B]/40 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={inquirySearch}
                          onChange={(e) => setInquirySearch(e.target.value)}
                          placeholder="Search order subject, customer, or phone..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] placeholder-[#3B211B]/40 focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                        />
                      </div>
                    </div>

                    {/* Customer Order Cards List */}
                    {filteredInquiries.length === 0 ? (
                      <div className="p-10 bg-white rounded-3xl text-center text-xs text-[#3B211B]/60 border border-[#E8D6C3] space-y-2">
                        <MessageSquare className="w-8 h-8 text-[#C47B55]/40 mx-auto" />
                        <p className="font-semibold text-sm text-[#3B211B]">No Customer Orders Found</p>
                        <p className="text-xs text-[#3B211B]/60 max-w-sm mx-auto">
                          {allInquiries.length === 0
                            ? 'No customer inquiries recorded yet. When users submit custom orders from the website, they will appear here.'
                            : 'No customer orders match your selected search or filter.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {filteredInquiries.map((inq) => {
                          const isRead = inq.status === 'read' || inq.isRead === true;
                          const isReplied = inq.status === 'replied';
                          const isClosed = inq.status === 'closed';

                          // Extract phone number from field or message
                          const extractedPhone =
                            inq.userPhone ||
                            inq.message?.match(/Phone:\s*([^\n\r]+)/)?.[1]?.trim() ||
                            '';

                          return (
                            <div
                              key={inq.id}
                              className={`p-5 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                                !isRead && !isReplied && !isClosed
                                  ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                                  : 'bg-white border-[#E8D6C3]'
                              }`}
                            >
                              {/* Order Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8D6C3]/60 pb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Read / Unread Status Badge */}
                                  {!isRead && !isReplied && !isClosed ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      New / Unread
                                    </span>
                                  ) : isReplied ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                                      <Check className="w-3 h-3" /> Replied
                                    </span>
                                  ) : isClosed ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold uppercase tracking-wider">
                                      Closed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-[#3B211B]/70 text-[10px] font-semibold uppercase tracking-wider">
                                      <Check className="w-3 h-3 text-[#C47B55]" /> Read
                                    </span>
                                  )}

                                  <span className="text-xs font-bold text-[#3B211B]">{inq.subject}</span>
                                </div>

                                <div className="text-[11px] text-[#3B211B]/60 font-mono">
                                  {inq.createdAt
                                    ? new Date(inq.createdAt).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                      })
                                    : 'Recent'}
                                </div>
                              </div>

                              {/* Order Message Details */}
                              <div className="bg-[#F8F0E5]/60 p-3.5 rounded-xl border border-[#E8D6C3]/60 text-xs text-[#3B211B]/90 font-mono whitespace-pre-wrap leading-relaxed">
                                {inq.message}
                              </div>

                              {/* Customer Profile & Actions Footer */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                <div className="text-xs text-[#3B211B]/80 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span>
                                    Customer: <strong>{inq.userName || 'Anonymous'}</strong>
                                  </span>
                                  <span>&bull;</span>
                                  <a
                                    href={`mailto:${inq.userEmail}`}
                                    className="text-[#C47B55] hover:underline"
                                  >
                                    {inq.userEmail}
                                  </a>
                                  {extractedPhone && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="font-mono text-[#3B211B]">
                                        Tel: {extractedPhone}
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Action Buttons: WhatsApp, Mark as Read, Delete */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* WhatsApp Quick Reply / Send to Given Number */}
                                  <a
                                    href={buildWhatsAppUrl(
                                      extractedPhone || settings.whatsappNumber || '7339651529',
                                      extractedPhone
                                        ? `Hello ${inq.userName || 'there'}, thank you for contacting BrowineGirlCakes regarding "${inq.subject}"!`
                                        : `New Order / Inquiry Alert:\nSubject: ${inq.subject}\nCustomer: ${inq.userName} (${inq.userEmail})\n\n${inq.message}`
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-bold transition-all shadow-2xs"
                                    title={
                                      extractedPhone
                                        ? `Send WhatsApp message to customer (${extractedPhone})`
                                        : `Send order details to Bakery WhatsApp (${settings.whatsappNumber || '7339651529'})`
                                    }
                                  >
                                    <MessageCircle className="w-3 h-3 text-white" />
                                    <span>{extractedPhone ? 'WhatsApp Customer' : 'Send WhatsApp'}</span>
                                  </a>

                                  {/* Mark as Read / Unread Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInquiryRead(inq)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                                      isRead
                                        ? 'bg-white hover:bg-stone-50 border-[#E8D6C3] text-[#3B211B]/80'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs font-bold'
                                    }`}
                                    title={isRead ? 'Mark as Unread' : 'Mark as Read'}
                                  >
                                    {isRead ? (
                                      <>
                                        <EyeOff className="w-3 h-3 text-[#3B211B]/60" />
                                        <span>Mark Unread</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3 h-3 text-white" />
                                        <span>Mark as Read</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Status Selector */}
                                  <select
                                    value={inq.status || (isRead ? 'read' : 'new')}
                                    onChange={(e) => handleUpdateInquiryStatus(inq.id, e.target.value)}
                                    className="p-1 px-2 bg-[#F8F0E5] border border-[#E8D6C3] rounded-lg text-xs font-semibold text-[#3B211B]"
                                  >
                                    <option value="new">new</option>
                                    <option value="read">read</option>
                                    <option value="replied">replied</option>
                                    <option value="closed">closed</option>
                                  </select>

                                  {/* Delete Facility with Inline Confirmation */}
                                  {deletingInquiryId === inq.id ? (
                                    <div className="flex items-center gap-1.5 p-1 bg-red-50 border border-red-300 rounded-lg animate-in fade-in shadow-2xs">
                                      <span className="text-[10px] font-bold text-red-700 px-1">
                                        Delete order?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteInquiry(inq.id, inq.userName)}
                                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                                      >
                                        Yes, Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeletingInquiryId(null)}
                                        className="px-2 py-1 bg-white hover:bg-stone-100 text-[#3B211B] rounded text-[10px] font-semibold border border-[#E8D6C3] cursor-pointer transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeletingInquiryId(inq.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      title="Delete customer order"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 8: ADMIN TEAM, PASSWORD & ROLE ACCESS */}
          {activeTab === 'admins' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-12">
              <div>
                <span className="text-xs font-bold text-[#C47B55] uppercase tracking-wider">
                  Security, Password &amp; Team Permissions
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#3B211B] mt-0.5">
                  Admin Password &amp; Team Access Management
                </h3>
                <p className="text-xs sm:text-sm text-[#3B211B]/70 mt-1">
                  Configure a strong admin login password and manage who has administrative access to the BROWNIEGIRLCAKES console. Only exact matching passwords are accepted at login.
                </p>
              </div>

              {/* 1. Set Strong Admin Master Password Card */}
              <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8D6C3] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#3B211B] text-[#E5A962] flex items-center justify-center shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg font-bold text-[#3B211B]">
                        Set Strong Admin Master Password
                      </h4>
                      <p className="text-xs text-[#3B211B]/60">
                        Replace the login password with your own strong password. Any random or wrong password will be blocked.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold self-start sm:self-center ${
                      adminPassword === DEFAULT_ADMIN_PASSWORD
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {adminPassword === DEFAULT_ADMIN_PASSWORD
                      ? 'Using Default Password (admin123)'
                      : 'Custom Strong Password Active'}
                  </span>
                </div>

                {pwdError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPwdError(null);

                    if (!currentPwdInput) {
                      setPwdError('Please enter your current admin password.');
                      return;
                    }
                    if (newPwdInput.length < 6) {
                      setPwdError('New password must be at least 6 characters long.');
                      return;
                    }
                    if (newPwdInput !== confirmPwdInput) {
                      setPwdError('New password and confirmation password do not match.');
                      return;
                    }

                    const res = await updateAdminPassword(currentPwdInput, newPwdInput);
                    if (!res.success) {
                      setPwdError(res.message);
                    } else {
                      setCurrentPwdInput('');
                      setNewPwdInput('');
                      setConfirmPwdInput('');
                      triggerSuccess(res.message);
                    }
                  }}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Current Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#3B211B]">
                          Current Password *
                        </label>
                        {adminPassword === DEFAULT_ADMIN_PASSWORD && (
                          <button
                            type="button"
                            onClick={() => setCurrentPwdInput(DEFAULT_ADMIN_PASSWORD)}
                            className="text-[10px] font-bold text-[#C47B55] hover:underline cursor-pointer"
                          >
                            Fill Default (admin123)
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showCurrentPwd ? 'text' : 'password'}
                          value={currentPwdInput}
                          onChange={(e) => {
                            setCurrentPwdInput(e.target.value);
                            setPwdError(null);
                          }}
                          placeholder="Enter current password"
                          required
                          className="w-full min-h-[44px] p-3 pr-10 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3B211B]/50 hover:text-[#3B211B] cursor-pointer"
                          tabIndex={-1}
                        >
                          {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Strong Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#3B211B]">
                          New Strong Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const generated = `Brownie#${Math.floor(1000 + Math.random() * 9000)}!`;
                            setNewPwdInput(generated);
                            setConfirmPwdInput(generated);
                            setShowNewPwd(true);
                            setPwdError(null);
                          }}
                          className="text-[10px] font-bold text-[#C47B55] hover:underline cursor-pointer"
                        >
                          Generate Strong
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPwd ? 'text' : 'password'}
                          value={newPwdInput}
                          onChange={(e) => {
                            setNewPwdInput(e.target.value);
                            setPwdError(null);
                          }}
                          placeholder="e.g. Preethi@Brownie2026"
                          required
                          className="w-full min-h-[44px] p-3 pr-10 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPwd(!showNewPwd)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3B211B]/50 hover:text-[#3B211B] cursor-pointer"
                          tabIndex={-1}
                        >
                          {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-1.5">
                        Confirm New Password *
                      </label>
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={confirmPwdInput}
                        onChange={(e) => {
                          setConfirmPwdInput(e.target.value);
                          setPwdError(null);
                        }}
                        placeholder="Re-enter new password"
                        required
                        className="w-full min-h-[44px] p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                      />
                    </div>
                  </div>

                  {/* Live Password Strength Checklist */}
                  <div className="p-3.5 rounded-2xl bg-[#F8F0E5]/70 border border-[#E8D6C3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
                      <span className="font-bold text-[#3B211B] uppercase tracking-wider text-[10px]">
                        Strength Checks:
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          newPwdInput.length >= 8 ? 'text-emerald-700 font-bold' : 'text-[#3B211B]/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> 8+ Characters
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          /[A-Z]/.test(newPwdInput) && /[a-z]/.test(newPwdInput)
                            ? 'text-emerald-700 font-bold'
                            : 'text-[#3B211B]/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Upper &amp; Lowercase
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          /[0-9]/.test(newPwdInput) ? 'text-emerald-700 font-bold' : 'text-[#3B211B]/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Number
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          /[^A-Za-z0-9]/.test(newPwdInput)
                            ? 'text-emerald-700 font-bold'
                            : 'text-[#3B211B]/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" /> Symbol (@#$!)
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[42px]"
                    >
                      <Save className="w-4 h-4 text-[#E5A962]" />
                      <span>Save Strong Password</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. Add Another Person to Admin Access Form */}
              <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[#E8D6C3] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#3B211B] text-[#E5A962] flex items-center justify-center shrink-0">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg font-bold text-[#3B211B]">
                        Add Another Person for Admin Access
                      </h4>
                      <p className="text-xs text-[#3B211B]/60">
                        Enter their email address, role, and optional personal password to grant dashboard access
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Instant Live Sync
                  </span>
                </div>

                {adminFormError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{adminFormError}</span>
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAdminFormError(null);
                    const result = await addAdminUser({
                      email: newAdminEmail,
                      name: newAdminName,
                      role: newAdminRole,
                      addedBy: adminEmail,
                      customPassword: newAdminCustomPassword,
                    });
                    if (!result.success) {
                      setAdminFormError(result.message);
                    } else {
                      setNewAdminEmail('');
                      setNewAdminName('');
                      setNewAdminCustomPassword('');
                      setNewAdminRole('co-admin');
                      triggerSuccess(result.message);
                    }
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end"
                >
                  <div className="lg:col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-1.5">
                      Person&apos;s Full Name
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="e.g. Preethi / Studio Manager"
                      className="w-full min-h-[44px] p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-1.5">
                      Email Address (Gmail / Official) *
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => {
                        setNewAdminEmail(e.target.value);
                        setAdminFormError(null);
                      }}
                      placeholder="colleague@gmail.com"
                      required
                      className="w-full min-h-[44px] p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-1.5">
                      Personal Password
                    </label>
                    <input
                      type="text"
                      value={newAdminCustomPassword}
                      onChange={(e) => setNewAdminCustomPassword(e.target.value)}
                      placeholder="Optional (or uses Master)"
                      className="w-full min-h-[44px] p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-medium text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-1.5">
                      Access Role
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as 'co-admin' | 'manager')}
                      className="w-full min-h-[44px] p-3 bg-[#F8F0E5]/60 border border-[#E8D6C3] rounded-xl text-xs sm:text-sm font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    >
                      <option value="co-admin">Co-Admin (Full)</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                    <button
                      type="submit"
                      className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#C47B55] hover:bg-[#D98B5F] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Admin</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* 3. Active Administrators List */}
              <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#E8D6C3] shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8D6C3] pb-4">
                  <div>
                    <h4 className="font-serif text-lg font-bold text-[#3B211B]">
                      Authorized Administrators ({adminList.length})
                    </h4>
                    <p className="text-xs text-[#3B211B]/60">
                      All accounts listed below have verified access to this administration console
                    </p>
                  </div>
                  <div className="text-xs text-[#3B211B]/70 font-medium">
                    Official Bakery Mail: <strong className="text-[#C47B55]">preethipreethu712@gmail.com</strong>
                  </div>
                </div>

                <div className="divide-y divide-[#E8D6C3]">
                  {adminList.map((adm) => {
                    const isCurrentSession = adm.email.toLowerCase() === adminEmail.toLowerCase();
                    const isPrimaryOwner =
                      adm.isPrimary ||
                      adm.email.toLowerCase() === 'preethipreethu712@gmail.com' ||
                      adm.email.toLowerCase() === 'vigneshsivan2001@gmail.com';

                    return (
                      <div
                        key={adm.email}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-serif font-bold text-base shrink-0 ${
                              isPrimaryOwner
                                ? 'bg-[#3B211B] text-[#E5A962]'
                                : 'bg-[#C47B55]/15 text-[#C47B55]'
                            }`}
                          >
                            {(adm.name || adm.email).charAt(0).toUpperCase()}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-[#3B211B]">{adm.name}</span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  adm.role === 'owner'
                                    ? 'bg-[#3B211B] text-[#E5A962]'
                                    : adm.role === 'co-admin'
                                    ? 'bg-[#C47B55]/15 text-[#C47B55]'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {adm.role === 'owner'
                                  ? 'Primary Owner / Admin'
                                  : adm.role === 'co-admin'
                                  ? 'Co-Admin'
                                  : 'Bakery Manager'}
                              </span>
                              {adm.email.toLowerCase() === 'preethipreethu712@gmail.com' && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Official Bakery Mail
                                </span>
                              )}
                              {isCurrentSession && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                  You (Active)
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-mono font-semibold text-[#3B211B]/80 break-all">
                              {adm.email}
                            </p>

                            <p className="text-[11px] text-[#3B211B]/50">
                              Added by {adm.addedBy || 'System'} &bull;{' '}
                              {new Date(adm.addedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isPrimaryOwner ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F0E5] text-[#3B211B]/60 text-xs font-semibold border border-[#E8D6C3]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#C47B55]" />
                              <span>Permanent Access</span>
                            </span>
                          ) : revokingAdminEmail === adm.email ? (
                            <div className="flex items-center gap-1.5 p-1.5 bg-red-50 border border-red-300 rounded-xl animate-in fade-in">
                              <span className="text-[11px] font-bold text-red-800 px-1.5">
                                Revoke access?
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await removeAdminUser(adm.email);
                                  setRevokingAdminEmail(null);
                                  if (res.success) {
                                    triggerSuccess(res.message);
                                  } else {
                                    setAdminFormError(res.message);
                                  }
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Yes, Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => setRevokingAdminEmail(null)}
                                className="px-2.5 py-1 bg-white text-[#3B211B] border border-[#E8D6C3] rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setRevokingAdminEmail(adm.email)}
                              className="px-3 py-1.5 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke Access</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

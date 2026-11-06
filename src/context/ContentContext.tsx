import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { SIGNATURE_BROWNIES, BAKING_CLASSES, BrownieItem, BakingClassInfo } from '../data/brownies';
import { formatRupee, OFFICIAL_INSTAGRAM_URL } from '../utils/formatters';

export interface SiteSettings {
  phone: string;
  phoneRaw: string;
  whatsappNumber: string;
  email: string;
  instagramId: string;
  facebookId?: string;
  onlineClassTime?: string;
  aboutImage: string;
  heroSlide1Image: string;
  heroSlide2Image: string;
  heroSlide3Image: string;
  updatedAt?: string;
}

export interface AchievementSettings {
  stat1Value: string;
  stat1Label: string;
  stat1Desc: string;
  stat2Value: string;
  stat2Label: string;
  stat2Desc: string;
  stat3Value: string;
  stat3Label: string;
  stat3Desc: string;
  stat4Value: string;
  stat4Label: string;
  stat4Desc: string;
  award1Title: string;
  award1Org: string;
  award1Note: string;
  award2Title: string;
  award2Org: string;
  award2Note: string;
  award3Title: string;
  award3Org: string;
  award3Note: string;
}

export interface AdminUserRecord {
  email: string;
  name: string;
  role: 'owner' | 'co-admin' | 'manager';
  addedAt: string;
  addedBy: string;
  isPrimary?: boolean;
  customPassword?: string;
}

export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const PRIMARY_ADMIN_EMAILS: string[] = [
  'preethipreethu712@gmail.com',
  'vigneshsivan2001@gmail.com',
];

export const DEFAULT_ADMIN_LIST: AdminUserRecord[] = [
  {
    email: 'preethipreethu712@gmail.com',
    name: 'Official Bakery Admin',
    role: 'owner',
    addedAt: '2025-01-01T00:00:00.000Z',
    addedBy: 'System / Master',
    isPrimary: true,
  },
  {
    email: 'vigneshsivan2001@gmail.com',
    name: 'Vignesh Sivan (Founder)',
    role: 'owner',
    addedAt: '2025-01-01T00:00:00.000Z',
    addedBy: 'System / Master',
    isPrimary: true,
  },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  phone: '(555) 392-CAKE',
  phoneRaw: '+15553922253',
  whatsappNumber: '7339651529',
  email: 'preethipreethu712@gmail.com',
  instagramId: OFFICIAL_INSTAGRAM_URL,
  onlineClassTime: '',
  aboutImage: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=1600&auto=format&fit=crop',
  heroSlide1Image: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=2400&auto=format&fit=crop',
  heroSlide2Image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=85&w=2400&auto=format&fit=crop',
  heroSlide3Image: 'https://images.unsplash.com/photo-1581299894007-aaa50297cf16?q=85&w=2400&auto=format&fit=crop',
};

export const DEFAULT_ACHIEVEMENTS: AchievementSettings = {
  stat1Value: '50,000+',
  stat1Label: 'Artisan Brownies Baked',
  stat1Desc: 'Handcrafted in small batches with 100% pure cocoa butter chocolate.',
  stat2Value: '1,200+',
  stat2Label: 'Baking Class Graduates',
  stat2Desc: 'Students who mastered fudgy centers and crackly crusts in our studio.',
  stat3Value: '4.9 / 5.0',
  stat3Label: 'Average Customer Rating',
  stat3Desc: 'From over 3,500+ verified dessert lovers and pastry enthusiasts.',
  stat4Value: '2025 Winner',
  stat4Label: 'Best Artisan Bakery',
  stat4Desc: 'Awarded by the National Pastry & Confectionery Guild for recipe excellence.',
  award1Title: 'Golden Whisk Pastry Award',
  award1Org: 'Artisan Bakery Association 2025',
  award1Note: 'Voted #1 Handcrafted Brownie in the Country',
  award2Title: 'Certified Fair-Trade Partner',
  award2Org: 'Valrhona & Belgian Cocoa Alliance',
  award2Note: '100% Sustainable Single-Origin Cocoa Sourcing',
  award3Title: 'Culinary Masterclass Excellence',
  award3Org: 'Metropolitan Cooking Guild',
  award3Note: 'Top Rated Hands-On Baking Workshop',
};

const STORAGE_KEYS = {
  SETTINGS: 'browinegirl_site_settings',
  ACHIEVEMENTS: 'browinegirl_achievements',
  MENU: 'browinegirl_menu_items',
  DELETED_MENU: 'browinegirl_deleted_menu_items',
  CLASSES: 'browinegirl_classes',
  DELETED_CLASSES: 'browinegirl_deleted_classes',
  CUSTOM: 'browinegirl_custom_items',
  ADMINS: 'browinegirl_admin_team',
  ADMIN_PASSWORD: 'browinegirl_admin_password',
};

const getDeletedClassIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_CLASSES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const getDeletedMenuIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_MENU);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const LEGACY_DEFAULT_IDS = new Set([
  'classic-fudge',
  'salted-caramel',
  'raspberry-ganache',
  'espresso-truffle',
  'hazelnut-praline',
  'pistachio-rose',
  'tahini-sea-salt',
  'bourbon-walnut',
  'orange-blossom-dark',
  'matcha-white-swirl',
]);

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=900&auto=format&fit=crop';

const sanitizeCategoryItem = (item: BrownieItem, fallbackSortOrder?: number): BrownieItem => {
  const defaultRef = SIGNATURE_BROWNIES.find((d) => d.id === item.id);
  const category = item.category || defaultRef?.category || 'brownie';
  const isNoKgCategory = category === 'assorted_box' || category === 'frosted_brownie';

  const cleanName =
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : defaultRef?.name || 'Artisan Creation';

  const cleanImage =
    typeof item.image === 'string' && item.image.trim().length > 0
      ? item.image.trim()
      : defaultRef?.image || DEFAULT_FALLBACK_IMAGE;

  const rawPrice =
    item.price ||
    item.priceHalfKg ||
    item.priceOneKg ||
    defaultRef?.price ||
    defaultRef?.priceHalfKg ||
    '₹150';

  return {
    ...(defaultRef || {}),
    ...item,
    name: cleanName,
    image: cleanImage,
    subtitle: item.subtitle !== undefined ? item.subtitle : defaultRef?.subtitle || '',
    description: item.description !== undefined ? item.description : defaultRef?.description || '',
    cocoaPercentage:
      item.cocoaPercentage !== undefined
        ? item.cocoaPercentage
        : defaultRef?.cocoaPercentage ||
          (category === 'cake_normal'
            ? 'Normal Flavour'
            : category === 'cake_premium'
            ? 'Premium Flavour'
            : category === 'bento_cake'
            ? 'Per Kg'
            : '70% Dark'),
    flavorNotes: Array.isArray(item.flavorNotes)
      ? item.flavorNotes
      : defaultRef?.flavorNotes || ['Artisan Handcrafted'],
    category,
    price: formatRupee(rawPrice),
    priceHalfKg: isNoKgCategory
      ? undefined
      : item.priceHalfKg
      ? formatRupee(item.priceHalfKg)
      : defaultRef?.priceHalfKg
      ? formatRupee(defaultRef.priceHalfKg)
      : undefined,
    priceOneKg: isNoKgCategory
      ? undefined
      : item.priceOneKg
      ? formatRupee(item.priceOneKg)
      : defaultRef?.priceOneKg
      ? formatRupee(defaultRef.priceOneKg)
      : undefined,
    sortOrder:
      typeof item.sortOrder === 'number'
        ? item.sortOrder
        : typeof defaultRef?.sortOrder === 'number'
        ? defaultRef.sortOrder
        : fallbackSortOrder ?? 999,
    enabled: item.enabled !== false,
  };
};

const persistMenuToLocalStorage = (items: BrownieItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(items));
  } catch {
    // If localStorage hits the 5MB browser quota due to multiple base64 photos,
    // store only items that differ from default SIGNATURE_BROWNIES or are newly added.
    try {
      const compactDelta = items.filter((item) => {
        const def = SIGNATURE_BROWNIES.find((d) => d.id === item.id);
        if (!def) return true;
        return (
          item.name !== def.name ||
          item.image !== def.image ||
          item.price !== def.price ||
          item.priceHalfKg !== def.priceHalfKg ||
          item.priceOneKg !== def.priceOneKg ||
          item.description !== def.description ||
          item.subtitle !== def.subtitle ||
          item.badge !== def.badge ||
          item.category !== def.category ||
          (item.enabled !== false) !== (def.enabled !== false)
        );
      });
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(compactDelta));
    } catch (innerErr) {
      console.warn('LocalStorage menu cache quota reached (Firestore sync remains active):', innerErr);
    }
  }
};

const normalizeAndMergeMenuItems = (items: BrownieItem[]): BrownieItem[] => {
  const deletedIds = new Set(getDeletedMenuIds());
  // Filter out unmodified legacy 10 items that lacked the 4-section category structure
  const filteredExisting = items
    .filter((item) => item && item.id && !deletedIds.has(item.id))
    .filter((item) => !(LEGACY_DEFAULT_IDS.has(item.id) && !item.category));

  const existingById = new Map<string, BrownieItem>();
  filteredExisting.forEach((item, idx) => {
    existingById.set(item.id, sanitizeCategoryItem(item, 100 + idx));
  });

  // 1. Preserve exact canonical order for all default SIGNATURE_BROWNIES items so editing never moves position
  const orderedResult: BrownieItem[] = [];
  const placedIds = new Set<string>();

  SIGNATURE_BROWNIES.forEach((defItem, idx) => {
    if (deletedIds.has(defItem.id)) return;
    const edited = existingById.get(defItem.id);
    if (edited) {
      orderedResult.push({
        ...defItem,
        ...edited,
        sortOrder: defItem.sortOrder ?? idx + 1,
      });
    } else {
      orderedResult.push(sanitizeCategoryItem(defItem, idx + 1));
    }
    placedIds.add(defItem.id);
  });

  // 2. Append any custom-added items in stable sortOrder / creation order
  const customAdded = filteredExisting
    .filter((item) => !placedIds.has(item.id))
    .map((item, idx) => sanitizeCategoryItem(item, 500 + idx))
    .sort((a, b) => {
      if ((a.sortOrder ?? 999) !== (b.sortOrder ?? 999)) {
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      }
      return a.id.localeCompare(b.id);
    });

  return [...orderedResult, ...customAdded];
};

interface ContentContextType {
  settings: SiteSettings;
  achievements: AchievementSettings;
  menuItems: BrownieItem[];
  bakingClasses: BakingClassInfo[];
  customBrownies: BrownieItem[];
  adminList: AdminUserRecord[];
  adminEmails: string[];
  isAdmin: boolean;
  isDemoAdmin: boolean;
  toggleDemoAdmin: () => void;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  updateAchievements: (newAchievements: Partial<AchievementSettings>) => Promise<void>;
  addMenuItem: (item: Omit<BrownieItem, 'id'>) => Promise<void>;
  updateMenuItem: (id: string, item: Partial<BrownieItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  addClass: (cls: Omit<BakingClassInfo, 'id'>) => Promise<void>;
  updateClass: (id: string, cls: Partial<BakingClassInfo>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addCustomBrownie: (item: Omit<BrownieItem, 'id'>) => Promise<void>;
  updateCustomBrownie: (id: string, item: Partial<BrownieItem>) => Promise<void>;
  deleteCustomBrownie: (id: string) => Promise<void>;
  adminPassword: string;
  updateAdminPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  verifyAdminCredentials: (email: string, password: string) => { valid: boolean; message: string };
  addAdminUser: (newAdmin: { email: string; name: string; role: 'co-admin' | 'manager'; addedBy?: string; customPassword?: string }) => Promise<{ success: boolean; message: string }>;
  removeAdminUser: (email: string) => Promise<{ success: boolean; message: string }>;
  resetToDefaults: () => Promise<void>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();

  // Initialize from LocalStorage or defaults
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          !parsed.email ||
          parsed.email === 'hello@browniegirlcakes.com' ||
          parsed.email === 'admin@browinegirlcakes.com'
        ) {
          parsed.email = 'preethipreethu712@gmail.com';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Could not read cached settings', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [achievements, setAchievements] = useState<AchievementSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      if (cached) return { ...DEFAULT_ACHIEVEMENTS, ...JSON.parse(cached) };
    } catch (e) {
      console.warn('Could not read cached achievements', e);
    }
    return DEFAULT_ACHIEVEMENTS;
  });

  const [menuItems, setMenuItems] = useState<BrownieItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.MENU);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeAndMergeMenuItems(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read cached menu items', e);
    }
    return normalizeAndMergeMenuItems(SIGNATURE_BROWNIES);
  });

  // Synchronous refs so addMenuItem & updateMenuItem always construct full Firestore payloads
  // immediately without relying on deferred React 18 state updater callbacks
  const menuItemsRef = React.useRef<BrownieItem[]>(menuItems);
  const localEditsMapRef = React.useRef<Map<string, BrownieItem>>(new Map());

  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  const [bakingClasses, setBakingClasses] = useState<BakingClassInfo[]>(() => {
    const deletedIds = getDeletedClassIds();
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CLASSES);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((c: BakingClassInfo) => !deletedIds.includes(c.id))
            .map((c: BakingClassInfo) => ({
              ...c,
              price: formatRupee(c.price),
              dates: Array.isArray(c.dates)
                ? c.dates
                : (BAKING_CLASSES.find((b) => b.id === c.id)?.dates || ['Saturday @ 10:00 AM (In-Studio)', 'Sunday @ 2:00 PM (Live Online)']),
            }));
        }
      }
    } catch (e) {
      console.warn('Could not read cached classes', e);
    }
    return BAKING_CLASSES.filter((c) => !deletedIds.includes(c.id));
  });

  const bakingClassesRef = React.useRef<BakingClassInfo[]>(bakingClasses);
  const localClassEditsMapRef = React.useRef<Map<string, BakingClassInfo>>(new Map());

  useEffect(() => {
    bakingClassesRef.current = bakingClasses;
  }, [bakingClasses]);

  const [customBrownies, setCustomBrownies] = useState<BrownieItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CUSTOM);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read cached custom items', e);
    }
    return SIGNATURE_BROWNIES;
  });

  const [adminList, setAdminList] = useState<AdminUserRecord[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.ADMINS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_ADMIN_LIST;
  });

  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    return Array.from(
      new Set([
        ...PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
        ...adminList.map((a) => a.email.toLowerCase()),
      ])
    );
  });

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
      if (saved && saved.trim().length > 0) return saved;
    } catch {}
    return DEFAULT_ADMIN_PASSWORD;
  });

  const [isDemoAdmin, setIsDemoAdmin] = useState<boolean>(true); // Accessible in applet environment

  const userEmailLower = user?.email?.toLowerCase().trim() || '';
  const isAuthorizedAdminEmail =
    PRIMARY_ADMIN_EMAILS.some((e) => e.toLowerCase() === userEmailLower) ||
    adminEmails.some((e) => e.toLowerCase() === userEmailLower);
  const isAdminRole = userProfile?.role === 'admin';
  const isAdmin = isAuthorizedAdminEmail || isAdminRole || isDemoAdmin;

  const getAdminAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token =
        localStorage.getItem('browinegirl_admin_token') ||
        sessionStorage.getItem('browinegirl_admin_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {}
    return headers;
  };

  // 0. Sync Settings, Products, and Baking Classes from MongoDB Atlas Backend API
  useEffect(() => {
    let isMounted = true;

    const fetchMongoCatalogueAndSettings = async () => {
      try {
        const [settingsRes, productsRes, classesRes] = await Promise.all([
          fetch('/api/settings').catch(() => null),
          fetch('/api/products').catch(() => null),
          fetch('/api/classes').catch(() => null),
        ]);

        if (!isMounted) return;

        if (settingsRes && settingsRes.ok) {
          const settingsPayload = await settingsRes.json();
          const settingsMap = settingsPayload?.settings || {};

          if (settingsMap.general && typeof settingsMap.general === 'object') {
            const { settingKey: _k, _id: _i, ...cleanGeneral } = settingsMap.general;
            if (Object.keys(cleanGeneral).length > 0) {
              const mergedSettings = { ...DEFAULT_SETTINGS, ...cleanGeneral } as SiteSettings;
              setSettings(mergedSettings);
              try {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
              } catch {}
            }
          }

          if (settingsMap.achievements && typeof settingsMap.achievements === 'object') {
            const { settingKey: _k, _id: _i, ...cleanAch } = settingsMap.achievements;
            if (Object.keys(cleanAch).length > 0) {
              const mergedAch = { ...DEFAULT_ACHIEVEMENTS, ...cleanAch } as AchievementSettings;
              setAchievements(mergedAch);
              try {
                localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(mergedAch));
              } catch {}
            }
          }

          if (settingsMap.admins && typeof settingsMap.admins === 'object') {
            const data = settingsMap.admins;
            const list =
              Array.isArray(data.adminList) && data.adminList.length > 0
                ? data.adminList
                : DEFAULT_ADMIN_LIST;
            const emails =
              Array.isArray(data.adminEmails) && data.adminEmails.length > 0
                ? data.adminEmails
                : PRIMARY_ADMIN_EMAILS;
            const mergedEmails = Array.from(
              new Set([
                ...PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
                ...emails.map((e: string) => e.toLowerCase()),
                ...list.map((a: AdminUserRecord) => a.email.toLowerCase()),
              ])
            );
            setAdminList(list);
            setAdminEmails(mergedEmails);
            try {
              localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(list));
            } catch {}
          }
        }

        if (productsRes && productsRes.ok) {
          const prodPayload = await productsRes.json();
          if (Array.isArray(prodPayload?.products) && prodPayload.products.length > 0) {
            const regularItems = prodPayload.products.filter(
              (p: BrownieItem & { isCustomShowcase?: boolean }) =>
                !p.isCustomShowcase && !String(p.id || '').startsWith('custom-')
            );
            const customItems = prodPayload.products.filter(
              (p: BrownieItem & { isCustomShowcase?: boolean }) =>
                p.isCustomShowcase || String(p.id || '').startsWith('custom-')
            );

            if (regularItems.length > 0) {
              const merged = normalizeAndMergeMenuItems(regularItems);
              menuItemsRef.current = merged;
              setMenuItems(merged);
              persistMenuToLocalStorage(merged);
            }
            if (customItems.length > 0) {
              setCustomBrownies(customItems);
              try {
                localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(customItems));
              } catch {}
            }
          }
        }

        if (classesRes && classesRes.ok) {
          const classesPayload = await classesRes.json();
          if (Array.isArray(classesPayload?.classes) && classesPayload.classes.length > 0) {
            const deletedIds = getDeletedClassIds();
            const validClasses = classesPayload.classes
              .filter((c: BakingClassInfo) => c && c.id && !deletedIds.includes(c.id))
              .map((c: BakingClassInfo) => ({
                ...c,
                price: formatRupee(c.price || '₹1,999'),
                description:
                  typeof c.description === 'string'
                    ? c.description.replace(/\r\n?/g, '\n')
                    : '',
                dates: Array.isArray(c.dates)
                  ? c.dates
                  : BAKING_CLASSES.find((b) => b.id === c.id)?.dates || [],
              }));
            if (validClasses.length > 0) {
              bakingClassesRef.current = validClasses;
              setBakingClasses(validClasses);
              try {
                localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(validClasses));
              } catch {}
            }
          }
        }
      } catch {
        // Silent fallback to Firestore / localStorage
      }
    };

    fetchMongoCatalogueAndSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Sync Settings from Firestore
  useEffect(() => {
    const settingsDocRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          if (
            !raw.email ||
            raw.email === 'hello@browniegirlcakes.com' ||
            raw.email === 'admin@browinegirlcakes.com'
          ) {
            raw.email = 'preethipreethu712@gmail.com';
            setDoc(settingsDocRef, { email: 'preethipreethu712@gmail.com' }, { merge: true }).catch(() => {});
          }
          const remoteData = { ...DEFAULT_SETTINGS, ...raw } as SiteSettings;
          setSettings(remoteData);
          try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remoteData));
          } catch {}
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // 2. Sync Achievements from Firestore
  useEffect(() => {
    const achDocRef = doc(db, 'settings', 'achievements');
    const unsubscribe = onSnapshot(
      achDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = { ...DEFAULT_ACHIEVEMENTS, ...docSnap.data() } as AchievementSettings;
          setAchievements(remoteData);
          try {
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(remoteData));
          } catch {}
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // 3. Sync Menu Items from Firestore (preserving canonical positions & local edits)
  useEffect(() => {
    const menuColRef = collection(db, 'menu_items');
    const unsubscribe = onSnapshot(
      menuColRef,
      (snapshot) => {
        // Read any locally cached items so local photo uploads are never lost
        let localCached: BrownieItem[] = [];
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEYS.MENU);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) localCached = parsed;
          }
        } catch {}

        if (!snapshot.empty) {
          const remoteById = new Map<string, BrownieItem>();
          snapshot.forEach((d) => {
            const raw = d.data() as BrownieItem;
            const id = d.id || raw.id;
            remoteById.set(id, {
              ...raw,
              id,
            });
          });

          // Combine defaults + localStorage cache + remote Firestore docs + in-memory session edits
          const combinedMap = new Map<string, BrownieItem>();
          for (const loc of localCached) {
            if (loc && loc.id) combinedMap.set(loc.id, loc);
          }
          remoteById.forEach((rem, id) => {
            const defaultRef = SIGNATURE_BROWNIES.find((d) => d.id === id);
            const existingLoc = combinedMap.get(id);
            combinedMap.set(id, {
              ...(defaultRef || {}),
              ...(existingLoc || {}),
              ...rem,
              name:
                typeof rem.name === 'string' && rem.name.trim().length > 0
                  ? rem.name
                  : existingLoc?.name || defaultRef?.name || 'Artisan Creation',
              image:
                typeof rem.image === 'string' && rem.image.trim().length > 0
                  ? rem.image
                  : existingLoc?.image || defaultRef?.image || DEFAULT_FALLBACK_IMAGE,
            });
          });
          localEditsMapRef.current.forEach((sessionItem, id) => {
            const current = combinedMap.get(id);
            combinedMap.set(id, { ...(current || {}), ...sessionItem });
          });

          const merged = normalizeAndMergeMenuItems(Array.from(combinedMap.values()));
          menuItemsRef.current = merged;
          setMenuItems(merged);
          persistMenuToLocalStorage(merged);
        } else if (localCached.length > 0 || localEditsMapRef.current.size > 0) {
          const combinedMap = new Map<string, BrownieItem>();
          for (const loc of localCached) {
            if (loc && loc.id) combinedMap.set(loc.id, loc);
          }
          localEditsMapRef.current.forEach((sessionItem, id) => {
            const current = combinedMap.get(id);
            combinedMap.set(id, { ...(current || {}), ...sessionItem });
          });
          const merged = normalizeAndMergeMenuItems(Array.from(combinedMap.values()));
          menuItemsRef.current = merged;
          setMenuItems(merged);
        } else {
          const merged = normalizeAndMergeMenuItems(SIGNATURE_BROWNIES);
          menuItemsRef.current = merged;
          setMenuItems(merged);
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // 4. Sync Baking Classes from Firestore
  useEffect(() => {
    const classesColRef = collection(db, 'baking_classes');
    const unsubscribe = onSnapshot(
      classesColRef,
      (snapshot) => {
        const deletedIds = getDeletedClassIds();
        let localCached: BakingClassInfo[] = [];
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEYS.CLASSES);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) localCached = parsed;
          }
        } catch {}

        if (!snapshot.empty) {
          const combinedById = new Map<string, BakingClassInfo>();
          localCached.forEach((loc) => {
            if (loc && loc.id && !deletedIds.includes(loc.id)) {
              combinedById.set(loc.id, loc);
            }
          });

          snapshot.forEach((d) => {
            const raw = d.data() as BakingClassInfo;
            const classId = d.id || raw.id;
            if (!deletedIds.includes(classId)) {
              const existingLoc = combinedById.get(classId);
              combinedById.set(classId, {
                ...(existingLoc || {}),
                ...raw,
                id: classId,
                price: formatRupee(raw.price || existingLoc?.price || '₹1,999'),
                dates: Array.isArray(raw.dates)
                  ? raw.dates
                  : Array.isArray(existingLoc?.dates)
                  ? existingLoc.dates
                  : BAKING_CLASSES.find((b) => b.id === classId)?.dates || [],
              });
            }
          });

          localClassEditsMapRef.current.forEach((editedCls, id) => {
            if (!deletedIds.includes(id)) {
              const current = combinedById.get(id);
              combinedById.set(id, { ...(current || {}), ...editedCls });
            }
          });

          const clsList = Array.from(combinedById.values());
          bakingClassesRef.current = clsList;
          setBakingClasses(clsList);
          try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(clsList));
          } catch {}
        } else if (localClassEditsMapRef.current.size > 0 || localCached.length > 0) {
          const combinedById = new Map<string, BakingClassInfo>();
          localCached.forEach((loc) => {
            if (loc && loc.id && !deletedIds.includes(loc.id)) {
              combinedById.set(loc.id, loc);
            }
          });
          localClassEditsMapRef.current.forEach((editedCls, id) => {
            if (!deletedIds.includes(id)) {
              const current = combinedById.get(id);
              combinedById.set(id, { ...(current || {}), ...editedCls });
            }
          });
          const clsList = Array.from(combinedById.values());
          bakingClassesRef.current = clsList;
          setBakingClasses(clsList);
          try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(clsList));
          } catch {}
        } else {
          const defaultClasses = BAKING_CLASSES.filter((c) => !deletedIds.includes(c.id));
          bakingClassesRef.current = defaultClasses;
          setBakingClasses(defaultClasses);
          try {
            localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(defaultClasses));
          } catch {}
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // 5. Sync Custom Showcase Brownies from Firestore
  useEffect(() => {
    const customColRef = collection(db, 'custom_items');
    const unsubscribe = onSnapshot(
      customColRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: BrownieItem[] = [];
          snapshot.forEach((d) => {
            const raw = d.data() as BrownieItem;
            items.push({
              ...raw,
              id: d.id || raw.id,
            });
          });
          setCustomBrownies(items);
          try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(items));
          } catch {}
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // 6. Sync Admin Team & Authorization from Firestore (without plain-text passwords)
  useEffect(() => {
    const adminDocRef = doc(db, 'settings', 'admins');
    const unsubscribe = onSnapshot(
      adminDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const list =
            Array.isArray(data?.adminList) && data.adminList.length > 0
              ? data.adminList
              : DEFAULT_ADMIN_LIST;
          const emails =
            Array.isArray(data?.adminEmails) && data.adminEmails.length > 0
              ? data.adminEmails
              : PRIMARY_ADMIN_EMAILS;

          // Always guarantee that official owners are preserved in authorized list
          const mergedEmails = Array.from(
            new Set([
              ...PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
              ...emails.map((e: string) => e.toLowerCase()),
              ...list.map((a: AdminUserRecord) => a.email.toLowerCase()),
            ])
          );

          setAdminList(list);
          setAdminEmails(mergedEmails);
          try {
            localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(list));
          } catch {}
        } else {
          // Initialize default admin list in Firestore without storing any plain-text password
          setDoc(
            adminDocRef,
            {
              adminList: DEFAULT_ADMIN_LIST,
              adminEmails: PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
        }
      },
      () => {}
    );

    return () => unsubscribe();
  }, []);

  // Update Settings
  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    const updated = { ...settings, ...newSettings, updatedAt: new Date().toISOString() };
    setSettings(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch {}

    try {
      await fetch('/api/settings/general', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(updated),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'settings', 'general'), updated, { merge: true });
    } catch {}
  };

  // Update Achievements
  const updateAchievements = async (newAchievements: Partial<AchievementSettings>) => {
    const updated = { ...achievements, ...newAchievements };
    setAchievements(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(updated));
    } catch {}

    try {
      await fetch('/api/settings/achievements', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(updated),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'settings', 'achievements'), updated, { merge: true });
    } catch {}
  };

  // Menu Management
  const addMenuItem = async (item: Omit<BrownieItem, 'id'>) => {
    const newId = `item-${Date.now()}`;
    const cat = item.category || 'brownie';
    const isNoKg = cat === 'assorted_box' || cat === 'frosted_brownie';
    const currentList = menuItemsRef.current;
    const maxOrder = currentList.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), 31);

    const formattedHalfKg = isNoKg
      ? undefined
      : item.priceHalfKg
      ? formatRupee(item.priceHalfKg)
      : formatRupee(item.price || '₹490');
    const formattedOneKg = isNoKg
      ? undefined
      : item.priceOneKg
      ? formatRupee(item.priceOneKg)
      : formatRupee('₹950');
    const formattedMainPrice = isNoKg
      ? formatRupee(item.price || (cat === 'assorted_box' ? '₹650' : '₹150'))
      : formattedHalfKg || formatRupee(item.price || '₹490');

    const fullItem: BrownieItem = {
      ...item,
      id: newId,
      name: (item.name || '').trim() || 'New Bakery Creation',
      subtitle: (item.subtitle || '').trim(),
      description: (item.description || '').trim(),
      image: (item.image || '').trim() || DEFAULT_FALLBACK_IMAGE,
      badge: item.badge ? item.badge.trim() : undefined,
      cocoaPercentage:
        item.cocoaPercentage ||
        (cat === 'cake_normal'
          ? 'Normal Flavour'
          : cat === 'cake_premium'
          ? 'Premium Flavour'
          : cat === 'bento_cake'
          ? 'Per Kg'
          : '70% Dark'),
      flavorNotes:
        Array.isArray(item.flavorNotes) && item.flavorNotes.length > 0
          ? item.flavorNotes
          : ['Artisan Handcrafted'],
      category: cat,
      price: formattedMainPrice,
      priceHalfKg: formattedHalfKg,
      priceOneKg: formattedOneKg,
      sortOrder: maxOrder + 1,
      enabled: item.enabled !== false,
    };

    localEditsMapRef.current.set(newId, fullItem);
    const updatedList = [...currentList, fullItem];
    menuItemsRef.current = updatedList;
    setMenuItems(updatedList);
    persistMenuToLocalStorage(updatedList);

    const cleanPayload = Object.fromEntries(
      Object.entries(fullItem).filter(([_, v]) => v !== undefined)
    );

    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(cleanPayload),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'menu_items', newId), cleanPayload);
    } catch {}
  };

  const updateMenuItem = async (id: string, updatedFields: Partial<BrownieItem>) => {
    const currentList = menuItemsRef.current;
    const defaultRef = SIGNATURE_BROWNIES.find((d) => d.id === id);
    const existingItem =
      currentList.find((item) => item.id === id) ||
      localEditsMapRef.current.get(id) ||
      defaultRef;

    const baseItem: BrownieItem = existingItem || {
      id,
      name: 'Artisan Creation',
      subtitle: '',
      description: '',
      price: '₹490',
      image: DEFAULT_FALLBACK_IMAGE,
      cocoaPercentage: '70% Dark',
      flavorNotes: ['Artisan Handcrafted'],
      category: 'brownie',
    };

    const nextCategory = updatedFields.category || baseItem.category || 'brownie';
    const isNoKg = nextCategory === 'assorted_box' || nextCategory === 'frosted_brownie';

    const nextHalfKgRaw = isNoKg
      ? undefined
      : updatedFields.priceHalfKg !== undefined
      ? updatedFields.priceHalfKg
      : baseItem.priceHalfKg;
    const nextOneKgRaw = isNoKg
      ? undefined
      : updatedFields.priceOneKg !== undefined
      ? updatedFields.priceOneKg
      : baseItem.priceOneKg;

    const nextHalfKg = nextHalfKgRaw ? formatRupee(nextHalfKgRaw) : undefined;
    const nextOneKg = nextOneKgRaw ? formatRupee(nextOneKgRaw) : undefined;

    const rawMainPrice =
      updatedFields.price !== undefined && String(updatedFields.price).trim().length > 0
        ? updatedFields.price
        : !isNoKg && nextHalfKg
        ? nextHalfKg
        : baseItem.price || nextHalfKg || '₹150';

    const nextName =
      updatedFields.name !== undefined && updatedFields.name.trim().length > 0
        ? updatedFields.name.trim()
        : baseItem.name;

    const nextImage =
      updatedFields.image !== undefined && updatedFields.image.trim().length > 0
        ? updatedFields.image.trim()
        : baseItem.image || DEFAULT_FALLBACK_IMAGE;

    const mergedItem: BrownieItem = {
      ...baseItem,
      ...updatedFields,
      id,
      name: nextName,
      image: nextImage,
      category: nextCategory,
      price: formatRupee(rawMainPrice),
      priceHalfKg: isNoKg ? undefined : nextHalfKg,
      priceOneKg: isNoKg ? undefined : nextOneKg,
      sortOrder: baseItem.sortOrder,
      enabled:
        updatedFields.enabled !== undefined
          ? updatedFields.enabled
          : baseItem.enabled !== false,
    };

    localEditsMapRef.current.set(id, mergedItem);

    // Update in-place without changing array index/position
    const updatedList = currentList.some((item) => item.id === id)
      ? currentList.map((item) => (item.id === id ? mergedItem : item))
      : [...currentList, mergedItem];

    menuItemsRef.current = updatedList;
    setMenuItems(updatedList);
    persistMenuToLocalStorage(updatedList);

    const cleanPayload = Object.fromEntries(
      Object.entries(mergedItem).filter(([_, v]) => v !== undefined)
    );

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(cleanPayload),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'menu_items', id), cleanPayload);
    } catch {}
  };

  const deleteMenuItem = async (id: string) => {
    const deletedIds = getDeletedMenuIds();
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      try {
        localStorage.setItem(STORAGE_KEYS.DELETED_MENU, JSON.stringify(deletedIds));
      } catch {}
    }

    localEditsMapRef.current.delete(id);
    const updatedList = menuItemsRef.current.filter((item) => item.id !== id);
    menuItemsRef.current = updatedList;
    setMenuItems(updatedList);
    persistMenuToLocalStorage(updatedList);

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
    } catch {}

    try {
      await deleteDoc(doc(db, 'menu_items', id));
    } catch {}
  };

  // Class Management
  const addClass = async (cls: Omit<BakingClassInfo, 'id'>) => {
    const newId = `class-${Date.now()}`;
    const fullClass: BakingClassInfo = {
      ...cls,
      id: newId,
      title: (cls.title || '').trim() || 'Artisan Baking Masterclass',
      description: typeof cls.description === 'string' ? cls.description.replace(/\r\n?/g, '\n') : '',
      price: formatRupee(cls.price || '₹1,999'),
      dates: Array.isArray(cls.dates) ? cls.dates : [],
      format: cls.format || 'Online',
    };
    localClassEditsMapRef.current.set(newId, fullClass);
    const updated = [...bakingClassesRef.current, fullClass];
    bakingClassesRef.current = updated;
    setBakingClasses(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
    } catch {}

    const cleanPayload = Object.fromEntries(
      Object.entries(fullClass).filter(([_, v]) => v !== undefined)
    );

    try {
      await fetch('/api/classes', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(cleanPayload),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'baking_classes', newId), cleanPayload);
    } catch {}
  };

  const updateClass = async (id: string, updatedFields: Partial<BakingClassInfo>) => {
    const currentList = bakingClassesRef.current;
    const defaultRef = BAKING_CLASSES.find((b) => b.id === id);
    const existing =
      currentList.find((c) => c.id === id) ||
      localClassEditsMapRef.current.get(id) ||
      defaultRef;

    const baseClass: BakingClassInfo = existing || {
      id,
      title: 'Artisan Baking Masterclass',
      level: 'All Levels',
      duration: '3 Hours',
      price: '₹1,999',
      description: '',
      dates: [],
      format: 'Online',
    };

    const nextDescription =
      updatedFields.description !== undefined
        ? updatedFields.description.replace(/\r\n?/g, '\n')
        : baseClass.description;

    const updatedClass: BakingClassInfo = {
      ...baseClass,
      ...updatedFields,
      id,
      title:
        updatedFields.title !== undefined && updatedFields.title.trim().length > 0
          ? updatedFields.title.trim()
          : baseClass.title,
      description: nextDescription,
      price:
        updatedFields.price !== undefined && String(updatedFields.price).trim().length > 0
          ? formatRupee(updatedFields.price)
          : formatRupee(baseClass.price || '₹1,999'),
    };

    localClassEditsMapRef.current.set(id, updatedClass);
    const updated = currentList.some((c) => c.id === id)
      ? currentList.map((c) => (c.id === id ? updatedClass : c))
      : [...currentList, updatedClass];
    bakingClassesRef.current = updated;
    setBakingClasses(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
    } catch {}

    const cleanPayload = Object.fromEntries(
      Object.entries(updatedClass).filter(([_, v]) => v !== undefined)
    );

    try {
      await fetch(`/api/classes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(cleanPayload),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'baking_classes', id), cleanPayload);
    } catch {}
  };

  const deleteClass = async (id: string) => {
    // 1. Add to deleted IDs set immediately so snapshot listeners never resurrect it
    const deletedIds = getDeletedClassIds();
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      try {
        localStorage.setItem(STORAGE_KEYS.DELETED_CLASSES, JSON.stringify(deletedIds));
      } catch {}
    }

    localClassEditsMapRef.current.delete(id);

    // 2. Remove from local state and update local storage
    const updated = bakingClassesRef.current.filter((c) => c.id !== id);
    bakingClassesRef.current = updated;
    setBakingClasses(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(updated));
    } catch {}

    try {
      await fetch(`/api/classes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
    } catch {}

    // 3. Delete from Firestore collection
    try {
      await deleteDoc(doc(db, 'baking_classes', id));
    } catch {}
  };

  // Custom Showcase Brownie Management
  const addCustomBrownie = async (item: Omit<BrownieItem, 'id'>) => {
    const newId = `custom-${Date.now()}`;
    const fullItem: BrownieItem = { ...item, id: newId };
    const updated = [...customBrownies, fullItem];
    setCustomBrownies(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(updated));
    } catch {}

    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ ...fullItem, isCustomShowcase: true }),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'custom_items', newId), fullItem);
    } catch {}
  };

  const updateCustomBrownie = async (id: string, updatedFields: Partial<BrownieItem>) => {
    const existing = customBrownies.find((b) => b.id === id);
    const updatedItem: BrownieItem = existing
      ? { ...existing, ...updatedFields }
      : ({ id, ...updatedFields } as BrownieItem);

    const updated = customBrownies.map((b) => (b.id === id ? updatedItem : b));
    setCustomBrownies(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(updated));
    } catch {}

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ ...updatedItem, isCustomShowcase: true }),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'custom_items', id), updatedItem);
    } catch {}
  };

  const deleteCustomBrownie = async (id: string) => {
    const updated = customBrownies.filter((b) => b.id !== id);
    setCustomBrownies(updated);
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(updated));
    } catch {}

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
    } catch {}

    try {
      await deleteDoc(doc(db, 'custom_items', id));
    } catch {}
  };

  const updateAdminPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 6) {
      return {
        success: false,
        message: 'New password must be at least 6 characters long for security.',
      };
    }

    // First verify & update on the server using scrypt hashing (never stored in plain text in MongoDB)
    try {
      const response = await fetch('/api/admin/password', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword: trimmedNew,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        setAdminPassword(trimmedNew);
        try {
          localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, trimmedNew);
        } catch {}
        return {
          success: true,
          message:
            data.message ||
            'Admin master password updated and securely hashed on the server!',
        };
      }
      if (response.status === 401 && data?.message) {
        return {
          success: false,
          message: data.message,
        };
      }
    } catch {
      // Fallback to local verification if offline
    }

    if (currentPassword !== adminPassword) {
      return {
        success: false,
        message: 'Current password is incorrect. Please enter your active admin password.',
      };
    }

    setAdminPassword(trimmedNew);
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, trimmedNew);
    } catch {}

    return {
      success: true,
      message: 'Admin master password updated! Use your new strong password on next login.',
    };
  };

  const verifyAdminCredentials = (
    email: string,
    password: string
  ): { valid: boolean; message: string } => {
    const cleanEmail = email.trim().toLowerCase();
    const isAuthorizedEmail =
      PRIMARY_ADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail) ||
      adminEmails.some((e) => e.toLowerCase() === cleanEmail);

    if (!isAuthorizedEmail) {
      return {
        valid: false,
        message: `Access denied: "${cleanEmail}" is not in the authorized administrators list.`,
      };
    }

    const matchedAdmin = adminList.find((a) => a.email.toLowerCase() === cleanEmail);
    const hasCustomPwd = Boolean(
      matchedAdmin?.customPassword && matchedAdmin.customPassword.trim().length > 0
    );

    if (hasCustomPwd && password === matchedAdmin!.customPassword) {
      return { valid: true, message: 'Authenticated with personal admin password.' };
    }

    if (password === adminPassword) {
      return { valid: true, message: 'Authenticated with master admin password.' };
    }

    return {
      valid: false,
      message: 'Incorrect admin password. Please enter the exact password configured by the administrator.',
    };
  };

  const addAdminUser = async (newAdmin: {
    email: string;
    name: string;
    role: 'co-admin' | 'manager';
    addedBy?: string;
    customPassword?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = newAdmin.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    if (adminEmails.map((e) => e.toLowerCase()).includes(cleanEmail)) {
      return {
        success: false,
        message: `${cleanEmail} already has administrator access.`,
      };
    }

    const newRecord: AdminUserRecord = {
      email: cleanEmail,
      name: newAdmin.name.trim() || cleanEmail.split('@')[0],
      role: newAdmin.role,
      addedAt: new Date().toISOString(),
      addedBy: newAdmin.addedBy || user?.email || 'preethipreethu712@gmail.com',
      isPrimary: false,
    };

    const updatedList = [...adminList, newRecord];
    const updatedEmails = Array.from(
      new Set([
        ...PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
        ...adminEmails.map((e) => e.toLowerCase()),
        cleanEmail,
      ])
    );

    setAdminList(updatedList);
    setAdminEmails(updatedEmails);

    try {
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(updatedList));
    } catch {}

    const sanitizedListForRemote = updatedList.map(({ customPassword: _cp, ...rest }) => rest);

    try {
      await fetch('/api/settings/admins', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          adminList: sanitizedListForRemote,
          adminEmails: updatedEmails,
          updatedAt: new Date().toISOString(),
        }),
      });
    } catch {}

    try {
      await setDoc(
        doc(db, 'settings', 'admins'),
        {
          adminList: sanitizedListForRemote,
          adminEmails: updatedEmails,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    return {
      success: true,
      message: `Successfully granted admin access to ${cleanEmail}!`,
    };
  };

  const removeAdminUser = async (
    email: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(cleanEmail)) {
      return {
        success: false,
        message: `Primary owner email (${cleanEmail}) is protected and cannot be removed.`,
      };
    }

    const updatedList = adminList.filter(
      (a) => a.email.toLowerCase() !== cleanEmail
    );
    const updatedEmails = Array.from(
      new Set([
        ...PRIMARY_ADMIN_EMAILS.map((e) => e.toLowerCase()),
        ...updatedList.map((a) => a.email.toLowerCase()),
      ])
    );

    setAdminList(updatedList);
    setAdminEmails(updatedEmails);

    try {
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(updatedList));
    } catch {}

    const sanitizedListForRemote = updatedList.map(({ customPassword: _cp, ...rest }) => rest);

    try {
      await fetch('/api/settings/admins', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          adminList: sanitizedListForRemote,
          adminEmails: updatedEmails,
          updatedAt: new Date().toISOString(),
        }),
      });
    } catch {}

    try {
      await setDoc(
        doc(db, 'settings', 'admins'),
        {
          adminList: sanitizedListForRemote,
          adminEmails: updatedEmails,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    return {
      success: true,
      message: `Revoked administrator access for ${cleanEmail}.`,
    };
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.DELETED_CLASSES);
      localStorage.removeItem(STORAGE_KEYS.DELETED_MENU);
    } catch {}

    setSettings(DEFAULT_SETTINGS);
    setAchievements(DEFAULT_ACHIEVEMENTS);
    setMenuItems(SIGNATURE_BROWNIES);
    setBakingClasses(BAKING_CLASSES);
    setCustomBrownies(SIGNATURE_BROWNIES);

    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(DEFAULT_ACHIEVEMENTS));
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(SIGNATURE_BROWNIES));
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(BAKING_CLASSES));
      localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(SIGNATURE_BROWNIES));
    } catch {}

    try {
      await fetch('/api/settings/general', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(DEFAULT_SETTINGS),
      });
      await fetch('/api/settings/achievements', {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(DEFAULT_ACHIEVEMENTS),
      });
    } catch {}

    try {
      await setDoc(doc(db, 'settings', 'general'), DEFAULT_SETTINGS);
      await setDoc(doc(db, 'settings', 'achievements'), DEFAULT_ACHIEVEMENTS);
      for (const item of SIGNATURE_BROWNIES) {
        await setDoc(doc(db, 'menu_items', item.id), item);
        await setDoc(doc(db, 'custom_items', item.id), item);
      }
      for (const cls of BAKING_CLASSES) {
        await setDoc(doc(db, 'baking_classes', cls.id), cls);
      }
    } catch {}
  };

  const toggleDemoAdmin = () => {
    setIsDemoAdmin((prev) => !prev);
  };

  return (
    <ContentContext.Provider
      value={{
        settings,
        achievements,
        menuItems,
        bakingClasses,
        customBrownies,
        adminList,
        adminEmails,
        adminPassword,
        isAdmin,
        isDemoAdmin,
        toggleDemoAdmin,
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
        updateAdminPassword,
        verifyAdminCredentials,
        addAdminUser,
        removeAdminUser,
        resetToDefaults,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

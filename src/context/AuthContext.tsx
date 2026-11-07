import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'customer' | 'admin';
  createdAt: string;
  favorites: string[];
}

export interface ClassRegistration {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  className: string;
  preferredDate?: string;
  notes?: string;
  status: 'registered' | 'waitlist' | 'cancelled';
  createdAt: string;
}

export interface Inquiry {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: 'new' | 'replied' | 'closed';
  createdAt: string;
}

export interface ClassRegistrationOptions {
  idempotencyKey?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  classId?: string;
  status?: 'registered' | 'waitlist';
}

export interface InquirySubmissionOptions {
  name?: string;
  email?: string;
  phone?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: string;
  deliveryType?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  requireDeliveryAddress?: boolean;
  idempotencyKey?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  registerForClass: (
    className: string,
    preferredDate?: string,
    notes?: string,
    options?: ClassRegistrationOptions
  ) => Promise<void>;
  submitInquiry: (
    subject: string,
    message: string,
    contactInfo?: InquirySubmissionOptions
  ) => Promise<void>;
  toggleFavorite: (brownieId: string) => Promise<void>;
  userRegistrations: ClassRegistration[];
  userInquiries: Inquiry[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRegistrations, setUserRegistrations] = useState<ClassRegistration[]>([]);
  const [userInquiries, setUserInquiries] = useState<Inquiry[]>([]);

  // Listen to Firebase Auth State (Preserving Firebase Authentication & Google Sign-In + syncing profile to MongoDB)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const emailLower = (currentUser.email || '').toLowerCase().trim();
        const isAuthorizedAdmin = ['vigneshsivan2001@gmail.com', 'preethipreethu712@gmail.com'].includes(emailLower);

        const resolvedProfile: UserProfile = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Baking Enthusiast',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          role: isAuthorizedAdmin ? 'admin' : 'customer',
          createdAt: new Date().toISOString(),
          favorites: ['classic-fudge', 'salted-caramel'],
        };

        setUserProfile(resolvedProfile);

        // Sync user profile to authoritative MongoDB `users` collection via /api/users/sync
        try {
          const syncRes = await fetch('/api/users/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resolvedProfile),
          });
          const syncData = await syncRes.json();
          if (syncRes.ok && syncData?.success && syncData?.user) {
            setUserProfile(syncData.user as UserProfile);
          }
        } catch {
          // Non-blocking background sync
        }
      } else {
        setUserProfile(null);
        setUserRegistrations([]);
        setUserInquiries([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load user registrations from authoritative MongoDB API when user is logged in
  useEffect(() => {
    if (!user) {
      setUserRegistrations([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/registrations?userId=${encodeURIComponent(user.uid)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.registrations)) {
          setUserRegistrations(data.registrations);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load user inquiries from authoritative MongoDB API when logged in, or from localStorage if guest
  useEffect(() => {
    if (!user) {
      try {
        const stored = localStorage.getItem('browinegirl_customer_inquiries');
        if (stored) {
          setUserInquiries(JSON.parse(stored));
        } else {
          setUserInquiries([]);
        }
      } catch {
        setUserInquiries([]);
      }
      return;
    }

    let cancelled = false;
    fetch(`/api/inquiries?userId=${encodeURIComponent(user.uid)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.inquiries)) {
          setUserInquiries(data.inquiries);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  const signInWithGoogle = async (): Promise<User | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      // Gracefully handle normal popup close / cancellation
      if (
        firebaseError?.code === 'auth/popup-closed-by-user' ||
        firebaseError?.code === 'auth/cancelled-popup-request' ||
        firebaseError?.message?.includes('popup-closed-by-user')
      ) {
        return null;
      }
      console.warn('Google Sign In:', firebaseError?.message || err);
      return null;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign Out failed:', err);
    }
  };

  const registerForClass = async (
    className: string,
    preferredDate?: string,
    notes?: string,
    options?: ClassRegistrationOptions
  ) => {
    const resolvedName = (options?.userName || user?.displayName || '').trim();
    const resolvedEmail = (options?.userEmail || user?.email || '').trim();

    if (!user && !resolvedEmail) {
      throw new Error('Please sign in with Google or provide your name and email to register for a class.');
    }

    const payload = {
      userId: user?.uid || `guest_${Date.now()}`,
      userEmail: resolvedEmail,
      userName: resolvedName || 'Baking Student',
      userPhone: (options?.userPhone || '').trim(),
      ...(options?.classId ? { classId: options.classId } : {}),
      ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      className,
      preferredDate: preferredDate || 'Next Available Batch',
      notes: notes || '',
      status: options?.status || ('registered' as const),
      createdAt: new Date().toISOString(),
    };

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.registration) {
      throw new Error(data?.error || 'Failed to save class registration to the database.');
    }

    setUserRegistrations((prev) => [
      data.registration,
      ...prev.filter((r) => r.id !== data.registration.id),
    ]);
  };

  const submitInquiry = async (
    subject: string,
    message: string,
    contactInfo?: InquirySubmissionOptions
  ) => {
    const guestId = `guest_${Date.now()}`;
    const inquiryData = {
      userId: user?.uid || guestId,
      userEmail: contactInfo?.email || user?.email || 'guest@browinegirlcakes.com',
      userName: contactInfo?.name || user?.displayName || 'Bakery Guest',
      userPhone: contactInfo?.phone || '',
      subject,
      message,
      ...(contactInfo?.eventType ? { eventType: contactInfo.eventType } : {}),
      ...(contactInfo?.eventDate ? { eventDate: contactInfo.eventDate } : {}),
      ...(contactInfo?.guestCount ? { guestCount: contactInfo.guestCount } : {}),
      ...(contactInfo?.deliveryType ? { deliveryType: contactInfo.deliveryType } : {}),
      ...(contactInfo?.deliveryAddress ? { deliveryAddress: contactInfo.deliveryAddress } : {}),
      ...(contactInfo?.requireDeliveryAddress ? { requireDeliveryAddress: true } : {}),
      ...(contactInfo?.idempotencyKey ? { idempotencyKey: contactInfo.idempotencyKey } : {}),
      status: 'new' as const,
      createdAt: new Date().toISOString(),
    };

    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiryData),
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.inquiry) {
      throw new Error(data?.error || 'Failed to submit order inquiry to the database.');
    }

    const savedInq = data.inquiry;

    try {
      const stored = localStorage.getItem('browinegirl_customer_inquiries');
      const list = stored ? JSON.parse(stored) : [];
      const deduped = [savedInq, ...list.filter((item: any) => item?.id !== savedInq.id)];
      localStorage.setItem('browinegirl_customer_inquiries', JSON.stringify(deduped));
      setUserInquiries((prev) => [savedInq, ...prev.filter((i) => i.id !== savedInq.id)]);
    } catch {}
  };

  const toggleFavorite = async (brownieId: string) => {
    if (!user || !userProfile) return;
    const currentFavs = userProfile.favorites || [];
    const updatedFavs = currentFavs.includes(brownieId)
      ? currentFavs.filter((id) => id !== brownieId)
      : [...currentFavs, brownieId];

    setUserProfile({ ...userProfile, favorites: updatedFavs });

    // Sync to authoritative MongoDB `users` collection
    fetch(`/api/users/${encodeURIComponent(user.uid)}/favorites`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites: updatedFavs }),
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signOutUser,
        registerForClass,
        submitInquiry,
        toggleFavorite,
        userRegistrations,
        userInquiries,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

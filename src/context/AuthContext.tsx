import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from '../firebase';

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

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  registerForClass: (className: string, preferredDate?: string, notes?: string) => Promise<void>;
  submitInquiry: (
    subject: string,
    message: string,
    contactInfo?: { name?: string; email?: string; phone?: string }
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

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user profile in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const emailLower = (currentUser.email || '').toLowerCase().trim();
          let isAuthorizedAdmin = ['vigneshsivan2001@gmail.com', 'preethipreethu712@gmail.com'].includes(emailLower);

          if (!isAuthorizedAdmin && emailLower) {
            try {
              const adminSnap = await getDoc(doc(db, 'settings', 'admins'));
              if (adminSnap.exists()) {
                const adminData = adminSnap.data();
                const emails: string[] = Array.isArray(adminData?.adminEmails)
                  ? adminData.adminEmails.map((e: string) => e.toLowerCase())
                  : [];
                if (emails.includes(emailLower)) {
                  isAuthorizedAdmin = true;
                }
              }
            } catch {}
          }

          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const existingProfile = docSnap.data() as UserProfile;
            if (isAuthorizedAdmin && existingProfile.role !== 'admin') {
              const upgradedProfile: UserProfile = { ...existingProfile, role: 'admin' };
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              setUserProfile(upgradedProfile);
            } else {
              setUserProfile(existingProfile);
            }
          } else {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Baking Enthusiast',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
              role: isAuthorizedAdmin ? 'admin' : 'customer',
              createdAt: new Date().toISOString(),
              favorites: ['classic-fudge', 'salted-caramel'],
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.warn('Could not fetch user profile:', error);
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

  // Listen to user registrations when user is logged in
  useEffect(() => {
    if (!user) {
      setUserRegistrations([]);
      return;
    }

    const regColPath = 'class_registrations';
    const q = query(collection(db, regColPath), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const regs: ClassRegistration[] = [];
        snapshot.forEach((d) => {
          regs.push({ id: d.id, ...d.data() } as ClassRegistration);
        });
        setUserRegistrations(regs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, regColPath);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Listen to user inquiries when user is logged in, or load from localStorage if guest
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

    const inqColPath = 'inquiries';
    const q = query(collection(db, inqColPath), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const inqs: Inquiry[] = [];
        snapshot.forEach((d) => {
          inqs.push({ id: d.id, ...d.data() } as Inquiry);
        });
        setUserInquiries(inqs);
      },
      (error) => {
        console.warn('Inquiries listener fallback:', error);
      }
    );

    return () => unsubscribe();
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

  const registerForClass = async (className: string, preferredDate?: string, notes?: string) => {
    if (!user) {
      throw new Error('Please sign in with Google to register for a class.');
    }
    const path = 'class_registrations';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || 'Baking Student',
        className,
        preferredDate: preferredDate || 'Next Available Batch',
        notes: notes || '',
        status: 'registered',
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const submitInquiry = async (
    subject: string,
    message: string,
    contactInfo?: { name?: string; email?: string; phone?: string }
  ) => {
    const path = 'inquiries';
    const guestId = `guest_${Date.now()}`;
    const inquiryData = {
      userId: user?.uid || guestId,
      userEmail: contactInfo?.email || user?.email || 'guest@browinegirlcakes.com',
      userName: contactInfo?.name || user?.displayName || 'Bakery Guest',
      userPhone: contactInfo?.phone || '',
      subject,
      message,
      status: 'new' as const,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, path), inquiryData);
    } catch (error) {
      console.warn('Could not save inquiry to Firestore directly, cached locally:', error);
    }

    try {
      const stored = localStorage.getItem('browinegirl_customer_inquiries');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift({ id: guestId, ...inquiryData });
      localStorage.setItem('browinegirl_customer_inquiries', JSON.stringify(list));
      setUserInquiries((prev) => [{ id: guestId, ...inquiryData }, ...prev]);
    } catch {}
  };

  const toggleFavorite = async (brownieId: string) => {
    if (!user || !userProfile) return;
    const currentFavs = userProfile.favorites || [];
    const updatedFavs = currentFavs.includes(brownieId)
      ? currentFavs.filter((id) => id !== brownieId)
      : [...currentFavs, brownieId];

    setUserProfile({ ...userProfile, favorites: updatedFavs });
    const userDocPath = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), { favorites: updatedFavs }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userDocPath);
    }
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

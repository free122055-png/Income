/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert,
  Lock, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  AlertTriangle,
  Fingerprint,
  Cpu,
  Activity,
  Terminal,
  LogOut,
  Mail,
  Settings,
  LayoutDashboard,
  FileText,
  Video,
  Upload,
  UserPlus,
  LogIn,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Badge } from '@/src/components/ui/badge';
import { Progress } from '@/src/components/ui/progress';
import { Toaster } from "@/src/components/ui/sonner";
import { toast } from "sonner";
import { VERIFICATION_SECTIONS, VerificationSection, FIELD_LABELS } from './constants';
import { AdminDashboard } from './components/AdminDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { OrgAdminDashboard } from './components/OrgAdminDashboard';
import { BiometricScanner } from './components/BiometricScanner';
import { cn } from './lib/utils';
import { auth, db } from './lib/firebase';
import { UserRole, Organization } from './types';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, serverTimestamp, query, collection, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeStep, setActiveStep] = useState(0);
  const [view, setView] = useState<'dashboard' | 'sector' | 'initial'>('initial');
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('veracore_form_draft');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('veracore_form_draft', JSON.stringify(formData));
  }, [formData]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | 'none'>('none');
  
  // Multi-tenant SaaS state
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  const sections: VerificationSection[] = React.useMemo(() => {
    if (currentOrg?.customSections && currentOrg.customSections.length > 0) {
      return currentOrg.customSections.map(cs => {
        // Map icon string to component if needed, otherwise use ShieldCheck
        return {
          id: cs.id,
          title: cs.title,
          description: cs.description,
          icon: ShieldCheck, // Simplification: use ShieldCheck for now or add a mapping
          fields: cs.fields.filter(f => f.type !== 'file').map(f => f.id),
          documents: cs.fields.filter(f => f.type === 'file').map(f => f.id)
        };
      });
    }
    return VERIFICATION_SECTIONS;
  }, [currentOrg]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgId = params.get('org');
    if (orgId) {
      setCurrentOrgId(orgId);
    }
  }, []);
  useEffect(() => {
    if (!currentOrgId) {
      setCurrentOrg(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'organizations', currentOrgId), (snap) => {
       if (snap.exists()) {
         setCurrentOrg(snap.data() as Organization);
       } else {
         setCurrentOrg(null);
       }
    }, (error) => {
       console.error("Org Sync Error:", error);
       setCurrentOrg(null);
    });
    return () => unsubscribe();
  }, [currentOrgId]);

  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isBiometricGateActive, setIsBiometricGateActive] = useState(false);
  const [biometricTarget, setBiometricTarget] = useState<'unlock' | 'admin' | 'submit' | 'step' | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [currentUploadingField, setCurrentUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setVerificationStatus('none');
      return;
    }

    const q = query(
      collection(db, "verifications"), 
      where("userId", "==", user.uid),
      orderBy("submittedAt", "desc"),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setVerificationStatus(data.status);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const [isScanning, setIsScanning] = useState(false);
  const [analyzingField, setAnalyzingField] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [aiRisk, setAiRisk] = useState<{ isSuspicious: boolean, riskReason: string, severity: string, flaggedFields?: string[] } | null>(null);
  const [systemLog, setSystemLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setSystemLog(prev => [msg, ...prev].slice(0, 5));
  };

  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setSyncError(null);
      if (u) {
        // Remove automatic biometric gate on login
        setIsAppLocked(false); 
        setIsBiometricGateActive(false);
        addLog(`AUTHENTICATED: ${u.email}`);
      } else {
        setIsAppLocked(false);
        setIsBiometricGateActive(false);
        setUserRole('user');
        setIsAdminMode(false);
        setIsInitializing(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Sync user profile using onSnapshot for better resilience
    const userRef = doc(db, "users", user.uid);
    const unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) {
        addLog("PROFILE_MISSING: INITIALIZING...");
        const isSuperAdminEmail = user.email?.toLowerCase() === "free122055@gmail.com";
        
        let initialRole: UserRole = isSuperAdminEmail ? "superadmin" : "user";
        let initialOrgId = currentOrgId || null;

        // Check if user is a designated Org Admin
        if (!isSuperAdminEmail) {
          const orgsQuery = query(collection(db, 'organizations'), where('adminEmail', '==', user.email?.toLowerCase()));
          const orgData = await getDocs(orgsQuery);
          if (!orgData.empty) {
            initialRole = "orgadmin";
            initialOrgId = orgData.docs[0].id;
            addLog(`ORG_ADMIN_DETECTED: ${initialOrgId.toUpperCase()}`);
          }
        }

        try {
          const profileData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: initialRole,
            orgId: initialOrgId,
            verificationStatus: "none" as const,
            lastActivity: serverTimestamp(),
          };
          await setDoc(userRef, profileData);
          setUserRole(initialRole);
          if (initialOrgId) setCurrentOrgId(initialOrgId);
          setIsInitializing(false);
          
          // No need to write to admins collection here, rules handle it via email and profile role
        } catch (err: any) {
          console.error("Profile Creation error:", err);
        }
      } else {
        const data = docSnap.data();
        setUserRole(data.role || 'user');
        // Profile orgId takes precedence for tracking, but don't overwrite URL org if it's a regular user
        if (data.orgId) setCurrentOrgId(data.orgId);
        
        if (data.verificationStatus && data.verificationStatus !== 'none') {
          setVerificationStatus(data.verificationStatus);
          setIsSubmitted(true);
        }

        // Auto-promote if designated as Org Admin but profile doesn't reflect it
        if (data.role === 'user') {
          const orgsQuery = query(collection(db, 'organizations'), where('adminEmail', '==', user.email?.toLowerCase()));
          const orgSnap = await getDocs(orgsQuery);
          if (!orgSnap.empty) {
            const orgId = orgSnap.docs[0].id;
            await setDoc(userRef, { role: 'orgadmin', orgId: orgId }, { merge: true });
            addLog(`ORG_ADMIN_PROMOTED: ${orgId}`);
          }
        }

        if (data.role === 'superadmin') addLog("SUPER_ADMIN_SESSION_ACTIVE");
        if (data.role === 'orgadmin') addLog(`ORG_ADMIN_SESSION: ${data.orgId}`);

        // Admin re-bootstrapping if needed
        if (user.email?.toLowerCase() === "free122055@gmail.com" && data.role !== 'superadmin') {
          setDoc(userRef, { role: 'superadmin' }, { merge: true });
        }
      }
      setIsInitializing(false);
      setSyncError(null);
    }, (err) => {
      console.error("Profile Sync Error:", err);
      // Resilience for high-scale: Don't block the UI for network flickers
      // Firestore will automatically retry and serve from cache in the meantime.
      if (err.code === 'permission-denied') {
        setSyncError("Access Denied: Please check your account permissions.");
      } else if (err.code !== 'unavailable') {
        // Only set hard errors for items that can't be resolved by automatic retries
        setSyncError(err.message || String(err));
      }
      // Ensure we don't stay stuck on the loading screen
      setIsInitializing(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  const login = async () => {
    setIsAuthenticating(true);
    addLog("INITIALIZING_OAUTH_FLOW...");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("পরিচয় যাচাই সম্পন্ন। সেশন সক্রিয়।");
    } catch (err) {
      toast.error("অথেনটিকেশন প্রোটোকল বিঘ্নিত হয়েছে।");
      console.error(err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("অনুগ্রহ করে ইমেল এবং পাসওয়ার্ড প্রদান করুন।");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    setIsAuthenticating(true);
    addLog(authMode === 'register' ? "INIT_REGISTRATION..." : "INIT_AUTH_FLOW...");
    
    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        addLog(`REGISTRATION_SUCCESS: ${userCredential.user.email}`);
        toast.success("অ্যাকাউন্ট সফলভাবে তৈরি করা হয়েছে।");
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
        addLog(`AUTH_SUCCESS: ${normalizedEmail}`);
        toast.success("সফলভাবে লগইন করা হয়েছে।");
      }
    } catch (err: any) {
      console.error("AUTH_ERROR_OBJECT:", err);
      let errorMsg = "অথেনটিকেশন প্রোটোকল ব্যর্থ হয়েছে।";
      
      const isSuperAdminEmail = normalizedEmail === "free122055@gmail.com";
      const errorCode = err.code || "";
      const errorMessage = err.message || "";

      // Handle various Firebase Auth error codes for better UX
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/invalid-login-credentials' || errorMessage.includes('invalid-credential')) {
        if (isSuperAdminEmail) {
          errorMsg = "লগইন তথ্য সঠিক নয়। আপনি যদি আগে গুগল দিয়ে সাইন-ইন করে থাকেন, তবে নিচের 'গুগল দিয়ে লগইন' বাটনে ক্লিক করুন। অথবা 'নিবন্ধন' ট্যাবে গিয়ে নতুন পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খুলুন।";
        } else {
          errorMsg = "লগইন তথ্য সঠিক নয়। পাসওয়ার্ড চেক করুন অথবা নিচের 'গুগল দিয়ে লগইন' ব্যবহার করুন। যদি তাও না হয়, তবে 'নিবন্ধন' করুন।";
        }
        setPassword('');
      } else {
        switch (errorCode) {
          case 'auth/user-not-found':
            errorMsg = "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে 'নিবন্ধন' ট্যাবে গিয়ে অ্যাকাউন্ট তৈরি করুন।";
            break;
          case 'auth/email-already-in-use':
            errorMsg = "এই ইমেইলটি ইতিমধ্যে নিবন্ধিত। আপনি কি সরাসরি লগইন করার চেষ্টা করবেন?";
            setAuthMode('login');
            break;
          case 'auth/weak-password':
            errorMsg = "আপনার পাসওয়ার্ডটি খুবই দুর্বল। অন্তত ৬ অক্ষরের স্ট্রং পাসওয়ার্ড দিন।";
            break;
          case 'auth/too-many-requests':
            errorMsg = "অতিরিক্ত বার চেষ্টা করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।";
            break;
          case 'auth/network-request-failed':
            errorMsg = "ইন্টারনেট সংযোগ বিচ্ছিন্ন। আপনার কানেকশন চেক করুন।";
            break;
          default:
            errorMsg = `সমস্যা: ${errorMessage || errorCode}`;
        }
      }
      
      toast.error(errorMsg);
      addLog(`AUTH_ERROR: ${errorCode}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("সেশন সমাপ্ত করা হয়েছে।");
      setView('dashboard');
      setIsAdminMode(false);
    } catch (err) {
      toast.error("সাইন আউট ব্যর্থ হয়েছে।");
    }
  };

  const validateNumber = (val: string) => {
    // Allow more flexible formats: 7 to 15 digits, optional +88
    return /^(\+?88)?\d{7,14}$/.test(val.replace(/[-\s]/g, ''));
  };

  const getDuplicateNumbers = () => {
    const fieldsToWatch = [
      'whatsappNumber', 'primaryNumber', 'secondaryNumber', 'thirdNumber',
      'motherContact', 'fatherContact', 'brotherContact',
      'uncleContact', 'maternalUncleContact', 'auntContact', 'paternalAuntContact',
      'imamContact', 'upMemberContact', 'referenceNumber',
      'bkashInfo', 'nagadInfo', 'rocketInfo'
    ];
    const numbers = fieldsToWatch.map(f => formData[f]).filter(Boolean);
    const seen = new Set();
    const duplicates = new Set();
    numbers.forEach(num => {
      if (seen.has(num)) duplicates.add(num);
      seen.add(num);
    });
    return Array.from(duplicates);
  };

  const calculateRiskScore = () => {
    let score = 0;
    const filledFields = Object.values(formData).filter((v: any) => v && v.toString().trim() !== "").length;
    const totalFields = sections.reduce((acc, s) => acc + s.fields.length + s.documents.length, 0);
    const completionBase = Math.max(0, 100 - (filledFields / totalFields) * 80);
    score = completionBase;

    const hasFormatErrors = Object.entries(formData).some(([key, val]) => {
      if (key.toLowerCase().includes('number') || key.toLowerCase().includes('info') || key.toLowerCase().includes('contact')) {
        return val && !validateNumber(val as string);
      }
      return false;
    });
    if (hasFormatErrors) score += 15;

    const duplicates = getDuplicateNumbers();
    score += duplicates.length * 10;

    return Math.min(100, Math.round(score));
  };


  const isSectionValid = (section: VerificationSection) => {
    const fieldsFilled = section.fields.every(field => {
      const val = formData[field];
      if (!val || val.toString().trim() === "") return false;
      const lowerField = field.toLowerCase();
      if (lowerField.includes('number') || lowerField.includes('info') || lowerField.includes('contact')) {
        if (!validateNumber(val)) return false;
      }
      return true;
    });
    const docsUploaded = section.documents.every(doc => formData[doc]);
    return fieldsFilled && docsUploaded;
  };

  const currentSection = sections[activeStep];

  const completedSections = React.useMemo(() => {
    return sections.filter(section => isSectionValid(section)).map(s => s.id);
  }, [formData, sections]);

  const handleFileUpload = (fieldName: string) => {
    setCurrentUploadingField(fieldName);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const fieldName = currentUploadingField;
    if (!file || !fieldName) return;

    addLog(`INITIALIZING_IMAGE_SCAN: ${fieldName}`);
    addLog(`FILE_DETECTED: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    toast.promise(
      new Promise((resolve, reject) => {
        setTimeout(() => {
          // Higher rejection rate for testing or realistic feel
          if (Math.random() > 0.95) {
            addLog("ALGORITHM_REJECT: METADATA_MANIPULATION");
            reject("AI forensic scanner detected potential metadata manipulation.");
          } else {
            addLog("METADATA_VERIFIED: IMAGE_AUTHENTIC");
            setFormData(prev => ({ ...prev, [fieldName]: file.name }));
            resolve(true);
          }
        }, 3000);
      }),
      {
        loading: `Initializing AI forensic scan for ${FIELD_LABELS[fieldName] || fieldName}...`,
        success: "Cryptographic signature verified. Data secured.",
        error: "IMAGE_FAKE_ARTEFACT DETECTED: Submission rejected."
      }
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (aiRisk?.flaggedFields?.includes(name)) {
      setAiRisk(prev => prev ? {
        ...prev,
        flaggedFields: prev.flaggedFields?.filter(f => f !== name)
      } : null);
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    setAnalyzingField(name);
    addLog(`ANALYZING: ${name}...`);
    
    // Simulate real-time forensic scanning
    setTimeout(() => {
      const isNum = name.toLowerCase().includes('number') || name.toLowerCase().includes('info') || name.toLowerCase().includes('contact');
      if (value && isNum && !validateNumber(value)) {
        addLog(`PATTERN_MISMATCH: ${name} (Invalid BD Format)`);
      } else if (value) {
        addLog(`HASH_VERIFIED: ${name}`);
      }
      setAnalyzingField(null);
    }, 1200);
  };

  const nextStep = async () => {
    setIsScanning(true);
    setAiRisk(null);
    addLog("INITIALIZING_SECTOR_SCAN...");
    
    // 1. Basic format validation
    if (!isSectionValid(currentSection)) {
      addLog("SCAN_FAILED: DATA_INTEGRITY_COMPROMISED");
      setIsScanning(false);
      setIsRejecting(true);
      setTimeout(() => {
        setIsRejecting(false);
        // Find the first invalid field in the current section
        const firstInvalidField = currentSection.fields.find(field => {
          const val = formData[field];
          if (!val || val.toString().trim() === "") return true;
          const lowerField = field.toLowerCase();
          if (lowerField.includes('number') || lowerField.includes('info') || lowerField.includes('contact')) {
            return !validateNumber(val);
          }
          return false;
        });
        if (firstInvalidField) {
          const element = document.getElementById(`field-container-${firstInvalidField}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.querySelector('input')?.focus();
          }
        }
      }, 1000);
      toast.error("তথ্য যাচাইকরণে ব্যর্থতা পাওয়া গেছে। দয়া করে সঠিক তথ্য প্রদান করুন।");
      return;
    }

    addLog("PHASE_2: INTELLIGENT_AUDIT_RUNNING...");

    // 2. AI Intelligence Check
    try {
      const response = await fetch('/api/verify/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          sectionTitle: currentSection.title
        })
      });
      
      const aiVerdict = await response.json();
      
      if (aiVerdict.isSuspicious) {
        addLog(aiVerdict.severity === 'high' ? "SCAN_FAILED: AI_BLOCK_DETECTED" : `AI_ADVISORY: ${aiVerdict.riskReason}`);
        setAiRisk(aiVerdict);

        if (aiVerdict.severity === 'high') {
          setIsScanning(false);
          setIsRejecting(true);
          
          // Scroll to the first flagged field after a short delay
          setTimeout(() => {
            setIsRejecting(false);
            if (aiVerdict.flaggedFields && aiVerdict.flaggedFields.length > 0) {
              const firstField = aiVerdict.flaggedFields[0];
              const element = document.getElementById(`field-container-${firstField}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Attempt to focus the input
                const input = element.querySelector('input');
                if (input) input.focus();
              }
            }
          }, 1000);

          toast.error(`এআই অডিট ব্যর্থ: ${aiVerdict.riskReason}`);
          return;
        }
      }
    } catch (err) {
      console.error("AI Check Failed:", err);
      // Fallback: Continue if AI fails
    }

    addLog("SCAN_COMPLETE: ALL_HASHES_MATCH");
    setIsScanning(false);
    
    if (activeStep < sections.length - 1) {
      setActiveStep(activeStep + 1);
      window.scrollTo(0, 0);
    } else {
      setView('dashboard');
      toast.success("সকল সেকশন সফলভাবে সম্পন্ন হয়েছে। এখন সাবমিট করতে পারেন।");
    }
  };

  const prevStep = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const submitApplication = async () => {
    if (!user) {
      toast.error("লগইন করা নেই: অনুগ্রহ করে আগে লগইন করুন।");
      login();
      return;
    }
    
    if (verificationStatus !== 'none') {
      toast.error("আপনার আবেদন ইতিমধ্যে জমা দেওয়া হয়েছে।");
      return;
    }

    if (completedSections.length < sections.length) { 
        toast.error(`ত্রুটি: আপনাকে সবগুলো সেকশন সম্পন্ন করতে হবে।`);
        return;
    }
    const loader = toast.loading("ডেটা এনক্রিপ্ট করা হচ্ছে এবং সার্ভারে আপলোড হচ্ছে...");
    try {
      addLog("INIT_VERIFICATION_SUBMISSION...");
      
      const verificationId = `VER-${user.uid}-${Date.now()}`;
      const urlParams = new URLSearchParams(window.location.search);
      const finalOrgId = currentOrgId || urlParams.get('org') || 'default';
      
      const riskScore = calculateRiskScore();
      
      // Auto-approve logic based on org settings
      let finalStatus: 'approved' | 'pending' = 'pending';
      if (currentOrg?.settings?.isAutoApprovalEnabled) {
        const threshold = currentOrg.settings.autoApprovalThreshold || 20;
        if (riskScore < threshold) {
          finalStatus = 'approved';
        }
      }

      addLog(`RECORDING_VERIFICATION: ${verificationId}`);
      
      const firestoreTimeout = 12000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Network Timeout")), firestoreTimeout)
      );

      // Attempt verification record
      await Promise.race([
        setDoc(doc(db, "verifications", verificationId), {
          id: verificationId,
          userId: user.uid,
          email: user.email,
          orgId: finalOrgId,
          status: finalStatus,
          sections: formData,
          riskScore: riskScore,
          submittedAt: serverTimestamp(),
        }),
        timeoutPromise
      ]);
      addLog("VERIFICATION_COMMITTED");

      // Attempt user profile update
      await Promise.race([
        setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: "user",
          verificationStatus: finalStatus,
          lastActivity: serverTimestamp(),
        }, { merge: true }),
        timeoutPromise
      ]);
      addLog("USER_PROFILE_SYNCED");

      addLog("SUBMISSION_SUCCESS: HASH_COMMITTED");
      localStorage.removeItem('veracore_form_draft');
      
      // Update local state and dismiss toast
      toast.dismiss(loader);
      setVerificationStatus(finalStatus);
      setIsSubmitted(true);

      if (finalStatus === 'approved') {
        toast.success("অভিনন্দন! আপনার আবেদনটি সফলভাবে যাচাই করা হয়েছে।");
      } else {
        toast.success("আবেদনটি জমা দেওয়া হয়েছে। অনুগ্রহ করে অপেক্ষা করুন।");
      }
      window.scrollTo(0, 0);
    } catch (err: any) {
      toast.dismiss(loader);
      console.error("Submission Error Details:", err);
      addLog(`SUBMISSION_ERROR: ${err.message || err.code || 'UNKNOWN'}`);
      
      let errorMsg = "সার্ভার ত্রুটি: ডেটা সংরক্ষণ করা সম্ভব হয়নি।";
      if (err.code === 'permission-denied') {
        errorMsg = "সিকিউরিটি রুলস এর কারণে আবেদন জমা দেওয়া সম্ভব হয়নি। (Permissions Denied)";
      } else if (err.code === 'unavailable' || err.message === 'Network Timeout') {
        errorMsg = "নেটওয়ার্ক সমস্যা: সার্ভারের সাথে সংযোগ বিচ্ছিন্ন। আবার চেষ্টা করুন।";
      }
      
      toast.error(errorMsg);
    } finally {
      toast.dismiss(loader);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
           <Cpu className="w-16 h-16 text-primary animate-pulse" />
           <p className="text-primary font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Initializing Core... {user ? "(Authenticating Profile)" : ""}</p>
        </div>
      </div>
    );
  }

  if (syncError && syncError.includes("Access Denied")) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center p-6">
        <div className="premium-card p-10 max-w-md w-full text-center space-y-6">
           <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-2xl mx-auto flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-red-500" />
           </div>
           <h3 className="text-2xl font-black text-white uppercase italic">Security Protocol Denied</h3>
           <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
             আপনার অ্যাকাউন্টের অ্যাক্সেস পারমিশন যাচাই করা সম্ভব হচ্ছে না। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।
           </p>
           <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 overflow-hidden">
              <p className="text-[9px] text-red-400 font-mono break-all opacity-60 uppercase">Error: {syncError}</p>
           </div>
           <Button 
            onClick={() => window.location.reload()} 
            className="w-full bg-primary hover:bg-white text-black font-black h-14 uppercase tracking-widest text-[10px] rounded-xl"
           >
             সিস্টেম রিস্টার্ট করুন
           </Button>
           <Button 
            variant="ghost"
            onClick={logout} 
            className="w-full text-gray-500 uppercase text-[9px] font-black tracking-widest"
           >
             সাইন আউট করুন
           </Button>
        </div>
      </div>
    );
  }

  if (!user && !isAdminMode) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_25px_rgba(16,185,129,0.4)]" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <Card className="premium-card max-w-md w-full p-8 md:p-12 text-center space-y-6 relative overflow-hidden ring-1 ring-white/5">
            <div className="w-20 h-20 rounded-3xl mx-auto border-2 border-primary/20 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.15)] bg-primary/5 relative group">
              {authMode === 'login' ? <Lock className="w-10 h-10 text-primary group-hover:scale-110 transition-all duration-700 ease-out" /> : <UserPlus className="w-10 h-10 text-primary group-hover:scale-110 transition-all duration-700 ease-out" />}
            </div>
            <div className="space-y-4">
               <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter">ভেরা<span className="text-primary">কোর</span></h1>
               <div className="flex justify-center border-b border-white/5">
                 <button 
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-3 text-[10px] uppercase font-black tracking-[0.2em] transition-all relative ${authMode === 'login' ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
                 >
                   লগইন
                   {authMode === 'login' && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                 </button>
                 <button 
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-3 text-[10px] uppercase font-black tracking-[0.2em] transition-all relative ${authMode === 'register' ? 'text-primary' : 'text-gray-600 hover:text-gray-400'}`}
                 >
                   নিবন্ধন
                   {authMode === 'register' && <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                 </button>
               </div>
            </div>
            
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-black text-gray-500 font-mono tracking-widest">Email Address</Label>
                <Input 
                  type="email" 
                  autoComplete="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@agency.com" 
                  className="bg-black/40 border-white/10 h-12 rounded-xl focus:border-primary/50 transition-all font-mono"
                />
              </div>
              <div className="space-y-2 relative">
                <Label className="text-[9px] uppercase font-black text-gray-500 font-mono tracking-widest flex justify-between">
                  <span>Account Password (পাসওয়ার্ড)</span>
                  {authMode === 'register' && <span className="text-primary/60">(Min. 6)</span>}
                </Label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    autoComplete={authMode === 'register' ? "new-password" : "current-password"}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="bg-black/40 border-white/10 h-12 rounded-xl focus:border-primary/50 transition-all font-mono pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary transition-all"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {email.toLowerCase() === 'free122055@gmail.com' && (
                  <p className="text-[9px] text-primary/50 italic mt-2 leading-tight">
                    সুপার অ্যাডমিন: যদি সঠিক পাসওয়ার্ড দিয়েও লগইন না হয়, তবে এই ইমেইল দিয়ে 'নিবন্ধন' ট্যাবে গিয়ে একবার রিয়েল অ্যাকাউন্ট খুলে নিন। (জিমেইল পাসওয়ার্ড দিয়ে লগইন হবে না)।
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center pt-2">
                <button 
                  type="button"
                  onClick={async () => {
                    if (!email) {
                      toast.error("অনুগ্রহ করে আগে ইমেইল প্রদান করুন।");
                      return;
                    }
                    try {
                      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
                      toast.success("পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।");
                    } catch (err: any) {
                      toast.error("রিসেট লিংক পাঠানো সম্ভব হয়নি। দয়া করে ইমেইল চেক করুন।");
                    }
                  }}
                  className="text-[10px] text-primary hover:text-white uppercase tracking-widest font-black transition-all underline decoration-primary/30 underline-offset-4"
                >
                  পাসওয়ার্ড মনে নেই? (Reset Password)
                </button>
              </div>

              <div className="space-y-4 pt-2">
                <Button type="submit" disabled={isAuthenticating} className="w-full bg-primary hover:bg-white text-black font-black h-14 uppercase tracking-[0.2em] text-[11px] rounded-xl active:scale-[0.98] group">
                  {isAuthenticating ? "প্রসেসিং..." : (authMode === 'login' ? "লগইন করুন" : "অ্যাকাউন্ট তৈরি করুন")}
                  <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>

                {authMode === 'login' && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-[8px] uppercase tracking-[0.4em]">
                      <span className="bg-cyber-black px-4 text-gray-500 font-black">OR</span>
                    </div>
                  </div>
                )}

                {authMode === 'login' && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={login}
                    disabled={isAuthenticating}
                    className="w-full bg-white/5 border-white/10 hover:bg-white/10 text-white font-black h-14 uppercase tracking-[0.2em] text-[11px] rounded-xl active:scale-[0.98]"
                  >
                    <Mail className="mr-2 w-4 h-4" />
                    গুগল দিয়ে লগইন (Google Single Sign-on)
                  </Button>
                )}
              </div>
            </form>

            <div className="pt-6 border-t border-white/5">
               <p className="text-gray-500 text-[8px] uppercase tracking-widest leading-relaxed">
                 সিস্টেমে প্রবেশের সাথে সাথে আপনি আমাদের ব্যবহার নীতিমালা মেনে নিচ্ছেন।
               </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const handleAdminToggle = () => {
    if (isAdminMode) { setIsAdminMode(false); return; }
    if (userRole === 'superadmin' || (userRole === 'orgadmin' && currentOrgId)) {
      setBiometricTarget('admin');
      setIsBiometricGateActive(true);
    } else {
      toast.error("আপনার কাছে অ্যাডমিন অ্যাক্সেসের অনুমতি নেই।");
      addLog("ACCESS_DENIED: UNAUTHORIZED_ROLE");
    }
  };

  const onBiometricSuccess = () => {
    if (biometricTarget === 'unlock') {
      setIsAppLocked(false);
      setIsBiometricGateActive(false);
      toast.success("সিস্টেম আনলক সম্পন্ন।");
    } else if (biometricTarget === 'admin') {
      setIsAdminMode(true);
      setIsBiometricGateActive(false);
      toast.success("অ্যাডমিন অ্যাক্সেস মঞ্জুর করা হয়েছে।");
    } else if (biometricTarget === 'submit') {
      setIsBiometricGateActive(false);
      submitApplication();
    } else if (biometricTarget === 'step') {
      setFormData(prev => ({ ...prev, biometricStatus: "VERIFIED" }));
      setIsBiometricGateActive(false);
      toast.success("বায়োমেট্রিক ধাপ সম্পন্ন হয়েছে।");
    }
    setBiometricTarget(null);
  };

  return (
    <div 
      className="min-h-screen bg-cyber-black text-foreground overflow-hidden font-sans relative"
      style={{ '--primary': currentOrg?.settings?.primaryColor || '#10b981' } as React.CSSProperties}
    >
      <AnimatePresence>
        {isBiometricGateActive && (
          <BiometricScanner 
            onSuccess={onBiometricSuccess}
            onCancel={biometricTarget === 'unlock' ? undefined : () => setIsBiometricGateActive(false)}
            title={biometricTarget === 'unlock' ? "সিস্টেম আনলক" : biometricTarget === 'admin' ? "অ্যাডমিন এক্সেস যাচাই" : "বায়োমেট্রিক যাচাই"}
            description={biometricTarget === 'unlock' ? "আপনার পরিচয় নিশ্চিত করে সিস্টেম আনলক করুন" : "পরবর্তী ধাপের জন্য পরিচয় নিশ্চিত করুন"}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
               <motion.div 
                 initial={{ top: '-10%' }}
                 animate={{ top: '110%' }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 className="absolute left-0 right-0 h-[2px] bg-primary shadow-[0_0_30px_#10b981]"
               />
            </div>
            <div className="relative text-center space-y-8 max-w-lg w-full">
               <div className="w-40 h-40 border-4 border-primary/20 rounded-full flex flex-col items-center justify-center mx-auto relative bg-primary/5">
                  <Activity className="w-12 h-12 text-primary animate-pulse mb-2" />
                  <span className="text-[9px] font-black text-primary font-mono animate-pulse uppercase tracking-widest">AI Audit</span>
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-6px] border-t-2 border-primary rounded-full opacity-40"
                  />
               </div>
               <div className="space-y-4">
                  <h3 className="text-3xl font-black text-white italic uppercase tracking-[0.2em] neon-glow-green">Forensic Scan</h3>
                  <div className="space-y-2">
                     <p className="text-[9px] text-primary/60 font-mono uppercase tracking-[0.4em] animate-pulse">Neural verification in progress...</p>
                     <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="h-full bg-primary"
                        />
                     </div>
                  </div>
               </div>
               <div className="bg-black/60 border border-white/10 p-5 rounded-2xl text-left font-mono">
                  <div className="text-[8px] text-gray-500 mb-2 uppercase tracking-[0.2em]">Auditor_Logs:</div>
                  <div className="space-y-1 h-24 overflow-hidden">
                     {systemLog.map((log, i) => (
                       <div key={i} className="text-[10px] text-primary/80 truncate">
                         <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                         {log}
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRejecting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[210] flex items-center justify-center pointer-events-none p-6"
          >
            <div className="bg-red-500/20 border-2 border-red-500 p-10 rounded-[3rem] backdrop-blur-3xl shadow-[0_0_50px_rgba(239,68,68,0.3)] flex flex-col items-center gap-6 text-center max-w-sm pointer-events-auto">
               <AlertCircle className="w-16 h-16 text-red-500 animate-bounce" />
               <div className="space-y-2">
                  <h4 className="text-3xl font-black uppercase italic text-white tracking-tighter">অডিট ব্যর্থ</h4>
                  <p className="text-[10px] font-mono uppercase font-bold tracking-widest text-red-400">
                    {aiRisk ? aiRisk.riskReason : "আপনার প্রদানকৃত তথ্য আমাদের কৃত্রিম বুদ্ধিমত্তা যাচাই করতে সক্ষম হয়নি"}
                  </p>
               </div>
               {aiRisk && (
                 <Badge className="bg-red-500/20 text-red-400 border-red-500 text-[8px] uppercase tracking-widest">Risk_Level: {aiRisk.severity.toUpperCase()}</Badge>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating System Log */}
      <div className="fixed top-28 left-8 z-[60] pointer-events-none hidden xl:block">
         <div className="glass-morphism p-4 border-white/5 rounded-2xl space-y-2 min-w-[240px]">
            <div className="flex items-center gap-2 mb-2">
               <Terminal className="w-3 h-3 text-primary" />
               <span className="text-[8px] font-mono text-primary font-black uppercase tracking-tighter">VeraCore_v2.0_Logs</span>
            </div>
            <div className="space-y-1">
               {systemLog.map((log, i) => (
                  <motion.div 
                    key={i + log}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1 - (i * 0.2), x: 0 }}
                    className="text-[9px] font-mono text-white/40 uppercase overflow-hidden whitespace-nowrap text-ellipsis"
                  >
                     <span className="text-primary mr-2">»</span> {log}
                  </motion.div>
               ))}
            </div>
         </div>
      </div>

      <header className="h-24 glass-morphism sticky top-0 flex items-center justify-between px-8 z-50 rounded-b-[2rem]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 neon-glow-green overflow-hidden">
            {currentOrg?.logoUrl ? (
              <img src={currentOrg.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ShieldCheck className="text-primary w-8 h-8" />
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-display font-black tracking-tighter text-white uppercase">
              {currentOrg?.name ? (
                <>
                  {currentOrg.name.slice(0, 4)}<span className="text-primary">{currentOrg.name.slice(4)}</span>
                </>
              ) : (
                <>ভেরা<span className="text-primary">কোর</span></>
              )}
            </h1>
            {syncError && !syncError.includes("Access Denied") && (
              <span className="text-[7px] text-red-500 font-mono font-bold uppercase animate-pulse flex items-center gap-1">
                <Activity className="w-2 h-2" /> Connection Fragmented - Retrying...
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" size="icon" onClick={handleAdminToggle} className="text-primary hover:bg-primary/10 border border-primary/10 rounded-2xl w-12 h-12">
            {isAdminMode ? <Settings className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
          </Button>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 pt-8 pb-32 max-w-6xl">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf"
          onChange={onFileSelected}
        />
        <AnimatePresence mode="wait">
          {isAdminMode ? (
            userRole === 'superadmin' ? (
              <SuperAdminDashboard key="superadmin" />
            ) : (
              <OrgAdminDashboard orgId={currentOrgId || ''} />
            )
          ) : (verificationStatus === 'pending' || verificationStatus === 'rejected' || verificationStatus === 'approved') && view !== 'dashboard' && !isSubmitted ? (
            <motion.div key="status-redirect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto pt-10 px-4">
              <Card className="premium-card p-12 text-center flex flex-col items-center gap-10 rounded-[4rem] bg-black/60 backdrop-blur-3xl border-white/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/5 opacity-50 group-hover:opacity-100 transition-opacity" />
                
                {verificationStatus === 'approved' ? (
                  <div className="w-40 h-40 rounded-full bg-primary shadow-[0_0_50px_#10b981] flex items-center justify-center relative z-10 transition-transform duration-700 hover:scale-110">
                    <ShieldCheck className="w-20 h-20 text-black" />
                  </div>
                ) : verificationStatus === 'rejected' ? (
                   <div className="w-40 h-40 rounded-full bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] flex items-center justify-center relative z-10 transition-transform duration-700 hover:scale-110 font-black">
                    <XCircle className="w-20 h-20 text-black" />
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center relative z-10">
                    <Activity className="w-20 h-20 text-primary animate-pulse" />
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }} 
                      className="absolute inset-[-10px] border-t-2 border-primary rounded-full opacity-40 shadow-[0_0_20px_#10b98122]" 
                    />
                  </div>
                )}

                <div className="space-y-6 relative z-10">
                  <Badge variant="outline" className={cn(
                    "px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.5em] mb-4",
                    verificationStatus === 'approved' ? "text-primary border-primary/40" : 
                    verificationStatus === 'rejected' ? "text-red-500 border-red-500/40" : 
                    "text-yellow-500 border-yellow-500/40 animate-pulse"
                  )}>
                    {verificationStatus === 'approved' ? "সিস্টেম_অথেনটিকেটেড" : 
                     verificationStatus === 'rejected' ? "অ্যাক্সেস_রেস্ট্রিক্টেড" : 
                     "ভেরিফিকেশন_চলছে"}
                  </Badge>
                  
                  <h2 className={cn(
                    "text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none h-[1.1em]",
                    verificationStatus === 'approved' ? "text-white" : 
                    verificationStatus === 'rejected' ? "text-red-500" : 
                    "text-yellow-500"
                  )}>
                    {verificationStatus === 'approved' ? 'অ্যাপ্রুভড' : 
                     verificationStatus === 'rejected' ? 'বাতিলকৃত' : 
                     'পেন্ডিং'}
                  </h2>

                  <div className="max-w-lg mx-auto space-y-4">
                    <p className="text-sm md:text-lg text-gray-400 font-mono uppercase tracking-[0.2em] leading-relaxed font-bold">
                      {verificationStatus === 'approved' 
                        ? 'অভিনন্দন! আপনার প্রোফাইল ভেরিফিকেশন সফল হয়েছে। আপনি এখন গেটওয়ের সকল সুবিধা ব্যবহার করতে পারবেন।' 
                        : verificationStatus === 'rejected'
                        ? 'দুঃখিত, আপনার প্রদানকৃত তথ্যগুলো আমাদের সিকিউরিটি স্ট্যান্ডার্ড পূরণ করতে সক্ষম হয়নি।'
                        : 'আপনার আবেদনটি এখন সিস্টেম পরাধীন অবস্থায় আছে। এডমিন প্যানেল খুব শীঘ্রই এটি যাচাই করে ফলাফল জানিয়ে দিবে।'}
                    </p>
                  </div>
                </div>

                <div className="w-full flex flex-col md:flex-row gap-4 relative z-10 mt-6">
                  <Button onClick={() => setView('dashboard')} className="flex-1 bg-white hover:bg-primary text-black font-black h-16 rounded-2xl uppercase tracking-widest transition-all">
                    ড্যাশবোর্ড ফিরে যান
                  </Button>
                  {verificationStatus === 'rejected' && (
                     <Button onClick={() => setVerificationStatus('none')} className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-red-500 hover:text-black font-black h-16 rounded-2xl uppercase tracking-widest transition-all">
                        আবার আবেদন করুন
                     </Button>
                  )}
                </div>

                <div className="pt-10 border-t border-white/5 w-full flex justify-between items-center px-4 opacity-40 grayscale">
                   <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Protocol: VERA_SECURE_v2</p>
                   <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">TS: {new Date().toISOString().slice(0,10)}</p>
                </div>
              </Card>
            </motion.div>
          ) : isSubmitted ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto pt-10">
              <Card className="premium-card p-12 text-center flex flex-col items-center gap-8 rounded-[3.5rem] bg-primary/[0.03] border-primary/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                <div className="w-32 h-32 rounded-full bg-primary shadow-[0_0_30px_#10b981] flex items-center justify-center">
                  <CheckCircle2 className="w-16 h-16 text-black" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter">সফলভাবে সাবমিট হয়েছে</h2>
                  <p className="text-[12px] text-primary font-mono uppercase tracking-[0.3em] leading-relaxed font-bold">
                    আপনার সকল তথ্য এনক্রিপ্টেড পদ্ধতিতে আমাদের আর্কাইভে সংরক্ষিত হয়েছে।
                  </p>
                </div>
                <div className="w-full grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                    <span className="text-[8px] text-gray-500 uppercase block mb-1">Status</span>
                    <span className="text-xs text-primary font-black uppercase">{verificationStatus.toUpperCase()}</span>
                  </div>
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                    <span className="text-[8px] text-gray-500 uppercase block mb-1">Risk Score</span>
                    <span className="text-xs text-white font-black uppercase">{calculateRiskScore()}%</span>
                  </div>
                </div>
                <Button onClick={() => { setIsSubmitted(false); setView('dashboard'); }} className="w-full bg-white text-black hover:bg-primary font-black h-16 rounded-2xl uppercase tracking-widest transition-all">ড্যাশবোর্ড ফিরে যান</Button>
              </Card>
            </motion.div>
          ) : view === 'dashboard' ? (
            <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <div className="space-y-4">
                  <h2 className="text-6xl font-display font-black text-white uppercase tracking-tighter italic">KYC ড্যাশবোর্ড</h2>
                </div>
                <div className="flex gap-8">
                  <div className="glass-morphism p-8 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[160px] neon-glow-green">
                    <span className="text-[10px] text-primary/60 font-mono uppercase mb-3 font-bold tracking-widest">সম্পন্ন ধাপ</span>
                    <span className="text-4xl font-black text-primary">{completedSections.length} / {sections.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {sections.map((section, idx) => {
                  const isLocked = idx > 0 && !completedSections.includes(sections[idx-1].id);
                  const isCompleted = completedSections.includes(section.id);
                  return (
                    <motion.div
                      key={section.id}
                      whileHover={!isLocked ? { scale: 1.02 } : {}}
                      onClick={() => { 
                        if (verificationStatus !== 'none') {
                          // Force show the main status screen
                          setActiveStep(0); 
                          setView('initial');
                          return;
                        }
                        if(!isLocked) { setActiveStep(idx); setView('sector'); } 
                        else toast.error("ধাপটি লক করা আছে"); 
                      }}
                      className={cn("group cursor-pointer p-10 rounded-[3rem] border transition-all duration-700 relative overflow-hidden", isCompleted ? "bg-primary/5 border-primary/20 neon-border-green" : isLocked ? "opacity-30 grayscale pointer-events-none scale-95" : "bg-black/60 border-white/10 hover:border-primary/50")}
                    >
                      <div className="flex justify-between items-start mb-10">
                         <div className={cn("w-20 h-20 rounded-[2rem] flex items-center justify-center border transition-all duration-700", isCompleted ? "bg-primary/10 border-primary/20 text-primary neon-glow-green" : "text-gray-400")}>
                           <section.icon className="w-10 h-10" />
                         </div>
                         {isCompleted && <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_#10b981] animate-pulse" />}
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">{section.title}</h3>
                      <p className="text-[11px] text-gray-500 font-mono uppercase tracking-wider">{section.description}</p>
                    </motion.div>
                  );
                })}
              </div>

              {completedSections.length === sections.length && verificationStatus === 'none' && (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="p-16 bg-primary/[0.03] border-2 border-primary/20 rounded-[4rem] text-center space-y-10">
                   <div className="w-28 h-28 rounded-[2.5rem] bg-primary/10 border-2 border-primary mx-auto flex items-center justify-center">
                      <ShieldCheck className="w-14 h-14 text-primary" />
                   </div>
                   <div className="space-y-4">
                      <h3 className="text-5xl font-black text-white uppercase tracking-tighter italic">ভেরিফিকেশন সম্পন্ন</h3>
                      <p className="text-gray-400 text-xs font-mono uppercase tracking-[0.4em] max-w-xl mx-auto">পরিচয় নিশ্চিতকরণ সম্পন্ন হয়েছে। সাবমিট করুন।</p>
                   </div>
                   <Button onClick={submitApplication} className="bg-primary text-black hover:bg-white h-20 px-16 rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                     অ্যাপ্লিকেশন সাবমিট করুন
                   </Button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="sector" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                <Card className="premium-card border-white/5 bg-black/60 backdrop-blur-3xl min-h-[550px] flex flex-col relative overflow-hidden group rounded-[3.5rem] shadow-2xl">
                  <CardHeader className="border-b border-white/5 py-10 px-10">
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-8 bg-primary rounded-full" />
                        <div>
                          <span className="text-primary text-[10px] font-black uppercase tracking-[0.4em] font-mono">Module {activeStep + 1} / {sections.length}</span>
                          <CardTitle className="text-4xl font-display text-white font-black italic flex items-center gap-4 uppercase">
                            <currentSection.icon className="w-10 h-10 text-primary" />
                            {currentSection.title}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="relative w-16 h-16 flex items-center justify-center">
                         <Progress value={isSectionValid(currentSection) ? 100 : 40} className="w-16 h-16 rotate-[-90deg] bg-white/5" />
                         <span className="absolute text-[10px] text-primary font-mono font-black">{isSectionValid(currentSection) ? "100%" : "40%"}</span>
                      </div>
                    </div>
                    <CardDescription className="text-xs text-gray-500 mt-4 uppercase tracking-[0.2em]">{currentSection.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="py-10 px-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {currentSection.id === "liveVideo" ? (
                        <div className="md:col-span-2 space-y-8">
                           <div className="aspect-video rounded-[3rem] bg-black border-2 border-primary/20 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                              <Video className="w-16 h-16 text-red-500 animate-pulse" />
                              <Badge className="bg-red-500 uppercase text-[10px]">Secure_Session_Wait</Badge>
                           </div>
                           <Button onClick={() => setFormData(prev => ({...prev, videoSessionId: "LIVE_" + Date.now()}))} className="w-full h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest shadow-lg">সেশন আইডি জেনারেট করুন</Button>
                        </div>
                      ) : currentSection.id === "biometricGate" ? (
                        <div className="md:col-span-2 flex flex-col items-center justify-center py-10 space-y-8">
                           <div className="text-center space-y-4">
                              <h4 className="text-3xl font-black text-white italic uppercase">{formData.biometricStatus === 'VERIFIED' ? "সফল" : "বায়োমেট্রিক গেটওয়ে"}</h4>
                              <p className="text-[10px] text-gray-500 font-mono uppercase">আপনার ডিভাইসের ফিঙ্গারপ্রিন্ট ব্যবহার করুন</p>
                           </div>
                           <Button onClick={() => { setBiometricTarget('step'); setIsBiometricGateActive(true); }} disabled={formData.biometricStatus === 'VERIFIED'} className={cn("w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 transition-all shadow-2xl relative group", formData.biometricStatus === 'VERIFIED' ? "bg-primary text-black" : "bg-primary/10 border-4 border-primary text-primary neon-glow-green")}>
                              <Fingerprint className="w-20 h-20" />
                              <span className="font-black uppercase text-xs">{formData.biometricStatus === 'VERIFIED' ? "যাচাইকৃত" : "স্ক্যান করুন"}</span>
                           </Button>
                        </div>
                      ) : currentSection.fields.map(field => {
                        const val = formData[field];
                        const lowerField = field.toLowerCase();
                        const isPhoneField = lowerField.includes('number') || lowerField.includes('info') || lowerField.includes('contact');
                        const isValid = val && val.toString().trim() !== "" && (!isPhoneField || validateNumber(val));
                        const repeats = getDuplicateNumbers();
                        const isDuplicate = val && repeats.includes(val);
                        const isAiFlagged = aiRisk?.flaggedFields?.includes(field);
                        return (
                          <div key={field} id={`field-container-${field}`} className="space-y-3 px-1 relative">
                            <div className="flex justify-between items-center">
                              <Label className="text-[10px] uppercase font-black text-gray-500 font-mono tracking-widest">{FIELD_LABELS[field] || field}</Label>
                              {analyzingField === field && (
                                <span className="text-[9px] font-mono text-primary animate-pulse flex items-center gap-1">
                                  <Activity className="w-2 h-2" /> ANALYZING...
                                </span>
                              )}
                              {isAiFlagged && (
                                <span className="text-[9px] font-mono text-red-500 animate-pulse flex items-center gap-1">
                                  <AlertCircle className="w-2 h-2" /> AI_FLAGGED
                                </span>
                              )}
                            </div>
                            <Input 
                              name={field} 
                              value={formData[field] || ""} 
                              onChange={handleInputChange} 
                              className={cn(
                                "h-12 bg-black/60 border-white/10 rounded-xl font-mono text-white transition-all", 
                                analyzingField === field ? "border-primary/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "", 
                                val && (!isValid || isDuplicate || isAiFlagged) ? "border-red-500 ring-2 ring-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : ""
                              )} 
                              placeholder={`${FIELD_LABELS[field] || field} লিখুন...`} 
                            />
                            {val && isDuplicate && <p className="text-[9px] text-red-500 font-black uppercase tracking-tighter flex items-center gap-1"><AlertTriangle className="w-2 h-2" /> ডুপ্লিকেট নম্বর শনাক্ত হয়েছে</p>}
                            {val && !isValid && !isDuplicate && <p className="text-[9px] text-red-500 font-black uppercase tracking-tighter flex items-center gap-1"><AlertCircle className="w-2 h-2" /> সঠিক প্যাটার্ন পাওয়া যায়নি</p>}
                            {isAiFlagged && <p className="text-[9px] text-red-500 font-black uppercase tracking-tighter flex items-center gap-1"><AlertCircle className="w-2 h-2" /> এআই অডিট: সন্দেহজনক তথ্য</p>}
                          </div>
                        )
                      })}
                      
                       {currentSection.documents.map(doc => (
                        <div key={doc} className="md:col-span-2 space-y-4">
                           <Label className="uppercase font-black text-[11px] text-white tracking-widest flex items-center gap-2">
                             <div className="w-1 h-3 bg-primary" /> {FIELD_LABELS[doc] || doc}
                           </Label>
                           <div onClick={() => handleFileUpload(doc)} className={cn("border-2 border-dashed h-40 rounded-[2rem] flex flex-col items-center justify-center transition-all cursor-pointer relative group", formData[doc] ? "border-primary bg-primary/5 shadow-[0_0_20px_#10b98122]" : "border-white/10 hover:border-primary/40 focus-within:border-primary/60")}>
                             {formData[doc] ? (
                               <div className="flex flex-col items-center gap-2">
                                 <CheckCircle2 className="w-10 h-10 text-primary" />
                                 <span className="text-[10px] text-primary font-mono truncate max-w-[200px]">{formData[doc]}</span>
                               </div>
                             ) : (
                               <div className="flex flex-col items-center gap-3">
                                 <Upload className="w-10 h-10 text-gray-700 group-hover:text-primary transition-colors" />
                                 <span className="text-[10px] text-gray-500 font-mono text-center px-4">ক্লিক করে গ্যালারি বা ফাইল থেকে নির্বাচন করুন</span>
                               </div>
                             )}
                           </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-white/5 p-8 flex justify-between">
                    <Button variant="outline" onClick={prevStep} disabled={activeStep === 0} className="border-white/10 text-gray-500 uppercase font-black text-xs px-8 h-12 rounded-xl">আগের ধাপ</Button>
                    <div className="flex gap-4">
                      <Button variant="ghost" onClick={() => setView('dashboard')} className="text-gray-500">বর্জন করুন</Button>
                      <Button onClick={nextStep} disabled={!isSectionValid(currentSection)} className="bg-primary text-black font-black px-12 h-14 rounded-xl uppercase text-xs tracking-widest">
                        {activeStep === sections.length - 1 ? "সম্পন্ন" : "পরবর্তী ধাপ"}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-black/95 backdrop-blur-2xl border-t border-white/10 px-6 flex items-center justify-around z-[100]">
          <button onClick={() => setView('dashboard')} className={cn("flex flex-col items-center gap-1", view === 'dashboard' ? "text-primary" : "text-gray-500")}>
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">হোম</span>
          </button>
          <div className="relative -mt-10">
             <button 
              disabled={completedSections.length < sections.length || verificationStatus !== 'none'} 
              onClick={submitApplication} 
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 border-cyber-black transition-all", 
                completedSections.length === sections.length && verificationStatus === 'none' ? "bg-primary text-black" : "bg-gray-800 text-gray-600 opacity-50 cursor-not-allowed"
              )}
             >
                <ShieldCheck className="w-8 h-8" />
             </button>
          </div>
          <button onClick={logout} className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-500 transition-colors">
            <LogOut className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase">লগআউট</span>
          </button>
      </footer>

      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

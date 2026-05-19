import { Shield, Smartphone, User, CreditCard, Users, Heart, Ghost, MapPin, Share2, Upload, Lock, Activity, Video } from "lucide-react";

export type VerificationStatus = "pending" | "verified" | "rejected" | "none";

export interface VerificationSection {
  id: string;
  title: string;
  description: string;
  icon: any;
  fields: string[];
  documents: string[];
  isCompleted: boolean;
}

export const VERIFICATION_SECTIONS: VerificationSection[] = [
  {
    id: "whatsapp",
    title: "হোয়াটসঅ্যাপ বিজনেস যাচাই",
    description: "আপনার নিবন্ধিত বিজনেস হোয়াটসঅ্যাপের মাধ্যমে পরিচয় নিশ্চিত করুন।",
    icon: Shield,
    fields: ["whatsappNumber", "whatsappBusinessName", "isRegisteredToSelf"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "personalMobile",
    title: "ব্যক্তিগত মোবাইল নম্বর",
    description: "আপনার সকল সক্রিয় মোবাইল নম্বরগুলো সিস্টেমে যুক্ত করুন।",
    icon: Smartphone,
    fields: ["primaryNumber", "secondaryNumber", "thirdNumber"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "personalIdentity",
    title: "ব্যক্তিগত পরিচয়",
    description: "আপনার আইনি এবং বায়োমেট্রিক পরিচয় তথ্য যাচাই করুন।",
    icon: User,
    fields: ["fullName", "profession", "fatherName", "motherName", "birthAddress", "presentAddress"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "mobileBanking",
    title: "মোবাইল ব্যাংকিং যাচাই",
    description: "আর্থিক লেনদেন চ্যানেল এবং MFS অ্যাকাউন্ট যাচাই করুন।",
    icon: CreditCard,
    fields: ["bkashInfo", "nagadInfo", "rocketInfo"],
    documents: ["bkashStatement", "nagadStatement", "rocketStatement", "bankStatement"],
    isCompleted: false,
  },
  {
    id: "family",
    title: "পরিবার যাচাইকরণ",
    description: "পরিবারের সদস্যদের তথ্য দিয়ে ভেরিফিকেশন শক্তিশালী করুন।",
    icon: Users,
    fields: ["motherContact", "fatherContact", "brotherContact"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "relative",
    title: "আত্মীয় যাচাইকরণ",
    description: "নিকটাত্মীয়দের তথ্যের মাধ্যমে নেটওয়ার্ক অডিট সম্পন্ন করুন।",
    icon: Heart,
    fields: ["uncleContact", "maternalUncleContact", "auntContact", "paternalAuntContact"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "friend",
    title: "বন্ধু যাচাইকরণ",
    description: "সামাজিক বিশ্বাসযোগ্যতা এবং বন্ধুদের তথ্য যাচাই।",
    icon: Ghost,
    fields: ["friend1", "friend2", "friend3", "friend4", "friend5"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "local",
    title: "স্থানীয় এলাকা যাচাই",
    description: "স্থায়ী ঠিকানা এবং স্থানীয় পরিচিতি নিশ্চিত করুন।",
    icon: MapPin,
    fields: ["imamContact", "upMemberContact"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "social",
    title: "সামাজিক যোগাযোগ যাচাই",
    description: "আপনার ডিজিটাল প্রোফাইল এবং সোশ্যাল লিংক অডিট।",
    icon: Share2,
    fields: ["facebookProfile", "referenceNumber"],
    documents: [],
    isCompleted: false,
  },
  {
    id: "mandatoryDocs",
    title: "ডকুমেন্ট আপলোড",
    description: "প্রয়োজনীয় দলিলাদি এবং ছবি নিরাপদ ভল্টে জমা দিন।",
    icon: Upload,
    fields: [],
    documents: [
      "userNID", "parentNID", "electricityBill", "simProof", "professionProof", 
      "photo1", "photo2", "photo3", "mosquePhoto"
    ],
    isCompleted: false,
  },
  {
    id: "liveVideo",
    title: "লাইভ ভিডিও যাচাই",
    description: "রিয়েল-টাইম বায়োমেট্রিক চেক এবং সেশন রেকর্ডিং শুরু করুন।",
    icon: Video,
    fields: ["videoSessionId"],
    documents: ["liveVideoRecording", "videoCallScreenshot"],
    isCompleted: false,
  },
  {
    id: "biometricGate",
    title: "বায়োমেট্রিক ফিঙ্গার লক",
    description: "আপনার ডিভাইসের ফিঙ্গারপ্রিন্ট ব্যবহার করে চূড়ান্ত ভেরিফিকেশন সম্পন্ন করুন।",
    icon: Lock,
    fields: ["biometricStatus"],
    documents: [],
    isCompleted: false,
  }
];

export const FIELD_LABELS: Record<string, string> = {
  biometricStatus: "ফিঙ্গারপ্রিন্ট অবস্থা",
  whatsappNumber: "হোয়াটসঅ্যাপ নম্বর",
  whatsappBusinessName: "বিজনেস নাম",
  isRegisteredToSelf: "নিজের নামে নিবন্ধিত?",
  primaryNumber: "প্রধান মোবাইল নম্বর",
  secondaryNumber: "দ্বিতীয় মোবাইল নম্বর",
  thirdNumber: "তৃতীয় মোবাইল নম্বর",
  fullName: "সম্পূর্ণ নাম (বাংলায়)",
  profession: "পেশা",
  fatherName: "পিতার নাম",
  motherName: "মাতার নাম",
  birthAddress: "স্থায়ী ঠিকানা",
  presentAddress: "বর্তমান ঠিকানা",
  bkashInfo: "বিকাশ নম্বর",
  nagadInfo: "নগদ নম্বর",
  rocketInfo: "রকেট নম্বর",
  motherContact: "মাতার কন্টাক্ট নম্বর",
  fatherContact: "পিতার কন্টাক্ট নম্বর",
  brotherContact: "ভাই/বোনের কন্টাক্ট নম্বর",
  uncleContact: "চাচা/ফুপার কন্টাক্ট নম্বর",
  maternalUncleContact: "মামা/খালুর কন্টাক্ট নম্বর",
  auntContact: "চাচী/ফুপু কন্টাক্ট নম্বর",
  paternalAuntContact: "মামী/খালা কন্টাক্ট নম্বর",
  friend1: "বন্ধুর নাম ও নম্বর ১",
  friend2: "বন্ধুর নাম ও নম্বর ২",
  friend3: "বন্ধুর নাম ও নম্বর ৩",
  friend4: "বন্ধুর নাম ও নম্বর ৪",
  friend5: "বন্ধুর নাম ও নম্বর ৫",
  imamContact: "মসজিদের ইমামের কন্টাক্ট",
  upMemberContact: "মেম্বারের কন্টাক্ট নম্বর",
  facebookProfile: "ফেসবুক প্রোফাইল লিংক",
  referenceNumber: "রেফারেন্স নম্বর",
  videoSessionId: "সেশন আইডি",
  userNID: "আপনার এনআইডি (NID)",
  parentNID: "পিতার এনআইডি (NID)",
  electricityBill: "বিদ্যুৎ বিলের কপি",
  simProof: "সিম মালিকানার প্রমাণ",
  professionProof: "পেশার প্রমাণপত্র",
  bankStatement: "ব্যাংক স্টেটমেন্ট",
  bkashStatement: "বিকাশ স্টেটমেন্ট (৩ মাস)",
  nagadStatement: "নগদ স্টেটমেন্ট (৩ মাস)",
  rocketStatement: "রকেট স্টেটমেন্ট (৩ মাস)",
  photo1: "আপনার ছবি ১",
  photo2: "আপনার ছবি ২",
  photo3: "ছবি এনআইডি সহ",
  mosquePhoto: "মসজিদের সামনে ছবি",
  liveVideoRecording: "লাইভ ভিডিও রেকর্ড",
  videoCallScreenshot: "ভিডিও কল স্ক্রিনশট"
};

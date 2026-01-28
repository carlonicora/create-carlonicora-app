import { configureWaitlist } from "@carlonicora/nextjs-jsonapi";

configureWaitlist({
  heroTitle: "Join the {{name}} Waitlist",
  heroSubtitle: "Be among the first to experience our platform",
  heroDescription:
    "Get early access and exclusive benefits when you join our waitlist.",
  benefits: [
    "Early access to all features",
    "Exclusive early bird pricing",
    "Priority onboarding support",
    "Direct feedback channel with founders",
  ],
  questionnaire: [
    {
      id: "useCase",
      type: "select",
      label: "What would you primarily use this platform for?",
      options: [
        { value: "personal", label: "Personal use" },
        { value: "business", label: "Business use" },
        { value: "both", label: "Both" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "referralSource",
      type: "text",
      label: "How did you hear about us?",
      placeholder: "e.g., Social media, Google search, friend referral...",
    },
  ],
});

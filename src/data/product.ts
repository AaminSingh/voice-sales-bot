export interface Feature {
  id: string;
  title: string;
  description: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  priceINR: number;
  billingPeriod: string;
  description: string;
  features: string[];
  popular?: boolean;
}

export interface ObjectionHandling {
  objection: string;
  response: string;
}

export interface CallToAction {
  trial: {
    label: string;
    description: string;
  };
  demo: {
    label: string;
    description: string;
  };
}

export interface Product {
  name: string;
  tagline: string;
  description: string;
  features: Feature[];
  pricingPlans: PricingPlan[];
  objections: ObjectionHandling[];
  callToAction: CallToAction;
}

export const product: Product = {
  name: "BillEasy",
  tagline: "Effortless Invoicing & Automated Billing for Modern Indian Businesses",
  description:
    "BillEasy simplifies GST-compliant invoicing, automated payment reminders, and expense tracking for freelancers and small-to-medium businesses across India.",
  features: [
    {
      id: "gst-invoicing",
      title: "GST-Compliant Invoicing",
      description:
        "Generate professional, custom-branded tax invoices and e-invoices with automated GST calculation and HSN code lookup in seconds.",
    },
    {
      id: "whatsapp-reminders",
      title: "Automated WhatsApp & Email Reminders",
      description:
        "Send scheduled payment follow-ups directly via WhatsApp and email to get paid up to 3x faster with zero manual chasing.",
    },
    {
      id: "upi-payments",
      title: "Integrated UPI & Online Payments",
      description:
        "Embed dynamic UPI QR codes and payment gateway links directly on invoices for instant, frictionless customer settlements.",
    },
    {
      id: "expense-inventory",
      title: "Real-Time Expense & Inventory Tracking",
      description:
        "Track recurring operational expenses, scan bills on mobile, and manage product inventory levels in real-time.",
    },
    {
      id: "client-portal",
      title: "Client Portal & Multi-Currency Billing",
      description:
        "Bill international clients seamlessly in foreign currencies and provide customers with a self-service portal to view and pay invoices.",
    },
  ],
  pricingPlans: [
    {
      id: "starter",
      name: "Starter",
      priceINR: 499,
      billingPeriod: "per month",
      description: "Ideal for freelancers and solo proprietors starting out.",
      features: [
        "Up to 50 GST invoices/month",
        "1 user account",
        "Dynamic UPI QR code integration",
        "Automated email payment reminders",
        "Basic financial reports",
        "Email support",
      ],
      popular: false,
    },
    {
      id: "growth",
      name: "Growth",
      priceINR: 1299,
      billingPeriod: "per month",
      description: "Best for growing small businesses and agencies needing team collaboration.",
      features: [
        "Unlimited invoices & estimates",
        "Up to 5 team members",
        "Automated WhatsApp & Email reminders",
        "Multi-currency billing",
        "Expense & inventory management",
        "Priority chat and email support",
      ],
      popular: true,
    },
    {
      id: "pro",
      name: "Pro",
      priceINR: 2499,
      billingPeriod: "per month",
      description: "Designed for established enterprises requiring advanced control and integrations.",
      features: [
        "Unlimited invoices, clients & users",
        "Dedicated account manager",
        "Custom domain client portal",
        "e-Way bill generation & bulk invoicing",
        "Full REST API and webhook access",
        "24/7 priority phone and WhatsApp support",
      ],
      popular: false,
    },
  ],
  objections: [
    {
      objection: "Too expensive",
      response:
        "I completely understand budget is a top priority. BillEasy typically saves business owners 5 to 10 hours every week on manual paperwork and helps recover overdue invoices 3x faster. Most of our clients recover their entire monthly subscription within the first week alone. Plus, you can try it completely free for 14 days without entering credit card details.",
    },
    {
      objection: "Already use a competitor",
      response:
        "That's fantastic that you already have an automated system in place! Many of our current clients previously used tools like Zoho or QuickBooks, but switched to BillEasy for our tailored Indian GST workflows, instant WhatsApp payment reminders, and zero-fee UPI integration. We also provide a free 1-click data migration service so you won't lose any of your customer records.",
    },
    {
      objection: "Need to ask my boss",
      response:
        "That makes total sense. I would be happy to share a concise 1-page ROI summary and feature checklist you can review together. We can also schedule a quick 15-minute demo with both of you whenever convenient to answer any technical or financial questions directly.",
    },
    {
      objection: "Not sure it fits my business",
      response:
        "Every business has distinct billing workflows, which is why BillEasy is built with customizable invoice templates, flexible tax slabs, and modular features tailored for service providers, agencies, and retail SMEs alike. During our free 14-day trial or a quick demo, we can configure a sample workflow specifically for your operations.",
    },
    {
      objection: "Too much hassle to switch",
      response:
        "Switching software can feel daunting, which is why our onboarding team handles data migration for you free of charge. You simply upload your client spreadsheet or export from your existing tool, and we handle the setup so you can start issuing invoices in under 10 minutes without any downtime.",
    },
  ],
  callToAction: {
    trial: {
      label: "Start 14-Day Free Trial",
      description: "Get full access to all features for 14 days with no credit card required.",
    },
    demo: {
      label: "Book a 15-Minute Live Demo",
      description: "Schedule a personalized 1-on-1 walkthrough with a product specialist.",
    },
  },
};

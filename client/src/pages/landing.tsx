import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  FileSearch,
  BrainCircuit,
  Gavel,
  Clock,
  Users,
  Lock,
  Workflow,
  Sparkles,
  CloudUpload,
  CheckCircle2,
} from "lucide-react";
import logo from "@assets/generated_images/minimalist_legal_logo_navy_gold.png";

const featureHighlights = [
  {
    title: "Evidence Intelligence",
    description: "Ingest discovery files and surface timelines, inconsistencies, and key facts in minutes.",
    icon: FileSearch,
  },
  {
    title: "Trial Readiness",
    description: "Run AI-driven simulations, deposition prep, and strategy coaching for every matter.",
    icon: Gavel,
  },
  {
    title: "Collaborative Casework",
    description: "Coordinate teams with live presence, shared notes, and secure case activity streams.",
    icon: Users,
  },
  {
    title: "Private by Design",
    description: "Every session requires authenticated access. Your client files stay protected.",
    icon: Lock,
  },
];

const workflowSteps = [
  {
    title: "Capture",
    description: "Upload documents, recordings, and images with built-in validation.",
    icon: CloudUpload,
  },
  {
    title: "Analyze",
    description: "Generate timelines, briefs, and discovery summaries with AI assistance.",
    icon: BrainCircuit,
  },
  {
    title: "Execute",
    description: "Stay on deadlines and push filings with clear, auditable case history.",
    icon: Workflow,
  },
];

const securityPoints = [
  "Authenticated sessions required for every case interaction.",
  "Granular audit trails for access, uploads, and case exports.",
  "Encrypted password storage with automatic hash upgrades.",
  "Rate-limited authentication endpoints to deter brute force.",
];

const platformPreview = [
  {
    title: "Matter Command Center",
    description: "Track deadlines, filings, and assignments from one live dashboard.",
  },
  {
    title: "Evidence Vault",
    description: "Keep discovery searchable, tagged, and linked to key facts.",
  },
  {
    title: "Team Activity Ledger",
    description: "See who accessed each file with time-stamped accountability.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

        <header className="relative z-10 px-6 py-6 lg:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-primary/10 p-1">
                <img src={logo} alt="CaseBuddy Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="font-serif text-xl font-bold text-primary">CaseBuddy</p>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Legal AI OS</p>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#features" className="hover:text-primary">Features</a>
              <a href="#workflow" className="hover:text-primary">Workflow</a>
              <a href="#security" className="hover:text-primary">Security</a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="outline" className="hidden md:inline-flex">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button className="bg-primary text-primary-foreground">Enter Platform</Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="relative z-10 px-6 pb-16 pt-10 lg:px-12 lg:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                AI-native workflow for modern litigation teams
              </div>
              <h1 className="text-3xl font-serif font-bold text-primary sm:text-4xl lg:text-5xl">
                Case strategy, evidence intelligence, and secure collaboration in one workspace.
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
                CaseBuddy turns fragmented case data into coherent, actionable insights. Upload discovery,
                generate briefs, and run trial simulations while protecting every client file behind
                authenticated access.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login">
                  <Button className="bg-primary text-primary-foreground">Get Started Securely</Button>
                </Link>
                <a href="#features">
                  <Button variant="outline">Explore Features</Button>
                </a>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  Authenticated access required
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Real-time case readiness
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/80 shadow-lg backdrop-blur">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="h-4 w-4 text-accent" />
                      Secure Access Portal
                    </CardTitle>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-primary">
                      Login
                    </span>
                  </div>
                  <CardDescription>Sign in to reach the full CaseBuddy platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="landing-username">Username</Label>
                    <Input
                      id="landing-username"
                      placeholder="e.g., jsmith"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="landing-password">Password</Label>
                    <Input
                      id="landing-password"
                      type="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="flex-1 min-w-[170px]">
                      <Link href="/login">Continue to Sign In</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 min-w-[170px]">
                      <Link href="/login">Create Account</Link>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    Authenticated sessions unlock the full workspace.
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/70 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BrainCircuit className="h-4 w-4 text-accent" />
                    Platform Preview
                  </CardTitle>
                  <CardDescription>
                    What opens up after secure sign-in.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {platformPreview.map((item) => (
                    <div key={item.title} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-3 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Features</p>
            <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
              Everything you need to move a case forward.
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
              CaseBuddy unifies discovery, AI analysis, collaboration, and security into a single, controlled
              workspace built for legal teams.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-border/60 bg-card/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-accent" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {feature.description}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-muted/30 px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workflow</p>
              <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
                A focused path from intake to trial readiness.
              </h2>
            </div>
            <Link href="/login">
              <Button variant="outline">Secure Sign In</Button>
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="border-border/60 bg-background">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {step.title}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{step.description}</CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="security" className="px-6 py-16 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Security</p>
            <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">
              Built for confidentiality and compliance.
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              CaseBuddy requires authenticated access for every action. Your evidence and client files are
              safeguarded with session controls and audit logging.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              End-to-end access accountability
            </div>
          </div>
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-accent" />
                Security Checklist
              </CardTitle>
              <CardDescription>Hardening defaults that protect sensitive matters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {securityPoints.map((point) => (
                <div key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                  <span>{point}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/80 px-6 py-10 text-center shadow-sm">
          <h3 className="text-xl font-serif font-bold text-primary sm:text-2xl">
            Ready to work securely?
          </h3>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Sign in to access your matters, manage evidence, and keep client files protected behind secure login.
          </p>
          <Link href="/login">
            <Button className="bg-primary text-primary-foreground">Enter CaseBuddy</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

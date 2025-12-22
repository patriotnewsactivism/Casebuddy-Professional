import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { 
  Clock, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  Activity,
  Newspaper,
  ExternalLink,
  Plus,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCases, getLatestNews, createCase } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const { data: news = [] } = useQuery({
    queryKey: ["news", "latest"],
    queryFn: () => getLatestNews(3),
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (cases && cases.length > 0) {
      const totalFiles = cases.reduce((acc, c) => acc + (c.filesCount || 0), 0);
      if (totalFiles > 0) {
        toast({
          title: "System Ready",
          description: `CaseBuddy AI has successfully indexed ${totalFiles.toLocaleString()} documents.`,
        });
      }
    }
  }, []);

  const upcomingDeadlines = cases?.filter(c => c.nextDeadline && new Date(c.nextDeadline) > new Date()).length || 0;
  const totalDocs = cases?.reduce((acc, c) => acc + (c.filesCount || 0), 0) || 0;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary mb-1 sm:mb-2">Good Morning, Counselor.</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Here is your case overview for today, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
          </div>
          <NewCaseModal onSuccess={(caseId) => navigate(`/case/${caseId}`)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-primary bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Matters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-serif text-primary">{cases?.filter(c => c.status === 'active').length || 0}</div>
              <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>{cases?.length || 0} total cases</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-accent bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-serif text-primary">{upcomingDeadlines}</div>
              <div className="flex items-center gap-2 mt-2 text-xs text-orange-600">
                <AlertCircle className="w-3 h-3" />
                <span>Cases with deadlines set</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-slate-400 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Documents Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold font-serif text-primary">{totalDocs >= 1000 ? (totalDocs / 1000).toFixed(1) + 'k' : totalDocs}</div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                <span>Total documents in system</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {news.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-medium text-muted-foreground">Legal News & Updates</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {news.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-muted/30 border border-border/50 rounded-lg p-4 hover:bg-muted/50 hover:border-primary/20 transition-all"
                  data-testid={`news-article-${article.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground/70">
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'We The People News'}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold font-serif text-primary">Recent Activity</h2>
            <Button variant="ghost" size="sm" className="text-sm text-primary">
              <span className="hidden sm:inline">View All Cases</span>
              <span className="sm:hidden">View All</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {isLoading && <div className="text-center py-12 text-muted-foreground">Loading cases...</div>}
            {!isLoading && (!cases || cases.length === 0) && (
              <div className="text-center py-12 border rounded-lg bg-muted/20">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No cases yet. Create your first case to get started.</p>
                <NewCaseModal onSuccess={(caseId) => navigate(`/case/${caseId}`)} />
              </div>
            )}
            {cases && cases.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/case/${c.id}`}>
                <div className="group bg-card border hover:border-accent/50 p-4 sm:p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden" data-testid={`case-card-${c.id}`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary group-hover:bg-accent transition-colors"></div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">{c.caseNumber}</span>
                        <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">{c.title}</h3>
                        {c.status === 'active' && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">{c.description || "No description"}</p>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3" />
                          {c.filesCount.toLocaleString()} Docs
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span className="hidden sm:inline">Last active:</span> {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-2 sm:pt-0 border-t sm:border-t-0 sm:text-right">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-0 sm:mb-1">Next Deadline</div>
                      <div className="text-sm font-medium text-destructive flex items-center gap-1 justify-end">
                        <CalendarIcon className="w-3 h-3" />
                        {c.nextDeadline ? new Date(c.nextDeadline).toLocaleDateString() : 'None set'}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function NewCaseModal({ onSuccess }: { onSuccess?: (caseId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => createCase({ title, caseNumber, client, description }),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast({
        title: "Case Created",
        description: `${newCase.title} has been created successfully.`,
      });
      setOpen(false);
      setTitle("");
      setCaseNumber("");
      setClient("");
      setDescription("");
      onSuccess?.(newCase.id);
    },
    onError: () => {
      toast({
        title: "Failed to Create Case",
        description: "Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !caseNumber || !client) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in case title, case number, and client name.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-case">
          <Plus className="w-4 h-4 mr-2" /> New Case Intake
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">New Case Intake</DialogTitle>
          <DialogDescription>
            Enter the case details to create a new matter in CaseBuddy.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Case Title *</label>
            <Input
              placeholder="e.g., Smith v. Johnson"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="input-case-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Case Number *</label>
            <Input
              placeholder="e.g., 2024-CV-12345"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              required
              data-testid="input-case-number"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Client Name *</label>
            <Input
              placeholder="e.g., John Smith"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              data-testid="input-client-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <textarea
              className="w-full p-2 border rounded-md bg-background min-h-[80px] text-sm"
              placeholder="Brief description of the case..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-case-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-case">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Case"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
  );
}

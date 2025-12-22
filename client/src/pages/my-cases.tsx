import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCases, createCase, deleteCase } from "@/lib/api";
import { Link } from "wouter";
import { 
  Briefcase, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  FileText,
  Trash2,
  Loader2,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { caseIntakeSchema } from "@shared/schema";
import { z } from "zod";

export default function MyCases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    caseNumber: "",
    client: "",
    description: "",
    representationType: "plaintiff" as "plaintiff" | "defendant" | "petitioner" | "respondent",
    opposingParty: "",
    caseTheory: "",
    winningFactors: "",
    trappingFactors: "",
  });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const createMutation = useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setIsNewCaseOpen(false);
      setFormData({ title: "", caseNumber: "", client: "", description: "", representationType: "plaintiff", opposingParty: "", caseTheory: "", winningFactors: "", trappingFactors: "" });
      toast({ title: "Case created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create case", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast({ title: "Case deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete case", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validatedData = caseIntakeSchema.parse(formData);
      createMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: error.errors[0].message, variant: "destructive" });
      }
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary" data-testid="text-page-title">My Cases</h1>
            <p className="text-muted-foreground mt-1">Manage all your legal cases in one place</p>
          </div>
          <Dialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-new-case">
                <Plus className="w-4 h-4" />
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
                <DialogDescription>
                  Enter case details. The more context you provide, the better AI can analyze evidence.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Case Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Smith v. Jones"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      data-testid="input-case-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caseNumber">Case Number *</Label>
                    <Input
                      id="caseNumber"
                      placeholder="e.g., CV-2024-12345"
                      value={formData.caseNumber}
                      onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
                      data-testid="input-case-number"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Our Client *</Label>
                    <Input
                      id="client"
                      placeholder="e.g., John Smith"
                      value={formData.client}
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      data-testid="input-client"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="representationType">We Represent</Label>
                    <Select
                      value={formData.representationType}
                      onValueChange={(value: "plaintiff" | "defendant" | "petitioner" | "respondent") => 
                        setFormData({ ...formData, representationType: value })
                      }
                    >
                      <SelectTrigger data-testid="select-representation-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plaintiff">Plaintiff</SelectItem>
                        <SelectItem value="defendant">Defendant</SelectItem>
                        <SelectItem value="petitioner">Petitioner</SelectItem>
                        <SelectItem value="respondent">Respondent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="opposingParty">Opposing Party</Label>
                  <Input
                    id="opposingParty"
                    placeholder="e.g., ABC Corporation"
                    value={formData.opposingParty}
                    onChange={(e) => setFormData({ ...formData, opposingParty: e.target.value })}
                    data-testid="input-opposing-party"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Case Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the case..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    data-testid="input-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caseTheory">Case Theory</Label>
                  <Textarea
                    id="caseTheory"
                    placeholder="What are we trying to prove? What's our theory of the case?"
                    value={formData.caseTheory}
                    onChange={(e) => setFormData({ ...formData, caseTheory: e.target.value })}
                    data-testid="input-case-theory"
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="winningFactors">Winning Evidence to Find</Label>
                    <Textarea
                      id="winningFactors"
                      placeholder="What evidence would help win this case?"
                      value={formData.winningFactors}
                      onChange={(e) => setFormData({ ...formData, winningFactors: e.target.value })}
                      data-testid="input-winning-factors"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trappingFactors">Inconsistencies to Find</Label>
                    <Textarea
                      id="trappingFactors"
                      placeholder="What inconsistencies should we look for in opposing side's story?"
                      value={formData.trappingFactors}
                      onChange={(e) => setFormData({ ...formData, trappingFactors: e.target.value })}
                      data-testid="input-trapping-factors"
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsNewCaseOpen(false)}>
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
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cases by title, number, or client..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-cases"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cases</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchQuery || statusFilter !== "all" ? "No cases found" : "No cases yet"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first case to start managing your legal matters"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setIsNewCaseOpen(true)} data-testid="button-create-first-case">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Case
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCases.map((caseItem) => (
              <Card key={caseItem.id} className="hover:shadow-md transition-shadow" data-testid={`card-case-${caseItem.id}`}>
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs">{caseItem.caseNumber}</Badge>
                        <Badge className={caseItem.status === "active" ? "bg-green-600" : "bg-slate-500"}>
                          {caseItem.status}
                        </Badge>
                      </div>
                      <Link href={`/case/${caseItem.id}`}>
                        <h3 className="text-lg font-semibold text-primary hover:underline cursor-pointer truncate" data-testid={`link-case-${caseItem.id}`}>
                          {caseItem.title}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">Client: {caseItem.client}</p>
                      {caseItem.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{caseItem.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="hidden md:flex flex-col items-end text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="w-4 h-4" />
                          <span>{caseItem.filesCount || 0} files</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(caseItem.lastActivity)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/case/${caseItem.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-open-case-${caseItem.id}`}>
                            Open Case
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-case-menu-${caseItem.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Case
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Case</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{caseItem.title}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(caseItem.id.toString())}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground text-center pt-4">
          Showing {filteredCases.length} of {cases.length} cases
        </div>
      </div>
    </Layout>
  );
}

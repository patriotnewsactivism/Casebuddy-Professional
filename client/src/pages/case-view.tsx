import { Layout } from "@/components/layout";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCase, getDiscoveryFiles, getTimeline, uploadDiscoveryFile, generateDepositionQuestions, getDriveFolders, getCloudFolders, linkCloudFolder, syncCloudFolder, getLegalBriefs, getBriefTypes, generateLegalBrief, deleteLegalBrief, exportCaseData, deleteCase, type DriveFolder, type LegalBrief } from "@/lib/api";
import type { DiscoveryFile, CloudFolder } from "@shared/schema";
import { 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Video, 
  Mic, 
  Image as ImageIcon, 
  MoreVertical, 
  Download,
  Eye,
  Gavel,
  BrainCircuit,
  CalendarCheck,
  ChevronRight,
  UploadCloud,
  Loader2,
  Cloud,
  FolderOpen,
  RefreshCw,
  ExternalLink,
  FileEdit,
  Trash2,
  BookOpen,
  Phone,
  MessageCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSaveStatus } from "@/hooks/use-save-status";
import { FeaturedNews } from "@/components/featured-news";
import { useCollaboration } from "@/hooks/use-collaboration";
import { PresenceIndicator } from "@/components/presence-indicator";
import { VideoCallPanel } from "@/components/video-call-panel";
import { CollaborationChat } from "@/components/collaboration-chat";
import { AIChat } from "@/components/ai-chat";

export default function CaseView() {
  const [match, params] = useRoute("/app/case/:id");
  const caseId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: currentCase, isLoading: caseLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    enabled: !!caseId,
  });

  const { collaborators, isConnected, userId, userName } = useCollaboration(caseId ? parseInt(caseId) : null);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!caseId) return;
    setIsExporting(true);
    try {
      const blob = await exportCaseData(caseId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentCase?.caseNumber || "case"}-export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Case exported successfully" });
    } catch (error) {
      toast({ title: "Failed to export case", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteCase(caseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast({ title: "Case deleted successfully" });
      navigate("/app");
    },
    onError: () => {
      toast({ title: "Failed to delete case", variant: "destructive" });
    },
  });

  if (caseLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">Loading case...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentCase) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Case Not Found</h1>
            <p className="text-muted-foreground">The case ID {caseId} does not exist.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)] flex flex-col">
        {/* Case Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 md:mb-6">
          <div className="w-full sm:flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono text-xs border-primary/20 text-primary bg-primary/5">{currentCase.caseNumber}</Badge>
              <Badge className={currentCase.status === 'active' ? "bg-green-600" : "bg-slate-500"}>{currentCase.status}</Badge>
              <div className="hidden sm:block ml-2">
                <PresenceIndicator collaborators={collaborators} isConnected={isConnected} />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-primary">{currentCase.title}</h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mt-1 line-clamp-2 sm:line-clamp-none">{currentCase.description || "No description available"}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full sm:w-auto">
            <div className="sm:hidden">
              <PresenceIndicator collaborators={collaborators} isConnected={isConnected} />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant={showChat ? "default" : "outline"} 
                size="sm" 
                className="flex-1 sm:flex-initial"
                onClick={() => setShowChat(!showChat)}
                data-testid="button-chat"
              >
                <MessageCircle className="w-4 h-4 sm:mr-2" /> 
                <span className="hidden sm:inline">Chat</span>
              </Button>
              <Button 
                variant={showVideoCall ? "default" : "outline"} 
                size="sm" 
                className="flex-1 sm:flex-initial"
                onClick={() => setShowVideoCall(!showVideoCall)}
                data-testid="button-video-call"
              >
                <Phone className="w-4 h-4 sm:mr-2" /> 
                <span className="hidden sm:inline">Video Call</span>
              </Button>
              <IngestModal />
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 sm:flex-initial"
                onClick={handleExport}
                disabled={isExporting}
                data-testid="button-export-case"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
                ) : (
                  <Download className="w-4 h-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Export</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="button-delete-case">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Case</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{currentCase.title}"? This action cannot be undone and will permanently delete all case data, documents, and notes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Delete Case
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="discovery" className="flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="w-max md:w-full justify-start border-b rounded-none h-11 md:h-12 bg-transparent p-0 space-x-1 md:space-x-4">
              <TabsTrigger value="discovery" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary data-[state=active]:bg-transparent px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap">
                <Search className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Discovery</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary data-[state=active]:bg-transparent px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap">
                <CalendarCheck className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="prep" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary data-[state=active]:bg-transparent px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap">
                <Gavel className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Trial Prep</span>
              </TabsTrigger>
              <TabsTrigger value="briefs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary data-[state=active]:bg-transparent px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap">
                <FileEdit className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Briefs</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary data-[state=active]:bg-transparent px-2 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap bg-gradient-to-r from-accent/10 to-transparent">
                <BrainCircuit className="w-4 h-4 md:mr-2 text-accent" /> <span className="hidden md:inline">AI</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 bg-card border rounded-b-lg shadow-sm mt-2 md:mt-4 overflow-hidden">
            <TabsContent value="discovery" className="h-full m-0 p-0 flex flex-col">
              <DiscoveryView />
            </TabsContent>
            <TabsContent value="timeline" className="h-full m-0 p-3 md:p-6 overflow-auto">
              <TimelineView />
            </TabsContent>
            <TabsContent value="prep" className="h-full m-0 p-0">
              <TrialPrepView />
            </TabsContent>
            <TabsContent value="briefs" className="h-full m-0 p-3 md:p-6 overflow-auto">
              <LegalBriefsView caseId={caseId!} />
            </TabsContent>
            <TabsContent value="ai" className="h-full m-0 p-0">
              <div className="h-full min-h-[400px]">
                <AIChat caseId={parseInt(caseId!)} caseName={currentCase.title} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {showVideoCall && (
        <VideoCallPanel
          caseId={parseInt(caseId!)}
          caseName={currentCase.title}
          userId={userId}
          userName={userName}
          onClose={() => setShowVideoCall(false)}
        />
      )}

      {showChat && (
        <CollaborationChat
          caseId={parseInt(caseId!)}
          userId={userId}
          userName={userName}
          onClose={() => setShowChat(false)}
        />
      )}
    </Layout>
  );
}

// --- Sub-Components ---

function IngestModal() {
  const [ingesting, setIngesting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"upload" | "cloud">("upload");
  const { toast } = useToast();
  const { setSaving, setSaved, setError } = useSaveStatus();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/app/case/:id");
  const caseId = params?.id;

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDiscoveryFile(caseId!, file),
    onMutate: () => {
      setSaving();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discoveryFiles", caseId] });
      setSaved();
      toast({
        title: "Document Saved",
        description: "File processed and saved to your case.",
      });
      setIngesting(false);
      setSelectedFile(null);
    },
    onError: () => {
      setError();
      toast({
        title: "Upload Failed",
        description: "There was an error processing the file.",
        variant: "destructive",
      });
      setIngesting(false);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleIngest = () => {
    if (selectedFile) {
      setIngesting(true);
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 flex-1 sm:flex-initial">
          <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Evidence</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl sm:text-2xl">Add Discovery Material</DialogTitle>
          <DialogDescription className="text-sm">
            Upload files directly or connect a cloud folder for automatic syncing.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 sm:gap-4 mb-4">
          <Button
            variant={mode === "upload" ? "default" : "outline"}
            onClick={() => setMode("upload")}
            className="flex-1 text-sm"
            size="sm"
            data-testid="button-upload-mode"
          >
            <UploadCloud className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Upload</span> Files
          </Button>
          <Button
            variant={mode === "cloud" ? "default" : "outline"}
            onClick={() => setMode("cloud")}
            className="flex-1 text-sm"
            size="sm"
            data-testid="button-cloud-mode"
          >
            <Cloud className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Google</span> Drive
          </Button>
        </div>

        {mode === "upload" ? (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl h-48 sm:h-64 flex flex-col items-center justify-center bg-secondary/20 hover:bg-secondary/40 transition-colors p-4">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.mp4,.mp3,.jpg,.jpeg,.png,.xml,.eml,.msg"
              data-testid="input-file-upload"
            />
            {ingesting ? (
              <div className="text-center space-y-4">
                <Loader2 className="w-8 sm:w-10 h-8 sm:h-10 animate-spin text-accent mx-auto" />
                <div>
                  <p className="font-medium text-sm sm:text-base text-primary">Processing with Gemini AI...</p>
                  <p className="text-xs text-muted-foreground">Analyzing • Extracting text • Transcribing</p>
                </div>
              </div>
            ) : (
              <>
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/5 flex items-center justify-center mb-3 sm:mb-4">
                    <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  <p className="font-medium text-base sm:text-lg truncate max-w-full px-2">{selectedFile ? selectedFile.name : "Tap to select file"}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">Supports .mp4, .mp3, .pdf, .jpg, .xml</p>
                </label>
                {selectedFile && (
                  <button
                    onClick={handleIngest}
                    className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 text-sm"
                    data-testid="button-upload-process"
                  >
                    Upload & Process
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <CloudFolderBrowser caseId={caseId!} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CloudFolderBrowser({ caseId }: { caseId: string }) {
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [batesPrefix, setBatesPrefix] = useState("");
  const { toast } = useToast();
  const { setSaving, setSaved, setError } = useSaveStatus();
  const queryClient = useQueryClient();

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : undefined;

  const { data: folders = [], isLoading, error } = useQuery({
    queryKey: ["driveFolders", currentFolderId],
    queryFn: () => getDriveFolders(currentFolderId),
  });

  const { data: linkedFolders = [] } = useQuery({
    queryKey: ["cloudFolders", caseId],
    queryFn: () => getCloudFolders(caseId),
    enabled: !!caseId,
  });

  const linkMutation = useMutation({
    mutationFn: ({ folderId, folderName, batesPrefix }: { folderId: string; folderName: string; batesPrefix: string }) => 
      linkCloudFolder(caseId, folderId, folderName, batesPrefix),
    onMutate: () => {
      setSaving();
    },
    onSuccess: (folder) => {
      queryClient.invalidateQueries({ queryKey: ["cloudFolders", caseId] });
      toast({
        title: "Folder Linked",
        description: `Now syncing ${folder.folderName}...`,
      });
      syncMutation.mutate(folder.id);
    },
    onError: () => {
      setError();
      toast({
        title: "Failed to Link Folder",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (folderId: number) => syncCloudFolder(folderId),
    onMutate: () => {
      setSaving();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["discoveryFiles", caseId] });
      setSaved();
      toast({
        title: "Documents Saved",
        description: `${result.files.length} files synced and saved to your case.`,
      });
      setSelectedFolder(null);
      setBatesPrefix("");
    },
    onError: () => {
      setError();
      toast({
        title: "Sync Failed",
        variant: "destructive",
      });
    },
  });

  const navigateToFolder = (folder: DriveFolder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setSelectedFolder(null);
  };

  const navigateBack = (index: number) => {
    setFolderPath(folderPath.slice(0, index));
    setSelectedFolder(null);
  };

  const handleLink = () => {
    if (selectedFolder && batesPrefix) {
      linkMutation.mutate({
        folderId: selectedFolder.id,
        folderName: selectedFolder.name,
        batesPrefix: batesPrefix.toUpperCase(),
      });
    }
  };

  if (error) {
    return (
      <div className="border rounded-lg p-8 text-center bg-muted/20">
        <Cloud className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">Google Drive not connected</p>
        <p className="text-sm text-muted-foreground">Please connect your Google Drive account to browse folders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setFolderPath([])}
          className="text-primary hover:underline"
          data-testid="button-drive-root"
        >
          My Drive
        </button>
        {folderPath.map((folder, i) => (
          <span key={folder.id} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => navigateBack(i + 1)}
              className="text-primary hover:underline"
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      <div className="border rounded-lg h-48 overflow-auto bg-background">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No folders found
          </div>
        ) : (
          <div className="divide-y">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedFolder?.id === folder.id ? "bg-accent/10 border-l-2 border-accent" : ""
                }`}
                onClick={() => setSelectedFolder(folder)}
                onDoubleClick={() => navigateToFolder(folder)}
                data-testid={`folder-item-${folder.id}`}
              >
                <FolderOpen className="w-5 h-5 text-yellow-500" />
                <span className="flex-1 font-medium">{folder.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToFolder(folder);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFolder && (
        <div className="space-y-3 p-4 bg-accent/5 rounded-lg border border-accent/20">
          <p className="font-medium">
            Selected: <span className="text-accent">{selectedFolder.name}</span>
          </p>
          <div>
            <label className="text-sm font-medium block mb-1">Bates Prefix</label>
            <Input
              placeholder="e.g., DEF or SMITH"
              value={batesPrefix}
              onChange={(e) => setBatesPrefix(e.target.value)}
              className="max-w-xs"
              data-testid="input-bates-prefix"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Files will be numbered as {batesPrefix || "XXX"}-00001, {batesPrefix || "XXX"}-00002, etc.
            </p>
          </div>
          <Button
            onClick={handleLink}
            disabled={!batesPrefix || linkMutation.isPending || syncMutation.isPending}
            className="bg-accent"
            data-testid="button-link-folder"
          >
            {linkMutation.isPending || syncMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 mr-2" />
                Link & Sync Folder
              </>
            )}
          </Button>
        </div>
      )}

      {linkedFolders.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Linked Folders</p>
          {linkedFolders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg"
              data-testid={`linked-folder-${folder.id}`}
            >
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{folder.folderName}</span>
                <Badge variant="outline" className="text-xs">{folder.batesPrefix}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncMutation.mutate(folder.id)}
                disabled={syncMutation.isPending}
                data-testid={`button-sync-${folder.id}`}
              >
                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveryView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [match, params] = useRoute("/app/case/:id");
  const caseId = params?.id;
  
  const { data: files = [], isLoading } = useQuery({
    queryKey: ["discoveryFiles", caseId],
    queryFn: () => getDiscoveryFiles(caseId!),
    enabled: !!caseId,
  });
  
  const getIcon = (fileType: string) => {
    if (fileType === 'application/pdf' || fileType === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (fileType.startsWith('video/') || fileType === 'video') return <Video className="w-5 h-5 text-blue-500" />;
    if (fileType.startsWith('audio/') || fileType === 'audio') return <Mic className="w-5 h-5 text-purple-500" />;
    if (fileType.startsWith('image/') || fileType === 'image') return <ImageIcon className="w-5 h-5 text-green-500" />;
    if (fileType.includes('xml') || fileType === 'xml') return <FileText className="w-5 h-5 text-orange-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const filteredFiles = files.filter(file => 
    searchTerm === "" ||
    file.batesStart.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.summary?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-3 md:p-4 border-b flex gap-2 md:gap-4 bg-muted/30">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search Bates, files..." 
            className="pl-10 bg-background text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-discovery"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1 md:gap-2" data-testid="button-filters">
          <Filter className="w-4 h-4" /> <span className="hidden sm:inline">Filters</span>
        </Button>
      </div>

      {/* Desktop Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="col-span-1">Type</div>
        <div className="col-span-2">Bates Number</div>
        <div className="col-span-4">File Name / Summary</div>
        <div className="col-span-2">Source</div>
        <div className="col-span-2">Tags</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading && <div className="p-6 text-center text-muted-foreground">Loading discovery files...</div>}
        {!isLoading && filteredFiles.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm ? "No files match your search" : "No discovery files yet. Add evidence to get started."}
          </div>
        )}
        
        {/* Mobile Card View */}
        <div className="md:hidden divide-y">
          {filteredFiles.map((file) => (
            <div 
              key={file.id} 
              className="p-3 hover:bg-muted/30 transition-colors"
              data-testid={`discovery-file-${file.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background border shadow-sm shrink-0">
                  {getIcon(file.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {file.driveUrl ? (
                      <a 
                        href={file.driveUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent font-medium hover:underline flex items-center gap-1"
                        data-testid={`bates-link-${file.id}`}
                      >
                        {file.batesStart}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-primary font-medium">{file.batesStart}</span>
                    )}
                    {file.sourceType === "cloud" && (
                      <Cloud className="w-3 h-3 text-blue-500" />
                    )}
                  </div>
                  <div className="font-medium text-sm text-foreground truncate">{file.fileName}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{file.summary || "Processing..."}</div>
                  {(file.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(file.tags || []).slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0 h-5 border-border/50 font-normal">{t}</Badge>
                      ))}
                      {(file.tags || []).length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5 border-border/50 font-normal">+{(file.tags || []).length - 3}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block divide-y">
          {filteredFiles.map((file) => (
            <div 
              key={file.id} 
              className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors group"
              data-testid={`discovery-file-desktop-${file.id}`}
            >
              <div className="col-span-1 flex items-center justify-center w-10 h-10 rounded-lg bg-background border shadow-sm">
                {getIcon(file.fileType)}
              </div>
              <div className="col-span-2">
                {file.driveUrl ? (
                  <a 
                    href={file.driveUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-accent font-medium hover:underline flex items-center gap-1"
                    data-testid={`bates-link-desktop-${file.id}`}
                  >
                    {file.batesStart}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="font-mono text-sm text-primary font-medium">{file.batesStart}</span>
                )}
                {file.batesStart !== file.batesEnd && (
                  <span className="text-muted-foreground text-xs block">to {file.batesEnd}</span>
                )}
              </div>
              <div className="col-span-4 pr-4">
                <div className="font-medium text-foreground">{file.fileName}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{file.summary || "Processing..."}</div>
              </div>
              <div className="col-span-2 text-sm">
                {file.sourceType === "cloud" ? (
                  <Badge variant="outline" className="text-xs gap-1 bg-blue-50 border-blue-200 text-blue-700">
                    <Cloud className="w-3 h-3" />
                    Google Drive
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 bg-gray-50 border-gray-200 text-gray-700">
                    <UploadCloud className="w-3 h-3" />
                    Uploaded
                  </Badge>
                )}
              </div>
              <div className="col-span-2 flex flex-wrap gap-1">
                {(file.tags || []).map(t => (
                  <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0 h-5 border-border/50 font-normal">{t}</Badge>
                ))}
              </div>
              <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                {file.driveUrl && (
                  <a 
                    href={file.driveUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent/10"
                    data-testid={`button-view-desktop-${file.id}`}
                  >
                    <ExternalLink className="w-4 h-4 text-accent" />
                  </a>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-more-${file.id}`}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function TimelineView() {
  const [match, params] = useRoute("/app/case/:id");
  const caseId = params?.id;
  
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ["timeline", caseId],
    queryFn: () => getTimeline(caseId!),
    enabled: !!caseId,
  });
  
  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8 relative">
      {isLoading && <div className="text-center text-muted-foreground">Loading timeline...</div>}
      
      {/* Mobile Timeline - left-aligned */}
      <div className="md:hidden space-y-4">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        {timeline.map((event) => (
          <div key={event.id} className="flex gap-4 pl-2">
            <div className="relative z-10 w-4 h-4 rounded-full bg-accent border-4 border-background shadow-sm shrink-0 mt-1" />
            <div className="flex-1 pb-4">
              <div className="text-xs font-bold text-accent mb-1">{new Date(event.eventDate).toLocaleDateString()}</div>
              <h3 className="text-base font-serif font-bold text-primary mb-1">{event.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
              {(event.linkedBates || []).length > 0 && (
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-secondary text-xs font-mono border mt-2">
                  <FileText className="w-3 h-3 text-primary" />
                  <span>{(event.linkedBates || [])[0]}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Timeline - alternating */}
      <div className="hidden md:block">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />
        {timeline.map((event, i) => (
          <div key={event.id} className={`flex items-center gap-8 mb-12 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`flex-1 ${i % 2 === 0 ? 'text-right' : 'text-left'}`}>
              <div className="text-sm font-bold text-accent mb-1">{new Date(event.eventDate).toLocaleDateString()}</div>
              <h3 className="text-xl font-serif font-bold text-primary mb-2">{event.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
            </div>
            
            <div className="relative z-10 w-4 h-4 rounded-full bg-accent border-4 border-background shadow-sm shrink-0" />
            
            <div className={`flex-1 ${i % 2 === 0 ? 'text-left' : 'text-right'}`}>
              {(event.linkedBates || []).length > 0 && (
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs font-mono border ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                  <FileText className="w-3 h-3 text-primary" />
                  <span>{(event.linkedBates || [])[0]}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrialPrepView() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 h-full md:divide-x overflow-auto">
      <div className="p-4 md:p-6 flex flex-col">
        <h3 className="font-serif font-bold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-accent" />
          Examination Strategy
        </h3>
        <div className="flex-1 space-y-3 md:space-y-4">
          <div className="p-3 md:p-4 rounded-lg bg-secondary/30 border border-secondary">
            <h4 className="font-semibold text-sm mb-2 text-primary">Line of Questioning: Inconsistencies</h4>
            <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-muted-foreground list-disc list-inside">
              <li>Ask about the timestamp on the surveillance video (10:45 PM).</li>
              <li>Contrast with email timestamp (10:50 PM sent from home IP).</li>
              <li>Press on the lack of badge swipe out record.</li>
            </ul>
          </div>
          <div className="p-3 md:p-4 rounded-lg bg-accent/10 border border-accent/20">
            <h4 className="font-semibold text-sm mb-2 text-accent-foreground">Key Evidence to Present</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background text-xs">AND-001256</Badge>
              <Badge variant="outline" className="bg-background text-xs">AND-001257</Badge>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <Button 
            className={`w-full ${isRecording ? 'bg-destructive animate-pulse' : 'bg-primary'}`}
            onClick={() => setIsRecording(!isRecording)}
          >
            <Mic className="w-4 h-4 mr-2" />
            {isRecording ? "Recording... (Tap to Stop)" : "Start Voice Simulation"}
          </Button>
          <p className="text-xs text-center mt-2 text-muted-foreground">CaseBuddy listens and suggests real-time objections/follow-ups.</p>
        </div>
      </div>

      <div className="p-4 md:p-6 bg-muted/10 flex flex-col border-t md:border-t-0">
        <h3 className="font-serif font-bold text-base md:text-lg mb-3 md:mb-4">Live Transcript / Notes</h3>
        <div className="flex-1 min-h-[150px] md:min-h-0 rounded-lg border bg-background p-3 md:p-4 shadow-inner font-mono text-xs md:text-sm leading-relaxed text-muted-foreground">
          <p className="text-primary/50 italic">[System Ready. Waiting for audio input...]</p>
          {isRecording && (
             <div className="mt-4 space-y-2">
                <p><span className="text-blue-600 font-bold">Attorney:</span> Can you explain where you were on the night of October 12th?</p>
                <p><span className="text-green-600 font-bold">Witness:</span> I was at home.</p>
                <p className="animate-pulse"><span className="text-blue-600 font-bold">Attorney:</span> ...</p>
             </div>
          )}
        </div>
        <FeaturedNews variant="inline" limit={1} />
      </div>
    </div>
  );
}

function LegalBriefsView({ caseId }: { caseId: string }) {
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState<LegalBrief | null>(null);
  const [briefTitle, setBriefTitle] = useState("");
  const [briefType, setBriefType] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const { toast } = useToast();
  const { setSaving, setSaved, setError } = useSaveStatus();
  const queryClient = useQueryClient();

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ["legalBriefs", caseId],
    queryFn: () => getLegalBriefs(caseId),
  });

  const { data: briefTypes = {} } = useQuery({
    queryKey: ["briefTypes"],
    queryFn: getBriefTypes,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateLegalBrief(caseId, briefType, briefTitle, additionalInstructions),
    onMutate: () => {
      setSaving();
    },
    onSuccess: (newBrief) => {
      queryClient.invalidateQueries({ queryKey: ["legalBriefs", caseId] });
      setSaved();
      toast({
        title: "Brief Generated",
        description: "Your legal brief has been created and saved.",
      });
      setShowGenerator(false);
      setSelectedBrief(newBrief);
      setBriefTitle("");
      setBriefType("");
      setAdditionalInstructions("");
    },
    onError: () => {
      setError();
      toast({
        title: "Generation Failed",
        description: "Unable to generate the legal brief. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (briefId: number) => deleteLegalBrief(briefId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legalBriefs", caseId] });
      setSaved();
      toast({ title: "Brief Deleted" });
      setSelectedBrief(null);
    },
  });

  if (selectedBrief) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBrief(null)} data-testid="button-back-briefs">
            <ChevronRight className="w-4 h-4 mr-1 sm:mr-2 rotate-180" /> Back
          </Button>
          <div className="flex gap-2">
            <Badge variant={selectedBrief.status === "draft" ? "outline" : "default"} className="text-xs">
              {selectedBrief.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate(selectedBrief.id)}
              data-testid="button-delete-brief"
            >
              <Trash2 className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-serif font-bold mb-2">{selectedBrief.title}</h2>
          <p className="text-xs md:text-sm text-muted-foreground mb-4">
            {briefTypes[selectedBrief.briefType] || selectedBrief.briefType} • Created {new Date(selectedBrief.createdAt).toLocaleDateString()}
          </p>

          {selectedBrief.summary && (
            <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <h4 className="text-sm font-semibold text-primary mb-2">Summary</h4>
              <p className="text-sm">{selectedBrief.summary}</p>
            </div>
          )}

          {selectedBrief.keyArguments && (selectedBrief.keyArguments as string[]).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold mb-2">Key Arguments</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {(selectedBrief.keyArguments as string[]).map((arg, i) => (
                  <li key={i}>{arg}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedBrief.precedents && (selectedBrief.precedents as any[]).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold mb-2">Legal Precedents</h4>
              <div className="space-y-2">
                {(selectedBrief.precedents as any[]).map((p, i) => (
                  <div key={i} className="p-3 bg-background rounded border text-sm">
                    <span className="font-medium">{p.caseName}</span>
                    <span className="text-muted-foreground ml-2">{p.citation}</span>
                    <p className="text-xs text-muted-foreground mt-1">{p.relevance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <h4 className="text-sm font-semibold mb-2">Full Brief</h4>
            <div className="p-4 bg-background rounded-lg border font-serif whitespace-pre-wrap text-sm leading-relaxed">
              {selectedBrief.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-serif font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Legal Briefs
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            AI-generated legal documents based on your case
          </p>
        </div>
        <Button size="sm" onClick={() => setShowGenerator(true)} data-testid="button-generate-brief">
          <Plus className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Generate</span> Brief
        </Button>
      </div>

      {showGenerator && (
        <div className="bg-muted/30 rounded-lg p-4 md:p-6 border">
          <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Generate New Legal Brief</h3>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="text-xs md:text-sm font-medium mb-1 block">Brief Title</label>
              <Input
                placeholder="e.g., Motion to Dismiss"
                value={briefTitle}
                onChange={(e) => setBriefTitle(e.target.value)}
                className="text-sm"
                data-testid="input-brief-title"
              />
            </div>
            <div>
              <label className="text-xs md:text-sm font-medium mb-1 block">Brief Type</label>
              <select
                className="w-full p-2 border rounded-md bg-background text-sm"
                value={briefType}
                onChange={(e) => setBriefType(e.target.value)}
                data-testid="select-brief-type"
              >
                <option value="">Select a type...</option>
                {Object.entries(briefTypes).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs md:text-sm font-medium mb-1 block">Additional Instructions (Optional)</label>
              <textarea
                className="w-full p-2 border rounded-md bg-background min-h-[60px] md:min-h-[80px] text-sm"
                placeholder="Any specific focus areas..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                data-testid="input-brief-instructions"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!briefTitle || !briefType || generateMutation.isPending}
                size="sm"
                className="flex-1 sm:flex-initial"
                data-testid="button-submit-brief"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4 mr-2" /> Generate with AI
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowGenerator(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading briefs...
        </div>
      )}

      {!isLoading && briefs.length === 0 && !showGenerator && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FileEdit className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Legal Briefs Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate AI-powered legal briefs based on your case documents and timeline.
          </p>
          <Button onClick={() => setShowGenerator(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Your First Brief
          </Button>
        </div>
      )}

      {briefs.length > 0 && (
        <div className="grid gap-4">
          {briefs.map((brief) => (
            <div
              key={brief.id}
              className="p-4 bg-background border rounded-lg hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setSelectedBrief(brief)}
              data-testid={`brief-card-${brief.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{brief.title}</h3>
                    <Badge variant="outline" className="text-xs">
                      {briefTypes[brief.briefType] || brief.briefType}
                    </Badge>
                    <Badge variant={brief.status === "draft" ? "secondary" : "default"} className="text-xs">
                      {brief.status}
                    </Badge>
                  </div>
                  {brief.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{brief.summary}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(brief.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

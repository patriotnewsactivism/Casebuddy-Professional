import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { 
  Scale, 
  Search, 
  BookOpen, 
  FileText,
  ExternalLink,
  Clock,
  Newspaper,
  TrendingUp,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { FeaturedNews } from "@/components/featured-news";

async function fetchLegalNews() {
  const response = await fetch("/api/news/latest");
  if (!response.ok) throw new Error("Failed to fetch news");
  return response.json();
}

export default function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["legal-news"],
    queryFn: fetchLegalNews,
  });

  const legalDatabases = [
    {
      name: "Westlaw",
      description: "Comprehensive legal research database",
      icon: BookOpen,
      url: "https://www.westlaw.com",
    },
    {
      name: "LexisNexis",
      description: "Legal, news, and business information",
      icon: FileText,
      url: "https://www.lexisnexis.com",
    },
    {
      name: "Google Scholar",
      description: "Free case law and legal articles",
      icon: Search,
      url: "https://scholar.google.com",
    },
    {
      name: "PACER",
      description: "Federal court records",
      icon: Scale,
      url: "https://pacer.uscourts.gov",
    },
    {
      name: "Cornell LII",
      description: "Free legal information institute",
      icon: BookOpen,
      url: "https://www.law.cornell.edu",
    },
    {
      name: "Justia",
      description: "Free case law and legal information",
      icon: FileText,
      url: "https://www.justia.com",
    },
  ];

  const recentSearches = [
    "Summary judgment standards",
    "Breach of contract elements",
    "Discovery motion practice",
    "Expert witness qualifications",
    "Attorney-client privilege",
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.open(`https://scholar.google.com/scholar?q=${encodeURIComponent(searchQuery)}`, "_blank");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary" data-testid="text-page-title">Legal Research</h1>
          <p className="text-muted-foreground mt-1">Access legal databases, case law, and stay updated with legal news</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search case law, statutes, or legal topics..."
                  className="pl-11 h-12 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-legal-search"
                />
              </div>
              <Button type="submit" size="lg" className="px-8" data-testid="button-search">
                Search
              </Button>
            </form>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Recent:</span>
              {recentSearches.map((term) => (
                <Badge 
                  key={term} 
                  variant="secondary" 
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => setSearchQuery(term)}
                >
                  {term}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="databases" className="space-y-4">
          <TabsList>
            <TabsTrigger value="databases" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Databases
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2">
              <Newspaper className="w-4 h-4" />
              Legal News
            </TabsTrigger>
          </TabsList>

          <TabsContent value="databases" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {legalDatabases.map((db) => (
                <Card key={db.name} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-database-${db.name.toLowerCase().replace(/\s/g, "-")}`}>
                  <a href={db.url} target="_blank" rel="noopener noreferrer">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <db.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{db.name}</h3>
                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{db.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </a>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="news" className="space-y-4">
            {newsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : news.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Newspaper className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No news articles available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {news.map((article: any) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow" data-testid={`card-news-${article.id}`}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{article.source}</Badge>
                              {article.featured && <Badge className="bg-accent">Featured</Badge>}
                            </div>
                            <h3 className="font-semibold hover:text-primary transition-colors">{article.title}</h3>
                            {article.summary && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.summary}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(article.publishedAt).toLocaleDateString()}
                              </div>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </a>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

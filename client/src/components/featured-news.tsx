import { useQuery } from "@tanstack/react-query";
import { getFeaturedNews } from "@/lib/api";
import { ExternalLink } from "lucide-react";

interface FeaturedNewsProps {
  variant?: "sidebar" | "inline";
  limit?: number;
}

export function FeaturedNews({ variant = "sidebar", limit = 1 }: FeaturedNewsProps) {
  const { data: articles = [] } = useQuery({
    queryKey: ["news", "featured"],
    queryFn: () => getFeaturedNews(2),
    refetchInterval: 5 * 60 * 1000,
  });

  const displayArticles = articles.slice(0, limit);

  if (displayArticles.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className="mt-6 pt-6 border-t border-border/50">
        <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Related Reading</div>
        {displayArticles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
            data-testid={`featured-news-${article.id}`}
          >
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {article.title}
              </h4>
              {article.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {article.summary}
                </p>
              )}
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">From WTP News</div>
      <div className="space-y-3">
        {displayArticles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
            data-testid={`featured-news-sidebar-${article.id}`}
          >
            <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {article.title}
            </h4>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'We The People News'}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

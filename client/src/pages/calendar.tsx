import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { Link } from "wouter";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gavel
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  const casesWithDeadlines = cases.filter((c) => c.nextDeadline);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const today = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const upcomingDeadlines = casesWithDeadlines
    .filter((c) => new Date(c.nextDeadline!) > new Date())
    .sort((a, b) => new Date(a.nextDeadline!).getTime() - new Date(b.nextDeadline!).getTime())
    .slice(0, 5);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntil = (date: string | Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `${diff} days`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-primary" data-testid="text-page-title">Calendar</h1>
          <p className="text-muted-foreground mt-1">Track deadlines and important dates for your cases</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium">{formatMonthYear(currentDate)}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={previousMonth} data-testid="button-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentDate(new Date())}
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = 
                      day === today.getDate() && 
                      currentDate.getMonth() === today.getMonth() && 
                      currentDate.getFullYear() === today.getFullYear();
                    
                    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                    const hasDeadline = casesWithDeadlines.some((c) => 
                      new Date(c.nextDeadline!).toDateString() === dateStr
                    );

                    return (
                      <div
                        key={day}
                        className={`
                          aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                          ${isToday ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted"}
                          ${hasDeadline && !isToday ? "bg-accent/20" : ""}
                        `}
                        data-testid={`calendar-day-${day}`}
                      >
                        <span>{day}</span>
                        {hasDeadline && (
                          <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isToday ? "bg-primary-foreground" : "bg-accent"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>Next 5 deadlines across all cases</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingDeadlines.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No upcoming deadlines</p>
                  </div>
                ) : (
                  upcomingDeadlines.map((caseItem) => (
                    <Link key={caseItem.id} href={`/case/${caseItem.id}`}>
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid={`deadline-case-${caseItem.id}`}>
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{caseItem.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(caseItem.nextDeadline!)}</p>
                        </div>
                        <Badge variant={getDaysUntil(caseItem.nextDeadline!) === "Today" ? "destructive" : "secondary"} className="flex-shrink-0">
                          {getDaysUntil(caseItem.nextDeadline!)}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Cases</span>
                  <span className="font-semibold">{cases.filter((c) => c.status === "active").length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cases with Deadlines</span>
                  <span className="font-semibold">{casesWithDeadlines.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Documents</span>
                  <span className="font-semibold">{cases.reduce((sum, c) => sum + (c.filesCount || 0), 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

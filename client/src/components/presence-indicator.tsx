import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Users } from "lucide-react";

interface CollaboratorUser {
  id: string;
  name: string;
  color: string;
}

interface PresenceIndicatorProps {
  collaborators: CollaboratorUser[];
  isConnected: boolean;
}

export function PresenceIndicator({ collaborators, isConnected }: PresenceIndicatorProps) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="hidden sm:inline">Connecting...</span>
      </div>
    );
  }

  if (collaborators.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="hidden sm:inline">Only you</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <div className="flex -space-x-2">
          {collaborators.slice(0, 3).map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <Avatar className="w-7 h-7 border-2 border-background cursor-default" data-testid={`collaborator-${user.id}`}>
                  <AvatarFallback 
                    className="text-[10px] font-semibold text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {user.name} is viewing this case
              </TooltipContent>
            </Tooltip>
          ))}
          {collaborators.length > 3 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="w-7 h-7 border-2 border-background cursor-default">
                  <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                    +{collaborators.length - 3}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {collaborators.slice(3).map(u => u.name).join(", ")} also viewing
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          <Users className="w-3 h-3 inline mr-1" />
          {collaborators.length + 1} active
        </span>
      </div>
    </TooltipProvider>
  );
}

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type NotificationRow,
} from "@/data/notificationsApi";

export function NotificationsBell() {
  const { data: items = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  function handleClick(n: NotificationRow) {
    if (!n.read_at) markRead.mutate(n.id);
    const href = (n.data as { href?: string } | null)?.href;
    if (href) {
      setOpen(false);
      navigate({ to: href });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-muted"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-gold text-[10px] font-bold text-background grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              Sin notificaciones
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={cn("min-w-0 flex-1", n.read_at && "pl-4")}>
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

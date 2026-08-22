import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KCT PULSE — Real-time Classroom Engagement" },
      {
        name: "description",
        content:
          "KCT PULSE turns classrooms into interactive experiences with live polls, word clouds, and quizzes for Kumaraguru College of Technology.",
      },
      { name: "author", content: "KCT PULSE" },
      { property: "og:title", content: "KCT PULSE — Real-time Classroom Engagement" },
      {
        property: "og:description",
        content: "Live polls, word clouds & quizzes for KCT classrooms.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kct-classroom-flow.vercel.app/" },
      { property: "og:image", content: "https://kct-classroom-flow.vercel.app/kct-logo-opt.jpg" },
      { property: "og:site_name", content: "KCT PULSE" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KCT PULSE — Real-time Classroom Engagement" },
      {
        name: "twitter:description",
        content: "Live polls, word clouds & quizzes for KCT classrooms.",
      },
      { name: "twitter:image", content: "https://kct-classroom-flow.vercel.app/kct-logo-opt.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/user-custom-favicon.png?v=user-custom-1", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { Toaster } from "@/components/ui/sonner";
import { getStoredTheme, applyTheme } from "@/components/theme-toggle";
import { autoDraftStaleSessions } from "@/lib/session-utils";
import { ChatBot } from "@/components/chat-bot";
import { Lock } from "lucide-react";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    // Allow local debugging on localhost/127.0.0.1, but block in Lovable sandbox and production
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return;
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }
      if (isCmdOrCtrl && e.shiftKey && key === "i") {
        e.preventDefault();
        return false;
      }
      if (isCmdOrCtrl && e.shiftKey && key === "j") {
        e.preventDefault();
        return false;
      }
      if (isCmdOrCtrl && e.shiftKey && key === "c") {
        e.preventDefault();
        return false;
      }
      if (isCmdOrCtrl && key === "u") {
        e.preventDefault();
        return false;
      }
    };

    // Shared check state
    let isConsoleOpen = false;

    // Check window size difference (reliable for docked DevTools)
    const checkWindowSize = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      return widthThreshold || heightThreshold;
    };

    // Setup RegExp toString check (works when debugger breakpoints are deactivated)
    const devtoolsRegexp = /./;
    devtoolsRegexp.toString = function () {
      isConsoleOpen = true;
      return "";
    };

    // Setup HTML Element ID getter check (backup console check)
    const element = new Image();
    Object.defineProperty(element, "id", {
      get: () => {
        isConsoleOpen = true;
      },
    });

    const runChecks = () => {
      // Reset console check flag
      isConsoleOpen = false;

      // 1. Console evaluation checks (logs element/regexp to trigger getters)
      console.log(devtoolsRegexp);
      console.log(element);
      console.clear();

      // 2. Debugger statement check
      let isDebuggerOpen = false;
      const start = Date.now();
      debugger;
      const end = Date.now();
      if (end - start > 100) {
        isDebuggerOpen = true;
      }

      // 3. Viewport size check
      const isSizeOpen = checkWindowSize();

      // Determine overall open state
      const isOpen = isConsoleOpen || isDebuggerOpen || isSizeOpen;
      setIsDevToolsOpen(isOpen);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", () => {
      if (checkWindowSize()) {
        setIsDevToolsOpen(true);
      }
    });
    
    const interval = setInterval(runChecks, 1000);

    // Initial check
    if (checkWindowSize()) {
      setIsDevToolsOpen(true);
    }

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(interval);
    };
  }, []);

  const showChatBot = pathname.startsWith("/dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
      {showChatBot && <ChatBot />}
      
      {/* Dynamic DevTools Warning Overlay */}
      {isDevToolsOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md p-6 text-center select-none animate-in fade-in duration-200">
          <div className="glass max-w-md rounded-3xl p-8 border border-destructive/20 shadow-[0_0_50px_rgba(239,68,68,0.15)] space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive animate-pulse">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Developer Tools Restricted</h2>
              <p className="text-sm text-muted-foreground">
                Access to browser inspect tools is disabled to protect session integrity and prevent unauthorized access.
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 text-xs font-medium text-muted-foreground border border-border/40">
              Please close Developer Tools (F12 / Inspect drawer) to resume using KCT PULSE.
            </div>
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}

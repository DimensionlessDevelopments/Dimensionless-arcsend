export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40">
              <div className="h-3 w-3 rounded-full border-2 border-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-3xl font-semibold tracking-tight text-teal-300">ArcSend</p>
              <p className="text-[11px] text-slate-400">By Circle x DimensionlessDevelopments MVP</p>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="https://github.com/DimensionlessDevelopments/Dimensionless-arcsend" className="transition-colors hover:text-foreground">Docs</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 ArcSend. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

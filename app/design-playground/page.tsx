// app/design-playground/page.tsx
import { theme } from "@/src/theme";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-static";

export default function DesignPlayground() {
  return (
    <main className="mx-auto max-w-3xl p-xl space-y-lg">
      <h1 className="text-3xl font-semibold">Design Playground</h1>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-medium">Tokens</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-md">
          {Object.entries(theme.color).map(([k, v]) => (
            <div key={k} className="flex items-center gap-sm">
              <div className="h-8 w-8 rounded-md border" style={{ background: v }} />
              <code className="text-sm">{k}: {v}</code>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-medium">Primitives</h2>
        </CardHeader>
        <CardContent className="space-y-md">
          <div className="flex gap-md">
            <Button>Primary Button</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="grid grid-cols-1 gap-sm">
            <Input placeholder="Your email" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

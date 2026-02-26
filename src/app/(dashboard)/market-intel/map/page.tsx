import { Map as MapIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function MarketMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Market Map</h1>
        <p className="text-sm text-muted-foreground">
          Interactive map view of acquisition targets
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MapIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Coming Soon</CardTitle>
          <CardDescription>
            The interactive market map is being rebuilt. Check back soon for a
            refreshed map experience with listing locations and proximity search.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            In the meantime, you can browse listings from the{" "}
            <a href="/listings" className="text-primary hover:underline">
              Listings
            </a>{" "}
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

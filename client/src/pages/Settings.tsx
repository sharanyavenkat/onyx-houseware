import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function Settings() {
  const { canMutate } = useAuth();
  const { toast } = useToast();

  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['/api/settings'],
  });

  const [ingotWastage, setIngotWastage] = useState('');
  const [scrapWastage, setScrapWastage] = useState('');

  useEffect(() => {
    if (settings.default_wastage_ingot_pct !== undefined) setIngotWastage(settings.default_wastage_ingot_pct);
    if (settings.default_wastage_scrap_pct !== undefined) setScrapWastage(settings.default_wastage_scrap_pct);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) =>
      apiRequest('PATCH', `/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  const handleSaveWastage = async () => {
    const ingotNum = parseFloat(ingotWastage);
    const scrapNum = parseFloat(scrapWastage);
    if (isNaN(ingotNum) || ingotNum < 0 || ingotNum >= 100) {
      toast({ title: 'Ingot wastage % must be a number between 0 and 100', variant: 'destructive' });
      return;
    }
    if (isNaN(scrapNum) || scrapNum < 0 || scrapNum >= 100) {
      toast({ title: 'Scrap wastage % must be a number between 0 and 100', variant: 'destructive' });
      return;
    }
    try {
      await Promise.all([
        saveMutation.mutateAsync({ key: 'default_wastage_ingot_pct', value: String(ingotNum) }),
        saveMutation.mutateAsync({ key: 'default_wastage_scrap_pct', value: String(scrapNum) }),
      ]);
      toast({ title: 'Default wastage rates updated' });
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    }
  };

  const hasChanges = ingotWastage !== (settings.default_wastage_ingot_pct ?? '') || scrapWastage !== (settings.default_wastage_scrap_pct ?? '');

  return (
    <div data-testid="page-settings" className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          App-wide defaults used across Onyx — applies unless a vendor has its own override.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Wastage Rates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Used whenever a vendor doesn't have its own wastage rate set on the Vendors page. This is the bottom of the fallback chain: SKU override → vendor default → this company-wide default.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <label className="text-sm font-medium mb-1 block">Ingot Wastage (%)</label>
                  <Input
                    type="number"
                    step="any"
                    value={ingotWastage}
                    onChange={(e) => setIngotWastage(e.target.value)}
                    disabled={!canMutate}
                    data-testid="input-default-wastage-ingot"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Scrap Wastage (%)</label>
                  <Input
                    type="number"
                    step="any"
                    value={scrapWastage}
                    onChange={(e) => setScrapWastage(e.target.value)}
                    disabled={!canMutate}
                    data-testid="input-default-wastage-scrap"
                  />
                </div>
              </div>
              {canMutate && (
                <Button
                  onClick={handleSaveWastage}
                  disabled={!hasChanges || saveMutation.isPending}
                  data-testid="button-save-wastage-defaults"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
              {!canMutate && (
                <p className="text-xs text-muted-foreground">You're on a read-only account — ask an admin to change these.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

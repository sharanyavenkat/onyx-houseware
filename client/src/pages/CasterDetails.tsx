import { useQuery } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, TrendingDown } from 'lucide-react';
import type { Caster } from '@shared/schema';

interface CasterStats {
  totalReceived: number;
  totalRejected: number;
  rejectionRate: number;
  batchesWithRejections: Array<{
    batchNumber: string;
    itemName: string;
    received: number;
    rejected: number;
    receivedDate: string;
  }>;
}

export default function CasterDetails() {
  const [, params] = useRoute('/casters/:id');
  const casterId = params?.id ? parseInt(params.id) : null;

  const { data: caster, isLoading: casterLoading } = useQuery<Caster>({
    queryKey: ['/api/casters', casterId],
    enabled: !!casterId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<CasterStats>({
    queryKey: ['/api/casters', casterId, 'stats'],
    enabled: !!casterId,
  });

  if (casterLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!caster) {
    return (
      <div className="space-y-4">
        <Link href="/casters">
          <Button variant="ghost" data-testid="button-back-to-casters">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Casters
          </Button>
        </Link>
        <p className="text-muted-foreground">Caster not found.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="page-caster-details">
      <div className="flex items-center gap-4">
        <Link href="/casters">
          <Button variant="ghost" size="icon" data-testid="button-back-to-casters">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-caster-name">{caster.name}</h1>
          {caster.address && (
            <p className="text-sm text-muted-foreground">{caster.address}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-received">
              {stats?.totalReceived?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">pieces from all batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Rejected</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-total-rejected">
              {stats?.totalRejected?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">pieces failed QC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Rejection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className={`text-2xl font-bold ${(stats?.rejectionRate || 0) > 5 ? 'text-destructive' : 'text-green-600'}`}
              data-testid="text-rejection-rate"
            >
              {(stats?.rejectionRate || 0).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">overall rejection percentage</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batches with Rejections</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.batchesWithRejections?.length ? (
            <p className="text-muted-foreground text-center py-8">
              No rejected batches found for this caster.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Batch #</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Received</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Rejected</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground hidden sm:table-cell">Rate</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.batchesWithRejections.map((batch) => {
                    const rate = batch.received > 0 ? ((batch.rejected / batch.received) * 100).toFixed(1) : '0.0';
                    return (
                      <tr 
                        key={batch.batchNumber} 
                        className="border-b last:border-0"
                        data-testid={`row-batch-${batch.batchNumber}`}
                      >
                        <td className="py-2 px-2 font-mono text-sm">{batch.batchNumber}</td>
                        <td className="py-2 px-2">{batch.itemName}</td>
                        <td className="py-2 px-2 text-right font-mono">{batch.received.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-mono text-destructive">{batch.rejected.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-mono hidden sm:table-cell">{rate}%</td>
                        <td className="py-2 px-2 text-right text-muted-foreground hidden md:table-cell">
                          {formatDate(batch.receivedDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {caster.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{caster.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

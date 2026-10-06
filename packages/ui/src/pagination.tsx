import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
export function Pagination({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  loading = false,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  loading?: boolean;
}) {
  return (
    <nav aria-label="Paginação" className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPreviousPage || loading}
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
        Anterior
      </Button>
      <Button variant="outline" size="sm" disabled={!hasNextPage || loading} onClick={onNext}>
        Próxima
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

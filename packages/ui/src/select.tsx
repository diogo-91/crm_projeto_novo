import { ChevronDown } from 'lucide-react';
import { cn } from './utils';
// Native-select pattern: platform semantics and keyboard behavior for a small option list.
export function Select({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
  placeholder = 'Selecione',
  className,
  id,
  describedBy,
  invalid,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string | undefined;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <select
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full appearance-none truncate rounded-md border bg-surface py-2 pl-3 pr-9 text-body disabled:opacity-50"
      >
        {!value && !options.some((option) => option.value === '') && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 size-4 text-muted"
      />
    </div>
  );
}

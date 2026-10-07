'use client';
import type { UseFormRegister, FieldErrors, FieldValues, Path } from 'react-hook-form';
import { FormField, Input, Textarea } from '@crm/ui';
export function RecordField<T extends FieldValues>({
  field,
  label,
  register,
  errors,
  required = false,
  multiline = false,
  type = 'text',
}: {
  field: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  required?: boolean;
  multiline?: boolean;
  type?: string;
}) {
  const id = `record-${field}`;
  const message = errors[field]?.message;
  const error = typeof message === 'string' ? message : undefined;
  const props = {
    id,
    required,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
    ...register(field, {
      setValueAs: (value: unknown) => (value === '' && !required ? null : value),
    }),
  };
  return (
    <FormField id={id} label={label} error={error} required={required}>
      {multiline ? <Textarea {...props} rows={4} /> : <Input {...props} type={type} />}
    </FormField>
  );
}

'use client';

import { input, muted } from '@/components/ui/styles';
import { useT } from '@/features/i18n/i18n-provider';

export type StaffOption = { id: string; name: string };

/** "Credit sale to": defaults to me; any active staff member can be chosen (sale on behalf of). */
export function StaffSelect({
  label,
  staff,
  meId,
  value,
  onChange,
}: {
  label: string;
  staff: StaffOption[];
  meId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT();
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.id === meId ? t('staff.me', { name: person.name }) : person.name}
          </option>
        ))}
      </select>
      {value !== meId && <span className={`text-xs font-normal ${muted}`}>{t('staff.onBehalf')}</span>}
    </label>
  );
}

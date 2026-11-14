'use client';

import { input, muted } from '@/components/ui/styles';

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
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.id === meId ? `${person.name} (me)` : person.name}
          </option>
        ))}
      </select>
      {value !== meId && <span className={`text-xs font-normal ${muted}`}>Recorded by you, on their behalf.</span>}
    </label>
  );
}

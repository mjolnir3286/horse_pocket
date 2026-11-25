import { useId } from 'react';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}

/** Radio-group styled as a segmented control (keyboard arrows work natively). */
export function Segmented<T extends string>({ label, value, options, onChange, hideLabel }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented-field">
      <legend className={hideLabel ? 'visually-hidden' : 'field-label'}>{label}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={o.value} className={`segmented-option ${value === o.value ? 'is-active' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

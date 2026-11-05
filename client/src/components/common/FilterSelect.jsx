// Props: label, value, onChange(newValue), options: [{ value, label }], allLabel
export default function FilterSelect({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

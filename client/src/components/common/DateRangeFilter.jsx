// Props: from, to, onChange({ from, to }). Flags an inverted range instead of querying with it.
export default function DateRangeFilter({ from, to, onChange }) {
  const invalid = from && to && from > to;
  return (
    <div className="date-range">
      <label className="filter-select">
        <span>From</span>
        <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} />
      </label>
      <label className="filter-select">
        <span>To</span>
        <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} />
      </label>
      {invalid && <span className="field-error">“From” must be on or before “To”.</span>}
    </div>
  );
}

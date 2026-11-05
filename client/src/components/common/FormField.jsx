// Labelled input with an inline error. Props: label, name, error, as ('input' | 'select' | 'textarea'), children (select options), ...inputProps
export default function FormField({ label, name, error, as: Tag = 'input', children, hint, ...props }) {
  const id = props.id || `f-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <Tag id={id} name={name} className={error ? 'has-error' : ''} aria-invalid={!!error} {...props}>
        {children}
      </Tag>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

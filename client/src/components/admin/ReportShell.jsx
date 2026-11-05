import { formatDate, formatDateTime } from '../../utils/format';

// Shared frame for printable reports. On screen: title + filter controls + Print button.
// When printing, the sidebar/controls are hidden (print.css) and the .print-header block appears.
// Props: title, subtitle, from, to, generatedAt, controls (node), children
export default function ReportShell({ title, subtitle, from, to, generatedAt, controls, children }) {
  const period = from || to ? `${from ? formatDate(from) : 'Beginning'} – ${to ? formatDate(to) : 'Today'}` : 'All time';
  return (
    <div className="report">
      <div className="page-head no-print">
        <h1>{title}</h1>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨 Print report</button>
      </div>

      <div className="toolbar no-print">{controls}</div>

      <div className="print-header">
        <h1>Gendai Japanese Restaurant</h1>
        <h2>{title}{subtitle ? `: ${subtitle}` : ''}</h2>
        <p>Period: {period}</p>
        <p>Generated: {generatedAt ? formatDateTime(generatedAt) : formatDateTime(new Date())}</p>
      </div>

      {children}
    </div>
  );
}

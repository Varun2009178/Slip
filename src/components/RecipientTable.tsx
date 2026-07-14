import {
  addColumn,
  addRow,
  applyPaste,
  isValidEmail,
  removeColumn,
  removeRow,
  renameColumn,
  setCell,
  type Campaign,
} from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onNext: () => void;
}

export default function RecipientTable({ campaign, onChange, onNext }: Props) {
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text/plain');
    // Multi-cell pastes (tabs or newlines) are imports; single values fall
    // through to the focused input's normal paste.
    if (!/[\t\n\r]/.test(text)) return;
    e.preventDefault();
    onChange(applyPaste(campaign, text));
  }

  function promptColumn() {
    const name = window.prompt('column name (becomes a {{variable}})');
    if (name) onChange(addColumn(campaign, name));
  }

  const ready = campaign.recipients.some((r) => isValidEmail(r.fields.email ?? ''));

  return (
    <div className="people" onPaste={handlePaste}>
      <p className="step-hint">
        paste straight from google sheets (first row = column names), or type below. every column
        is a {'{{variable}}'} you can use in the email.
      </p>
      <table className="sheet">
        <thead>
          <tr>
            {campaign.columns.map((col) => (
              <th key={col}>
                <input
                  className="sheet-head"
                  value={col}
                  readOnly={col === 'email'}
                  onChange={(e) => onChange(renameColumn(campaign, col, e.target.value))}
                />
                {col !== 'email' && (
                  <button
                    className="sheet-x"
                    title={`remove ${col}`}
                    onClick={() => onChange(removeColumn(campaign, col))}
                  >
                    ×
                  </button>
                )}
              </th>
            ))}
            <th className="sheet-add">
              <button className="sheet-plus" title="add column" onClick={promptColumn}>
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {campaign.recipients.map((r) => (
            <tr key={r.id}>
              {campaign.columns.map((col) => {
                const value = r.fields[col] ?? '';
                const bad = col === 'email' && value.trim() !== '' && !isValidEmail(value);
                return (
                  <td key={col}>
                    <input
                      className={bad ? 'sheet-cell cell-bad' : 'sheet-cell'}
                      value={value}
                      placeholder={col}
                      onChange={(e) => onChange(setCell(campaign, r.id, col, e.target.value))}
                    />
                  </td>
                );
              })}
              <td className="sheet-add">
                <button className="sheet-x" title="remove row" onClick={() => onChange(removeRow(campaign, r.id))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="step-actions">
        <button className="ghost" onClick={() => onChange(addRow(campaign))}>
          + add person
        </button>
        <button className="send" disabled={!ready} onClick={onNext}>
          write the email →
        </button>
      </div>
    </div>
  );
}

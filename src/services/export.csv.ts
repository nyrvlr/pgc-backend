/**
 * export.csv.ts
 * Serialização de ExportRow[] para CSV científico.
 *
 * - Usa EXPORT_COLUMNS como única fonte da ordem.
 * - null        → campo vazio
 * - Date        → ISO 8601 (toISOString)
 * - boolean     → "true" / "false"
 * - string com vírgula, aspas, \n ou \r → envolvido em aspas duplas; aspas internas duplicadas
 * - [] → somente cabeçalho
 * - Sem dependências externas.
 */

import { EXPORT_COLUMNS, type ExportRow } from '../domain/export.contract';

// ---------------------------------------------------------------------------
// Escaping CSV
// ---------------------------------------------------------------------------

function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str: string;
  if (value instanceof Date)    str = value.toISOString();
  else if (typeof value === 'boolean') str = String(value);
  else str = String(value);

  // Envolver em aspas se contiver vírgula, aspas duplas, \n ou \r
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ---------------------------------------------------------------------------
// serializeExportCsv
// ---------------------------------------------------------------------------

export function serializeExportCsv(rows: ExportRow[]): string {
  const header = EXPORT_COLUMNS.join(',');

  if (rows.length === 0) return header;

  const dataLines = rows.map(row =>
    EXPORT_COLUMNS.map(col => csvField((row as Record<string, unknown>)[col])).join(',')
  );

  return [header, ...dataLines].join('\n');
}

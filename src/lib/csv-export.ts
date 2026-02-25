/**
 * Generic CSV export utility.
 * Converts an array of objects to a CSV string and triggers a browser download.
 */

interface CsvColumn<T> {
  /** Column header label */
  header: string
  /** Function to extract the cell value from a row */
  accessor: (row: T) => string | number | boolean | null | undefined
}

/**
 * Convert an array of objects to a CSV string.
 */
export function toCsvString<T>(data: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((col) => escapeCsvField(col.header)).join(',')

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.accessor(row)
        if (value === null || value === undefined) return ''
        return escapeCsvField(String(value))
      })
      .join(',')
  )

  return [header, ...rows].join('\n')
}

/**
 * Convert an array of objects to a JSON string (pretty-printed).
 */
export function toJsonString<T>(data: T[]): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export data as CSV and trigger download.
 */
export function exportCsv<T>(data: T[], columns: CsvColumn<T>[], filename: string) {
  const csv = toCsvString(data, columns)
  downloadFile(csv, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8;')
}

/**
 * Export data as JSON and trigger download.
 */
export function exportJson<T>(data: T[], filename: string) {
  const json = toJsonString(data)
  downloadFile(json, filename.endsWith('.json') ? filename : `${filename}.json`, 'application/json')
}

/**
 * Escape a CSV field value — wraps in quotes if it contains commas, newlines, or quotes.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

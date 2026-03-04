/**
 * SSS Corp ERP — Shared Download Helper
 * Phase 10: Excel/file download via blob
 */

import api from '../services/api';

/**
 * Download a file from an API endpoint as a blob.
 *
 * @param {string} apiPath  — API path (e.g. '/api/inventory/products/export')
 * @param {string} filename — Download filename (e.g. 'products.xlsx')
 * @param {object} [params] — Optional query params
 * @returns {Promise<void>}
 */
export async function downloadFile(apiPath, filename, params = {}) {
  const response = await api.get(apiPath, {
    responseType: 'blob',
    params,
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Download an Excel export with date-stamped filename.
 *
 * @param {string} apiPath  — API path
 * @param {string} baseName — Base filename without extension (e.g. 'products')
 * @param {object} [params] — Optional query params
 * @returns {Promise<void>}
 */
export async function downloadExcel(apiPath, baseName, params = {}) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${baseName}_${dateStr}.xlsx`;
  return downloadFile(apiPath, filename, params);
}

/**
 * SearchSelect — Reusable server-side search Select component
 *
 * Replaces the limit:500 pattern across the app. Uses Ant Design Select
 * with server-side search + 300ms debounce.
 *
 * Props:
 *   apiUrl        — API endpoint (e.g. "/api/inventory/products")
 *   labelField    — field name for label (default: "name")
 *   labelRender   — (item) => display text (overrides labelField)
 *   valueField    — field name for value (default: "id")
 *   extraParams   — extra query params (e.g. { status: "OPEN" })
 *   initialLimit  — initial fetch limit (default: 50)
 *   searchParam   — query param name for search (default: "search")
 *   itemsPath     — response path to items array (default: "items", null = root array)
 *   defaultOptions — pre-loaded options for edit mode [{value, label}]
 *   disabled      — disable the select
 *   ...selectProps — all Ant Design Select props pass-through
 *
 * Pattern reference: EmployeeContextSelector.jsx
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Select, Spin } from 'antd';
import api from '../services/api';

export default function SearchSelect({
  apiUrl,
  labelField = 'name',
  labelRender,
  valueField = 'id',
  extraParams = {},
  initialLimit = 50,
  searchParam = 'search',
  itemsPath = 'items',
  defaultOptions = [],
  ...selectProps
}) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const extraParamsKey = JSON.stringify(extraParams);

  const buildOption = useCallback((item) => ({
    value: item[valueField],
    label: labelRender ? labelRender(item) : item[labelField],
  }), [valueField, labelField, labelRender]);

  const fetchData = useCallback((searchText) => {
    setFetching(true);
    const params = { limit: initialLimit, offset: 0, ...extraParams };
    if (searchText?.trim()) {
      params[searchParam] = searchText.trim();
    }
    api.get(apiUrl, { params })
      .then((res) => {
        const data = res.data;
        let items;
        if (itemsPath === null) {
          items = Array.isArray(data) ? data : [];
        } else {
          items = data[itemsPath] || data;
          if (!Array.isArray(items)) items = [];
        }
        setOptions(items.map(buildOption));
      })
      .catch((err) => {
        console.warn('[SearchSelect] load:', err?.response?.status, apiUrl);
        setOptions([]);
      })
      .finally(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, extraParamsKey, valueField, labelField, initialLimit, searchParam, itemsPath, buildOption]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData('');
  }, [fetchData]);

  const handleSearch = useCallback((val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(val), 300);
  }, [fetchData]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Merge defaultOptions with fetched options (for edit mode)
  const mergedOptions = useMemo(() => {
    if (!defaultOptions || defaultOptions.length === 0) return options;
    const optionValues = new Set(options.map((o) => o.value));
    const missing = defaultOptions.filter((d) => !optionValues.has(d.value));
    return [...missing, ...options];
  }, [options, defaultOptions]);

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      options={mergedOptions}
      loading={fetching}
      notFoundContent={fetching ? <Spin size="small" /> : 'ไม่พบข้อมูล'}
      {...selectProps}
    />
  );
}

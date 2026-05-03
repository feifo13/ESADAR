import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function normalizeHeaderLabel(label) {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyLabelsToTable(table) {
  if (!table || table.dataset.responsiveLabelsApplied === 'true') return;

  const headers = Array.from(table.querySelectorAll('thead th')).map((header) => (
    normalizeHeaderLabel(header.innerText || header.textContent)
  ));

  if (!headers.length) return;

  Array.from(table.querySelectorAll('tbody tr')).forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      if (cell.tagName !== 'TD' || cell.hasAttribute('colspan')) return;
      const label = headers[index];
      if (label) cell.setAttribute('data-label', label);
    });
  });

  table.dataset.responsiveLabelsApplied = 'true';
}

export default function ResponsiveTableLabels() {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const applyAll = () => {
      document.querySelectorAll('table.data-table').forEach((table) => {
        table.dataset.responsiveLabelsApplied = 'false';
        applyLabelsToTable(table);
      });
    };

    const frameId = window.requestAnimationFrame(applyAll);
    const observer = new MutationObserver(applyAll);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [location.pathname, location.search, location.key]);

  return null;
}

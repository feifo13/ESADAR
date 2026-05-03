import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function normalizeHeaderLabel(label) {
  return String(label || '')
    .replace(/[↑↓↕⌃⌄]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACTION_ICON_MAP = [
  [/(agregar\s+al\s+carrito|carrito)/i, 'cart-plus'],
  [/^(ver|abrir|detalle|detalles|ver detalle|ver orden|ver prenda|ver compra|leer)$/i, '👁'],
  [/(editar|modificar)/i, '✎'],
  [/(eliminar|borrar|quitar|remover|sacar)/i, '🗑'],
  [/(cancelar|rechazar|anular)/i, '⊘'],
  [/(aprobar|confirmar|activar|marcar|guardar|aplicar)/i, '✓'],
  [/(pagar|pago|cobrar)/i, '$'],
  [/(reenviar|enviar|responder)/i, '➜'],
  [/(duplicar|copiar)/i, '⧉'],
  [/(descargar|exportar)/i, '↓'],
  [/(subir|importar)/i, '↑'],
  [/(historial|auditoria|logs?)/i, '◷'],
  [/(stock|inventario)/i, '#'],
];

function getActionIcon(label) {
  const normalized = String(label || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  const match = ACTION_ICON_MAP.find(([pattern]) => pattern.test(normalized));
  return match?.[1] || '•';
}

function shouldIconizeControl(control) {
  if (!control) return false;

  if (
    control.classList.contains('table-strong-link') ||
    control.classList.contains('table-thumb-link') ||
    control.classList.contains('icon-action-button') ||
    control.closest('.table-thumb-link') ||
    control.querySelector('img, picture, svg')
  ) {
    return false;
  }

  return Boolean(
    control.closest('.table-actions') ||
    control.closest('.inline-action-group') ||
    control.tagName === 'BUTTON',
  );
}

function iconizeTableActions(row) {
  Array.from(row.querySelectorAll('td button, td a')).forEach((control) => {
    if (!shouldIconizeControl(control)) return;

    const label = (
      control.getAttribute('aria-label') ||
      control.getAttribute('title') ||
      control.textContent ||
      ''
    ).replace(/\s+/g, ' ').trim();

    if (!label) return;

    const icon = getActionIcon(label);
    if (!icon) return;

    control.classList.add('table-action-iconized');
    control.setAttribute('data-mobile-icon', icon);
    control.setAttribute('data-mobile-label', label);

    if (!control.getAttribute('aria-label')) {
      control.setAttribute('aria-label', label);
    }
    if (!control.getAttribute('title')) {
      control.setAttribute('title', label);
    }
  });
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

    iconizeTableActions(row);
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

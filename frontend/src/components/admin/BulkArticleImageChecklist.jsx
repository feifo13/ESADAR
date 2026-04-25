import SmartImage from '../SmartImage.jsx';

export const IMAGE_ROLE_DEFINITIONS = [
  { key: 'front', label: 'Frente completo', helper: 'Recomendado', requiredStrong: true, defaultPrimary: true },
  { key: 'back', label: 'Espalda completa', helper: 'Recomendado', requiredStrong: true },
  { key: 'label', label: 'Etiqueta / marca', helper: 'Recomendado' },
  { key: 'texture', label: 'Textura / material', helper: 'Recomendado' },
  { key: 'condition', label: 'Detalle de estado', helper: 'Subelo si la prenda tiene detalle' },
  { key: 'measurements', label: 'Medidas visuales', helper: 'Opcional' },
  { key: 'extra', label: 'Imagen adicional', helper: 'Opcional' },
];

function resolvePreview(file) {
  if (!file) return '';
  return URL.createObjectURL(file);
}

export function createEmptyImageState() {
  return IMAGE_ROLE_DEFINITIONS.reduce((accumulator, role) => ({
    ...accumulator,
    [role.key]: {
      file: null,
      preview: '',
      altText: '',
      isPrimary: Boolean(role.defaultPrimary),
    },
  }), {});
}

export default function BulkArticleImageChecklist({ value, title, onChange, hasConditionWarning }) {
  function replaceFile(roleKey, file) {
    onChange(roleKey, {
      ...value[roleKey],
      file: file || null,
      preview: file ? resolvePreview(file) : '',
    });
  }

  function setPrimary(roleKey) {
    const next = {};
    Object.entries(value).forEach(([key, roleValue]) => {
      next[key] = { ...roleValue, isPrimary: key === roleKey };
    });
    onChange(null, next, true);
  }

  return (
    <div className="bulk-image-checklist">
      {IMAGE_ROLE_DEFINITIONS.map((role) => {
        const current = value[role.key];
        const hasFile = Boolean(current?.file);
        return (
          <article key={role.key} className={hasFile ? 'bulk-image-card is-complete' : 'bulk-image-card'}>
            <div className="bulk-image-card__heading">
              <div>
                <strong>{role.label}</strong>
                <span>{hasFile ? 'Completado' : 'Faltante'}</span>
              </div>
              <span className="muted-copy">{role.helper}</span>
            </div>

            {current?.preview ? (
              <SmartImage
                src={current.preview}
                alt={current.altText || `${title || 'Prenda'} - ${role.label.toLowerCase()}`}
                fallbackLabel={title || role.label}
                className="bulk-image-card__preview"
              />
            ) : (
              <div className="bulk-image-card__placeholder">{role.label}</div>
            )}

            <label className="button button-secondary button-compact">
              {hasFile ? 'Reemplazar archivo' : 'Subir archivo'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => replaceFile(role.key, event.target.files?.[0] || null)}
              />
            </label>

            <label className="field-group">
              <span>Alt text</span>
              <input
                className="input"
                value={current?.altText || ''}
                onChange={(event) => onChange(role.key, { ...current, altText: event.target.value })}
                placeholder={`${title || 'Prenda'} - ${role.label.toLowerCase()}`}
              />
            </label>

            <div className="inline-action-group">
              <button type="button" className={current?.isPrimary ? 'button button-primary button-compact' : 'button button-secondary button-compact'} onClick={() => setPrimary(role.key)}>
                {current?.isPrimary ? 'Imagen principal' : 'Marcar principal'}
              </button>
              {hasFile ? (
                <button type="button" className="button button-secondary button-compact" onClick={() => replaceFile(role.key, null)}>
                  Borrar
                </button>
              ) : null}
            </div>
          </article>
        );
      })}

      {hasConditionWarning ? (
        <p className="field-helper">Marcaste que la prenda tiene detalle, conviene subir una foto del detalle.</p>
      ) : null}
    </div>
  );
}

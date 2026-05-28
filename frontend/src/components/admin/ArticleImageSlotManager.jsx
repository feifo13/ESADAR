import SmartImage from "../SmartImage.jsx";

function getUploadStatus(upload) {
  if (upload?.file) return "Pendiente de guardar";
  return "Vacío";
}

export default function ArticleImageSlotManager({
  slots,
  title,
  existingImages,
  uploads,
  imageActionId,
  canAddSlot,
  addSlotDisabledReason,
  hasConditionWarning,
  onAddSlot,
  onUploadChange,
  onSetUploadPrimary,
  onExistingAltChange,
  onSaveExisting,
  onMarkExistingPrimary,
  onDeleteExisting,
  onMoveExisting,
}) {
  return (
    <div className="page-stack-sm">
      <div className="section-heading section-heading-wrap">
        <div>
          <h3>Imagenes</h3>
          <p className="field-helper">
            Los slots respetan el orden real de la galeria. Las imagenes nuevas
            se suben al guardar el articulo.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary button-compact"
          onClick={onAddSlot}
          disabled={!canAddSlot}
          title={canAddSlot ? "Agregar otro slot" : addSlotDisabledReason}
        >
          Agregar otra imagen
        </button>
      </div>

      <div className="bulk-image-checklist article-image-slot-grid">
        {slots.map((slot, index) => {
          const image = existingImages[index] || null;
          const upload = uploads[slot.key] || {
            file: null,
            preview: "",
            altText: "",
            isPrimary: Boolean(slot.defaultPrimary),
          };
          const hasUpload = Boolean(upload.file);
          const hasMedia = Boolean(image || hasUpload);
          const isBusy = Boolean(imageActionId);

          return (
            <article
              key={slot.key}
              className={[
                "bulk-image-card",
                hasMedia ? "is-complete" : "",
                image?.isPrimary || (hasUpload && upload.isPrimary)
                  ? "is-primary"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="bulk-image-card__heading">
                <div className="cell-stack">
                  <strong>{slot.label}</strong>
                  <span className="muted-copy">{slot.helper}</span>
                </div>
                <span className={image ? "status-pill" : "status-pill is-muted"}>
                  {image ? "Subida" : getUploadStatus(upload)}
                </span>
              </div>

              {image ? (
                <SmartImage
                  src={
                    image.cardFilePath ||
                    image.detailFilePath ||
                    image.filePath
                  }
                  alt={image.altText || title || slot.label}
                  fallbackLabel={title || "ESADAR"}
                  className="bulk-image-card__preview"
                />
              ) : upload.preview ? (
                <SmartImage
                  src={upload.preview}
                  alt={
                    upload.altText ||
                    `${title || "Prenda"} - ${slot.label.toLowerCase()}`
                  }
                  fallbackLabel={title || slot.label}
                  className="bulk-image-card__preview"
                />
              ) : (
                <div className="bulk-image-card__placeholder">{slot.label}</div>
              )}

              {image ? (
                <div className="page-stack stack-gap-xs">
                  <div className="table-actions table-actions-spread">
                    <strong>
                      {image.isPrimary ? "Primaria" : `Imagen ${index + 1}`}
                    </strong>
                    <span className="muted-copy">Orden {image.sortOrder}</span>
                  </div>

                  <label className="field-group">
                    <span>Alt text</span>
                    <input
                      className="input"
                      value={image.altText || ""}
                      onChange={(event) =>
                        onExistingAltChange(image.id, event.target.value)
                      }
                      placeholder="Descripcion util para Google Images y accesibilidad"
                    />
                  </label>

                  <div className="image-manager-meta">
                    <span>
                      {image.width && image.height
                        ? `${image.width}x${image.height}`
                        : "Sin metadata"}
                    </span>
                    <span>{image.processedStatus || "DONE"}</span>
                  </div>

                  <div className="inline-action-group">
                    <button
                      type="button"
                      className="button button-secondary button-compact"
                      onClick={() => onSaveExisting(image.id)}
                      disabled={isBusy}
                    >
                      {imageActionId === `save-${image.id}`
                        ? "Guardando..."
                        : "Guardar alt"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary button-compact"
                      onClick={() => onMarkExistingPrimary(image.id)}
                      disabled={isBusy || image.isPrimary}
                    >
                      {imageActionId === `primary-${image.id}`
                        ? "Actualizando..."
                        : image.isPrimary
                          ? "Ya es primaria"
                          : "Marcar primaria"}
                    </button>
                  </div>

                  <div className="inline-action-group">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onMoveExisting(image.id, -1)}
                      disabled={isBusy || index === 0}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onMoveExisting(image.id, 1)}
                      disabled={
                        isBusy || index === existingImages.length - 1
                      }
                    >
                      Bajar
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onDeleteExisting(image.id)}
                      disabled={isBusy}
                    >
                      {imageActionId === `delete-${image.id}`
                        ? "Eliminando..."
                        : "Borrar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="page-stack stack-gap-xs">
                  <label className="button button-secondary button-compact">
                    {hasUpload ? "Reemplazar archivo" : "Subir archivo"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) =>
                        onUploadChange(slot.key, {
                          ...upload,
                          file: event.target.files?.[0] || null,
                        })
                      }
                    />
                  </label>

                  <label className="field-group">
                    <span>Alt text</span>
                    <input
                      className="input"
                      value={upload.altText || ""}
                      onChange={(event) =>
                        onUploadChange(slot.key, {
                          ...upload,
                          altText: event.target.value,
                        })
                      }
                      placeholder={`${title || "Prenda"} - ${slot.label.toLowerCase()}`}
                    />
                  </label>

                  <div className="inline-action-group">
                    <button
                      type="button"
                      className={
                        upload.isPrimary
                          ? "button button-primary button-compact"
                          : "button button-secondary button-compact"
                      }
                      onClick={() => onSetUploadPrimary(slot.key)}
                      disabled={!hasUpload}
                    >
                      {upload.isPrimary
                        ? "Principal al guardar"
                        : "Marcar principal"}
                    </button>
                    {hasUpload ? (
                      <button
                        type="button"
                        className="button button-secondary button-compact"
                        onClick={() =>
                          onUploadChange(slot.key, {
                            ...upload,
                            file: null,
                            preview: "",
                          })
                        }
                      >
                        Borrar
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {hasConditionWarning ? (
        <p className="field-helper">
          Marcaste que la prenda tiene detalle, conviene subir una foto del
          detalle.
        </p>
      ) : null}
    </div>
  );
}

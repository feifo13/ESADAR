# Vaciado operativo canónico de sandbox

`db/scripts/02_vaciado_operativo_sandbox.sql` es la única herramienta de vaciado operativo habitual. No es un instalador ni un seed: `01_from_scratch_superadmin_seed.sql` mantiene separada la responsabilidad de crear el esquema y el superadmin inicial.

## Contrato

El vaciado preserva exactamente usuarios, hashes de contraseña, roles, identidades de autenticación, clientes y direcciones persistentes. También preserva artículos e imágenes, lotes, categorías, marcas, talles, shipping, medios de cobro, configuración visual/SEO y la fila completa de `company_collecting_settings`, incluidas las credenciales, firma y URL de notificación de Mercado Pago.

Elimina órdenes, pagos, preferencias y webhooks históricos de Mercado Pago, carritos, ofertas, wishlists, prospectos/guest transitorios, tokens temporales, importaciones, eventos, visitas, auditoría y logs. No desactiva foreign keys: las eliminaciones siguen el orden de dependencias del esquema actual.

Cada ejecución completa inventarios faltantes y deja exactamente una fila por artículo con:

```text
quantity_total     = 100
quantity_available = 100
quantity_reserved  = 0
quantity_sold      = 0
quantity_lost      = 0
```

El ledger anterior se elimina y se crea un único movimiento `INITIAL_STOCK` por artículo. Una segunda ejecución reemplaza ese baseline, no suma stock ni duplica filas.

## Clasificación del esquema actual

| Tabla | Clase | Acción |
|---|---|---|
| `roles` | MASTER/PERSISTENT | Preservar |
| `users` | PERSISTENT | Preservar |
| `user_auth_identities` | PERSISTENT | Preservar |
| `password_reset_tokens` | TEMPORARY | Limpiar |
| `user_roles` | PERSISTENT | Preservar |
| `categories` | MASTER | Preservar |
| `brands` | MASTER | Preservar |
| `sizes` | MASTER | Preservar |
| `shipping_methods` | CONFIGURATION | Preservar |
| `shipping_method_weight_rates` | CONFIGURATION | Preservar |
| `company_collecting_settings` | CONFIGURATION | Preservar |
| `customers` | PERSISTENT | Preservar |
| `customer_addresses` | PERSISTENT | Preservar |
| `potential_customers` | TRANSACTIONAL | Limpiar |
| `article_lots` | MASTER | Preservar |
| `articles` | MASTER/PERSISTENT | Preservar |
| `article_inventory` | DERIVED | Normalizar a 100 |
| `article_images` | MASTER/PERSISTENT | Preservar |
| `article_import_batches` | TEMPORARY | Limpiar |
| `article_import_batch_items` | TEMPORARY | Limpiar |
| `carts` | TRANSACTIONAL | Limpiar |
| `cart_items` | TRANSACTIONAL | Limpiar |
| `orders` | TRANSACTIONAL | Limpiar |
| `order_payment_retry_capabilities` | TEMPORARY | Limpiar |
| `article_inventory_movements` | TRANSACTIONAL | Rehacer baseline |
| `order_items` | TRANSACTIONAL | Limpiar |
| `order_status_history` | TRANSACTIONAL | Limpiar |
| `offers` | TRANSACTIONAL | Limpiar |
| `offer_status_history` | TRANSACTIONAL | Limpiar |
| `payments` | TRANSACTIONAL | Limpiar |
| `mercado_pago_webhook_events` | TRANSACTIONAL | Limpiar |
| `mercado_pago_preference_events` | TRANSACTIONAL | Limpiar |
| `mercado_pago_checkout_preferences` | TRANSACTIONAL | Limpiar |
| `contact_messages` | TRANSACTIONAL | Limpiar |
| `lead_preferences` | TRANSACTIONAL | Limpiar |
| `article_interest_alerts` | TRANSACTIONAL | Limpiar |
| `wishlists` | TRANSACTIONAL | Limpiar |
| `wishlist_items` | TRANSACTIONAL | Limpiar |
| `article_events` | DERIVED | Limpiar |
| `public_page_visits` | DERIVED | Limpiar |
| `site_pages_seo` | CONFIGURATION | Preservar |
| `site_hero` | CONFIGURATION | Preservar |
| `site_hero_images` | CONFIGURATION | Preservar |
| `site_ticker_settings` | CONFIGURATION | Preservar |
| `audit_log` | TRANSACTIONAL | Limpiar |
| `client_error_logs` | TRANSACTIONAL | Limpiar |

Las bases actualizadas desde el esquema anterior al split de inventario pueden conservar `article_stock_movements`. El reset lo detecta y limpia condicionalmente; esa tabla no forma parte del esquema consolidado actual.

## Uso seguro

El script declara `USE esadar_sandbox`, y el runner exige que `DB_NAME` coincida. Primero haz un backup si la base contiene datos útiles. No lo uses en producción.

Dry-run desde `backend/`:

```bash
npm run db:script -- \
  --file db/scripts/02_vaciado_operativo_sandbox.sql
```

Ejecución:

```bash
npm run db:script -- \
  --file db/scripts/02_vaciado_operativo_sandbox.sql \
  --execute \
  --confirm-db esadar_sandbox \
  --allow-destructive
```

El reset operacional no requiere credenciales de bootstrap. Se mantienen los guards de dry-run, confirmación exacta de DB, SQL destructivo y detección de producción del runner.

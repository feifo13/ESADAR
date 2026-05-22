export const INVENTORY_MOVEMENT_TYPES = Object.freeze({
  INITIAL_STOCK: 'INITIAL_STOCK',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  RESERVE: 'RESERVE',
  RELEASE_RESERVATION: 'RELEASE_RESERVATION',
  SALE: 'SALE',
  LOSS: 'LOSS',
  RETURN: 'RETURN',
});

export const STOCK_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  SOLD_OUT: 'SOLD_OUT',
});

export const PUBLICATION_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
});

export function deriveStockStatus(inventory = {}) {
  const quantityAvailable = Number(inventory.quantityAvailable || 0);
  const quantityReserved = Number(inventory.quantityReserved || 0);
  const quantitySold = Number(inventory.quantitySold || 0);

  if (quantityAvailable > 0) return STOCK_STATUSES.ACTIVE;
  if (quantityReserved > 0) return STOCK_STATUSES.RESERVED;
  if (quantitySold > 0) return STOCK_STATUSES.SOLD_OUT;
  return STOCK_STATUSES.SOLD_OUT;
}

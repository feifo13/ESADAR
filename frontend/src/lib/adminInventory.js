export const INITIAL_STOCK_STATES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  SOLD_OUT: "SOLD_OUT",
});

export function buildInitialInventorySnapshot(quantityTotal, initialStockState) {
  const total = Number(quantityTotal);
  const normalizedTotal = Number.isInteger(total) && total >= 0 ? total : 0;
  const startsSoldOut = initialStockState === INITIAL_STOCK_STATES.SOLD_OUT;

  return {
    quantityTotal: normalizedTotal,
    quantityAvailable: startsSoldOut ? 0 : normalizedTotal,
    quantityReserved: 0,
    quantitySold: startsSoldOut ? normalizedTotal : 0,
    quantityLost: 0,
  };
}

export function getManualInventoryActionAvailability(article = {}) {
  const quantityAvailable = Number(article.quantityAvailable || 0);
  const quantityReserved = Number(article.quantityReserved || 0);
  const quantitySold = Number(article.quantitySold || 0);

  return {
    canSell: quantityAvailable > 0 && quantityReserved === 0,
    saleBlockedByReservation: quantityAvailable > 0 && quantityReserved > 0,
    canReturn: quantitySold > 0,
    isSoldOutBySale:
      quantityAvailable === 0 && quantityReserved === 0 && quantitySold > 0,
  };
}

export function getInventoryMovementLimit(article = {}, mode) {
  return mode === "return"
    ? Math.max(0, Number(article.quantitySold || 0))
    : Math.max(0, Number(article.quantityAvailable || 0));
}

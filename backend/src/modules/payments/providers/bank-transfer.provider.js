export const bankTransferProvider = Object.freeze({
  id: "BANK_TRANSFER",

  isAvailable(settings = {}) {
    return Boolean(settings.isBankTransferEnabled);
  },
});

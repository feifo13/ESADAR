import {
  getBankTransferPaymentInstructions,
} from "../../collecting/collecting.service.js";

export const bankTransferProvider = Object.freeze({
  id: "BANK_TRANSFER",

  isAvailable(settings = {}) {
    return Boolean(settings.isBankTransferEnabled);
  },

  async prepare(_order, connection, _options = {}) {
    return getBankTransferPaymentInstructions(connection);
  },
});

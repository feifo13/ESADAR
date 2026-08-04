import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustInventory,
  confirmSale,
  createInitialInventory,
  registerInventoryReturn,
  registerManualSale,
  releaseReservation,
  reserveForOrder,
} from '../src/modules/inventory/inventory.service.js';
import { INVENTORY_MOVEMENT_TYPES } from '../src/modules/inventory/inventory.constants.js';

function makeInventory(articleId, overrides = {}) {
  return {
    articleId,
    quantityTotal: 3,
    quantityAvailable: 3,
    quantityReserved: 0,
    quantitySold: 0,
    quantityLost: 0,
    updatedBy: null,
    ...overrides,
  };
}

function makeConnection(initialInventory = null) {
  const state = {
    inventory: initialInventory ? { ...initialInventory } : null,
    movements: [],
    selects: [],
  };

  return {
    state,
    async execute(sql, params = []) {
      if (sql.includes('FROM article_inventory')) {
        state.selects.push(sql);
        const row = state.inventory
          ? {
              articleId: state.inventory.articleId,
              quantityTotal: state.inventory.quantityTotal,
              quantityAvailable: state.inventory.quantityAvailable,
              quantityReserved: state.inventory.quantityReserved,
              quantitySold: state.inventory.quantitySold,
              quantityLost: state.inventory.quantityLost,
              updatedBy: state.inventory.updatedBy,
            }
          : null;
        return [[row].filter(Boolean)];
      }

      if (sql.includes('INSERT INTO article_inventory_movements')) {
        const [
          articleId,
          orderId,
          movementType,
          availableDelta,
          reservedDelta,
          soldDelta,
          lostDelta,
          quantityAvailableAfter,
          quantityReservedAfter,
          quantitySoldAfter,
          quantityLostAfter,
          reason,
          createdBy,
        ] = params;
        state.movements.push({
          articleId,
          orderId,
          movementType,
          availableDelta,
          reservedDelta,
          soldDelta,
          lostDelta,
          quantityAvailableAfter,
          quantityReservedAfter,
          quantitySoldAfter,
          quantityLostAfter,
          reason,
          createdBy,
        });
        return [{ insertId: state.movements.length }];
      }

      if (sql.includes('INSERT INTO article_inventory')) {
        const [
          articleId,
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
        ] = params;
        state.inventory = {
          articleId,
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
        };
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('UPDATE article_inventory')) {
        const [
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
          articleId,
        ] = params;
        state.inventory = {
          articleId,
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
        };
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected SQL in fake connection: ${sql}`);
    },
  };
}

function assertLastSelectLocked(connection) {
  const lastSelect = connection.state.selects.at(-1) || '';
  assert.match(lastSelect, /FOR UPDATE/);
}

test('createInitialInventory creates balance and initial movement', async () => {
  const connection = makeConnection();

  const inventory = await createInitialInventory(connection, {
    articleId: 10,
    quantityTotal: 4,
    createdBy: 7,
  });

  assert.deepEqual(inventory, {
    articleId: 10,
    quantityTotal: 4,
    quantityAvailable: 4,
    quantityReserved: 0,
    quantitySold: 0,
    quantityLost: 0,
    updatedBy: 7,
  });
  assert.equal(connection.state.movements.length, 1);
  assert.equal(connection.state.movements[0].movementType, INVENTORY_MOVEMENT_TYPES.INITIAL_STOCK);
  assert.equal(connection.state.movements[0].availableDelta, 4);
});

test('reserveForOrder lowers available, raises reserved and records deltas with a lock', async () => {
  const connection = makeConnection(makeInventory(20));

  await reserveForOrder(connection, {
    articleId: 20,
    quantity: 2,
    orderId: 100,
    userId: 7,
  });

  assertLastSelectLocked(connection);
  assert.equal(connection.state.inventory.quantityAvailable, 1);
  assert.equal(connection.state.inventory.quantityReserved, 2);
  assert.deepEqual(connection.state.movements.at(-1), {
    articleId: 20,
    orderId: 100,
    movementType: INVENTORY_MOVEMENT_TYPES.RESERVE,
    availableDelta: -2,
    reservedDelta: 2,
    soldDelta: 0,
    lostDelta: 0,
    quantityAvailableAfter: 1,
    quantityReservedAfter: 2,
    quantitySoldAfter: 0,
    quantityLostAfter: 0,
    reason: 'Reserva por orden',
    createdBy: 7,
  });
});

test('releaseReservation raises available and lowers reserved', async () => {
  const connection = makeConnection(makeInventory(21, {
    quantityAvailable: 1,
    quantityReserved: 2,
  }));

  await releaseReservation(connection, {
    articleId: 21,
    quantity: 1,
    orderId: 101,
  });

  assertLastSelectLocked(connection);
  assert.equal(connection.state.inventory.quantityAvailable, 2);
  assert.equal(connection.state.inventory.quantityReserved, 1);
  assert.equal(connection.state.movements.at(-1).movementType, INVENTORY_MOVEMENT_TYPES.RELEASE_RESERVATION);
});

test('confirmSale lowers reserved and raises sold', async () => {
  const connection = makeConnection(makeInventory(22, {
    quantityAvailable: 1,
    quantityReserved: 2,
  }));

  await confirmSale(connection, {
    articleId: 22,
    quantity: 2,
    orderId: 102,
  });

  assertLastSelectLocked(connection);
  assert.equal(connection.state.inventory.quantityReserved, 0);
  assert.equal(connection.state.inventory.quantitySold, 2);
  assert.equal(connection.state.movements.at(-1).movementType, INVENTORY_MOVEMENT_TYPES.SALE);
  assert.equal(connection.state.movements.at(-1).reservedDelta, -2);
  assert.equal(connection.state.movements.at(-1).soldDelta, 2);
});

test('inventory service rejects negative stock and broken balances', async () => {
  const connection = makeConnection(makeInventory(30));

  await assert.rejects(
    reserveForOrder(connection, { articleId: 30, quantity: 4, orderId: 103 }),
    /No hay stock suficiente/,
  );

  await assert.rejects(
    adjustInventory(connection, {
      articleId: 30,
      quantityTotal: 1,
      quantityAvailable: 2,
      reason: 'Balance invalido',
    }),
    /stock perdido|stock total/i,
  );
});

test('confirmSale rejects sales without enough reserved stock', async () => {
  const connection = makeConnection(makeInventory(40, {
    quantityAvailable: 2,
    quantityReserved: 1,
  }));

  await assert.rejects(
    confirmSale(connection, { articleId: 40, quantity: 2, orderId: 104 }),
    /stock reservado suficiente/,
  );
});

test('createInitialInventory can create an article already sold without a SALE movement', async () => {
  const connection = makeConnection();

  await createInitialInventory(connection, {
    articleId: 41,
    quantityTotal: 2,
    quantityAvailable: 0,
    quantitySold: 2,
    quantityLost: 0,
    reason: 'Articulo ingresado inicialmente como vendido',
  });

  assert.equal(connection.state.inventory.quantityAvailable, 0);
  assert.equal(connection.state.inventory.quantitySold, 2);
  assert.equal(connection.state.inventory.quantityLost, 0);
  assert.equal(connection.state.movements.length, 1);
  assert.equal(connection.state.movements[0].movementType, INVENTORY_MOVEMENT_TYPES.INITIAL_STOCK);
  assert.equal(connection.state.movements[0].soldDelta, 2);
});

test('registerManualSale sells one unique article and produces SOLD_OUT inventory', async () => {
  const connection = makeConnection(makeInventory(50, {
    quantityTotal: 1,
    quantityAvailable: 1,
  }));

  const result = await registerManualSale(connection, {
    articleId: 50,
    quantity: 1,
    userId: 9,
    reason: 'Venta por Instagram',
  });

  assertLastSelectLocked(connection);
  assert.equal(result.soldQuantity, 1);
  assert.equal(connection.state.inventory.quantityAvailable, 0);
  assert.equal(connection.state.inventory.quantitySold, 1);
  assert.equal(connection.state.inventory.quantityLost, 0);
  assert.equal(connection.state.movements.at(-1).movementType, INVENTORY_MOVEMENT_TYPES.SALE);
  assert.equal(connection.state.movements.at(-1).orderId, null);
  assert.equal(connection.state.movements.at(-1).availableDelta, -1);
  assert.equal(connection.state.movements.at(-1).soldDelta, 1);
  assert.equal(connection.state.movements.at(-1).createdBy, 9);
});

test('registerManualSale supports partial sales and preserves the inventory invariant', async () => {
  const connection = makeConnection(makeInventory(51, {
    quantityTotal: 5,
    quantityAvailable: 4,
    quantitySold: 1,
  }));

  await registerManualSale(connection, {
    articleId: 51,
    quantity: 2,
  });

  const inventory = connection.state.inventory;
  assert.equal(inventory.quantityAvailable, 2);
  assert.equal(inventory.quantitySold, 3);
  assert.equal(inventory.quantityLost, 0);
  assert.equal(
    inventory.quantityTotal,
    inventory.quantityAvailable + inventory.quantityReserved + inventory.quantitySold + inventory.quantityLost,
  );
});

test('registerManualSale rejects reservations, overselling and a repeated exhausted sale', async () => {
  const reservedConnection = makeConnection(makeInventory(52, {
    quantityAvailable: 2,
    quantityReserved: 1,
  }));
  await assert.rejects(
    registerManualSale(reservedConnection, { articleId: 52, quantity: 1 }),
    (error) => error.statusCode === 409 && error.details?.code === 'INVENTORY_RESERVED',
  );

  const oversellConnection = makeConnection(makeInventory(53, {
    quantityTotal: 2,
    quantityAvailable: 2,
  }));
  await assert.rejects(
    registerManualSale(oversellConnection, { articleId: 53, quantity: 3 }),
    (error) => error.statusCode === 409 && error.details?.code === 'INSUFFICIENT_AVAILABLE_STOCK',
  );

  const exhaustedConnection = makeConnection(makeInventory(54, {
    quantityTotal: 1,
    quantityAvailable: 1,
  }));
  await registerManualSale(exhaustedConnection, { articleId: 54, quantity: 1 });
  await assert.rejects(
    registerManualSale(exhaustedConnection, { articleId: 54, quantity: 1 }),
    (error) => error.statusCode === 409 && error.details?.code === 'ARTICLE_ALREADY_SOLD_OUT',
  );
  assert.equal(exhaustedConnection.state.inventory.quantitySold, 1);
  assert.equal(exhaustedConnection.state.movements.length, 1);
});

test('registerInventoryReturn moves sold stock back to available and records RETURN', async () => {
  const connection = makeConnection(makeInventory(55, {
    quantityTotal: 4,
    quantityAvailable: 1,
    quantitySold: 3,
  }));

  await registerInventoryReturn(connection, {
    articleId: 55,
    quantity: 2,
    userId: 11,
    reason: 'Venta anulada',
  });

  assertLastSelectLocked(connection);
  assert.equal(connection.state.inventory.quantityAvailable, 3);
  assert.equal(connection.state.inventory.quantitySold, 1);
  assert.equal(connection.state.inventory.quantityLost, 0);
  assert.equal(connection.state.movements.at(-1).movementType, INVENTORY_MOVEMENT_TYPES.RETURN);
  assert.equal(connection.state.movements.at(-1).orderId, null);
  assert.equal(connection.state.movements.at(-1).availableDelta, 2);
  assert.equal(connection.state.movements.at(-1).soldDelta, -2);
});

test('registerInventoryReturn rejects quantities greater than sold stock', async () => {
  const connection = makeConnection(makeInventory(56, {
    quantityTotal: 3,
    quantityAvailable: 2,
    quantitySold: 1,
  }));

  await assert.rejects(
    registerInventoryReturn(connection, { articleId: 56, quantity: 2 }),
    (error) => error.statusCode === 409 && error.details?.code === 'INSUFFICIENT_SOLD_STOCK',
  );
  assert.equal(connection.state.inventory.quantityAvailable, 2);
  assert.equal(connection.state.inventory.quantitySold, 1);
  assert.equal(connection.state.movements.length, 0);
});

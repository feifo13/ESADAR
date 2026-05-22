import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustInventory,
  confirmSale,
  createInitialInventory,
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

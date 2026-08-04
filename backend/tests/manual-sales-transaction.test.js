import test from 'node:test';
import assert from 'node:assert/strict';
import { withTransaction } from '../src/db/transaction.js';
import { articleCreateSchema } from '../src/modules/articles/articles.schemas.js';
import { articlesTestInternals } from '../src/modules/articles/articles.service.js';
import { INVENTORY_MOVEMENT_TYPES } from '../src/modules/inventory/inventory.constants.js';
import {
  confirmSale,
  createInitialInventory,
} from '../src/modules/inventory/inventory.service.js';

const AUDIT_CONTEXT = {
  actorUserId: 7,
  actorLabel: 'Admin test',
  source: 'TEST',
  ipAddress: '127.0.0.1',
  userAgent: 'node:test',
};

function makeState({
  articleId = 101,
  publicationStatus = 'ACTIVE',
  inventory = {},
  offers = [],
} = {}) {
  return {
    article: { id: articleId, title: `Artículo ${articleId}`, status: publicationStatus },
    inventory: {
      articleId,
      quantityTotal: 3,
      quantityAvailable: 3,
      quantityReserved: 0,
      quantitySold: 0,
      quantityLost: 0,
      updatedAt: null,
      updatedBy: null,
      ...inventory,
    },
    offers: offers.map((offer, index) => ({
      id: index + 1,
      status: 'PENDING',
      consumedAt: null,
      ...offer,
    })),
    movements: [],
    audits: [],
    events: [],
    offerReadSql: [],
    transactions: { begun: 0, committed: 0, rolledBack: 0, released: 0 },
  };
}

function cloneTransactionalState(state) {
  return structuredClone({
    article: state.article,
    inventory: state.inventory,
    offers: state.offers,
    movements: state.movements,
    audits: state.audits,
  });
}

function restoreTransactionalState(state, snapshot) {
  state.article = snapshot.article;
  state.inventory = snapshot.inventory;
  state.offers = snapshot.offers;
  state.movements = snapshot.movements;
  state.audits = snapshot.audits;
}

function makeConnection(state) {
  let transactionSnapshot = null;

  return {
    state,
    async beginTransaction() {
      state.transactions.begun += 1;
      state.events.push('begin');
      transactionSnapshot = cloneTransactionalState(state);
    },
    async commit() {
      state.transactions.committed += 1;
      state.events.push('commit');
      transactionSnapshot = null;
    },
    async rollback() {
      state.transactions.rolledBack += 1;
      state.events.push('rollback');
      if (transactionSnapshot) restoreTransactionalState(state, transactionSnapshot);
      transactionSnapshot = null;
    },
    release() {
      state.transactions.released += 1;
      state.events.push('release');
    },
    async execute(sql, params = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (
        normalizedSql.includes('FROM articles a') &&
        normalizedSql.includes('INNER JOIN article_inventory inv') &&
        normalizedSql.includes('FOR UPDATE')
      ) {
        state.events.push('lock-article-inventory');
        if (!state.article || !state.inventory || Number(state.article.id) !== Number(params[0])) {
          return [[]];
        }
        return [[{
          articleId: state.article.id,
          publicationStatus: state.article.status,
          quantityTotal: state.inventory.quantityTotal,
          quantityAvailable: state.inventory.quantityAvailable,
          quantityReserved: state.inventory.quantityReserved,
          quantitySold: state.inventory.quantitySold,
          quantityLost: state.inventory.quantityLost,
          updatedAt: state.inventory.updatedAt,
          updatedBy: state.inventory.updatedBy,
        }]];
      }

      if (normalizedSql.includes('FROM offers')) {
        state.events.push('read-active-offers');
        state.offerReadSql.push(normalizedSql);
        return [state.offers
          .filter((offer) => (
            ['PENDING', 'ACCEPTED'].includes(offer.status) && offer.consumedAt == null
          ))
          .map(({ id, status }) => ({ id, status }))];
      }

      if (
        normalizedSql.includes('FROM article_inventory') &&
        normalizedSql.includes('FOR UPDATE')
      ) {
        state.events.push('lock-inventory');
        return [[state.inventory ? {
          articleId: state.inventory.articleId,
          quantityTotal: state.inventory.quantityTotal,
          quantityAvailable: state.inventory.quantityAvailable,
          quantityReserved: state.inventory.quantityReserved,
          quantitySold: state.inventory.quantitySold,
          quantityLost: state.inventory.quantityLost,
          updatedAt: state.inventory.updatedAt,
          updatedBy: state.inventory.updatedBy,
        } : null].filter(Boolean)];
      }

      if (normalizedSql.startsWith('INSERT INTO article_inventory (')) {
        const [
          articleId,
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
        ] = params;
        state.events.push('insert-inventory');
        state.inventory = {
          articleId,
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedAt: null,
          updatedBy,
        };
        return [{ affectedRows: 1 }];
      }

      if (normalizedSql.startsWith('UPDATE article_inventory')) {
        const [
          quantityTotal,
          quantityAvailable,
          quantityReserved,
          quantitySold,
          quantityLost,
          updatedBy,
          articleId,
        ] = params;
        state.events.push('update-inventory');
        state.inventory = {
          ...state.inventory,
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

      if (normalizedSql.startsWith('INSERT INTO article_inventory_movements')) {
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
        state.events.push('insert-movement');
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

      throw new Error(`Unexpected SQL in manual sale fake connection: ${normalizedSql}`);
    },
  };
}

function makePool(connection) {
  return {
    async getConnection() {
      return connection;
    },
  };
}

function buildArticleSnapshot(state) {
  return {
    id: state.article.id,
    title: state.article.title,
    publicationStatus: state.article.status,
    quantityTotal: state.inventory.quantityTotal,
    quantityAvailable: state.inventory.quantityAvailable,
    quantityReserved: state.inventory.quantityReserved,
    quantitySold: state.inventory.quantitySold,
    quantityLost: state.inventory.quantityLost,
  };
}

function makeArticleDependencies(state, { failAudit = false } = {}) {
  let snapshotCount = 0;
  return {
    async getAdminArticle() {
      snapshotCount += 1;
      state.events.push(snapshotCount === 1 ? 'snapshot-before' : 'snapshot-after');
      return structuredClone(buildArticleSnapshot(state));
    },
    async writeAudit(payload) {
      state.events.push('audit');
      if (failAudit) throw new Error('audit write failed');
      state.audits.push(structuredClone(payload));
    },
  };
}

test('ACTIVE manual sale locks eligibility first and records SALE without changing lost stock', async () => {
  const state = makeState({
    inventory: {
      quantityTotal: 4,
      quantityAvailable: 2,
      quantitySold: 1,
      quantityLost: 1,
    },
  });
  const connection = makeConnection(state);

  const result = await withTransaction(
    (transactionConnection) => (
      articlesTestInternals.registerArticleManualSaleInTransaction(
        transactionConnection,
        state.article.id,
        { quantity: 1, reason: 'Venta presencial' },
        AUDIT_CONTEXT,
        makeArticleDependencies(state),
      )
    ),
    makePool(connection),
  );

  assert.equal(result.quantityAvailable, 1);
  assert.equal(result.quantitySold, 2);
  assert.equal(result.quantityLost, 1);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].movementType, INVENTORY_MOVEMENT_TYPES.SALE);
  assert.equal(state.movements[0].orderId, null);
  assert.equal(state.movements[0].lostDelta, 0);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].actionCode, 'ARTICLE_MANUAL_SALE_REGISTERED');
  assert.deepEqual(state.events, [
    'begin',
    'lock-article-inventory',
    'read-active-offers',
    'snapshot-before',
    'update-inventory',
    'insert-movement',
    'snapshot-after',
    'audit',
    'commit',
    'release',
  ]);
  assert.deepEqual(state.transactions, {
    begun: 1,
    committed: 1,
    rolledBack: 0,
    released: 1,
  });
  assert.doesNotMatch(state.offerReadSql[0], /FOR UPDATE/i);
});

test('INACTIVE manual sale fails after the authoritative lock without side effects', async () => {
  const state = makeState({ publicationStatus: 'INACTIVE' });
  const connection = makeConnection(state);

  await assert.rejects(
    articlesTestInternals.registerArticleManualSaleInTransaction(
      connection,
      state.article.id,
      { quantity: 1 },
      AUDIT_CONTEXT,
      makeArticleDependencies(state),
    ),
    (error) => (
      error.statusCode === 409 &&
      error.details?.code === 'ARTICLE_PUBLICATION_NOT_ACTIVE'
    ),
  );

  assert.deepEqual(state.events, ['lock-article-inventory']);
  assert.equal(state.inventory.quantityAvailable, 3);
  assert.equal(state.inventory.quantitySold, 0);
  assert.equal(state.movements.length, 0);
  assert.equal(state.audits.length, 0);
});

for (const offerStatus of ['PENDING', 'ACCEPTED']) {
  test(`${offerStatus} unconsumed offer blocks manual sale with intact inventory`, async () => {
    const state = makeState({ offers: [{ status: offerStatus }] });
    const connection = makeConnection(state);

    await assert.rejects(
      articlesTestInternals.registerArticleManualSaleInTransaction(
        connection,
        state.article.id,
        { quantity: 1 },
        AUDIT_CONTEXT,
        makeArticleDependencies(state),
      ),
      (error) => (
        error.statusCode === 409 &&
        error.details?.code === 'ARTICLE_HAS_ACTIVE_OFFERS'
      ),
    );

    assert.deepEqual(state.events, ['lock-article-inventory', 'read-active-offers']);
    assert.equal(state.inventory.quantityAvailable, 3);
    assert.equal(state.inventory.quantitySold, 0);
    assert.equal(state.movements.length, 0);
    assert.equal(state.audits.length, 0);
  });
}

test('administrative movement lock returns 404 when article or inventory is missing', async () => {
  const state = makeState();
  state.inventory = null;
  const connection = makeConnection(state);

  await assert.rejects(
    articlesTestInternals.lockArticleInventoryForAdministrativeMovement(
      connection,
      state.article.id,
    ),
    (error) => error.statusCode === 404,
  );
  assert.deepEqual(state.events, ['lock-article-inventory']);
});

test('transaction rolls back inventory and movement when audit fails after the update', async () => {
  const state = makeState();
  const connection = makeConnection(state);

  await assert.rejects(
    withTransaction(
      (transactionConnection) => (
        articlesTestInternals.registerArticleManualSaleInTransaction(
          transactionConnection,
          state.article.id,
          { quantity: 1 },
          AUDIT_CONTEXT,
          makeArticleDependencies(state, { failAudit: true }),
        )
      ),
      makePool(connection),
    ),
    /audit write failed/,
  );

  assert.equal(state.inventory.quantityAvailable, 3);
  assert.equal(state.inventory.quantitySold, 0);
  assert.equal(state.movements.length, 0);
  assert.equal(state.audits.length, 0);
  assert.deepEqual(state.transactions, {
    begun: 1,
    committed: 0,
    rolledBack: 1,
    released: 1,
  });
  assert.deepEqual(state.events.slice(0, 3), [
    'begin',
    'lock-article-inventory',
    'read-active-offers',
  ]);
  assert.deepEqual(state.events.slice(-3), ['audit', 'rollback', 'release']);
});

test('AVAILABLE explicit initial state overrides contradictory serialized counters', async () => {
  const parsed = articleCreateSchema.parse({
    title: 'Disponible autoritativo',
    salePrice: 1500,
    quantityTotal: 4,
    quantityAvailable: 0,
    quantityReserved: 2,
    quantitySold: 3,
    initialStockState: 'AVAILABLE',
  });
  const snapshot = articlesTestInternals.resolveArticleInventoryQuantities({
    ...parsed,
    quantityLost: 9,
  }, false);

  assert.deepEqual(snapshot, {
    quantityTotal: 4,
    quantityAvailable: 4,
    quantityReserved: 0,
    quantitySold: 0,
    quantityLost: 0,
    initialStockState: 'AVAILABLE',
  });
});

test('SOLD_OUT explicit initial state overrides counters and writes one INITIAL_STOCK', async () => {
  const parsed = articleCreateSchema.parse({
    title: 'Vendido autoritativo',
    salePrice: 1500,
    quantityTotal: 3,
    quantityAvailable: 3,
    quantityReserved: 2,
    quantitySold: 1,
    initialStockState: 'SOLD_OUT',
  });
  const snapshot = articlesTestInternals.resolveArticleInventoryQuantities({
    ...parsed,
    quantityLost: 9,
  }, false);
  const state = makeState();
  state.inventory = null;
  const connection = makeConnection(state);

  await createInitialInventory(connection, {
    articleId: state.article.id,
    ...snapshot,
  });

  assert.deepEqual(snapshot, {
    quantityTotal: 3,
    quantityAvailable: 0,
    quantityReserved: 0,
    quantitySold: 3,
    quantityLost: 0,
    initialStockState: 'SOLD_OUT',
  });
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].movementType, INVENTORY_MOVEMENT_TYPES.INITIAL_STOCK);
  assert.equal(state.movements[0].soldDelta, 3);
});

test('omitted initial state preserves legacy counter behavior', () => {
  const snapshot = articlesTestInternals.resolveArticleInventoryQuantities({
    quantityTotal: 5,
    quantityAvailable: 1,
    quantityReserved: 1,
    quantitySold: 1,
    quantityLost: 2,
  }, false);

  assert.deepEqual(snapshot, {
    quantityTotal: 5,
    quantityAvailable: 1,
    quantityReserved: 1,
    quantitySold: 1,
    quantityLost: 2,
    initialStockState: null,
  });
});

test('confirmSale regression still moves reserved stock to sold stock', async () => {
  const state = makeState({
    inventory: {
      quantityAvailable: 1,
      quantityReserved: 2,
      quantitySold: 0,
    },
  });
  const connection = makeConnection(state);

  await confirmSale(connection, {
    articleId: state.article.id,
    quantity: 2,
    orderId: 501,
  });

  assert.equal(state.inventory.quantityAvailable, 1);
  assert.equal(state.inventory.quantityReserved, 0);
  assert.equal(state.inventory.quantitySold, 2);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].movementType, INVENTORY_MOVEMENT_TYPES.SALE);
  assert.equal(state.movements[0].orderId, 501);
  assert.equal(state.movements[0].reservedDelta, -2);
  assert.equal(state.movements[0].soldDelta, 2);
});

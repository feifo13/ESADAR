import { findInventoryByArticleId } from './inventory.repository.js';

function normalizeArticleId(value) {
  const articleId = Number(value);
  if (!Number.isSafeInteger(articleId) || articleId <= 0) {
    throw new TypeError('Inventory operation articleId must be a positive integer.');
  }
  return articleId;
}

export function sortInventoryOperationsCanonical(operations = []) {
  return operations
    .map((operation, originalIndex) => ({
      operation,
      originalIndex,
      articleId: normalizeArticleId(operation?.articleId),
    }))
    .sort((left, right) =>
      left.articleId - right.articleId
      || left.originalIndex - right.originalIndex)
    .map(({ operation }) => operation);
}

export function aggregateInventoryOperationsCanonical(items = []) {
  const quantitiesByArticle = new Map();

  for (const item of items) {
    if (item?.articleId == null) continue;
    const articleId = normalizeArticleId(item.articleId);
    quantitiesByArticle.set(
      articleId,
      Number(quantitiesByArticle.get(articleId) || 0)
        + Number(item.quantity || 0),
    );
  }

  return sortInventoryOperationsCanonical(
    [...quantitiesByArticle.entries()].map(([articleId, quantity]) => ({
      articleId,
      quantity,
    })),
  );
}

export async function lockInventoryOperationsCanonical(
  connection,
  operations = [],
) {
  const canonicalOperations = sortInventoryOperationsCanonical(operations);
  const lockedArticleIds = new Set();

  for (const operation of canonicalOperations) {
    const articleId = normalizeArticleId(operation.articleId);
    if (lockedArticleIds.has(articleId)) continue;

    await findInventoryByArticleId(connection, articleId, {
      forUpdate: true,
    });
    lockedArticleIds.add(articleId);
  }

  return canonicalOperations;
}

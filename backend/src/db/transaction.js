import { pool } from './pool.js';

export async function withTransaction(handler, connectionPool = pool) {
  const connection = await connectionPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

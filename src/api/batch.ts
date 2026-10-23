import { writeBatch, type WriteBatch } from 'firebase/firestore';
import { db } from '../firebase';

const chunkSize = 400;

export async function commitBatched(
  operations: Array<(batch: WriteBatch) => void>,
  extraOnLast?: (batch: WriteBatch) => void,
) {
  if (operations.length === 0) {
    if (!extraOnLast) {
      return;
    }

    const batch = writeBatch(db);
    extraOnLast(batch);
    await batch.commit();
    return;
  }

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => operation(batch));

    if (index + chunkSize >= operations.length) {
      extraOnLast?.(batch);
    }

    await batch.commit();
  }
}

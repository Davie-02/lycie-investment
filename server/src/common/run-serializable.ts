import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Runs `work` inside a Serializable-isolation database transaction.
 *
 * Why this exists: some operations follow a "check something, then act on
 * it" shape — e.g. "check this payment hasn't been reviewed yet, then mark
 * it reviewed and credit the account", or "check no other booking overlaps
 * these dates, then confirm this one". If two people trigger the same
 * operation at almost exactly the same moment, both could pass the check
 * before either one writes — resulting in a payment approved twice, or a
 * vehicle double-booked. Wrapping the check-and-write in a Serializable
 * transaction tells Postgres to guarantee that can't happen: it detects the
 * conflict and forces one of the two attempts to fail cleanly (Prisma error
 * code P2034) so it can be retried, rather than letting both succeed.
 *
 * Use this any time a new feature has that "check an invariant, then write
 * based on it" shape and getting it wrong would cause real damage (money,
 * double bookings, an account with no owner, etc).
 */
export async function runSerializable<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const attempt = () =>
    prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  try {
    return await attempt();
  } catch (err) {
    // P2034 = "transaction failed due to a write conflict" — the expected,
    // safe outcome when two of these raced each other. Retry once: the
    // retry will see the other transaction's now-committed result and
    // either succeed normally or fail with a normal business-logic error
    // (e.g. "already reviewed"), rather than a confusing raw DB error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return await attempt();
    }
    throw err;
  }
}

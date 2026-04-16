import { Types } from "mongoose";

interface CursorPaginationOptions {
  cursor?: string; // Last document's _id from previous page
  limit: number;
}

interface CursorPaginationResult<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
    limit: number;
  };
}

// ─── Build MongoDB query filter from cursor ───────────────────────

export const buildCursorFilter = (cursor?: string): object => {
  if (!cursor) return {};
  // Return documents with _id < cursor (for descending sort)
  return { _id: { $lt: new Types.ObjectId(cursor) } };
};

// ─── Build pagination meta from results ──────────────────────────

export const buildPaginationMeta = <T extends { _id: unknown }>(
  data: T[],
  limit: number,
): CursorPaginationResult<T>["meta"] => {
  const hasMore = data.length > limit;
  // We fetch limit+1 — if we got more than limit, there's a next page
  const trimmed = hasMore ? data.slice(0, limit) : data;
  const lastItem = trimmed[trimmed.length - 1];

  return {
    hasMore,
    nextCursor: hasMore && lastItem ? String(lastItem._id) : null,
    limit,
  };
};

/*
  USAGE in a service:
  ─────────────────────────────────────────────────────────────────
  const { cursor, limit = 20 } = query;

  const cursorFilter = buildCursorFilter(cursor);

  // Fetch limit+1 to detect if there's a next page
  const transactions = await Transaction.find({
    'sender.userId': userId,
    ...cursorFilter,
  })
    .sort({ _id: -1 })        // Newest first (descending by _id)
    .limit(limit + 1)         // +1 to check for next page
    .lean();

  const meta = buildPaginationMeta(transactions, limit);
  const data = transactions.slice(0, limit);  // Return only limit items

  Why cursor-based instead of page-based?
  ─────────────────────────────────────────
  Page-based: SKIP(page * limit) — at page 500 with 10,000 records,
    MongoDB skips 5,000 documents. Performance degrades linearly.
  Cursor-based: _id < lastSeenId — MongoDB jumps directly to that
    position via the index. O(1) regardless of page depth.
  Fintech transaction histories grow very long. Cursor is mandatory.
*/

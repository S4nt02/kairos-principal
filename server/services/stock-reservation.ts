/**
 * Stock Reservation Service
 *
 * Implements the 10-minute stock hold pattern:
 *   1. reserveStock()     — atomic SELECT FOR UPDATE + decrement + INSERT reservation
 *   2. confirmReservations() — called by MP webhook on payment approved
 *   3. releaseReservations() — called by cron job every 60s to roll back expired holds
 *   4. releaseOrderReservations() — called on payment rejected/cancelled
 */

import { db } from "../db";
import {
  wireoOptions, addonItems, stockReservations,
} from "../../shared/schema";
import { eq, and, lt, isNull, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { log } from "../index";

export type ReservableEntityType = "wireo_option" | "addon_item";

export interface ReserveItem {
  entityType: ReservableEntityType;
  entityId: string;
  quantity: number;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly entityType: ReservableEntityType,
    public readonly entityId: string,
  ) {
    super(`Estoque insuficiente: ${entityType} ${entityId}`);
    this.name = "InsufficientStockError";
  }
}

function tableFor(entityType: ReservableEntityType) {
  switch (entityType) {
    case "wireo_option": return wireoOptions;
    case "addon_item":   return addonItems;
  }
}

/**
 * Reserves stock for a list of items inside a provided transaction.
 * Uses SELECT FOR UPDATE to prevent race conditions.
 * Called inside db.transaction() at checkout time.
 */
export async function reserveStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  cartSessionId: string,
  items: ReserveItem[],
): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes

  for (const item of items) {
    const table = tableFor(item.entityType);

    // Lock the row to prevent concurrent reads of the same stock
    const rows = await tx
      .select({ id: table.id, stockQuantity: table.stockQuantity })
      .from(table as any)
      .where(eq((table as any).id, item.entityId))
      .for("update");

    if (rows.length === 0) {
      throw new InsufficientStockError(item.entityType, item.entityId);
    }

    const current = rows[0].stockQuantity;
    if (current < item.quantity) {
      throw new InsufficientStockError(item.entityType, item.entityId);
    }

    // Decrement stock
    await tx
      .update(table as any)
      .set({ stockQuantity: sql`${(table as any).stockQuantity} - ${item.quantity}` })
      .where(eq((table as any).id, item.entityId));

    // Record reservation
    await tx.insert(stockReservations).values({
      cartSessionId,
      entityType: item.entityType,
      entityId: item.entityId,
      quantity: item.quantity,
      expiresAt,
    });
  }
}

/**
 * Marks reservations as confirmed (permanent) when MP payment is approved.
 * Sets confirmedAt so the cron job skips them.
 */
export async function confirmReservations(cartSessionId: string): Promise<void> {
  await db
    .update(stockReservations)
    .set({ confirmedAt: new Date() })
    .where(
      and(
        eq(stockReservations.cartSessionId, cartSessionId),
        isNull(stockReservations.confirmedAt),
      ),
    );
}

/**
 * Releases stock reservations (returns quantity to stock).
 * Called when payment is rejected/cancelled.
 */
export async function releaseOrderReservations(cartSessionId: string): Promise<void> {
  const expired = await db
    .select()
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.cartSessionId, cartSessionId),
        isNull(stockReservations.confirmedAt),
      ),
    );

  if (expired.length === 0) return;

  await db.transaction(async (tx) => {
    for (const r of expired) {
      const table = tableFor(r.entityType as ReservableEntityType);
      await tx
        .update(table as any)
        .set({ stockQuantity: sql`${(table as any).stockQuantity} + ${r.quantity}` })
        .where(eq((table as any).id, r.entityId));
    }
    await tx
      .delete(stockReservations)
      .where(
        inArray(
          stockReservations.id,
          expired.map((r) => r.id),
        ),
      );
  });
}

/**
 * Cron function: releases all expired reservations that have not been confirmed.
 * Should be called every 60 seconds via setInterval in server/index.ts.
 */
export async function releaseExpiredReservations(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(stockReservations)
    .where(
      and(
        lt(stockReservations.expiresAt, now),
        isNull(stockReservations.confirmedAt),
      ),
    );

  if (expired.length === 0) return;

  await db.transaction(async (tx) => {
    for (const r of expired) {
      const table = tableFor(r.entityType as ReservableEntityType);
      await tx
        .update(table as any)
        .set({ stockQuantity: sql`${(table as any).stockQuantity} + ${r.quantity}` })
        .where(eq((table as any).id, r.entityId));
    }
    await tx
      .delete(stockReservations)
      .where(
        inArray(
          stockReservations.id,
          expired.map((r) => r.id),
        ),
      );
  });

  log(`[StockReservation] Released ${expired.length} expired reservation(s)`, "cron");
}
